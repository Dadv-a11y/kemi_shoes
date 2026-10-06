import rateLimit from 'express-rate-limit';
import { env, isTest } from '../config/env.js';

// Désactivé en test pour ne pas polluer les suites qui enchaînent des dizaines
// de requêtes vers /auth en quelques millisecondes.
const skip = () => isTest;

/**
 * Limite les tentatives de connexion / OTP — mitigation brute-force
 * (OWASP A07 - Identification and Authentication Failures).
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.AUTH_RATE_LIMIT, // 10 par défaut ; relevable pour un audit automatisé
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Trop de tentatives, réessayez plus tard.' } },
});

/**
 * Limite plus stricte spécifiquement sur l'envoi de code OTP par SMS,
 * pour éviter l'épuisement du quota SMS / spam d'un numéro tiers.
 */
export const otpRequestLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Trop de demandes de code, réessayez dans quelques minutes.' } },
});

/**
 * Limite générale sur l'API publique — filet de sécurité, pas la seule protection.
 */
export const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip,
});