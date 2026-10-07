import { randomUUID } from 'node:crypto';
import { get, all, run, transaction } from '../../db/client.js';
import { badRequest, notFound, conflict } from '../../middleware/errorHandler.js';
import { generateOrderReference } from '../../utils/reference.js';
import { getGateway } from '../payments/payments.factory.js';
import { mailer } from '../notifications/mailer.js';
import { ordersCreatedTotal } from '../../config/metrics.js';
import { logger } from '../../config/logger.js';
import { createNotification } from '../notifications/notifications.service.js';
import { env } from '../../config/env.js';
import { recordAttempt, listTransactions } from '../payments/payments.transactions.js';
import { chargeableAmount } from '../payments/gateways/CampayGateway.js';

const ETA_LABELS = (min, max) => (min === max ? `${min}h` : `${min}–${max}h`);

const ALLOWED_TRANSITIONS = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

async function hydrateOrder(order) {
  if (!order) return null;
  return {
    ...order,
    // Image principale et slugs du produit : les cartes de commande (compte, admin) affichent le produit.
    items: await all(
      `SELECT oi.*, p.slugFr, p.slugEn,
         (SELECT pi.url FROM ProductImage pi WHERE pi.productId = oi.productId ORDER BY pi.isMain DESC, pi.position ASC LIMIT 1) AS imageUrl
       FROM OrderItem oi LEFT JOIN Product p ON p.id = oi.productId WHERE oi.orderId = ?`,
      [order.id]
    ),
    statusHistory: await all(`SELECT * FROM OrderStatusEvent WHERE orderId = ? ORDER BY createdAt ASC`, [order.id]),
    paymentTransactions: await listTransactions(order.id),
  };
}

async function nextReference() {
  const { total } = await get(`SELECT COUNT(*) as total FROM "Order"`);
  return generateOrderReference(total + 1);
}

function mapPaymentMethodToZoneKey(method) {
  return { MOBILE_MONEY: 'mobile_money', CARD: 'card', CASH_ON_DELIVERY: 'cod' }[method];
}

export async function transitionStatus(orderId, newStatus, note) {
  await run(`UPDATE "Order" SET status = ?, updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`, [newStatus, orderId]);
  await run(`INSERT INTO OrderStatusEvent (id, orderId, status, note) VALUES (?, ?, ?, ?)`, [randomUUID(), orderId, newStatus, note ?? null]);
}

/**
 * Crée une commande à partir d'un panier. Fonctionne aussi bien pour un
 * visiteur invité (guest.name/phone/email) que pour un utilisateur connecté
 * (userId) — jamais de compte obligatoire pour acheter.
 */
export async function createOrder({ items, deliveryZoneId, address, guest, userId, paymentMethod, paymentPhone }) {
  if (!items?.length) throw badRequest('Le panier est vide.');

  const zone = await get(`SELECT * FROM DeliveryZone WHERE id = ? AND active = 1`, [deliveryZoneId]);
  if (!zone) throw notFound('Zone de livraison introuvable ou inactive.');

  const zonePaymentMethods = Array.isArray(zone.paymentMethods) ? zone.paymentMethods : JSON.parse(zone.paymentMethods ?? '[]');
  if (!zonePaymentMethods.includes(mapPaymentMethodToZoneKey(paymentMethod))) {
    throw badRequest(`Le moyen de paiement ${paymentMethod} n'est pas disponible pour cette zone.`);
  }
  if (paymentMethod === 'CASH_ON_DELIVERY' && !zone.codAvailable) {
    throw badRequest('Le paiement à la livraison n’est pas disponible pour cette zone.');
  }

  const resolvedItems = await Promise.all(items.map(async (item) => {
    const product = await get(`SELECT * FROM Product WHERE id = ?`, [item.productId]);
    if (!product) throw notFound(`Produit ${item.productId} introuvable.`);
    if (product.status !== 'active') throw badRequest(`Le produit "${product.nameFr}" n'est plus disponible.`);

    const sizeRow = await get(`SELECT * FROM ProductSize WHERE productId = ? AND size = ?`, [item.productId, item.size]);
    if (!sizeRow || !sizeRow.available) throw badRequest(`Taille ${item.size} indisponible pour "${product.nameFr}".`);

    if (item.customColor && !product.colorCustomizable) throw badRequest(`La couleur n'est pas personnalisable pour "${product.nameFr}".`);
    if (item.customMaterial && !product.materialCustomizable) throw badRequest(`La matière n'est pas personnalisable pour "${product.nameFr}".`);

    return {
      productId: product.id,
      productNameFr: product.nameFr,
      unitPriceFcfa: product.price,
      quantity: item.quantity ?? 1,
      size: item.size,
      color: item.color ?? null,
      customColor: item.customColor ?? null,
      customMaterial: item.customMaterial ?? null,
    };
  }));

  const subtotalFcfa = resolvedItems.reduce((sum, i) => sum + i.unitPriceFcfa * i.quantity, 0);
  const totalFcfa = subtotalFcfa + zone.feeFcfa;

  const orderId = randomUUID();
  const reference = await nextReference();

  await transaction(async ({ query }) => {
    await query(
      `INSERT INTO "Order" (id, reference, userId, guestName, guestPhone, guestEmail, deliveryZoneId,
         addressCountry, addressCity, addressDistrict, addressStreet, paymentMethod, subtotalFcfa, deliveryFeeFcfa, totalFcfa)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderId, reference, userId ?? null, guest.name, guest.phone, guest.email ?? null, deliveryZoneId,
        address.country, address.city, address.district ?? null, address.street,
        paymentMethod, subtotalFcfa, zone.feeFcfa, totalFcfa,
      ]
    );
    // Séquentiel : un client pg en transaction ne traite qu'une requête à la fois.
    for (const item of resolvedItems) {
      await query(
        `INSERT INTO OrderItem (id, orderId, productId, productNameFr, unitPriceFcfa, quantity, size, color, customColor, customMaterial)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [randomUUID(), orderId, item.productId, item.productNameFr, item.unitPriceFcfa, item.quantity, item.size, item.color, item.customColor, item.customMaterial]
      );
    }
    await query(`INSERT INTO OrderStatusEvent (id, orderId, status, note) VALUES (?, ?, 'PENDING', 'Commande créée')`, [randomUUID(), orderId]);
  });

  ordersCreatedTotal.inc({ payment_method: paymentMethod });

  let paymentResult = { status: 'pending', reference: null };
  let paymentError = null;
  try {
    const gateway = getGateway(paymentMethod);
    paymentResult = await gateway.createPayment({
      orderId, orderReference: reference, amountFcfa: totalFcfa,
      phone: paymentPhone || guest.phone, email: guest.email, name: guest.name,
    });
  } catch (err) {
    // La commande reste enregistrée : le client peut relancer le paiement
    // depuis la page de suivi (POST /payments/:orderId/retry).
    paymentError = err.message ?? 'Initialisation du paiement impossible.';
    logger.error({ err, orderId }, 'payment_creation_failed');
  }

  if (paymentResult.reference && paymentMethod !== 'CASH_ON_DELIVERY') {
    await recordAttempt({ orderId, reference: paymentResult.reference, amountFcfa: chargeableAmount(totalFcfa), operator: paymentResult.operator });
  }
  await run(`UPDATE "Order" SET paymentRef = ?, paymentStatus = ? WHERE id = ?`, [
    paymentResult.reference ?? null,
    paymentResult.status === 'paid' ? 'PAID' : 'PENDING',
    orderId,
  ]);
  if (paymentResult.status === 'paid') {
    await transitionStatus(orderId, 'CONFIRMED', 'Paiement confirmé automatiquement');
  }

  const order = await hydrateOrder(await get(`SELECT * FROM "Order" WHERE id = ?`, [orderId]));

  if (guest.email) {
    mailer.sendOrderConfirmation({
      to: guest.email,
      reference,
      totalFcfa,
      etaLabel: ETA_LABELS(zone.etaMinHours, zone.etaMaxHours),
    }).catch((err) => logger.error({ err, orderId }, 'confirmation_email_failed'));
  }

  return {
    order,
    paymentRedirectUrl: paymentResult.redirectUrl ?? null,
    payment: {
      status: paymentResult.status,
      reference: paymentResult.reference ?? null,
      ussdCode: paymentResult.ussdCode ?? null,
      operator: paymentResult.operator ?? null,
      redirectUrl: paymentResult.redirectUrl ?? null,
      error: paymentError,
    },
  };
}

export async function updateOrderStatus(orderId, newStatus, note) {
  const order = await get(`SELECT * FROM "Order" WHERE id = ?`, [orderId]);
  if (!order) throw notFound('Commande introuvable.');

  const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(newStatus)) {
    throw conflict(`Transition de statut invalide : ${order.status} → ${newStatus}.`);
  }

  await transitionStatus(orderId, newStatus, note);
  const updated = await hydrateOrder(await get(`SELECT * FROM "Order" WHERE id = ?`, [orderId]));

  const recipient = order.guestEmail;
  if (recipient) {
    mailer.sendOrderStatusUpdate({ to: recipient, reference: order.reference, status: newStatus })
      .catch((err) => logger.error({ err, orderId }, 'status_email_failed'));
  }
  if (newStatus === 'DELIVERED') {
    for (const item of updated.items) {
      const characteristics = [item.size, item.color, item.customMaterial].filter(Boolean).join(', ');
      const product = await get(`SELECT slugFr FROM Product WHERE id = ?`, [item.productId]);
      const reviewUrl = `${env.FRONTEND_URL}/fr/produits/${product?.slugFr ?? item.productId}?review=1`;
      await createNotification({
        userId: order.userId,
        email: recipient,
        type: 'REVIEW_INVITATION',
        title: `Votre avis sur ${item.productNameFr}`,
        message: `Merci pour votre commande ${order.reference}. Partagez votre expérience sur ${item.productNameFr}.`,
        metadata: { orderId, productId: item.productId, reference: order.reference, orderDate: order.createdAt, characteristics, reviewUrl },
      });
      if (recipient) mailer.sendReviewInvitation({ to: recipient, reference: order.reference, productName: item.productNameFr, orderDate: new Date(order.createdAt).toLocaleDateString('fr-FR'), characteristics, reviewUrl }).catch((err) => logger.error({ err, orderId }, 'review_invitation_email_failed'));
    }
  }
  return updated;
}

export async function setInternalNote(orderId, note) {
  const order = await get(`SELECT id FROM "Order" WHERE id = ?`, [orderId]);
  if (!order) throw notFound('Commande introuvable.');
  await run(`UPDATE "Order" SET internalNote = ? WHERE id = ?`, [note, orderId]);
  return hydrateOrder(await get(`SELECT * FROM "Order" WHERE id = ?`, [orderId]));
}

export async function getOrderById(id) {
  const order = await get(`SELECT * FROM "Order" WHERE id = ?`, [id]);
  if (!order) throw notFound('Commande introuvable.');
  return hydrateOrder(order);
}

export async function getOrderByReference(reference) {
  const order = await get(`SELECT * FROM "Order" WHERE reference = ?`, [reference]);
  if (!order) throw notFound('Commande introuvable.');
  return hydrateOrder(order);
}

export async function listOrders({ status, deliveryZoneId, userId, page = 1, pageSize = 20 } = {}) {
  const conditions = [];
  const params = [];
  if (status) { conditions.push('status = ?'); params.push(status); }
  if (deliveryZoneId) { conditions.push('deliveryZoneId = ?'); params.push(deliveryZoneId); }
  if (userId) { conditions.push('userId = ?'); params.push(userId); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const offset = (page - 1) * pageSize;
  const items = await all(`SELECT * FROM "Order" ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`, [...params, pageSize, offset]);
  const [{ total }, hydratedItems] = await Promise.all([
    get(`SELECT COUNT(*) as total FROM "Order" ${where}`, params),
    Promise.all(items.map(hydrateOrder)),
  ]);
  return { items: hydratedItems, total: Number(total), page, pageSize };
}