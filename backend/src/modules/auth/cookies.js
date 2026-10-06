import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';

/**
 * Les jetons de session vivent dans des cookies HttpOnly : inaccessibles au
 * JavaScript de la page (une XSS ne peut pas les exfiltrer), envoyés
 * automatiquement par le navigateur (fetch `credentials: 'include'`).
 * - access token : envoyé à toute l'API, durée de vie courte (JWT_ACCESS_TTL) ;
 * - refresh token : envoyé uniquement aux routes /api/v1/auth (renouvellement, déconnexion).
 */
export const ACCESS_COOKIE = 'kemi_at';
export const REFRESH_COOKIE = 'kemi_rt';
const REFRESH_PATH = '/api/v1/auth';

function baseOptions() {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAMESITE,
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

// Le cookie expire en même temps que le jeton qu'il porte.
const maxAgeOf = (token) => Math.max(0, jwt.decode(token).exp * 1000 - Date.now());

export function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie(ACCESS_COOKIE, accessToken, { ...baseOptions(), path: '/', maxAge: maxAgeOf(accessToken) });
  res.cookie(REFRESH_COOKIE, refreshToken, { ...baseOptions(), path: REFRESH_PATH, maxAge: maxAgeOf(refreshToken) });
}

export function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE, { ...baseOptions(), path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...baseOptions(), path: REFRESH_PATH });
}

/** Access token : cookie (navigateur) ou en-tête Bearer (scripts, supervision). */
export function readAccessToken(req) {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length).trim();
  return req.cookies?.[ACCESS_COOKIE] ?? null;
}

/** Refresh token : cookie (navigateur) ou corps JSON (clients hors navigateur). */
export function readRefreshToken(req) {
  return req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken ?? null;
}

export const hasAuthCookie = (req) => Boolean(req.cookies?.[ACCESS_COOKIE] || req.cookies?.[REFRESH_COOKIE]);
