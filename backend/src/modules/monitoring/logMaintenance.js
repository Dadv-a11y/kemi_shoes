import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { env } from '../../config/env.js';
import { logger, LOG_DIR, LOG_BASENAME } from '../../config/logger.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const LOG_FILE_PATTERN = new RegExp(`^${LOG_BASENAME}[.-][A-Za-z0-9.-]+\\.log(\\.gz)?$`);

/** Fichiers de log du dossier, du plus récent au plus ancien. */
export async function listLogFiles() {
  let names = [];
  try {
    names = await fs.readdir(LOG_DIR);
  } catch {
    return [];
  }
  const files = await Promise.all(names.filter((name) => LOG_FILE_PATTERN.test(name)).map(async (name) => {
    const stat = await fs.stat(path.join(LOG_DIR, name));
    return { name, size: stat.size, modifiedAt: stat.mtime.toISOString(), compressed: name.endsWith('.gz') };
  }));
  return files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

/** Seuls les noms listés par listLogFiles sont acceptés (aucune traversée de chemin possible). */
export async function resolveLogFile(name) {
  const files = await listLogFiles();
  return files.some((file) => file.name === name) ? path.join(LOG_DIR, name) : null;
}

/** Fichier en cours d'écriture : le plus récent non compressé hors fichier « fatal ». */
export async function currentLogFile() {
  const files = await listLogFiles();
  return files.find((file) => !file.compressed && !file.name.includes('-fatal'))?.name ?? null;
}

async function compress(file) {
  const source = path.join(LOG_DIR, file);
  await pipeline(createReadStream(source), createGzip(), createWriteStream(`${source}.gz`));
  await fs.unlink(source);
}

/**
 * Rotation complémentaire à pino-roll : compresse les fichiers des jours passés
 * et supprime ceux qui dépassent LOG_RETENTION_DAYS. Sans cron (indisponible en
 * mutualisé) : exécuté au démarrage puis toutes les 6 heures.
 */
export async function runLogMaintenance({ retentionDays = env.LOG_RETENTION_DAYS, now = Date.now() } = {}) {
  const files = await listLogFiles();
  const current = await currentLogFile();
  const report = { compressed: [], deleted: [] };
  for (const file of files) {
    const age = now - new Date(file.modifiedAt).getTime();
    if (age > retentionDays * DAY_MS) {
      await fs.unlink(path.join(LOG_DIR, file.name));
      report.deleted.push(file.name);
    } else if (!file.compressed && file.name !== current && !file.name.includes('-fatal') && age > 60 * 60 * 1000) {
      await compress(file.name);
      report.compressed.push(file.name);
    }
  }
  if (report.compressed.length || report.deleted.length) logger.info(report, 'log_maintenance');
  return report;
}

/**
 * Supprime les fichiers plus anciens que `olderThanDays` — ou le seul fichier `onlyName`
 * — sans jamais toucher au fichier en cours d'écriture.
 */
export async function purgeLogs(olderThanDays, onlyName) {
  const files = await listLogFiles();
  const current = await currentLogFile();
  const limit = Date.now() - olderThanDays * DAY_MS;
  const deleted = [];
  for (const file of files) {
    if (onlyName && file.name !== onlyName) continue;
    if (file.name !== current && new Date(file.modifiedAt).getTime() <= limit) {
      await fs.unlink(path.join(LOG_DIR, file.name));
      deleted.push(file.name);
    }
  }
  return deleted;
}

export function scheduleLogMaintenance() {
  const tick = () => runLogMaintenance().catch((err) => logger.warn({ err }, 'log_maintenance_failed'));
  tick();
  setInterval(tick, 6 * 60 * 60 * 1000).unref();
}
