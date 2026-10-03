import * as productsService from './products.service.js';
import { audit } from '../../middleware/audit.js';

export async function list(req, res) {
  res.json(await productsService.listProducts(req.query));
}

export async function getBySlug(req, res) {
  const locale = req.query.locale === 'en' ? 'en' : 'fr';
  res.json(await productsService.getProductBySlug(req.params.slug, locale));
}

export async function getById(req, res) {
  res.json(await productsService.getProductById(req.params.id));
}

export async function create(req, res) {
  const product = await productsService.createProduct(req.body);
  audit(req, { action: 'product.created', entityType: 'Product', entityId: product.id, metadata: { nameFr: product.nameFr } });
  res.status(201).json(product);
}

export async function update(req, res) {
  const product = await productsService.updateProduct(req.params.id, req.body);
  audit(req, { action: 'product.updated', entityType: 'Product', entityId: product.id });
  res.json(product);
}

export async function remove(req, res) {
  await productsService.deleteProduct(req.params.id);
  audit(req, { action: 'product.deleted', entityType: 'Product', entityId: req.params.id });
  res.status(204).send();
}

export async function updateSizeAvailability(req, res) {
  const product = await productsService.setSizeAvailability(req.params.id, req.body.size, req.body.available);
  audit(req, {
    action: 'product.size_availability_changed',
    entityType: 'Product',
    entityId: product.id,
    metadata: { size: req.body.size, available: req.body.available },
  });
  res.json(product);
}

/**
 * Réception d'une image uploadée (multer a déjà validé type/taille et écrit le
 * fichier sur disque sous un nom aléatoire — voir products.upload.js).
 * Renvoie l'URL publique à inclure ensuite dans le tableau `images` du produit.
 */
export function uploadImage(req, res) {
  if (!req.file) return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Aucun fichier reçu.' } });
  audit(req, { action: 'product.image_uploaded', entityType: 'ProductImage', metadata: { filename: req.file.filename } });
  res.status(201).json({ url: `/uploads/products/${req.file.filename}` });
}