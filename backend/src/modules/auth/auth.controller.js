import * as authService from './auth.service.js';
import { audit } from '../../middleware/audit.js';

export async function register(req, res) {
  const result = await authService.registerWithPassword(req.body);
  audit(req, { action: 'auth.register', entityType: 'User', entityId: result.user.id });
  res.status(201).json(result);
}

export async function login(req, res) {
  const result = await authService.loginWithPassword(req.body);
  audit(req, { action: 'auth.login', entityType: 'User', entityId: result.user.id });
  res.json(result);
}

export async function requestOtp(req, res) {
  const result = await authService.requestPhoneOtp(req.body.phone);
  // On ne renvoie jamais le code lui-même dans la réponse HTTP.
  res.json({ message: result.resent ? 'Code envoyé.' : 'Un code valide a déjà été envoyé.', expiresAt: result.expiresAt, resent: result.resent });
}

export async function verifyOtp(req, res) {
  const result = await authService.verifyPhoneOtpAndAuthenticate(req.body);
  audit(req, { action: 'auth.otp_login', entityType: 'User', entityId: result.user.id });
  res.json(result);
}

export async function refresh(req, res) {
  const result = await authService.refreshSession(req.body.refreshToken);
  res.json(result);
}

export async function logout(req, res) {
  await authService.logout(req.user.sessionId);
  audit(req, { action: 'auth.logout', entityType: 'User', entityId: req.user.id });
  res.status(204).send();
}

export async function logoutAll(req, res) {
  await authService.logoutEverywhere(req.user.id);
  audit(req, { action: 'auth.logout_all', entityType: 'User', entityId: req.user.id });
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
  res.status(204).send();
}
