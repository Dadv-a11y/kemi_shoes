import { get, all, run } from '../../db/client.js';
import { notFound, badRequest } from '../../middleware/errorHandler.js';
import { revokeAllSessions } from '../auth/session.service.js';

export async function listUsers({ role, page = 1, pageSize = 50 } = {}) {
  const where = role ? `WHERE u.role = ?` : '';
  const params = role ? [role] : [];
  const items = await all(
    `SELECT u.id, u.name, u.email, u.phone, u.role, u.provider, u.createdAt,
            COUNT(o.id) AS orderCount, MAX(o.createdAt) AS lastOrderAt
       FROM User u LEFT JOIN "Order" o ON o.userId = u.id
       ${where}
      GROUP BY u.id
      ORDER BY u.createdAt DESC
      LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize]
  );
  const { total } = await get(`SELECT COUNT(*) AS total FROM User u ${where}`, params);
  return {
    items: items.map((item) => ({ ...item, orderCount: Number(item.orderCount ?? item.ordercount ?? 0), lastOrderAt: item.lastOrderAt ?? item.lastorderat ?? null })),
    total: Number(total),
    page,
    pageSize,
  };
}

export async function updateUserRole(id, role, actorId) {
  if (id === actorId && role !== 'ADMIN') throw badRequest('Vous ne pouvez pas retirer votre propre rôle administrateur.');
  const user = await get(`SELECT id FROM User WHERE id = ?`, [id]);
  if (!user) throw notFound('Utilisateur introuvable.');
  await run(`UPDATE User SET role = ?, updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`, [role, id]);
  // Le rôle est inscrit dans l'access token : on force une reconnexion pour qu'il soit pris en compte.
  await revokeAllSessions(id);
  return get(`SELECT id, name, email, phone, role, provider, createdAt FROM User WHERE id = ?`, [id]);
}
