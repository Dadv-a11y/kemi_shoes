import pino from 'pino';
import { env, isTest } from './env.js';

// En test on coupe le bruit ; en dev on garde un rendu simple sans dépendance
// supplémentaire (pino-pretty) pour rester "léger" comme demandé.
export const logger = pino({
  level: isTest ? 'silent' : env.LOG_LEVEL,
  base: { service: 'kemi-shoes-backend' },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    // Ne jamais logger de secrets/PII sensibles en clair (OWASP A09 - logging &
    // monitoring failures / exposition de données sensibles dans les logs).
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'passwordHash',
      'codeHash',
      '*.password',
      '*.passwordHash',
    ],
    censor: '[REDACTED]',
  },
});

/**
 * Logger d'audit dédié : une ligne structurée par action sensible
 * (création/édition produit, changement de statut commande, changement de rôle...).
 * Séparé du logger applicatif pour pouvoir router/retenir différemment (conformité).
 */
export const auditLogger = logger.child({ stream: 'audit' });