import { createHash, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { get, run } from '../../db/client.js';
import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken } from '../../utils/tokens.js';
import { AppError, unauthorized } from '../../middleware/errorHandler.js';
import { logger } from '../../config/logger.js';

// Seul un hash du jti est stocké : une fuite de la table ne permet pas de forger un refresh token.
const hashJti = (jti) => createHash('sha256').update(jti).digest('hex');

// Délai pendant lequel l'ancien refresh token d'une rotation est reconnu comme
// « déjà remplacé » (onglets ouverts en parallèle) plutôt que comme un rejeu.
const ROTATION_GRACE_MS = 60 * 1000;

const expiryOf = (token) => new Date(jwt.decode(token).exp * 1000).toISOString();

function tokensFor(user, sid, jti) {
  const refreshToken = signRefreshToken(user, { sid, jti });
  return { accessToken: signAccessToken(user, sid), refreshToken };
}

/** Ouvre une session (connexion) et renvoie la paire de jetons associée. */
export async function createSession(user) {
  // Ménage opportuniste : les sessions expirées depuis plus de 7 jours ne servent plus à rien.
  await run(`DELETE FROM Session WHERE expiresAt < CURRENT_TIMESTAMP - INTERVAL '7 days'`);
  const sid = randomUUID();
  const jti = randomUUID();
  const tokens = tokensFor(user, sid, jti);
  await run(
    `INSERT INTO Session (id, userId, refreshHash, expiresAt) VALUES (?, ?, ?, ?)`,
    [sid, user.id, hashJti(jti), expiryOf(tokens.refreshToken)]
  );
  return tokens;
}

/**
 * Rotation : échange un refresh token valide contre une nouvelle paire. L'ancien
 * refresh token devient inutilisable. Présenter un refresh token déjà remplacé
 * (hors délai de grâce) est traité comme un vol : la session est révoquée.
 */
export async function rotateSession(refreshToken) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw unauthorized('Session expirée, reconnectez-vous.');
  }
  if (!payload.sid || !payload.jti) throw unauthorized('Session expirée, reconnectez-vous.');

  const session = await get(
    `SELECT * FROM Session WHERE id = ? AND userId = ? AND revokedAt IS NULL AND expiresAt > CURRENT_TIMESTAMP`,
    [payload.sid, payload.sub]
  );
  if (!session) throw unauthorized('Session expirée ou révoquée, reconnectez-vous.');

  const presented = hashJti(payload.jti);
  if (presented !== session.refreshHash) {
    const recentlyRotated = session.previousHash === presented
      && session.rotatedAt && Date.now() - new Date(session.rotatedAt).getTime() < ROTATION_GRACE_MS;
    if (recentlyRotated) {
      // Un autre onglet vient de faire la rotation : le client doit relire ses jetons.
      throw new AppError('Session déjà renouvelée.', 401, 'REFRESH_SUPERSEDED');
    }
    await revokeSession(session.id);
    logger.warn({ sessionId: session.id, userId: session.userId }, 'refresh_token_reuse_detected');
    throw unauthorized('Session révoquée, reconnectez-vous.');
  }

  const user = await get(`SELECT * FROM User WHERE id = ?`, [payload.sub]);
  if (!user) throw unauthorized('Compte introuvable.');

  const jti = randomUUID();
  const tokens = tokensFor(user, session.id, jti);
  await run(
    `UPDATE Session SET refreshHash = ?, previousHash = ?, rotatedAt = CURRENT_TIMESTAMP, lastUsedAt = CURRENT_TIMESTAMP,
       expiresAt = ? WHERE id = ?`,
    [hashJti(jti), session.refreshHash, expiryOf(tokens.refreshToken), session.id]
  );
  return { ...tokens, user };
}

/** Utilisé par requireAuth : l'access token n'est accepté que si sa session est active. */
export async function isSessionActive(sid, userId) {
  if (!sid) return false;
  const row = await get(
    `SELECT id FROM Session WHERE id = ? AND userId = ? AND revokedAt IS NULL AND expiresAt > CURRENT_TIMESTAMP`,
    [sid, userId]
  );
  return Boolean(row);
}

/**
 * Session désignée par les jetons présentés (déconnexion) : l'access token, même
 * expiré, ou à défaut le refresh token. Signature toujours vérifiée.
 */
export function sessionIdFromTokens({ accessToken, refreshToken }) {
  for (const read of [() => verifyAccessToken(accessToken, { ignoreExpiration: true }), () => verifyRefreshToken(refreshToken)]) {
    try {
      const { sid } = read();
      if (sid) return sid;
    } catch {
      /* jeton absent ou invalide : essayer le suivant */
    }
  }
  return null;
}

export async function revokeSession(sid) {
  await run(`UPDATE Session SET revokedAt = CURRENT_TIMESTAMP WHERE id = ? AND revokedAt IS NULL`, [sid]);
}

/** Déconnecte un compte de tous ses appareils (changement de rôle, « déconnecter partout »). */
export async function revokeAllSessions(userId) {
  await run(`UPDATE Session SET revokedAt = CURRENT_TIMESTAMP WHERE userId = ? AND revokedAt IS NULL`, [userId]);
}
