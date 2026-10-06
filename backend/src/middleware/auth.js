import { verifyAccessToken } from '../utils/tokens.js';
import { unauthorized, forbidden } from './errorHandler.js';
import { isSessionActive } from '../modules/auth/session.service.js';
import { readAccessToken, hasAuthCookie } from '../modules/auth/cookies.js';

// Jeton lu dans le cookie HttpOnly (navigateur) ou l'en-tête Bearer (scripts, supervision).
const bearerToken = (req) => readAccessToken(req);

/**
 * Décode l'access token et vérifie que sa session est toujours active : une
 * session révoquée (déconnexion, changement de rôle, compte supprimé) invalide
 * immédiatement le jeton, sans attendre son expiration.
 */
async function authenticate(token) {
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    return null;
  }
  if (!(await isSessionActive(payload.sid, payload.sub))) return null;
  return { id: payload.sub, role: payload.role, sessionId: payload.sid };
}

/**
 * Vérifie le token d'accès Bearer et attache req.user = { id, role, sessionId }.
 * Rejette avec 401 si absent/invalide/expiré/révoqué — jamais de fallback silencieux
 * vers un utilisateur anonyme sur une route protégée (OWASP A01 - broken access control).
 */
export async function requireAuth(req, res, next) {
  const token = bearerToken(req);
  if (!token) return next(unauthorized('Token d’accès manquant.'));
  try {
    const user = await authenticate(token);
    if (!user) return next(unauthorized('Token d’accès invalide, expiré ou révoqué.'));
    req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

/**
 * Comme requireAuth, mais ne bloque pas la requête si aucun token n'est fourni —
 * utile pour le checkout invité où req.user est optionnel mais doit être pris en
 * compte s'il est présent (rattachement de commande à un compte existant).
 */
export async function optionalAuth(req, res, next) {
  const token = bearerToken(req);
  if (!token) return next();
  try {
    // token optionnel invalide ou révoqué -> on continue en invité plutôt que de bloquer.
    const user = await authenticate(token);
    if (user) req.user = user;
    return next();
  } catch (error) {
    return next(error);
  }
}

/**
 * RBAC — à chaîner après requireAuth. Refuse avec 403 si le rôle de l'utilisateur
 * authentifié ne fait pas partie des rôles autorisés pour cette route.
 * Fail-closed : toute route qui oublie requireAuth avant requireRole plantera
 * explicitement (req.user absent) plutôt que de laisser passer par erreur.
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return next(unauthorized());
    if (!allowedRoles.includes(req.user.role)) {
      return next(forbidden('Rôle insuffisant pour cette action.'));
    }
    return next();
  };
}

/**
 * Protection CSRF : avec une session en cookie, le navigateur joint les jetons
 * à toute requête vers l'API. Une requête qui modifie des données et porte un
 * cookie de session doit donc venir d'une origine autorisée (CORS_ORIGINS).
 * Les clients hors navigateur n'envoient pas d'en-tête Origin : non concernés.
 */
export function requireTrustedOrigin(allowedOrigins) {
  const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
  return (req, res, next) => {
    if (safeMethods.has(req.method) || !hasAuthCookie(req)) return next();
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.includes(origin)) return next(forbidden('Origine non autorisée.'));
    return next();
  };
}
