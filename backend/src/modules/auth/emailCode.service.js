import { randomUUID, randomInt, createHmac } from 'node:crypto';
import { get, run } from '../../db/client.js';
import { env } from '../../config/env.js';
import { AppError, badRequest } from '../../middleware/errorHandler.js';
import { logger } from '../../config/logger.js';
import { mailer, isSmtpConfigured } from '../notifications/mailer.js';

// Même principe que les codes SMS : seul un HMAC du code est stocké.
const hashCode = (email, code) => createHmac('sha256', env.JWT_ACCESS_SECRET).update(`email:${email}:${code}`).digest('hex');
const generateCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

/**
 * 'on' : l'adresse doit être confirmée par un code reçu par e-mail avant l'ouverture de session
 * (évite les inscriptions avec l'adresse d'un tiers et les envois indésirables).
 * 'off' : développement sans SMTP. 'unavailable' : vérification voulue mais SMTP absent.
 */
export function emailVerificationMode() {
  if (env.EMAIL_VERIFICATION === 'off') return 'off';
  const wanted = env.EMAIL_VERIFICATION === 'on' || isSmtpConfigured() || env.NODE_ENV === 'production';
  if (!wanted) return 'off';
  return isSmtpConfigured() || env.NODE_ENV === 'test' ? 'on' : 'unavailable';
}

/** Émet un code (un nouveau seulement si le précédent a expiré ou est épuisé) et l'envoie par e-mail. */
export async function sendEmailCode(email) {
  const pending = await get(
    `SELECT expiresAt FROM EmailCode WHERE email = ? AND consumed = 0 AND attempts < ? ORDER BY createdAt DESC LIMIT 1`,
    [email, env.OTP_MAX_ATTEMPTS]
  );
  if (pending && new Date(pending.expiresAt).getTime() > Date.now()) {
    return { expiresAt: new Date(pending.expiresAt).toISOString(), resent: false };
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + env.OTP_TTL_MINUTES * 60 * 1000).toISOString();
  const id = randomUUID();
  await run(`INSERT INTO EmailCode (id, email, codeHash, expiresAt) VALUES (?, ?, ?, ?)`, [id, email, hashCode(email, code), expiresAt]);
  try {
    await mailer.sendEmailVerification({ to: email, code, ttlMinutes: env.OTP_TTL_MINUTES });
  } catch (err) {
    await run(`DELETE FROM EmailCode WHERE id = ?`, [id]);
    logger.error({ err: err.message, email }, 'email_code_delivery_failed');
    throw new AppError('Impossible d’envoyer le code par e-mail pour le moment, réessayez.', 502, 'EMAIL_DELIVERY_FAILED');
  }
  return { expiresAt, resent: true };
}

export async function verifyEmailCode(email, code) {
  const record = await get(`SELECT * FROM EmailCode WHERE email = ? AND consumed = 0 ORDER BY createdAt DESC LIMIT 1`, [email]);
  if (!record) throw badRequest('Aucun code en attente pour cette adresse.');
  if (record.attempts >= env.OTP_MAX_ATTEMPTS) throw badRequest('Nombre maximal de tentatives atteint, redemandez un code.');
  if (new Date(record.expiresAt).getTime() < Date.now()) throw badRequest('Ce code a expiré, redemandez-en un.');
  if (record.codeHash !== hashCode(email, code)) {
    await run(`UPDATE EmailCode SET attempts = attempts + 1 WHERE id = ?`, [record.id]);
    throw badRequest('Code incorrect.');
  }
  await run(`UPDATE EmailCode SET consumed = 1 WHERE id = ?`, [record.id]);
  return true;
}
