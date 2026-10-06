import { randomUUID } from 'node:crypto';
import { get, all, run, transaction } from '../../db/client.js';
import { notFound, badRequest, conflict } from '../../middleware/errorHandler.js';
import { merchantClient } from '../integrations/googleMerchant.js';
import { logger } from '../../config/logger.js';

function slugify(text) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function getRelations(productId) {
  const [images, colors, sizes] = await Promise.all([
    all(`SELECT * FROM ProductImage WHERE productId = ? ORDER BY position ASC`, [productId]),
    all(`SELECT * FROM ProductColor WHERE productId = ?`, [productId]),
    all(`SELECT * FROM ProductSize WHERE productId = ?`, [productId]),
  ]);
  return { images, colors, sizes };
}

// Les indicateurs sont stockés en INTEGER (0/1) : l'API les expose en booléens,
// format attendu par le schéma de mise à jour (sinon le back-office, qui renvoie
// le produit tel que lu, voyait chaque modification refusée en 400).
async function hydrate(product) {
  if (!product) return null;
  const { images, colors, sizes } = await getRelations(product.id);
  return {
    ...product,
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

export async function listProducts({ category, status, page = 1, pageSize = 20 } = {}) {
  const conditions = [];
  const params = [];
  if (category) { conditions.push('category = ?'); params.push(category); }
  if (status) { conditions.push('status = ?'); params.push(status); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const offset = (page - 1) * pageSize;
  const items = (await all(
    `SELECT * FROM Product ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  )).map((product) => hydrate(product));

  const [{ total }, hydratedItems] = await Promise.all([
    get(`SELECT COUNT(*) as total FROM Product ${where}`, params), Promise.all(items),
  ]);
  return { items: hydratedItems, total: Number(total), page, pageSize };
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
  const { images = [], colors = [], sizes = [], ...data } = input;
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
  });

  const product = await getProductById(id);
  await syncToMerchantSafely(product, product);
  return product;
}

export async function updateProduct(id, input) {
  const existing = await get(`SELECT * FROM Product WHERE id = ?`, [id]);
  if (!existing) throw notFound('Produit introuvable.');

  const { images, colors, sizes, ...data } = input;
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