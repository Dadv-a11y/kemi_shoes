import { randomUUID, randomInt, createHmac } from 'node:crypto';
import { get, run } from '../../db/client.js';
import { env } from '../../config/env.js';
import { AppError, badRequest } from '../../middleware/errorHandler.js';
import { logger } from '../../config/logger.js';
import { isPhoneAuthAvailable } from '../notifications/sms/sms.factory.js';
import { smsSender, whatsappSender } from '../notifications/sms.js';
import { otpRequestsTotal } from '../../config/metrics.js';

// HMAC plutôt que bcrypt pour ces codes courts et à durée de vie très brève :
// bcrypt serait inutilement coûteux ici, l'enjeu est surtout d'éviter de stocker
// le code en clair en base (en cas de fuite de la table OtpCode).
function hashCode(phone, code) {
  return createHmac('sha256', env.JWT_ACCESS_SECRET).update(`${phone}:${code}`).digest('hex');
}

function generateSixDigitCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/**
 * Génère un code, le stocke haché avec une expiration, puis l'envoie par SMS
 * (avec repli WhatsApp si l'envoi SMS échoue). Le code en clair n'est jamais
 * retourné à l'appelant HTTP — uniquement transmis via le canal SMS/WhatsApp.
 */
export async function requestOtp(phone) {
  // Aucun fournisseur SMS/WhatsApp branché (ex. production sans fournisseur choisi).
  if (!isPhoneAuthAvailable()) {
    throw new AppError('La connexion par téléphone n’est pas disponible pour le moment.', 503, 'PHONE_AUTH_UNAVAILABLE');
  }
  // Un nouveau code n'est émis qu'une fois le précédent expiré (ou épuisé) : tant
  // qu'il est valable, on renvoie son échéance sans renvoyer de SMS.
  const pending = await get(
    `SELECT expiresAt FROM OtpCode WHERE phone = ? AND consumed = 0 AND attempts < ? ORDER BY createdAt DESC LIMIT 1`,
    [phone, env.OTP_MAX_ATTEMPTS]
  );
  if (pending && new Date(pending.expiresAt).getTime() > Date.now()) {
    return { expiresAt: new Date(pending.expiresAt).toISOString(), resent: false };
  }

  const code = generateSixDigitCode();
  const expiresAt = new Date(Date.now() + env.OTP_TTL_MINUTES * 60 * 1000).toISOString();

  const id = randomUUID();
  await run(
    `INSERT INTO OtpCode (id, phone, codeHash, expiresAt) VALUES (?, ?, ?, ?)`,
    [id, phone, hashCode(phone, code), expiresAt]
  );

  // SMS d'abord, WhatsApp en repli : seuls les canaux branchés sont essayés.
  const message = `Votre code KEMI SHOES : ${code} (valable ${env.OTP_TTL_MINUTES} minutes)`;
  let delivered = false;
  for (const channel of [smsSender, whatsappSender].filter((candidate) => candidate.available)) {
    try {
      await channel.send(phone, message);
      delivered = true;
      break;
    } catch (err) {
      logger.error({ err, phone }, 'otp_delivery_failed');
    }
  }
  if (!delivered) {
    // Code jamais reçu : on le supprime pour permettre une nouvelle demande immédiate.
    await run(`DELETE FROM OtpCode WHERE id = ?`, [id]);
    throw new AppError('Impossible d’envoyer le code pour le moment, réessayez.', 502, 'OTP_DELIVERY_FAILED');
  }
  otpRequestsTotal.inc();

  return { expiresAt, resent: true };
}

/**
 * Vérifie un code OTP pour un numéro donné.
 * - Prend le code non consommé le plus récent pour ce numéro.
 * - Rejette si expiré, déjà consommé, ou nombre max de tentatives atteint.
 * - Incrémente le compteur de tentatives à chaque échec (protection brute-force
 *   même si express-rate-limit tombe/est contourné — défense en profondeur OWASP).
 */
export async function verifyOtp(phone, code) {
  const record = await get(
    `SELECT * FROM OtpCode WHERE phone = ? AND consumed = 0 ORDER BY createdAt DESC LIMIT 1`,
    [phone]
  );

  if (!record) throw badRequest('Aucun code en attente pour ce numéro.');
  if (record.attempts >= env.OTP_MAX_ATTEMPTS) {
    throw badRequest('Nombre maximal de tentatives atteint, redemandez un code.');
  }
  if (new Date(record.expiresAt).getTime() < Date.now()) {
    throw badRequest('Ce code a expiré, redemandez-en un.');
  }

  const isValid = record.codeHash === hashCode(phone, code);

  if (!isValid) {
    await run(`UPDATE OtpCode SET attempts = attempts + 1 WHERE id = ?`, [record.id]);
    throw badRequest('Code incorrect.');
  }

  await run(`UPDATE OtpCode SET consumed = 1 WHERE id = ?`, [record.id]);
  return true;
}