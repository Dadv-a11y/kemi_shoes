import { randomUUID } from 'node:crypto';
import { get, all, run, transaction } from '../../db/client.js';
import { notFound } from '../../middleware/errorHandler.js';

export async function listAddresses(userId) {
  return all(`SELECT * FROM Address WHERE userId = ? ORDER BY isDefault DESC, createdAt ASC`, [userId]);
}

async function getOwnedAddress(id, userId) {
  const address = await get(`SELECT * FROM Address WHERE id = ? AND userId = ?`, [id, userId]);
  if (!address) throw notFound('Adresse introuvable.');
  return address;
}

export async function createAddress(userId, input) {
  const id = randomUUID();
  const { total } = await get(`SELECT COUNT(*) as total FROM Address WHERE userId = ?`, [userId]);
  // La première adresse d'un compte devient automatiquement l'adresse par défaut.
  const isDefault = input.isDefault || Number(total) === 0;
  await transaction(async ({ query }) => {
    if (isDefault) await query(`UPDATE Address SET isDefault = 0 WHERE userId = ?`, [userId]);
    await query(
      `INSERT INTO Address (id, userId, label, fullName, phone, country, city, district, street, isDefault)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, input.label ?? null, input.fullName, input.phone, input.country, input.city, input.district ?? null, input.street, isDefault ? 1 : 0]
    );
  });
  return getOwnedAddress(id, userId);
}

export async function updateAddress(id, userId, input) {
  const current = await getOwnedAddress(id, userId);
  const next = { ...current, ...input };
  await transaction(async ({ query }) => {
    if (input.isDefault) await query(`UPDATE Address SET isDefault = 0 WHERE userId = ?`, [userId]);
    await query(
      `UPDATE Address SET label = ?, fullName = ?, phone = ?, country = ?, city = ?, district = ?, street = ?, isDefault = ? WHERE id = ?`,
      [next.label ?? null, next.fullName, next.phone, next.country, next.city, next.district ?? null, next.street, next.isDefault ? 1 : 0, id]
    );
  });
  return getOwnedAddress(id, userId);
}

export async function deleteAddress(id, userId) {
  const address = await getOwnedAddress(id, userId);
  await run(`DELETE FROM Address WHERE id = ?`, [id]);
  if (address.isDefault) {
    const next = await get(`SELECT id FROM Address WHERE userId = ? ORDER BY createdAt ASC LIMIT 1`, [userId]);
    if (next) await run(`UPDATE Address SET isDefault = 1 WHERE id = ?`, [next.id]);
  }
}
