import os from 'node:os';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../../config/env.js';
import { LOG_DIR } from '../../config/logger.js';
import { all, get } from '../../db/client.js';
import { getSmsProvider, getWhatsappProvider } from '../notifications/sms/sms.factory.js';
import { listLogFiles } from './logMaintenance.js';
import { getRequestStats } from './requestStats.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const { version } = JSON.parse(readFileSync(path.join(backendRoot, 'package.json'), 'utf8'));

/** État du serveur pour l'écran Santé de la supervision. */
export async function getHealth() {
  const started = process.hrtime.bigint();
  let database = { ok: true, latencyMs: 0 };
  try {
    await get('SELECT 1 AS ok');
    database.latencyMs = Math.round(Number(process.hrtime.bigint() - started) / 1e6);
  } catch (error) {
    database = { ok: false, error: error.message };
  }
  const files = await listLogFiles();
  const memory = process.memoryUsage();
  return {
    version,
    node: process.version,
    environment: env.NODE_ENV,
    pid: process.pid,
    uptimeSeconds: Math.round(process.uptime()),
    startedAt: new Date(Date.now() - process.uptime() * 1000).toISOString(),
    memory: { rssMb: Math.round(memory.rss / 1048576), heapUsedMb: Math.round(memory.heapUsed / 1048576), heapTotalMb: Math.round(memory.heapTotal / 1048576) },
    system: { loadAverage: os.loadavg().map((value) => Math.round(value * 100) / 100), freeMemoryMb: Math.round(os.freemem() / 1048576), totalMemoryMb: Math.round(os.totalmem() / 1048576) },
    database,
    logs: {
      directory: LOG_DIR,
      files: files.length,
      totalSizeMb: Math.round(files.reduce((total, file) => total + file.size, 0) / 10485.76) / 100,
      retentionDays: env.LOG_RETENTION_DAYS,
      maxFileSize: env.LOG_MAX_SIZE,
      level: env.LOG_LEVEL,
    },
    integrations: {
      sms: getSmsProvider()?.name ?? 'none',
      whatsapp: getWhatsappProvider()?.name ?? 'none',
      alertEmails: env.ALERT_EMAILS ? 'ALERT_EMAILS' : 'comptes DEV',
      frontendIngestKey: Boolean(env.LOG_INGEST_KEY),
    },
    requests: getRequestStats(),
    slowRequestMs: env.SLOW_REQUEST_MS,
  };
}

/** Journal d'audit (table AuditLog) filtré et paginé. */
export async function listAudit({ action, actor, from, to, page = 1, pageSize = 25 } = {}) {
  const conditions = [];
  const params = [];
  if (action) { conditions.push('a.action LIKE ?'); params.push(`${action}%`); }
  if (actor) { conditions.push('(u.email ILIKE ? OR a.actorLabel ILIKE ?)'); params.push(`%${actor}%`, `%${actor}%`); }
  if (from) { conditions.push('a.createdAt::timestamptz >= ?::timestamptz'); params.push(from); }
  if (to) { conditions.push('a.createdAt::timestamptz <= ?::timestamptz'); params.push(to); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [items, { total }] = await Promise.all([
    all(
      `SELECT a.id, a.action, a.entityType, a.entityId, a.metadata, a.ip, a.actorLabel, a.createdAt, u.email AS actorEmail, u.name AS actorName
       FROM AuditLog a LEFT JOIN User u ON u.id = a.actorId ${where}
       ORDER BY a.createdAt DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, (page - 1) * pageSize]
    ),
    get(`SELECT COUNT(*) AS total FROM AuditLog a LEFT JOIN User u ON u.id = a.actorId ${where}`, params),
  ]);
  return { items, total: Number(total), page, pageSize };
}
