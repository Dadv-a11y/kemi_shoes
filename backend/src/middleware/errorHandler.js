import { logger } from '../config/logger.js';
import { isProd } from '../config/env.js';

/**
 * Erreur applicative avec code HTTP explicite — permet aux services de lever
 * des erreurs métier claires (404, 409, 403...) sans coupler la logique à Express.
 */
export class AppError extends Error {
  constructor(message, statusCode = 400, code = 'BAD_REQUEST', details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }
}

export const notFound = (message = 'Ressource introuvable') => new AppError(message, 404, 'NOT_FOUND');
export const badRequest = (message, details) => new AppError(message, 400, 'BAD_REQUEST', details);
export const unauthorized = (message = 'Authentification requise') => new AppError(message, 401, 'UNAUTHORIZED');
export const forbidden = (message = 'Accès refusé') => new AppError(message, 403, 'FORBIDDEN');
export const conflict = (message) => new AppError(message, 409, 'CONFLICT');

/**
 * Middleware d'erreur global. Volontairement le dernier maillon de la chaîne Express.
 * - Ne renvoie jamais la stack trace ni le message brut d'une erreur non opérationnelle
 *   en production (évite les fuites d'information — OWASP A05 Security Misconfiguration).
 * - Log systématique côté serveur pour l'observabilité, quel que soit l'environnement.
 */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational === true;

  req.log?.error({ err, statusCode }, 'request_error');
  if (!isOperational) logger.error({ err }, 'unhandled_error');

  const payload = {
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: isOperational || !isProd ? err.message : 'Une erreur interne est survenue.',
    },
  };
  if (!isProd && err.details) payload.error.details = err.details;

  res.status(statusCode).json(payload);
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route inconnue.' } });
}