import { verifyAccessToken } from '../utils/tokens.js';
import { unauthorized, forbidden } from './errorHandler.js';

/**
 * Vérifie le token d'accès Bearer et attache req.user = { id, role }.
 * Rejette avec 401 si absent/invalide/expiré — jamais de fallback silencieux
 * vers un utilisateur anonyme sur une route protégée (OWASP A01 - broken access control).
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(unauthorized('Token d’accès manquant.'));
  }
  const token = header.slice('Bearer '.length).trim();
  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    return next();
  } catch {
    return next(unauthorized('Token d’accès invalide ou expiré.'));
  }
}

/**
 * Comme requireAuth, mais ne bloque pas la requête si aucun token n'est fourni —
 * utile pour le checkout invité où req.user est optionnel mais doit être pris en
 * compte s'il est présent (rattachement de commande à un compte existant).
 */
export function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return next();
  try {
    const payload = verifyAccessToken(header.slice('Bearer '.length).trim());
    req.user = { id: payload.sub, role: payload.role };
  } catch {
    // token optionnel invalide -> on continue en invité plutôt que de bloquer.
  }
  return next();
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