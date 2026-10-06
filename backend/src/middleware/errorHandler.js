import { isProd } from '../config/env.js';
import { reportAlert } from '../modules/monitoring/alerts.js';

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
// Erreurs PostgreSQL prévisibles traduites en réponses HTTP claires plutôt qu'en 500
// exposant le nom des contraintes et tables.
const PG_ERRORS = {
  '23503': () => conflict('Ressource encore utilisée par d’autres données.'),
  '23505': () => conflict('Cette ressource existe déjà.'),
  '22P02': () => badRequest('Identifiant ou valeur invalide.'),
};

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (!err.isOperational && PG_ERRORS[err.code]) {
    req.log?.warn({ err }, 'database_constraint_error');
    err = PG_ERRORS[err.code]();
  } else if (err.name === 'MulterError') {
    // Upload refusé (fichier > 5 Mo, champ inattendu…) : erreur client, pas 500.
    err = badRequest(err.code === 'LIMIT_FILE_SIZE' ? 'Image trop lourde (5 Mo maximum).' : 'Upload invalide.');
  }
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational === true;

  // L'erreur (pile comprise) est jointe à la ligne de journal HTTP de la requête
  // (pino-http), retrouvable dans la supervision par son identifiant.
  res.err = err;
  if (statusCode >= 500) {
    reportAlert({ title: `${statusCode} ${req.method} ${req.originalUrl?.split('?')[0]}`, message: err.message, requestId: req.id, route: req.route?.path ? `${req.baseUrl}${req.route.path}` : undefined });
  }

  const payload = {
    error: {
      code: isOperational ? err.code : 'INTERNAL_ERROR',
      message: isOperational || !isProd ? err.message : `Une erreur interne est survenue (référence ${req.id}).`,
      // Référence à communiquer à l'équipe technique : identifiant de la requête dans les logs.
      requestId: req.id,
    },
  };
  if (!isProd && err.details) payload.error.details = err.details;

  res.status(statusCode).json(payload);
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route inconnue.' } });
}