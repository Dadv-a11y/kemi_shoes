import { randomUUID } from 'node:crypto';
import { get, all, run } from '../../db/client.js';
import { notFound } from '../../middleware/errorHandler.js';

function hydrate(zone) {
  if (!zone) return null;
  const paymentMethods = Array.isArray(zone.paymentMethods) ? zone.paymentMethods : JSON.parse(zone.paymentMethods ?? '[]');
  return { ...zone, paymentMethods, codAvailable: Boolean(zone.codAvailable), active: Boolean(zone.active) };
}

export async function listZones({ activeOnly = false } = {}) {
  const where = activeOnly ? 'WHERE active = 1' : '';
  return (await all(`SELECT * FROM DeliveryZone ${where} ORDER BY country, regionOrCity`)).map(hydrate);
}

export async function getZoneById(id) {
  const zone = await get(`SELECT * FROM DeliveryZone WHERE id = ?`, [id]);
  if (!zone) throw notFound('Zone de livraison introuvable.');
  return hydrate(zone);
}

export async function createZone(input) {
  const id = randomUUID();
  await run(
    `INSERT INTO DeliveryZone (id, country, regionOrCity, feeFcfa, etaMinHours, etaMaxHours, codAvailable, paymentMethods, active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, input.country, input.regionOrCity ?? null, input.feeFcfa, input.etaMinHours, input.etaMaxHours,
      input.codAvailable ? 1 : 0, JSON.stringify(input.paymentMethods), input.active !== false ? 1 : 0,
    ]
  );
  return getZoneById(id);
}

export async function updateZone(id, input) {
  const existing = await get(`SELECT * FROM DeliveryZone WHERE id = ?`, [id]);
  if (!existing) throw notFound('Zone de livraison introuvable.');
  const merged = { ...hydrate(existing), ...input };

  await run(
    `UPDATE DeliveryZone SET country=?, regionOrCity=?, feeFcfa=?, etaMinHours=?, etaMaxHours=?, codAvailable=?,
       paymentMethods=?, active=?, updatedAt=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
    [
      merged.country, merged.regionOrCity ?? null, merged.feeFcfa, merged.etaMinHours, merged.etaMaxHours,
      merged.codAvailable ? 1 : 0, JSON.stringify(merged.paymentMethods), merged.active ? 1 : 0, id,
    ]
  );
  return getZoneById(id);
}

export async function deleteZone(id) {
  const existing = await get(`SELECT id FROM DeliveryZone WHERE id = ?`, [id]);
  if (!existing) throw notFound('Zone de livraison introuvable.');
  await run(`DELETE FROM DeliveryZone WHERE id = ?`, [id]);
}