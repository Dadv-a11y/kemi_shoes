import { randomUUID } from 'node:crypto';
import { setupTestDb } from '../testDb.js';
import { run } from '../../src/db/client.js';
import { requireAuth, optionalAuth, requireRole } from '../../src/middleware/auth.js';
import { signAccessToken } from '../../src/utils/tokens.js';
import { createSession, revokeSession } from '../../src/modules/auth/session.service.js';

setupTestDb();

// Crée un utilisateur et une session réelle : requireAuth vérifie la session en base.
async function sessionFor(role) {
  const id = randomUUID();
  await run(`INSERT INTO User (id, name, email, role) VALUES (?, 'Test', ?, ?)`, [id, `${id}@test.local`, role]);
  const { accessToken } = await createSession({ id, role });
  return { id, accessToken };
}

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

describe('requireAuth', () => {
  test('rejette avec 401 si aucun header Authorization', async () => {
    const req = { headers: {} };
    const res = mockRes();
    const next = jest.fn();
    await requireAuth(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(401);
  });

  test('rejette avec 401 si le token est invalide', async () => {
    const req = { headers: { authorization: 'Bearer not-a-real-token' } };
    const res = mockRes();
    const next = jest.fn();
    await requireAuth(req, res, next);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(401);
  });

  test('attache req.user et appelle next() sans erreur si le token est valide', async () => {
    const { id, accessToken } = await sessionFor('ADMIN');
    const req = { headers: { authorization: `Bearer ${accessToken}` } };
    const res = mockRes();
    const next = jest.fn();
    await requireAuth(req, res, next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toMatchObject({ id, role: 'ADMIN' });
  });

  test('rejette avec 401 un token dont la session a été révoquée', async () => {
    const { accessToken } = await sessionFor('CUSTOMER');
    const req = { headers: { authorization: `Bearer ${accessToken}` } };
    const first = jest.fn();
    await requireAuth(req, mockRes(), first);
    expect(first).toHaveBeenCalledWith();
    await revokeSession(req.user.sessionId);
    const next = jest.fn();
    await requireAuth({ headers: req.headers }, mockRes(), next);
    expect(next.mock.calls[0][0].statusCode).toBe(401);
  });

  test('rejette un token signé sans session (ancien format)', async () => {
    const token = signAccessToken({ id: 'user-1', role: 'ADMIN' });
    const next = jest.fn();
    await requireAuth({ headers: { authorization: `Bearer ${token}` } }, mockRes(), next);
    expect(next.mock.calls[0][0].statusCode).toBe(401);
  });
});

describe('optionalAuth', () => {
  test('continue en tant qu’invité (pas d’erreur, pas de req.user) sans token', async () => {
    const req = { headers: {} };
    const next = jest.fn();
    await optionalAuth(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeUndefined();
  });

  test('attache req.user si un token valide est fourni', async () => {
    const { id, accessToken } = await sessionFor('CUSTOMER');
    const req = { headers: { authorization: `Bearer ${accessToken}` } };
    const next = jest.fn();
    await optionalAuth(req, mockRes(), next);
    expect(req.user).toMatchObject({ id, role: 'CUSTOMER' });
  });

  test('un token invalide ne bloque pas la requête (reste invité)', async () => {
    const req = { headers: { authorization: 'Bearer garbage' } };
    const next = jest.fn();
    await optionalAuth(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeUndefined();
  });
});

describe('requireRole', () => {
  test('laisse passer si le rôle correspond', () => {
    const req = { user: { id: 'u1', role: 'ADMIN' } };
    const next = jest.fn();
    requireRole('ADMIN', 'PRODUCT_MANAGER')(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  test('renvoie 403 si le rôle ne correspond pas', () => {
    const req = { user: { id: 'u1', role: 'CUSTOMER' } };
    const next = jest.fn();
    requireRole('ADMIN')(req, mockRes(), next);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });

  test('renvoie 401 si req.user est absent (fail-closed)', () => {
    const req = {};
    const next = jest.fn();
    requireRole('ADMIN')(req, mockRes(), next);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(401);
  });
});