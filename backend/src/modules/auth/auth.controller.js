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
  res.json({ message: 'Code envoyé.', expiresAt: result.expiresAt });
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
