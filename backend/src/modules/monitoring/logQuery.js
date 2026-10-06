import fs from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { LOG_DIR } from '../../config/logger.js';
import { listLogFiles } from './logMaintenance.js';

const LEVELS = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60 };
const levelValue = (level) => (typeof level === 'number' ? level : LEVELS[level] ?? 30);
const levelName = (level) => (typeof level === 'string' ? level : Object.keys(LEVELS).find((name) => LEVELS[name] === level) ?? 'info');

async function readLines(file) {
  const buffer = await fs.readFile(path.join(LOG_DIR, file.name));
  return (file.compressed ? gunzipSync(buffer) : buffer).toString('utf8').split('\n');
}

function statusOf(entry) {
  return entry.res?.statusCode ?? entry.statusCode;
}

function matches(entry, raw, filters) {
  if (filters.minLevel && levelValue(entry.level) < filters.minLevel) return false;
  if (filters.source && (entry.source ?? 'backend') !== filters.source) return false;
  if (filters.requestId && entry.requestId !== filters.requestId) return false;
  if (filters.from && entry.time < filters.from) return false;
  if (filters.to && entry.time > filters.to) return false;
  if (filters.before && entry.time >= filters.before) return false;
  if (filters.after && entry.time <= filters.after) return false;
  if (filters.slowMs && !(entry.durationMs >= filters.slowMs)) return false;
  if (filters.status) {
    const status = statusOf(entry);
    if (!status) return false;
    if (/^[1-5]xx$/.test(filters.status) ? String(status)[0] !== filters.status[0] : String(status) !== filters.status) return false;
  }
  if (filters.q && !raw.toLowerCase().includes(filters.q)) return false;
  return true;
}

/**
 * Recherche dans les fichiers de log (y compris compressés), du plus récent au
 * plus ancien. S'arrête dès que les fichiers restants ne peuvent plus contenir
 * d'entrée plus récente que celles déjà retenues.
 *  - `before` : pagination vers le passé (heure ISO de la dernière entrée affichée) ;
 *  - `after`  : suivi en direct (entrées postérieures à la plus récente affichée).
 */
export async function queryLogs({ level, source, requestId, from, to, before, after, status, q, slowMs, limit = 100 } = {}) {
  const filters = {
    minLevel: level ? levelValue(level) : undefined, source, requestId, from, to, before, after, status, slowMs,
    q: q ? q.toLowerCase() : undefined,
  };
  const files = await listLogFiles();
  const found = [];
  for (const [index, file] of files.entries()) {
    if (filters.from && file.modifiedAt < filters.from) continue; // fichier entièrement plus ancien
    const lines = await readLines(file);
    lines.forEach((raw, lineNo) => {
      if (!raw.trim()) return;
      let entry;
      try {
        entry = JSON.parse(raw);
      } catch {
        return; // ligne tronquée (écriture en cours)
      }
      if (!entry || typeof entry !== 'object' || typeof entry.time !== 'string') return; // pas une entrée de log
      if (matches(entry, raw, filters)) found.push({ id: `${file.name}:${lineNo}`, file: file.name, ...entry, level: levelName(entry.level) });
    });
    found.sort((a, b) => (b.time ?? '').localeCompare(a.time ?? ''));
    const next = files[index + 1];
    if (found.length >= limit && next && next.modifiedAt < found[limit - 1].time) break;
  }
  const items = found.slice(0, limit);
  return { items, hasMore: found.length > limit, nextBefore: items.at(-1)?.time ?? null };
}
