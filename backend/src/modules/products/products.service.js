import { randomUUID } from 'node:crypto';
import { get, all, run, transaction } from '../../db/client.js';
import { notFound, badRequest, conflict } from '../../middleware/errorHandler.js';
import { merchantClient } from '../integrations/googleMerchant.js';
import { logger } from '../../config/logger.js';
import { slugify } from '../../utils/slug.js';
import { NEW_PRODUCT_DAYS } from './products.constants.js';
import { resolveCategorySlug, NEW_CATEGORY_SLUG } from '../categories/categories.service.js';
import { getCategoryBySlug } from '../categories/categories.service.js';
import { assertCollectionsExist } from '../collections/collections.service.js';

async function getRelations(productId) {
  const [images, colors, sizes, collections] = await Promise.all([
    all(`SELECT * FROM ProductImage WHERE productId = ? ORDER BY position ASC`, [productId]),
    all(`SELECT * FROM ProductColor WHERE productId = ?`, [productId]),
    all(`SELECT * FROM ProductSize WHERE productId = ?`, [productId]),
    all(`SELECT collectionId FROM ProductCollection WHERE productId = ?`, [productId]),
  ]);
  return { images, colors, sizes, collectionIds: collections.map((row) => row.collectionId) };
}

// Les indicateurs sont stockés en INTEGER (0/1) : l'API les expose en booléens,
// format attendu par le schéma de mise à jour (sinon le back-office, qui renvoie
// le produit tel que lu, voyait chaque modification refusée en 400).
export { NEW_PRODUCT_DAYS };
const newSince = () => new Date(Date.now() - NEW_PRODUCT_DAYS * 24 * 60 * 60 * 1000).toISOString();
const isRecent = (createdAt) => new Date(createdAt).getTime() >= Date.now() - NEW_PRODUCT_DAYS * 24 * 60 * 60 * 1000;

async function hydrate(product) {
  if (!product) return null;
  const [{ images, colors, sizes, collectionIds }, category] = await Promise.all([getRelations(product.id), getCategoryBySlug(product.category)]);
  return {
    ...product,
    // Libellés de la catégorie (gérée en base) : la boutique n'a pas à les connaître.
    categoryName: { fr: category?.nameFr ?? product.category, en: category?.nameEn ?? product.category },
    isNew: isRecent(product.createdAt),
    unitsSold: Number(product.unitsSold ?? 0),
    collectionIds,
    colorCustomizable: Boolean(product.colorCustomizable),
    materialCustomizable: Boolean(product.materialCustomizable),
    images: images.map((image) => ({ ...image, isMain: Boolean(image.isMain) })),
    colors,
    sizes: sizes.map((size) => ({ ...size, available: Boolean(size.available) })),
  };
}

/**
 * Best-effort : la synchronisation Merchant Center ne doit jamais faire
 * échouer une requête de gestion produit côté admin, même si Google renvoie
 * une erreur ou si l'intégration n'est pas configurée.
 */
async function syncToMerchantSafely(product, relations) {
  try {
    await merchantClient.syncProduct(product, relations);
  } catch (err) {
    logger.error({ err, productId: product.id }, 'merchant_sync_error');
  }
}

const SORTS = {
  newest: 'p.createdAt DESC',
  priceAsc: 'p.price ASC, p.createdAt DESC',
  priceDesc: 'p.price DESC, p.createdAt DESC',
  // Meilleures ventes : unités vendues (commandes non annulées), puis les plus récents.
  popular: 'COALESCE(s.units, 0) DESC, p.createdAt DESC',
};

const SALES_JOIN = `LEFT JOIN (
  SELECT oi.productId, SUM(oi.quantity) AS units FROM OrderItem oi JOIN "Order" o ON o.id = oi.orderId
  WHERE o.status <> 'CANCELLED' GROUP BY oi.productId
) s ON s.productId = p.id`;

/** Conditions SQL communes à la liste et aux facettes (alias de table : p). */
function productFilters({ category, status, size, color, minPrice, maxPrice, collection }) {
  const conditions = [];
  const params = [];
  if (category === NEW_CATEGORY_SLUG || category === 'Nouveautes') {
    conditions.push('p.createdAt >= ?');
    params.push(newSince());
  } else if (category) {
    conditions.push('p.category = ?');
    params.push(slugify(category));
  }
  if (status) { conditions.push('p.status = ?'); params.push(status); }
  if (size) { conditions.push('EXISTS (SELECT 1 FROM ProductSize ps WHERE ps.productId = p.id AND ps.size = ? AND ps.available = 1)'); params.push(size); }
  if (color) { conditions.push('EXISTS (SELECT 1 FROM ProductColor pc WHERE pc.productId = p.id AND lower(pc.name) = lower(?))'); params.push(color); }
  if (minPrice !== undefined) { conditions.push('p.price >= ?'); params.push(minPrice); }
  if (maxPrice !== undefined) { conditions.push('p.price <= ?'); params.push(maxPrice); }
  if (collection) { conditions.push('EXISTS (SELECT 1 FROM ProductCollection pcol JOIN Collection col ON col.id = pcol.collectionId WHERE pcol.productId = p.id AND col.slug = ?)'); params.push(collection); }
  return { where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

export async function listProducts({ page = 1, pageSize = 20, sort = 'newest', ...filters } = {}) {
  const { where, params } = productFilters(filters);
  const offset = (page - 1) * pageSize;
  const items = (await all(
    `SELECT p.*, COALESCE(s.units, 0) AS unitsSold FROM Product p ${SALES_JOIN} ${where} ORDER BY ${SORTS[sort] ?? SORTS.newest} LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )).map((product) => hydrate(product));

  const [{ total }, hydratedItems] = await Promise.all([
    get(`SELECT COUNT(*) as total FROM Product p ${where}`, params), Promise.all(items),
  ]);
  return { items: hydratedItems, total: Number(total), page, pageSize };
}

/** Valeurs de filtre réellement disponibles (tailles en stock, couleurs, fourchette de prix) pour un périmètre. */
export async function getFacets(filters = {}) {
  const { where, params } = productFilters({ status: 'active', ...filters, size: undefined, color: undefined, minPrice: undefined, maxPrice: undefined });
  const scope = `SELECT p.id FROM Product p ${where}`;
  const [sizes, colors, price] = await Promise.all([
    all(`SELECT DISTINCT ps.size FROM ProductSize ps WHERE ps.available = 1 AND ps.productId IN (${scope})`, params),
    all(`SELECT lower(pc.name) AS key, MIN(pc.name) AS name, MIN(pc.hex) AS hex FROM ProductColor pc WHERE pc.productId IN (${scope}) GROUP BY lower(pc.name) ORDER BY MIN(pc.name)`, params),
    get(`SELECT MIN(p.price) AS min, MAX(p.price) AS max FROM Product p ${where}`, params),
  ]);
  const byNumber = (a, b) => Number(a) - Number(b) || String(a).localeCompare(String(b));
  return {
    sizes: sizes.map((row) => row.size).sort(byNumber),
    colors: colors.map(({ name, hex }) => ({ name, hex })),
    minPrice: price?.min === null || price?.min === undefined ? null : Number(price.min),
    maxPrice: price?.max === null || price?.max === undefined ? null : Number(price.max),
  };
}

export async function getProductById(id) {
  const product = await get(`SELECT * FROM Product WHERE id = ?`, [id]);
  if (!product) throw notFound('Produit introuvable.');
  return hydrate(product);
}

export async function getProductBySlug(slug, locale = 'fr') {
  const column = locale === 'en' ? 'slugEn' : 'slugFr';
  const product = await get(`SELECT * FROM Product WHERE ${column} = ?`, [slug]);
  if (!product) throw notFound('Produit introuvable.');
  return hydrate(product);
}

export async function createProduct(input) {
  const { images = [], colors = [], sizes = [], collectionIds = [], ...data } = input;
  data.category = await resolveCategorySlug(data.category);
  await assertCollectionsExist(collectionIds);
  const id = randomUUID();
  const slugFr = data.slugFr || slugify(data.nameFr);
  const slugEn = data.slugEn || slugify(data.nameEn || data.nameFr);

  const existingSlug = await get(`SELECT id FROM Product WHERE slugFr = ? OR slugEn = ?`, [slugFr, slugEn]);
  if (existingSlug) throw badRequest('Un produit avec un slug identique existe déjà.');

  await transaction(async ({ query }) => {
    await query(
      `INSERT INTO Product (id, slugFr, slugEn, nameFr, nameEn, descriptionFr, descriptionEn, category, price,
         compareAtPrice, status, colorCustomizable, materialCustomizable)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, slugFr, slugEn, data.nameFr, data.nameEn, data.descriptionFr, data.descriptionEn, data.category,
        data.price, data.compareAtPrice ?? null, data.status ?? 'draft',
        data.colorCustomizable !== false ? 1 : 0, data.materialCustomizable !== false ? 1 : 0,
      ]
    );
    // Séquentiel : un client pg en transaction ne traite qu'une requête à la fois.
    for (const [i, img] of images.entries()) {
      await query(
        `INSERT INTO ProductImage (id, productId, url, position, isMain) VALUES (?, ?, ?, ?, ?)`,
        [randomUUID(), id, img.url, i, img.isMain ? 1 : (i === 0 ? 1 : 0)]
      );
    }
    for (const c of colors) {
      await query(
        `INSERT INTO ProductColor (id, productId, name, hex) VALUES (?, ?, ?, ?)`,
        [randomUUID(), id, c.name, c.hex]
      );
    }
    for (const s of sizes) {
      await query(
        `INSERT INTO ProductSize (id, productId, size, available) VALUES (?, ?, ?, ?)`,
        [randomUUID(), id, s.size, s.available === false ? 0 : 1]
      );
    }
    for (const collectionId of new Set(collectionIds)) {
      await query(`INSERT INTO ProductCollection (productId, collectionId) VALUES (?, ?)`, [id, collectionId]);
    }
  });

  const product = await getProductById(id);
  await syncToMerchantSafely(product, product);
  return product;
}

export async function updateProduct(id, input) {
  const existing = await get(`SELECT * FROM Product WHERE id = ?`, [id]);
  if (!existing) throw notFound('Produit introuvable.');

  const { images, colors, sizes, collectionIds, ...data } = input;
  if (data.category !== undefined) data.category = await resolveCategorySlug(data.category);
  if (collectionIds) await assertCollectionsExist(collectionIds);
  const merged = { ...existing, ...data };

  await transaction(async ({ query }) => {
    await query(
      `UPDATE Product SET nameFr=?, nameEn=?, descriptionFr=?, descriptionEn=?, category=?, price=?,
         compareAtPrice=?, status=?, colorCustomizable=?, materialCustomizable=?, updatedAt=strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ?`,
      [
        merged.nameFr, merged.nameEn, merged.descriptionFr, merged.descriptionEn, merged.category, merged.price,
        merged.compareAtPrice ?? null, merged.status, merged.colorCustomizable ? 1 : 0, merged.materialCustomizable ? 1 : 0,
        id,
      ]
    );

    if (images) {
      await query(`DELETE FROM ProductImage WHERE productId = ?`, [id]);
      for (const [i, img] of images.entries()) {
      await query(
        `INSERT INTO ProductImage (id, productId, url, position, isMain) VALUES (?, ?, ?, ?, ?)`,
        [randomUUID(), id, img.url, i, img.isMain ? 1 : (i === 0 ? 1 : 0)]
      );
    }
    }
    if (colors) {
      await query(`DELETE FROM ProductColor WHERE productId = ?`, [id]);
      for (const c of colors) {
      await query(
        `INSERT INTO ProductColor (id, productId, name, hex) VALUES (?, ?, ?, ?)`,
        [randomUUID(), id, c.name, c.hex]
      );
    }
    }
    if (collectionIds) {
      await query(`DELETE FROM ProductCollection WHERE productId = ?`, [id]);
      for (const collectionId of new Set(collectionIds)) {
        await query(`INSERT INTO ProductCollection (productId, collectionId) VALUES (?, ?)`, [id, collectionId]);
      }
    }
    if (sizes) {
      await query(`DELETE FROM ProductSize WHERE productId = ?`, [id]);
      for (const s of sizes) {
      await query(
        `INSERT INTO ProductSize (id, productId, size, available) VALUES (?, ?, ?, ?)`,
        [randomUUID(), id, s.size, s.available === false ? 0 : 1]
      );
    }
    }
  });

  const product = await getProductById(id);
  await syncToMerchantSafely(product, product);
  return product;
}

export async function deleteProduct(id) {
  const existing = await get(`SELECT id FROM Product WHERE id = ?`, [id]);
  if (!existing) throw notFound('Produit introuvable.');
  // L'historique des commandes référence le produit : on refuse la suppression
  // plutôt que de casser la contrainte (et la comptabilité).
  const { total } = await get(`SELECT COUNT(*) as total FROM OrderItem WHERE productId = ?`, [id]);
  if (Number(total) > 0) throw conflict('Ce produit figure dans des commandes : passez-le en brouillon plutôt que de le supprimer.');
  await run(`DELETE FROM Product WHERE id = ?`, [id]); // cascade sur images/couleurs/tailles/avis

  try {
    await merchantClient.deleteProduct(id);
  } catch (err) {
    logger.error({ err, productId: id }, 'merchant_delete_error');
  }
}

/**
 * Met à jour uniquement la disponibilité d'une taille précise — utilisé par
 * l'écran admin pour retirer temporairement une taille sans toucher au reste
 * de la fiche produit.
 */
export async function setSizeAvailability(productId, size, available) {
  const row = await get(`SELECT id FROM ProductSize WHERE productId = ? AND size = ?`, [productId, size]);
  if (!row) throw notFound('Taille introuvable pour ce produit.');
  await run(`UPDATE ProductSize SET available = ? WHERE id = ?`, [available ? 1 : 0, row.id]);
  return getProductById(productId);
}