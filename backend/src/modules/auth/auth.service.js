import { randomUUID } from 'node:crypto';
import { get, run, all } from '../../db/client.js';
import { hashSecret, verifySecret } from '../../config/password.js';
import { createSession, rotateSession, revokeSession, revokeAllSessions, sessionIdFromTokens } from './session.service.js';
import { unauthorized, conflict } from '../../middleware/errorHandler.js';
import { requestOtp as sendOtp, verifyOtp as checkOtp } from './otp.service.js';
import { mailer } from '../notifications/mailer.js';
import { authFailuresTotal } from '../../config/metrics.js';

function toPublicUser(user) {
  if (!user) return null;
  // Ne jamais exposer passwordHash/providerId en dehors de la couche service (OWASP A02).
  const { passwordHash, providerId, ...safe } = user;
  return safe;
}

// Chaque connexion ouvre une session révocable (voir session.service.js).
async function issueTokens(user) {
  return { ...(await createSession(user)), user: toPublicUser(user) };
}

/**
 * Rattache automatiquement les commandes passées en invité avec ce numéro de
 * téléphone au compte qui vient d'être créé/authentifié — décision produit
 * validée : jamais de doublon d'historique entre commande invitée et compte.
 */
async function linkGuestOrdersToUser(userId, phone) {
  if (!phone) return;
  await run(`UPDATE "Order" SET userId = ? WHERE guestPhone = ? AND userId IS NULL`, [userId, phone]);
}

// ---------------------------------------------------------------------------
// Email + mot de passe
// ---------------------------------------------------------------------------

export async function registerWithPassword({ name, email, password }) {
  const existing = await get(`SELECT id FROM User WHERE email = ?`, [email]);
  if (existing) throw conflict('Un compte existe déjà avec cet email.');

  const passwordHash = await hashSecret(password);
  const id = randomUUID();
  await run(
    `INSERT INTO User (id, name, email, passwordHash, provider) VALUES (?, ?, ?, ?, 'PASSWORD')`,
    [id, name, email, passwordHash]
  );
  const user = await get(`SELECT * FROM User WHERE id = ?`, [id]);

  mailer.sendWelcomeEmail({ to: email, name }).catch(() => {});
  return issueTokens(user);
}

export async function loginWithPassword({ email, password }) {
  const user = await get(`SELECT * FROM User WHERE email = ?`, [email]);
  if (!user || !(await verifySecret(password, user.passwordHash))) {
    authFailuresTotal.inc({ type: 'password' });
    // Message volontairement identique dans les deux cas (email inconnu / mdp faux)
    // pour ne pas laisser un attaquant énumérer les comptes existants (OWASP A07).
    throw unauthorized('Email ou mot de passe incorrect.');
  }
  return issueTokens(user);
}

// ---------------------------------------------------------------------------
// Téléphone + OTP
// ---------------------------------------------------------------------------

export async function requestPhoneOtp(phone) {
  return sendOtp(phone);
}

export async function verifyPhoneOtpAndAuthenticate({ phone, code, name }) {
  await checkOtp(phone, code); // lève une AppError si invalide

  let user = await get(`SELECT * FROM User WHERE phone = ?`, [phone]);
  if (!user) {
    const id = randomUUID();
    await run(
      `INSERT INTO User (id, name, phone, phoneVerified, provider) VALUES (?, ?, ?, 1, 'PHONE_OTP')`,
      [id, name ?? null, phone]
    );
    user = await get(`SELECT * FROM User WHERE id = ?`, [id]);
  } else if (!user.phoneVerified) {
    await run(`UPDATE User SET phoneVerified = 1 WHERE id = ?`, [user.id]);
    user.phoneVerified = 1;
  }

  await linkGuestOrdersToUser(user.id, phone);
  return issueTokens(user);
}

// ---------------------------------------------------------------------------
// OAuth (Google / Facebook)
// ---------------------------------------------------------------------------

/**
 * Logique pure de "find or create" pour un profil OAuth — indépendante de
 * passport/express pour rester facilement testable. Les routes passport
 * (auth.routes.js) appellent cette fonction dans leur callback de vérification.
 */
export async function findOrCreateOAuthUser({ provider, providerId, email, name }) {
  let user = await get(`SELECT * FROM User WHERE provider = ? AND providerId = ?`, [provider, providerId]);

  if (!user && email) {
    // Un compte existe déjà avec cet email (créé via mot de passe par ex.) :
    // on lie le provider plutôt que de créer un doublon.
    user = await get(`SELECT * FROM User WHERE email = ?`, [email]);
    if (user) {
      await run(`UPDATE User SET provider = ?, providerId = ?, emailVerified = 1 WHERE id = ?`, [provider, providerId, user.id]);
      user = await get(`SELECT * FROM User WHERE id = ?`, [user.id]);
    }
  }

  if (!user) {
    const id = randomUUID();
    await run(
      `INSERT INTO User (id, name, email, emailVerified, provider, providerId) VALUES (?, ?, ?, 1, ?, ?)`,
      [id, name ?? null, email ?? null, provider, providerId]
    );
    user = await get(`SELECT * FROM User WHERE id = ?`, [id]);
  }

  return issueTokens(user);
}

// ---------------------------------------------------------------------------
// Rafraîchissement de session
// ---------------------------------------------------------------------------

export async function refreshSession(refreshToken) {
  const { user, ...tokens } = await rotateSession(refreshToken);
  return { ...tokens, user: toPublicUser(user) };
}

export async function logout(tokens) {
  const sessionId = sessionIdFromTokens(tokens);
  if (sessionId) await revokeSession(sessionId);
}

export async function logoutEverywhere(userId) {
  await revokeAllSessions(userId);
}

export async function getUserById(id) {
  return toPublicUser(await get(`SELECT * FROM User WHERE id = ?`, [id]));
}

export async function listUsers() {
  return (await all(`SELECT id, name, email, phone, role, provider, createdAt FROM User ORDER BY createdAt DESC`)).map(toPublicUser);
}
export async function updateProfile(id, { name, email }) {
  if (email) {
    const existing = await get(`SELECT id FROM User WHERE email = ? AND id <> ?`, [email, id]);
    if (existing) throw conflict('Un compte existe déjà avec cet email.');
  }
  const current = await get(`SELECT * FROM User WHERE id = ?`, [id]);
  if (!current) throw unauthorized('Compte introuvable.');
  const emailChanged = email && email !== current.email;
  await run(
    `UPDATE User SET name = ?, email = ?, emailVerified = ?, updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
    [name ?? current.name, email ?? current.email, emailChanged ? 0 : current.emailVerified, id]
  );
  return getUserById(id);
}

/**
 * Suppression du compte (droit à l'effacement). Les commandes sont conservées
 * pour la comptabilité mais détachées du compte ; adresses et notifications
 * sont supprimées en cascade.
 */
export async function deleteAccount(id) {
  await run(`UPDATE "Order" SET userId = NULL WHERE userId = ?`, [id]);
  await run(`UPDATE Review SET userId = NULL WHERE userId = ?`, [id]);
  await run(`UPDATE AuditLog SET actorId = NULL WHERE actorId = ?`, [id]);
  await run(`DELETE FROM User WHERE id = ?`, [id]);
}
