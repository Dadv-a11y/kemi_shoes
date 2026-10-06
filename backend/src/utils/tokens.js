import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// sid = identifiant de session (table Session) : permet la révocation côté serveur.
export function signAccessToken(user, sid) {
  return jwt.sign(
    { sub: user.id, role: user.role, sid },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_TTL, issuer: 'kemi-shoes' }
  );
}

// jti change à chaque rotation : seul le dernier refresh token émis est valable.
export function signRefreshToken(user, { sid, jti }) {
  return jwt.sign(
    { sub: user.id, typ: 'refresh', sid, jti },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_TTL, issuer: 'kemi-shoes' }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET, { issuer: 'kemi-shoes' });
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET, { issuer: 'kemi-shoes' });
}