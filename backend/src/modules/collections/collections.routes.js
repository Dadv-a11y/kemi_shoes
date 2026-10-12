import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { audit } from '../../middleware/audit.js';
import { listProducts } from '../products/products.service.js';
import * as service from './collections.service.js';

const router = Router();
const canManage = requireRole('ADMIN', 'PRODUCT_MANAGER');

const body = {
  nameFr: z.string().min(1).max(80),
  nameEn: z.string().max(80).optional(),
  descriptionFr: z.string().max(400).optional(),
  descriptionEn: z.string().max(400).optional(),
  position: z.number().int().min(0).max(999).optional(),
  active: z.boolean().optional(),
};
const idParams = z.object({ id: z.string().uuid() });

/**
 * Public. `showcase` indique si la section « Nos collections » doit s'afficher (au moins
 * MIN_COLLECTIONS_FOR_SHOWCASE collections avec produits) ; chaque collection porte sa meilleure vente.
 */
router.get('/', async (req, res) => {
  const collections = await service.listPublicCollections();
  const items = await Promise.all(collections.map(async (collection) => {
    const { items: best } = await listProducts({ collection: collection.slug, status: 'active', sort: 'popular', pageSize: 1 });
    return { ...collection, bestProduct: best[0] ?? null };
  }));
  res.json({ items, showcase: items.length >= service.MIN_COLLECTIONS_FOR_SHOWCASE });
});

router.get('/all', requireAuth, canManage, async (req, res) => res.json({ items: await service.listAllCollections() }));

router.post('/', requireAuth, canManage, validate(z.object({ body: z.object(body) })), async (req, res) => {
  const collection = await service.createCollection(req.body);
  audit(req, { action: 'collection.created', entityType: 'Collection', entityId: collection.id, metadata: { slug: collection.slug } });
  res.status(201).json(collection);
});

router.patch('/:id', requireAuth, canManage, validate(z.object({ params: idParams, body: z.object(body).partial() })), async (req, res) => {
  const collection = await service.updateCollection(req.params.id, req.body);
  audit(req, { action: 'collection.updated', entityType: 'Collection', entityId: collection.id });
  res.json(collection);
});

router.delete('/:id', requireAuth, canManage, validate(z.object({ params: idParams })), async (req, res) => {
  await service.deleteCollection(req.params.id);
  audit(req, { action: 'collection.deleted', entityType: 'Collection', entityId: req.params.id });
  res.status(204).send();
});

export default router;
