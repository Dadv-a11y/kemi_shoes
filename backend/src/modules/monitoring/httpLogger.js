import { randomUUID } from 'node:crypto';
import pinoHttp from 'pino-http';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { recordRequest } from './requestStats.js';

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{8,64}$/;
// Paramètres d'URL sensibles (callback OAuth, liens de paiement) : valeur masquée dans les logs.
const SENSITIVE_QUERY = /([?&](?:code|token|state|reference|access_token)=)[^&]*/gi;
const safeUrl = (url = '') => url.replace(SENSITIVE_QUERY, '$1[REDACTED]');

/**
 * Journal HTTP : une ligne par requête terminée, avec identifiant de requête
 * (repris de X-Request-Id s'il est valide, sinon généré, et renvoyé au client),
 * route, statut, durée et utilisateur. Niveau error ≥ 500, warn ≥ 400.
 * Monté en tout premier pour couvrir aussi les erreurs de parsing et de CORS.
 */
export const httpLogger = pinoHttp({
  logger,
  genReqId(req, res) {
    const incoming = req.headers['x-request-id'];
    const id = typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  autoLogging: { ignore: (req) => req.method === 'OPTIONS' || req.url === '/health' },
  customLogLevel(req, res, err) {
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    // Images servies avec succès : trop nombreuses pour être utiles (les échecs restent journalisés).
    if (req.url?.startsWith('/uploads/')) return 'silent';
    return 'info';
  },
  customAttributeKeys: { reqId: 'requestId', responseTime: 'durationMs' },
  customProps: (req) => ({
    requestId: req.id,
    source: 'backend',
    route: req.route?.path ? `${req.baseUrl}${req.route.path}` : undefined,
    userId: req.user?.id,
    role: req.user?.role,
  }),
  customSuccessMessage: (req, res, responseTime) => `${req.method} ${safeUrl(req.originalUrl ?? req.url)} ${res.statusCode} ${Math.round(responseTime)}ms`,
  customErrorMessage: (req, res) => `${req.method} ${safeUrl(req.originalUrl ?? req.url)} ${res.statusCode}`,
  serializers: {
    req: (req) => ({ method: req.method, url: safeUrl(req.url), ip: req.remoteAddress, userAgent: req.headers?.['user-agent'] }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});

/** Statistiques de l'écran Santé et signalement des requêtes lentes. */
export function requestStatsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    if (req.method === 'OPTIONS' || req.path === '/health') return;
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    recordRequest({ status: res.statusCode, durationMs, slowThresholdMs: env.SLOW_REQUEST_MS });
    if (durationMs >= env.SLOW_REQUEST_MS) {
      logger.warn({ requestId: req.id, source: 'backend', url: safeUrl(req.originalUrl), durationMs: Math.round(durationMs), statusCode: res.statusCode }, 'slow_request');
    }
  });
  next();
}
