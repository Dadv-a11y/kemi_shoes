import { randomUUID } from 'node:crypto';
import { get, all, run } from '../../db/client.js';
import { notFound, badRequest } from '../../middleware/errorHandler.js';

export async function createReview({ productId, userId, rating, comment }) {
  const product = await get(`SELECT id FROM Product WHERE id = ?`, [productId]);
  if (!product) throw notFound('Produit introuvable.');
  if (rating < 1 || rating > 5) throw badRequest('La note doit être comprise entre 1 et 5.');

  const id = randomUUID();
  await run(
    `INSERT INTO Review (id, productId, userId, rating, comment, status) VALUES (?, ?, ?, ?, ?, 'pending')`,
    [id, productId, userId ?? null, rating, comment]
  );
  return get(`SELECT * FROM Review WHERE id = ?`, [id]);
}

export async function listReviews({ productId, status } = {}) {
  const conditions = [];
  const params = [];
  if (productId) { conditions.push('productId = ?'); params.push(productId); }
  if (status) { conditions.push('status = ?'); params.push(status); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return all(`SELECT * FROM Review ${where} ORDER BY createdAt DESC`, params);
}

export async function moderateReview(id, status) {
  if (!['approved', 'hidden', 'pending'].includes(status)) throw badRequest('Statut de modération invalide.');
  const review = await get(`SELECT id FROM Review WHERE id = ?`, [id]);
  if (!review) throw notFound('Avis introuvable.');
  await run(`UPDATE Review SET status = ? WHERE id = ?`, [status, id]);
  return get(`SELECT * FROM Review WHERE id = ?`, [id]);
}

/**
 * Résumé utilisé sur la fiche produit publique — uniquement les avis approuvés.
 */
export async function getProductRatingSummary(productId) {
  const row = await get(
    `SELECT COUNT(*) as count, AVG(rating) as average FROM Review WHERE productId = ? AND status = 'approved'`,
    [productId]
  );
  return { count: row.count, average: row.count > 0 ? Math.round(row.average * 10) / 10 : null };
}