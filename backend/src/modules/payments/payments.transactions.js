import { randomUUID } from 'node:crypto';
import { all, get, run } from '../../db/client.js';

const STATUS = { paid: 'PAID', failed: 'FAILED', pending: 'PENDING' };

/** Enregistre une tentative de paiement en ligne (appelé à la création et à chaque relance). */
export async function recordAttempt({ orderId, provider = 'campay', reference, amountFcfa, operator = null }) {
  if (!reference) return;
  await run(
    `INSERT INTO PaymentTransaction (id, orderId, provider, reference, operator, amountFcfa) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (provider, reference) DO NOTHING`,
    [randomUUID(), orderId, provider, reference, operator, amountFcfa ?? null]
  );
}

/**
 * Met à jour la tentative avec ce que l'opérateur a répondu à la vérification : statut,
 * référence opérateur et réponse brute (conservée telle quelle pour les litiges).
 */
export async function syncTransaction({ orderId, reference, transaction, provider = 'campay' }) {
  if (!reference || !transaction) return;
  await recordAttempt({ orderId, provider, reference, operator: transaction.operator });
  await run(
    `UPDATE PaymentTransaction SET status = ?, operator = COALESCE(?, operator),
       operatorReference = COALESCE(?, operatorReference), rawPayload = ?, updatedAt = CURRENT_TIMESTAMP
     WHERE provider = ? AND reference = ?`,
    [STATUS[transaction.status] ?? 'PENDING', transaction.operator ?? null, transaction.operatorReference ?? null,
      transaction.raw ? JSON.stringify(transaction.raw) : null, provider, reference]
  );
}

/** Tentatives d'une commande, sans la réponse brute. */
export function listTransactions(orderId) {
  return all(
    `SELECT id, provider, reference, operatorReference, operator, status, amountFcfa, createdAt, updatedAt
     FROM PaymentTransaction WHERE orderId = ? ORDER BY createdAt ASC`,
    [orderId]
  );
}

/** Retrouve une commande à partir d'une référence opérateur ou CamPay (support / remboursement). */
export function findByAnyReference(value) {
  return get(`SELECT * FROM PaymentTransaction WHERE reference = ? OR operatorReference = ?`, [value, value]);
}
