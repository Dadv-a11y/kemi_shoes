import { badRequest } from './errorHandler.js';

/**
 * Valide req.body/query/params contre un schéma Zod et remplace la valeur brute
 * par la valeur "parsed" (types coercés, champs par défaut appliqués, champs
 * inconnus retirés selon le schéma) — première ligne de défense contre l'injection
 * et la pollution de paramètres (OWASP A03 - Injection).
 */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    if (!result.success) {
      return next(badRequest('Requête invalide.', result.error.flatten()));
    }
    if (result.data.body !== undefined) req.body = result.data.body;
    if (result.data.query !== undefined) req.query = result.data.query;
    if (result.data.params !== undefined) req.params = result.data.params;
    return next();
  };
}