import fs from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { setupTestDb } from '../testDb.js';
import { run } from '../../src/db/client.js';
import { app } from '../../src/server.js';
import { LOG_DIR } from '../../src/config/logger.js';
import { queryLogs } from '../../src/modules/monitoring/logQuery.js';
import { listLogFiles, purgeLogs, runLogMaintenance } from '../../src/modules/monitoring/logMaintenance.js';
import { flushAlerts, reportAlert, resetAlerts } from '../../src/modules/monitoring/alerts.js';
import { setTransporter } from '../../src/modules/notifications/mailer.js';

setupTestDb();

const DAY = 24 * 60 * 60 * 1000;
const line = (entry) => (typeof entry === 'string' ? entry : JSON.stringify({ service: 'kemi-shoes-backend', ...entry }));

async function writeLog(name, entries, { ageMs = 0, gzip = false } = {}) {
  const content = `${entries.map(line).join('\n')}\n`;
  const file = path.join(LOG_DIR, name);
  await fs.writeFile(file, gzip ? gzipSync(content) : content);
  const time = new Date(Date.now() - ageMs);
  await fs.utimes(file, time, time);
}

beforeEach(async () => {
  await fs.rm(LOG_DIR, { recursive: true, force: true });
  await fs.mkdir(LOG_DIR, { recursive: true });
});

describe('recherche dans les logs', () => {
  beforeEach(async () => {
    const now = Date.now();
    const iso = (offsetMs) => new Date(now - offsetMs).toISOString();
    await writeLog('kemishoes.2026-01-01.1.log.gz', [
      { level: 'error', time: iso(2 * DAY), msg: 'ancienne erreur compressée', requestId: 'old-req-0001', source: 'backend' },
    ], { ageMs: 2 * DAY - 1000, gzip: true });
    await writeLog('kemishoes.2026-01-02.1.log', [
      { level: 'info', time: iso(3000), msg: 'GET /api/v1/products 200 12ms', requestId: 'req-a-000001', res: { statusCode: 200 }, durationMs: 12, source: 'backend' },
      { level: 'error', time: iso(2000), msg: 'GET /api/v1/orders 500', requestId: 'req-b-000002', res: { statusCode: 500 }, durationMs: 1500, err: { message: 'boom', stack: 'Error: boom' }, source: 'backend' },
      { level: 'error', time: iso(1000), msg: 'frontend_error: x is undefined', source: 'frontend-browser' },
      'ligne tronquée {',
    ]);
  });

  test('du plus récent au plus ancien, y compris les fichiers compressés', async () => {
    const { items } = await queryLogs({ limit: 10 });
    expect(items.map((entry) => entry.msg)).toEqual(['frontend_error: x is undefined', 'GET /api/v1/orders 500', 'GET /api/v1/products 200 12ms', 'ancienne erreur compressée']);
  });

  test('filtres : niveau minimal, source, statut, référence, texte, lenteur', async () => {
    expect((await queryLogs({ level: 'error' })).items).toHaveLength(3);
    expect((await queryLogs({ source: 'frontend-browser' })).items).toHaveLength(1);
    expect((await queryLogs({ status: '5xx' })).items[0].requestId).toBe('req-b-000002');
    expect((await queryLogs({ requestId: 'req-a-000001' })).items).toHaveLength(1);
    expect((await queryLogs({ q: 'BOOM' })).items).toHaveLength(1);
    expect((await queryLogs({ slowMs: 1000 })).items).toHaveLength(1);
  });

  test('période, pagination vers le passé et suivi en direct', async () => {
    expect((await queryLogs({ from: new Date(Date.now() - DAY).toISOString() })).items).toHaveLength(3);
    const first = await queryLogs({ limit: 2 });
    expect(first.hasMore).toBe(true);
    const older = await queryLogs({ limit: 2, before: first.nextBefore });
    expect(older.items.map((entry) => entry.msg)).toEqual(['GET /api/v1/products 200 12ms', 'ancienne erreur compressée']);
    const live = await queryLogs({ after: new Date(Date.now() - 1500).toISOString() });
    expect(live.items).toHaveLength(1);
  });
});

describe('rotation, compression et purge', () => {
  test('compresse les fichiers passés, supprime au-delà de la conservation, garde le fichier courant', async () => {
    await writeLog('kemishoes.2026-01-01.1.log', [{ level: 'info', time: new Date().toISOString(), msg: 'très ancien' }], { ageMs: 20 * DAY });
    await writeLog('kemishoes.2026-01-10.1.log', [{ level: 'info', time: new Date().toISOString(), msg: 'hier' }], { ageMs: DAY });
    await writeLog('kemishoes.2026-01-11.1.log', [{ level: 'info', time: new Date().toISOString(), msg: 'courant' }]);
    const report = await runLogMaintenance({ retentionDays: 14 });
    expect(report.deleted).toEqual(['kemishoes.2026-01-01.1.log']);
    expect(report.compressed).toEqual(['kemishoes.2026-01-10.1.log']);
    const names = (await listLogFiles()).map((file) => file.name).sort();
    expect(names).toEqual(['kemishoes.2026-01-10.1.log.gz', 'kemishoes.2026-01-11.1.log']);
    // Le contenu reste lisible après compression.
    expect((await queryLogs({ q: 'hier' })).items).toHaveLength(1);
  });

  test('la purge ne supprime jamais le fichier en cours d’écriture', async () => {
    await writeLog('kemishoes.2026-01-10.1.log.gz', [{ level: 'info', time: new Date().toISOString(), msg: 'archive' }], { ageMs: 3 * DAY, gzip: true });
    await writeLog('kemishoes.2026-01-11.1.log', [{ level: 'info', time: new Date().toISOString(), msg: 'courant' }], { ageMs: 3 * DAY });
    expect(await purgeLogs(1)).toEqual(['kemishoes.2026-01-10.1.log.gz']);
    expect((await listLogFiles()).map((file) => file.name)).toEqual(['kemishoes.2026-01-11.1.log']);
  });
});

async function sessionFor(role) {
  const email = `${role.toLowerCase()}-${randomUUID().slice(0, 6)}@test.local`;
  const register = await request(app).post('/api/v1/auth/register').send({ name: role, email, password: 'Password123!' });
  await run(`UPDATE User SET role = ? WHERE email = ?`, [role, email]);
  const login = await request(app).post('/api/v1/auth/login').send({ email, password: 'Password123!' });
  return { email, cookie: login.headers['set-cookie'].map((value) => value.split(';')[0]).join('; '), id: register.body.user.id };
}

describe('API de supervision', () => {
  test('réservée au rôle DEV (ADMIN refusé, invité refusé)', async () => {
    await writeLog('kemishoes.2026-01-11.1.log', [{ level: 'info', time: new Date().toISOString(), msg: 'courant' }]);
    const dev = await sessionFor('DEV');
    const admin = await sessionFor('ADMIN');
    expect((await request(app).get('/api/v1/monitoring/logs')).status).toBe(401);
    expect((await request(app).get('/api/v1/monitoring/logs').set('Cookie', admin.cookie)).status).toBe(403);
    const logs = await request(app).get('/api/v1/monitoring/logs').set('Cookie', dev.cookie);
    expect(logs.status).toBe(200);
    expect(logs.body.items[0].msg).toBe('courant');
    const health = await request(app).get('/api/v1/monitoring/health').set('Cookie', dev.cookie);
    expect(health.body).toMatchObject({ database: { ok: true }, logs: { retentionDays: 14 } });
    expect((await request(app).get('/api/v1/monitoring/audit').set('Cookie', dev.cookie)).status).toBe(200);
  });

  test('téléchargement limité aux fichiers listés (pas de traversée de chemin)', async () => {
    await writeLog('kemishoes.2026-01-11.1.log', [{ level: 'info', time: new Date().toISOString(), msg: 'courant' }]);
    const dev = await sessionFor('DEV');
    const ok = await request(app).get('/api/v1/monitoring/logs/files/kemishoes.2026-01-11.1.log').set('Cookie', dev.cookie);
    expect(ok.status).toBe(200);
    expect(ok.text).toContain('courant');
    expect((await request(app).get(`/api/v1/monitoring/logs/files/${encodeURIComponent('../../.env')}`).set('Cookie', dev.cookie)).status).toBe(404);
  });

  test('l’admin peut attribuer le rôle DEV', async () => {
    const admin = await sessionFor('ADMIN');
    const customer = await sessionFor('CUSTOMER');
    const response = await request(app).patch(`/api/v1/users/${customer.id}/role`).set('Cookie', admin.cookie).send({ role: 'DEV' });
    expect(response.status).toBe(200);
    expect(response.body.role).toBe('DEV');
  });

  test('remontée d’erreurs du frontend : validée, publique', async () => {
    expect((await request(app).post('/api/v1/monitoring/client-errors').send({})).status).toBe(400);
    expect((await request(app).post('/api/v1/monitoring/client-errors').send({ message: 'x is undefined', url: '/fr/panier' })).status).toBe(204);
  });
});

describe('alertes e-mail', () => {
  const sent = [];
  beforeAll(() => setTransporter({ sendMail: async (mail) => { sent.push(mail); return { messageId: String(sent.length) }; } }));
  beforeEach(() => { sent.length = 0; resetAlerts(); });

  test('regroupe les erreurs et les envoie aux comptes DEV', async () => {
    const dev = await sessionFor('DEV');
    reportAlert({ title: '500 GET /api/v1/orders', message: 'boom', requestId: 'req-1' });
    reportAlert({ title: '500 GET /api/v1/products', message: '<script>', requestId: 'req-2' });
    await flushAlerts();
    const alerts = sent.filter((mail) => mail.subject.includes('erreur(s) serveur'));
    expect(alerts).toHaveLength(1);
    expect(alerts[0].to).toContain(dev.email);
    expect(alerts[0].subject).toBe('[KEMI SHOES] 2 erreur(s) serveur');
    expect(alerts[0].html).toContain('req-2');
    expect(alerts[0].html).not.toContain('<script>');
  });

  test('une erreur 500 renvoie sa référence et déclenche une alerte', async () => {
    const dev = await sessionFor('DEV');
    // Octet nul dans le slug : PostgreSQL rejette la requête (erreur imprévue → 500).
    const response = await request(app).get('/api/v1/content/%00').set('X-Request-Id', 'test-request-0001');
    expect(response.status).toBe(500);
    expect(response.headers['x-request-id']).toBe('test-request-0001');
    expect(response.body.error.requestId).toBe('test-request-0001');
    // La première alerte part sans attendre, de façon asynchrone.
    const deadline = Date.now() + 2000;
    let alert;
    while (!alert && Date.now() < deadline) {
      alert = sent.find((mail) => mail.subject.includes('erreur(s) serveur'));
      if (!alert) await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(alert?.to).toContain(dev.email);
    expect(alert?.html).toContain('test-request-0001');
  });
});
