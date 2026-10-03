import { PaymentGateway } from './PaymentGateway.js';
import { env } from '../../../config/env.js';
import { logger } from '../../../config/logger.js';
import { AppError, badRequest } from '../../../middleware/errorHandler.js';

const STATUS_MAP = { SUCCESSFUL: 'paid', FAILED: 'failed', PENDING: 'pending' };

export function isCampayConfigured() {
  return Boolean(env.CAMPAY_ACCESS_TOKEN || (env.CAMPAY_USERNAME && env.CAMPAY_APP_PASSWORD));
}

export function isCampayDemo() {
  return env.CAMPAY_BASE_URL.includes('demo.campay.net');
}

/**
 * Montant réellement facturé. Le compte demo CamPay refuse toute transaction
 * au-delà de 25 XAF : CAMPAY_MAX_AMOUNT_XAF permet de tester le parcours
 * complet avec des commandes réelles du catalogue.
 */
export function chargeableAmount(amountFcfa) {
  const amount = Math.round(amountFcfa);
  return env.CAMPAY_MAX_AMOUNT_XAF ? Math.min(amount, env.CAMPAY_MAX_AMOUNT_XAF) : amount;
}

/**
 * CamPay attend un numéro au format international sans "+" (ex. 2376XXXXXXXX).
 * Un numéro local camerounais à 9 chiffres est préfixé par 237.
 */
export function normalizeCampayPhone(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.length === 9 && digits.startsWith('6')) return `237${digits}`;
  return digits;
}

/**
 * CamPay dédoublonne les transactions sur external_reference : chaque tentative
 * (première demande ou relance) reçoit donc une référence unique "<orderId>.<suffixe>".
 */
export function attemptReference(orderId) {
  return `${orderId}.${Date.now().toString(36)}`;
}

export function orderIdFromExternalReference(externalReference) {
  return externalReference ? String(externalReference).split('.')[0] : null;
}

let cachedToken = null; // { value, expiresAt }

async function getAuthToken() {
  if (env.CAMPAY_ACCESS_TOKEN) return env.CAMPAY_ACCESS_TOKEN;
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const response = await fetch(`${env.CAMPAY_BASE_URL}/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: env.CAMPAY_USERNAME, password: env.CAMPAY_APP_PASSWORD }),
  });
  if (!response.ok) throw new AppError('Authentification CamPay impossible.', 502, 'PAYMENT_PROVIDER_ERROR');
  const { token, expires_in: expiresIn = 3600 } = await response.json();
  // Marge de 60 s pour ne jamais envoyer un token sur le point d'expirer.
  cachedToken = { value: token, expiresAt: Date.now() + (Number(expiresIn) - 60) * 1000 };
  return token;
}

async function campayRequest(path, { method = 'GET', body } = {}) {
  const token = await getAuthToken();
  const response = await fetch(`${env.CAMPAY_BASE_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Token ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    logger.error({ path, status: response.status, payload }, 'campay_request_failed');
    const message = payload?.message ?? payload?.detail ?? 'Le fournisseur de paiement a refusé la requête.';
    throw new AppError(message, response.status === 400 ? 400 : 502, 'PAYMENT_PROVIDER_ERROR');
  }
  return payload;
}

/**
 * Passerelle CamPay.
 *  - mode "momo" : collecte directe (POST /collect/) — l'utilisateur valide la
 *    transaction sur son téléphone (USSD MTN / Orange).
 *  - mode "card" : lien de paiement hébergé par CamPay (POST /get_payment_link/),
 *    l'utilisateur est redirigé puis revient sur la page commande.
 */
export class CampayGateway extends PaymentGateway {
  constructor({ mode = 'momo' } = {}) {
    super();
    this.mode = mode;
  }

  async createPayment({ orderId, orderReference, amountFcfa, phone, email, name }) {
    const amount = String(chargeableAmount(amountFcfa));
    const description = `Commande KEMI SHOES ${orderReference ?? orderId}`;

    if (this.mode === 'card') {
      // CamPay refuse les URL de retour non publiques (localhost) : en local,
      // FRONTEND_URL doit pointer vers une URL https accessible (ex. tunnel).
      const returnUrl = `${env.FRONTEND_URL}/fr/commande/suivi?order=${orderId}`;
      const [firstName, ...rest] = String(name ?? '').trim().split(/\s+/);
      const result = await campayRequest('/get_payment_link/', {
        method: 'POST',
        body: {
          amount,
          currency: 'XAF',
          description,
          external_reference: attemptReference(orderId),
          redirect_url: returnUrl,
          failure_redirect_url: returnUrl,
          payment_options: 'CARD',
          ...(firstName ? { first_name: firstName, last_name: rest.join(' ') || firstName } : {}),
          ...(email ? { email } : {}),
        },
      });
      // La référence renvoyée permet ensuite le suivi par polling, comme en Mobile Money.
      return { status: 'pending', reference: result.reference ?? null, redirectUrl: result.link };
    }

    const from = normalizeCampayPhone(phone);
    if (!/^237[62]\d{8}$/.test(from)) throw badRequest('Numéro Mobile Money camerounais invalide (ex. 6XXXXXXXX).');

    const result = await campayRequest('/collect/', {
      method: 'POST',
      body: { amount, currency: 'XAF', from, description, external_reference: attemptReference(orderId) },
    });
    return { status: 'pending', reference: result.reference, ussdCode: result.ussd_code ?? null, operator: result.operator ?? null };
  }

  async verifyPayment(reference) {
    const result = await campayRequest(`/transaction/${encodeURIComponent(reference)}/`);
    return {
      status: STATUS_MAP[result.status] ?? 'pending',
      amount: Number(result.amount),
      externalReference: orderIdFromExternalReference(result.external_reference),
      operator: result.operator ?? null,
    };
  }
}
