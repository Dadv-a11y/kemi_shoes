import { randomUUID } from 'node:crypto';
import { get, all, run } from '../../db/client.js';
import { badRequest, conflict, notFound } from '../../middleware/errorHandler.js';
import { slugify } from '../../utils/slug.js';
import { NEW_PRODUCT_DAYS } from '../products/products.constants.js';

/** Slug réservé à la vue « Nouveautés » (calculée, jamais enregistrée en base). */
export const NEW_CATEGORY_SLUG = 'nouveautes';

const counts = `(SELECT COUNT(*) FROM Product p WHERE p.category = c.slug AND p.status = 'active')`;

/**
 * Catégories visibles en boutique : celles qui ont au moins un produit publié, plus
 * « Nouveautés » tant qu'un produit a moins de NEW_PRODUCT_DAYS jours. Une catégorie vide
 * (ou « Nouveautés » sans nouveauté) disparaît donc des menus et de ses routes.
 */
export async function listPublicCategories() {
  const rows = await all(
    `SELECT c.id, c.slug, c.nameFr, c.nameEn, c.position, ${counts} AS count FROM Category c WHERE c.active = 1 ORDER BY c.position ASC, c.nameFr ASC`
  );
  const items = rows.map((row) => ({ ...row, count: Number(row.count), virtual: false })).filter((row) => row.count > 0);
  const since = new Date(Date.now() - NEW_PRODUCT_DAYS * 86400000).toISOString();
  const { total } = await get(`SELECT COUNT(*) AS total FROM Product WHERE status = 'active' AND createdAt >= ?`, [since]);
  if (Number(total) > 0) {
    items.push({ id: NEW_CATEGORY_SLUG, slug: NEW_CATEGORY_SLUG, nameFr: 'Nouveautés', nameEn: 'New in', position: 999, count: Number(total), virtual: true });
  }
  return items;
}

/** Liste complète pour l'admin (y compris inactives et vides). */
export async function listAllCategories() {
  const rows = await all(
    `SELECT c.*, (SELECT COUNT(*) FROM Product p WHERE p.category = c.slug) AS productCount FROM Category c ORDER BY c.position ASC, c.nameFr ASC`
  );
  return rows.map((row) => ({ ...row, active: Boolean(row.active), productCount: Number(row.productCount ?? row.productcount ?? 0) }));
}

export async function getCategoryBySlug(slug) {
  return get(`SELECT * FROM Category WHERE slug = ?`, [slug]);
}

/** Valide la catégorie d'un produit et renvoie son slug normalisé. */
export async function resolveCategorySlug(value) {
  const slug = slugify(value);
  if (slug === NEW_CATEGORY_SLUG) throw badRequest('« Nouveautés » est automatique : choisissez la vraie catégorie du produit.');
  const category = slug ? await getCategoryBySlug(slug) : null;
  if (!category) throw badRequest(`Catégorie inconnue : ${value}.`);
  return category.slug;
}

export async function createCategory({ nameFr, nameEn, position, active }) {
  const slug = slugify(nameFr);
  if (!slug || slug === NEW_CATEGORY_SLUG) throw badRequest('Nom de catégorie invalide ou réservé.');
  if (await getCategoryBySlug(slug)) throw conflict('Une catégorie avec ce nom existe déjà.');
  const id = randomUUID();
  const { max } = await get(`SELECT COALESCE(MAX(position), 0) AS max FROM Category`);
  await run(`INSERT INTO Category (id, slug, nameFr, nameEn, position, active) VALUES (?, ?, ?, ?, ?, ?)`, [id, slug, nameFr, nameEn || nameFr, position ?? Number(max) + 1, active === false ? 0 : 1]);
  return get(`SELECT * FROM Category WHERE id = ?`, [id]);
}

export async function updateCategory(id, { nameFr, nameEn, position, active }) {
  const existing = await get(`SELECT * FROM Category WHERE id = ?`, [id]);
  if (!existing) throw notFound('Catégorie introuvable.');
  // Le slug reste stable : il est référencé par les produits et par les URLs publiques.
  await run(
    `UPDATE Category SET nameFr = ?, nameEn = ?, position = ?, active = ?, updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
    [nameFr ?? existing.nameFr, nameEn ?? existing.nameEn, position ?? existing.position, active === undefined ? existing.active : (active ? 1 : 0), id]
  );
  return get(`SELECT * FROM Category WHERE id = ?`, [id]);
}

export async function deleteCategory(id) {
  const existing = await get(`SELECT * FROM Category WHERE id = ?`, [id]);
  if (!existing) throw notFound('Catégorie introuvable.');
  const { total } = await get(`SELECT COUNT(*) AS total FROM Product WHERE category = ?`, [existing.slug]);
  if (Number(total) > 0) throw conflict(`${total} produit(s) utilisent cette catégorie : reclassez-les avant de la supprimer.`);
  await run(`DELETE FROM Category WHERE id = ?`, [id]);
}
