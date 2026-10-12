import { randomUUID } from 'node:crypto';
import { get, all, run } from '../../db/client.js';
import { badRequest, conflict, notFound } from '../../middleware/errorHandler.js';
import { slugify } from '../../utils/slug.js';

/** Nombre minimal de collections actives (avec produits) pour afficher « Nos collections » en boutique. */
export const MIN_COLLECTIONS_FOR_SHOWCASE = 3;

const activeProducts = `(SELECT COUNT(*) FROM ProductCollection pc JOIN Product p ON p.id = pc.productId WHERE pc.collectionId = c.id AND p.status = 'active')`;

/** Collections actives qui contiennent au moins un produit publié (la meilleure vente est ajoutée par le service produits). */
export async function listPublicCollections() {
  const rows = await all(`SELECT c.*, ${activeProducts} AS count FROM Collection c WHERE c.active = 1 ORDER BY c.position ASC, c.nameFr ASC`);
  return rows.map((row) => ({ ...row, active: true, count: Number(row.count) })).filter((row) => row.count > 0);
}

export async function listAllCollections() {
  const rows = await all(`SELECT c.*, (SELECT COUNT(*) FROM ProductCollection pc WHERE pc.collectionId = c.id) AS productCount FROM Collection c ORDER BY c.position ASC, c.nameFr ASC`);
  return rows.map((row) => ({ ...row, active: Boolean(row.active), productCount: Number(row.productCount ?? row.productcount ?? 0) }));
}

export async function getCollectionBySlug(slug) {
  return get(`SELECT * FROM Collection WHERE slug = ?`, [slug]);
}

export async function createCollection({ nameFr, nameEn, descriptionFr, descriptionEn, position, active }) {
  const slug = slugify(nameFr);
  if (!slug) throw badRequest('Nom de collection invalide.');
  if (await getCollectionBySlug(slug)) throw conflict('Une collection avec ce nom existe déjà.');
  const id = randomUUID();
  const { max } = await get(`SELECT COALESCE(MAX(position), 0) AS max FROM Collection`);
  await run(
    `INSERT INTO Collection (id, slug, nameFr, nameEn, descriptionFr, descriptionEn, position, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, slug, nameFr, nameEn || nameFr, descriptionFr ?? null, descriptionEn ?? null, position ?? Number(max) + 1, active === false ? 0 : 1]
  );
  return get(`SELECT * FROM Collection WHERE id = ?`, [id]);
}

export async function updateCollection(id, input) {
  const existing = await get(`SELECT * FROM Collection WHERE id = ?`, [id]);
  if (!existing) throw notFound('Collection introuvable.');
  const next = { ...existing, ...Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) };
  await run(
    `UPDATE Collection SET nameFr = ?, nameEn = ?, descriptionFr = ?, descriptionEn = ?, position = ?, active = ?, updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
    [next.nameFr, next.nameEn, next.descriptionFr ?? null, next.descriptionEn ?? null, next.position, typeof next.active === 'boolean' ? (next.active ? 1 : 0) : next.active, id]
  );
  return get(`SELECT * FROM Collection WHERE id = ?`, [id]);
}

export async function deleteCollection(id) {
  const { rowCount } = (await run(`DELETE FROM Collection WHERE id = ?`, [id])) ?? {};
  if (rowCount === 0) throw notFound('Collection introuvable.');
}

/** Remplace les collections d'un produit (appelé par le service produits dans sa transaction). */
export async function assertCollectionsExist(ids) {
  if (!ids.length) return;
  const rows = await all(`SELECT id FROM Collection WHERE id = ANY(?::text[])`, [ids]);
  if (rows.length !== new Set(ids).size) throw badRequest('Collection inconnue.');
}
