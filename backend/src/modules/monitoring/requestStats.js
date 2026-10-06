// Statistiques glissantes des requêtes (60 dernières minutes, une case par minute),
// en mémoire : suffisant pour l'écran « Santé » sans base de séries temporelles.
const WINDOW_MINUTES = 60;
const buckets = new Map(); // minute (epoch / 60 000) → { requests, errors, clientErrors, totalMs, slow }

function bucketFor(minute) {
  let bucket = buckets.get(minute);
  if (!bucket) {
    bucket = { requests: 0, errors: 0, clientErrors: 0, totalMs: 0, slow: 0 };
    buckets.set(minute, bucket);
    for (const key of buckets.keys()) if (key <= minute - WINDOW_MINUTES) buckets.delete(key);
  }
  return bucket;
}

export function recordRequest({ status, durationMs, slowThresholdMs }) {
  const bucket = bucketFor(Math.floor(Date.now() / 60000));
  bucket.requests += 1;
  bucket.totalMs += durationMs;
  if (status >= 500) bucket.errors += 1;
  else if (status >= 400) bucket.clientErrors += 1;
  if (durationMs >= slowThresholdMs) bucket.slow += 1;
}

/** Série minute par minute (les minutes sans trafic valent 0) et totaux sur 15 et 60 min. */
export function getRequestStats(now = Date.now()) {
  const current = Math.floor(now / 60000);
  const series = [];
  for (let minute = current - WINDOW_MINUTES + 1; minute <= current; minute += 1) {
    const bucket = buckets.get(minute) ?? { requests: 0, errors: 0, clientErrors: 0, totalMs: 0, slow: 0 };
    series.push({ minute: new Date(minute * 60000).toISOString(), ...bucket, totalMs: Math.round(bucket.totalMs), avgMs: bucket.requests ? Math.round(bucket.totalMs / bucket.requests) : 0 });
  }
  const sum = (items) => items.reduce((total, item) => ({
    requests: total.requests + item.requests, errors: total.errors + item.errors,
    clientErrors: total.clientErrors + item.clientErrors, slow: total.slow + item.slow, totalMs: total.totalMs + item.totalMs,
  }), { requests: 0, errors: 0, clientErrors: 0, slow: 0, totalMs: 0 });
  const summarize = (items) => {
    const total = sum(items);
    return { ...total, totalMs: Math.round(total.totalMs), avgMs: total.requests ? Math.round(total.totalMs / total.requests) : 0, errorRate: total.requests ? total.errors / total.requests : 0 };
  };
  return { series, last15: summarize(series.slice(-15)), last60: summarize(series) };
}

export function resetRequestStats() {
  buckets.clear();
}
