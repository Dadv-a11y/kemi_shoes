import * as authService from './auth.service.js';
import { audit } from '../../middleware/audit.js';
import { unauthorized } from '../../middleware/errorHandler.js';
import { clearAuthCookies, readAccessToken, readRefreshToken, setAuthCookies } from './cookies.js';

// Les jetons partent uniquement en cookies HttpOnly : le corps ne contient que l'utilisateur.
function respondWithSession(res, { accessToken, refreshToken, user }, status = 200) {
  setAuthCookies(res, { accessToken, refreshToken });
  res.status(status).json({ user });
}

export async function register(req, res) {
  const result = await authService.registerWithPassword(req.body);
  audit(req, { action: 'auth.register', entityType: 'User', entityId: result.user.id });
  respondWithSession(res, result, 201);
}

export async function login(req, res) {
  const result = await authService.loginWithPassword(req.body);
  audit(req, { action: 'auth.login', entityType: 'User', entityId: result.user.id });
  respondWithSession(res, result);
}

export async function requestOtp(req, res) {
  const result = await authService.requestPhoneOtp(req.body.phone);
  // On ne renvoie jamais le code lui-même dans la réponse HTTP.
  res.json({ message: result.resent ? 'Code envoyé.' : 'Un code valide a déjà été envoyé.', expiresAt: result.expiresAt, resent: result.resent });
}

export async function verifyOtp(req, res) {
  const result = await authService.verifyPhoneOtpAndAuthenticate(req.body);
  audit(req, { action: 'auth.otp_login', entityType: 'User', entityId: result.user.id });
  respondWithSession(res, result);
}

export async function refresh(req, res) {
  const refreshToken = readRefreshToken(req);
  if (!refreshToken) throw unauthorized('Session expirée, reconnectez-vous.');
  try {
    respondWithSession(res, await authService.refreshSession(refreshToken));
  } catch (error) {
    // Session morte : on efface les cookies. Pas si un autre onglet vient de la renouveler.
    if (error.statusCode === 401 && error.code !== 'REFRESH_SUPERSEDED') clearAuthCookies(res);
    throw error;
  }
}

/** Déconnexion : tolère un access token expiré (la session est retrouvée via le refresh token). */
export async function logout(req, res) {
  await authService.logout({ accessToken: readAccessToken(req), refreshToken: readRefreshToken(req) });
  clearAuthCookies(res);
  res.status(204).send();
}

export async function logoutAll(req, res) {
  await authService.logoutEverywhere(req.user.id);
  audit(req, { action: 'auth.logout_all', entityType: 'User', entityId: req.user.id });
  clearAuthCookies(res);
  res.status(204).send();
}

export async function me(req, res) {
  res.json({ user: await authService.getUserById(req.user.id) });
}
export async function updateMe(req, res) {
  const user = await authService.updateProfile(req.user.id, req.body);
  audit(req, { action: 'auth.profile_updated', entityType: 'User', entityId: req.user.id });
  res.json({ user });
}

export async function deleteMe(req, res) {
  audit(req, { action: 'auth.account_deleted', entityType: 'User', entityId: req.user.id });
  await authService.deleteAccount(req.user.id);
  clearAuthCookies(res);
  res.status(204).send();
}
