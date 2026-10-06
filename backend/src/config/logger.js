import fs from 'node:fs';
import path from 'node:path';
import pino from 'pino';
import roll from 'pino-roll';
import { env, isTest } from './env.js';

/**
 * Journalisation centralisée (voir DEPLOIEMENT.md › Logs et supervision) :
 * - une ligne JSON par événement (format directement lisible par Grafana Loki / Promtail) ;
 * - écrite dans la console ET dans LOG_DIR/kemishoes.<date>.<n>.log (pino-roll :
 *   nouveau fichier chaque jour ou dès LOG_MAX_SIZE) ; compression et suppression
 *   au-delà de LOG_RETENTION_DAYS par modules/monitoring/logMaintenance.js ;
 * - le fichier est indispensable sur un hébergement mutualisé (Passenger) où la
 *   sortie console n'est pas conservée.
 */
export const LOG_DIR = path.resolve(env.LOG_DIR);
export const LOG_BASENAME = 'kemishoes';
/** Plantages écrits de façon synchrone (le processus s'arrête juste après). */
export const FATAL_LOG = path.join(LOG_DIR, `${LOG_BASENAME}-fatal.log`);

// Ne jamais écrire de secrets ni de données d'authentification (OWASP A09).
const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'password', 'passwordHash', 'codeHash', 'refreshToken', 'accessToken', 'token',
  '*.password', '*.passwordHash', '*.refreshToken', '*.accessToken', '*.token',
];

const options = {
  level: isTest ? 'silent' : env.LOG_LEVEL,
  base: { service: 'kemi-shoes-backend', pid: process.pid },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Niveau en clair (« error ») plutôt qu'en nombre : filtrage plus simple partout.
  formatters: { level: (label) => ({ level: label }) },
  redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
};

async function buildDestination() {
  if (isTest || !env.LOG_TO_FILE) return process.stdout;
  try {
    const fileStream = await roll({
      file: path.join(LOG_DIR, LOG_BASENAME),
      extension: '.log',
      frequency: 'daily',
      dateFormat: 'yyyy-MM-dd',
      size: env.LOG_MAX_SIZE,
      mkdir: true,
    });
    return pino.multistream([{ stream: process.stdout }, { stream: fileStream }]);
  } catch (error) {
    // Dossier non inscriptible : on continue en console plutôt que d'empêcher le démarrage.
    // eslint-disable-next-line no-console
    console.error(`log_file_unavailable (${LOG_DIR}):`, error.message);
    return process.stdout;
  }
}

export const logger = pino(options, await buildDestination());

/**
 * Logger d'audit dédié : une ligne structurée par action sensible
 * (création/édition produit, changement de statut commande, changement de rôle...).
 */
export const auditLogger = logger.child({ stream: 'audit' });

/**
 * Écriture synchrone d'un plantage (exception non gérée, échec au démarrage) :
 * garantie d'être sur disque avant l'arrêt du processus.
 */
export function logFatalSync(message, error) {
  const line = JSON.stringify({
    level: 'fatal',
    time: new Date().toISOString(),
    service: 'kemi-shoes-backend',
    pid: process.pid,
    msg: message,
    err: error ? { type: error.name, message: error.message, stack: error.stack } : undefined,
  });
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(FATAL_LOG, `${line}\n`);
  } catch {
    /* disque indisponible : il reste la console */
  }
  // eslint-disable-next-line no-console
  console.error(line);
}
