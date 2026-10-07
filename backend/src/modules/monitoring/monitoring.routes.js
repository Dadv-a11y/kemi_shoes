import { createReadStream } from 'node:fs';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env, isTest } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { audit } from '../../middleware/audit.js';
import { notFound } from '../../middleware/errorHandler.js';
import { queryLogs } from './logQuery.js';
import { currentLogFile, listLogFiles, purgeLogs, resolveLogFile } from './logMaintenance.js';
import { getHealth, listAudit } from './monitoring.service.js';
import { reportAlert } from './alerts.js';
import { checkSmtp, mailer, smtpSummary } from '../notifications/mailer.js';

const smtpTestSchema = z.object({ body: z.object({ to: z.string().email().optional() }) });

const isoDate = z.string().datetime({ offset: true });

const logsQuerySchema = z.object({
  query: z.object({
    level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).optional(),
    source: z.enum(['backend', 'frontend-browser', 'frontend-server']).optional(),
    requestId: z.string().max(64).optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    before: isoDate.optional(),
    after: isoDate.optional(),
    status: z.string().regex(/^([1-5]xx|[1-5]\d\d)$/).optional(),
    q: z.string().max(200).optional(),
    slowMs: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
  }),
});
const fileParams = z.object({ params: z.object({ name: z.string().max(120) }) });
const purgeSchema = z.object({ body: z.object({ olderThanDays: z.number().int().min(1).max(365) }) });
const auditSchema = z.object({
  query: z.object({
    action: z.string().max(80).optional(),
    actor: z.string().max(120).optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
  }),
});
const clientErrorSchema = z.object({
  body: z.object({
    message: z.string().min(1).max(1000),
    stack: z.string().max(8000).optional(),
    url: z.string().max(500).optional(),
    kind: z.enum(['error', 'unhandledrejection', 'render', 'server']).default('error'),
    digest: z.string().max(100).optional(),
    route: z.string().max(300).optional(),
    method: z.string().max(10).optional(),
  }),
});

// Remontée d'erreurs du frontend : publique, donc strictement limitée (anti-saturation des logs).
const clientErrorLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Trop de rapports d’erreur.' } },
});

/** Le serveur Next (Vercel) s'authentifie avec LOG_INGEST_KEY : ses erreurs sont « frontend-server ». */
function isTrustedFrontendServer(req) {
  const key = req.headers['x-log-ingest-key'];
  if (!env.LOG_INGEST_KEY || typeof key !== 'string' || key.length !== env.LOG_INGEST_KEY.length) return false;
  return timingSafeEqual(Buffer.from(key), Buffer.from(env.LOG_INGEST_KEY));
}

const router = Router();

router.post('/client-errors', clientErrorLimiter, validate(clientErrorSchema), (req, res) => {
  const trusted = isTrustedFrontendServer(req);
  const source = trusted ? 'frontend-server' : 'frontend-browser';
  const { message, stack, url, kind, digest, route, method } = req.body;
  logger.error({
    source,
    requestId: req.id,
    client: { url, kind, digest, route, method, userAgent: req.headers['user-agent'], ip: req.ip },
    err: { message, stack },
  }, `frontend_error: ${message.slice(0, 200)}`);
  // Seules les erreurs du serveur Next (authentifiées) déclenchent une alerte e-mail :
  // les rapports navigateur sont anonymes et pourraient être falsifiés.
  if (trusted) reportAlert({ source, title: `Erreur de rendu ${method ?? ''} ${route ?? url ?? ''}`.trim(), message, requestId: digest });
  res.status(204).send();
});

// --- Réservé à l'équipe technique (rôle DEV) ---
router.use(requireAuth, requireRole('DEV'));

router.get('/logs', validate(logsQuerySchema), async (req, res) => {
  res.json(await queryLogs(req.query));
});

router.get('/logs/files', async (req, res) => {
  res.json({ files: await listLogFiles(), current: await currentLogFile() });
});

router.get('/logs/files/:name', validate(fileParams), async (req, res) => {
  const file = await resolveLogFile(req.params.name);
  if (!file) throw notFound('Fichier de log introuvable.');
  audit(req, { action: 'monitoring.log_downloaded', entityType: 'LogFile', entityId: req.params.name });
  res.setHeader('Content-Type', req.params.name.endsWith('.gz') ? 'application/gzip' : 'application/x-ndjson');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.name}"`);
  createReadStream(file).pipe(res);
});

router.delete('/logs/files/:name', validate(fileParams), async (req, res) => {
  const deleted = await purgeLogs(0, req.params.name);
  if (!deleted.length) throw notFound('Fichier introuvable ou en cours d’écriture.');
  audit(req, { action: 'monitoring.log_deleted', entityType: 'LogFile', entityId: req.params.name });
  res.status(204).send();
});

router.post('/logs/purge', validate(purgeSchema), async (req, res) => {
  const deleted = await purgeLogs(req.body.olderThanDays);
  audit(req, { action: 'monitoring.logs_purged', entityType: 'LogFile', metadata: { olderThanDays: req.body.olderThanDays, deleted } });
  res.json({ deleted });
});

router.get('/health', async (req, res) => {
  res.json(await getHealth());
});

// Teste le SMTP (connexion + authentification) et, si une adresse est fournie, envoie un message d'essai.
router.post('/smtp-test', validate(smtpTestSchema), async (req, res) => {
  const result = await checkSmtp();
  let sent = null;
  if (result.ok && req.body.to) {
    try {
      await mailer.send({ to: req.body.to, subject: 'KEMI SHOES — test SMTP', html: '<p>Le serveur SMTP est correctement configuré.</p>' });
      sent = true;
    } catch (error) {
      sent = false;
      result.ok = false;
      result.error = error.message;
      result.code = error.code ?? null;
    }
  }
  audit(req, { action: 'monitoring.smtp_tested', entityType: 'Smtp', metadata: { ok: result.ok } });
  res.json({ ...result, sent, smtp: smtpSummary() });
});

router.get('/audit', validate(auditSchema), async (req, res) => {
  res.json(await listAudit(req.query));
});

export default router;
