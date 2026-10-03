import jwt from 'jsonwebtoken';
import { get, run } from '../../db/client.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { badRequest, conflict, notFound, unauthorized } from '../../middleware/errorHandler.js';
import { getGateway } from './payments.factory.js';
import { chargeableAmount, isCampayConfigured, isCampayDemo, orderIdFromExternalReference } from './gateways/CampayGateway.js';
import { transitionStatus } from '../orders/orders.service.js';

const ONLINE_METHODS = ['MOBILE_MONEY', 'CARD'];

function toPublicStatus(order) {
  // Informations minimales : la route est accessible sans compte (checkout invité).
  return {
    orderId: order.id,
    reference: order.reference,
    status: order.status,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    totalFcfa: order.totalFcfa,
    chargedAmountFcfa: ONLINE_METHODS.includes(order.paymentMethod) ? chargeableAmount(order.totalFcfa) : order.totalFcfa,
  };
}

async function loadOrder(orderId) {
  const order = await get(`SELECT * FROM "Order" WHERE id = ?`, [orderId]);
  if (!order) throw notFound('Commande introuvable.');
  return order;
}

/**
 * Applique un résultat de paiement à la commande. Idempotent : un webhook
 * reçu après un polling déjà concluant (ou l'inverse) ne fait rien.
 */
async function applyPaymentResult(order, { status, reference }) {
  if (order.paymentStatus === 'PAID') return order;

  if (status === 'paid') {
    await run(`UPDATE "Order" SET paymentStatus = 'PAID', paymentRef = COALESCE(?, paymentRef) WHERE id = ?`, [reference ?? null, order.id]);
    if (order.status === 'PENDING') await transitionStatus(order.id, 'CONFIRMED', 'Paiement CamPay confirmé');
    logger.info({ orderId: order.id, reference }, 'payment_confirmed');
  } else if (status === 'failed' && order.paymentStatus !== 'FAILED') {
    await run(`UPDATE "Order" SET paymentStatus = 'FAILED', paymentRef = COALESCE(?, paymentRef) WHERE id = ?`, [reference ?? null, order.id]);
    logger.warn({ orderId: order.id, reference }, 'payment_failed');
  }
  return loadOrder(order.id);
}

/** Vérifie côté serveur qu'une transaction CamPay correspond bien à la commande. */
function assertTransactionMatchesOrder(order, transaction) {
  if (transaction.externalReference && transaction.externalReference !== order.id) {
    throw badRequest('Cette transaction ne correspond pas à la commande.');
  }
  // Les numéros de test du compte demo renvoient un montant de 0 : le contrôle
  // du montant ne s'applique qu'en production.
  if (!isCampayDemo() && transaction.status === 'paid' && Number.isFinite(transaction.amount) && transaction.amount < chargeableAmount(order.totalFcfa)) {
    throw badRequest('Montant payé insuffisant.');
  }
}

export async function getPaymentStatus(orderId) {
  let order = await loadOrder(orderId);
  // Polling : tant que le paiement en ligne est en attente, on interroge CamPay.
  if (ONLINE_METHODS.includes(order.paymentMethod) && order.paymentStatus === 'PENDING' && order.paymentRef) {
    try {
      const transaction = await getGateway(order.paymentMethod).verifyPayment(order.paymentRef);
      assertTransactionMatchesOrder(order, transaction);
      order = await applyPaymentResult(order, { status: transaction.status, reference: order.paymentRef });
    } catch (err) {
      logger.error({ err, orderId }, 'payment_status_check_failed');
    }
  }
  return toPublicStatus(order);
}

/**
 * Retour depuis la page de paiement hébergée CamPay (carte) : la référence
 * transmise par le navigateur est re-vérifiée auprès de CamPay avant usage.
 */
export async function confirmPayment(orderId, reference) {
  const order = await loadOrder(orderId);
  if (!ONLINE_METHODS.includes(order.paymentMethod)) throw badRequest('Cette commande n’est pas payée en ligne.');
  const transaction = await getGateway(order.paymentMethod).verifyPayment(reference);
  assertTransactionMatchesOrder(order, transaction);
  if (!transaction.externalReference) throw badRequest('Transaction non rattachée à une commande.');
  return toPublicStatus(await applyPaymentResult(order, { status: transaction.status, reference }));
}

export async function retryPayment(orderId, { phone, paymentMethod } = {}) {
  const order = await loadOrder(orderId);
  if (order.paymentStatus === 'PAID') throw conflict('Cette commande est déjà payée.');
  if (order.status === 'CANCELLED') throw conflict('Cette commande est annulée.');
  const method = paymentMethod ?? order.paymentMethod;
  if (!ONLINE_METHODS.includes(method)) throw badRequest('Seuls les paiements en ligne peuvent être relancés.');

  const result = await getGateway(method).createPayment({
    orderId: order.id,
    orderReference: order.reference,
    amountFcfa: order.totalFcfa,
    phone: phone || order.guestPhone,
    email: order.guestEmail,
    name: order.guestName,
  });
  await run(`UPDATE "Order" SET paymentMethod = ?, paymentStatus = 'PENDING', paymentRef = ? WHERE id = ?`, [method, result.reference ?? null, order.id]);
  return {
    ...toPublicStatus(await loadOrder(order.id)),
    payment: { status: result.status, reference: result.reference ?? null, ussdCode: result.ussdCode ?? null, operator: result.operator ?? null, redirectUrl: result.redirectUrl ?? null },
  };
}

/**
 * Webhook CamPay. Le paramètre "signature" est un JWT HS256 signé avec la clé
 * webhook de l'application : sans signature valide, la notification est rejetée.
 * Le statut est ensuite re-vérifié via l'API (on ne fait jamais confiance au seul
 * contenu de la notification).
 */
export async function handleCampayWebhook(payload) {
  if (!env.CAMPAY_WEBHOOK_KEY) throw unauthorized('Webhook CamPay non configuré.');
  try {
    jwt.verify(String(payload.signature ?? ''), env.CAMPAY_WEBHOOK_KEY, { algorithms: ['HS256'] });
  } catch {
    throw unauthorized('Signature webhook invalide.');
  }

  const orderId = orderIdFromExternalReference(payload.external_reference);
  const reference = payload.reference;
  if (!orderId || !reference) throw badRequest('Notification incomplète.');

  const order = await get(`SELECT * FROM "Order" WHERE id = ?`, [orderId]);
  if (!order) {
    logger.warn({ orderId, reference }, 'campay_webhook_unknown_order');
    return { received: true };
  }
  const transaction = await getGateway(order.paymentMethod === 'CARD' ? 'CARD' : 'MOBILE_MONEY').verifyPayment(reference);
  assertTransactionMatchesOrder(order, transaction);
  await applyPaymentResult(order, { status: transaction.status, reference });
  return { received: true };
}

export function getProviders() {
  const campay = isCampayConfigured();
  return [
    {
      id: 'campay',
      name: 'CamPay',
      description: 'Mobile Money MTN / Orange + carte — Cameroun',
      status: campay ? (isCampayDemo() ? 'demo' : 'live') : 'not_configured',
      methods: campay ? ['MOBILE_MONEY', 'CARD'] : [],
      webhookConfigured: Boolean(env.CAMPAY_WEBHOOK_KEY),
      maxAmountXaf: env.CAMPAY_MAX_AMOUNT_XAF ?? null,
      baseUrl: env.CAMPAY_BASE_URL,
    },
    {
      id: 'cod',
      name: 'Paiement à la livraison',
      description: 'Encaissement manuel par le livreur',
      status: 'live',
      methods: ['CASH_ON_DELIVERY'],
    },
  ];
}
