import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

/**
 * Authentification Google partagée par les intégrations Merchant Center et
 * Business Profile — un compte de service, deux scopes. `google-auth-library`
 * est utilisée plutôt que le paquet `googleapis` complet (beaucoup plus lourd)
 * puisqu'on ne fait que de l'authentification + des appels REST bruts ensuite.
 */
export const googleIntegrationsEnabled = Boolean(
  env.GOOGLE_SERVICE_ACCOUNT_EMAIL && env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
);

let authClient;

async function getAuth(scopes) {
  if (!googleIntegrationsEnabled) return null;
  if (!authClient) {
    const { GoogleAuth } = await import('google-auth-library');
    authClient = new GoogleAuth({
      credentials: {
        client_email: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        // Les clés privées stockées en variable d'env contiennent des "\n" littéraux.
        private_key: env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes,
    });
  }
  return authClient;
}

/**
 * Retourne un client HTTP (fetch) déjà authentifié pour les scopes demandés.
 * Renvoie null si les identifiants de compte de service ne sont pas configurés
 * (permet aux modules appelants de no-op proprement plutôt que planter).
 */
export async function getAuthedFetcher(scopes) {
  const auth = await getAuth(scopes);
  if (!auth) {
    logger.warn('Intégration Google désactivée (compte de service non configuré).');
    return null;
  }
  const client = await auth.getClient();
  return async (url, options = {}) => {
    const headers = await client.getRequestHeaders();
    return fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
  };
}