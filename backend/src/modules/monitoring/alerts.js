import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { all } from '../../db/client.js';
import { mailer } from '../notifications/mailer.js';

/**
 * Alertes e-mail sur erreur serveur, regroupées : la première erreur part tout de
 * suite, les suivantes sont cumulées et envoyées en un seul récapitulatif au plus
 * toutes les ALERT_THROTTLE_MINUTES (pas de rafale de mails lors d'une panne).
 */
const MAX_PENDING = 50;
let pending = [];
let dropped = 0;
let lastSentAt = 0;
let timer = null;

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

async function recipients() {
  if (env.ALERT_EMAILS) return env.ALERT_EMAILS.split(',').map((email) => email.trim()).filter(Boolean);
  const rows = await all(`SELECT email FROM User WHERE role = 'DEV' AND email IS NOT NULL`);
  return rows.map((row) => row.email);
}

function render(batch, skipped) {
  const rows = batch.map((event) => `
    <tr>
      <td>${escapeHtml(event.time)}</td><td>${escapeHtml(event.source)}</td>
      <td><strong>${escapeHtml(event.title)}</strong><br>${escapeHtml(event.message)}</td>
      <td>${escapeHtml(event.route ?? '')}</td><td><code>${escapeHtml(event.requestId ?? '')}</code></td>
    </tr>`).join('');
  return `
    <p>${batch.length} erreur(s) détectée(s) sur KEMI SHOES${skipped ? ` (+${skipped} non détaillée(s))` : ''}.</p>
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:13px">
      <tr><th>Heure</th><th>Source</th><th>Erreur</th><th>Route</th><th>Référence</th></tr>${rows}
    </table>
    <p>Détail complet : écran Supervision › Logs, recherche par référence.</p>`;
}

export async function flushAlerts() {
  timer = null;
  if (!pending.length) return;
  const batch = pending;
  const skipped = dropped;
  pending = [];
  dropped = 0;
  lastSentAt = Date.now();
  try {
    const to = await recipients();
    if (!to.length) return logger.warn({ count: batch.length }, 'alert_no_recipient');
    await mailer.send({ to: to.join(','), subject: `[KEMI SHOES] ${batch.length} erreur(s) serveur`, html: render(batch, skipped) });
  } catch (err) {
    // Jamais d'erreur « error » ici : elle redéclencherait une alerte.
    logger.warn({ err }, 'alert_email_failed');
  }
}

/** @param {{ title: string, message?: string, requestId?: string, route?: string, source?: string }} event */
export function reportAlert(event) {
  if (pending.length >= MAX_PENDING) dropped += 1;
  else pending.push({ time: new Date().toISOString(), source: 'backend', ...event });
  if (timer) return;
  const wait = lastSentAt + env.ALERT_THROTTLE_MINUTES * 60000 - Date.now();
  if (wait <= 0) {
    timer = setTimeout(flushAlerts, 0);
  } else {
    timer = setTimeout(flushAlerts, wait);
  }
  timer.unref?.();
}

// Tests : état interne remis à zéro.
export function resetAlerts() {
  if (timer) clearTimeout(timer);
  pending = [];
  dropped = 0;
  lastSentAt = 0;
  timer = null;
}
