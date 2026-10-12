import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { audit } from '../../middleware/audit.js';
import * as service from './categories.service.js';

const router = Router();
const canManage = requireRole('ADMIN', 'PRODUCT_MANAGER');

const body = {
  nameFr: z.string().min(1).max(60),
  nameEn: z.string().max(60).optional(),
  position: z.number().int().min(0).max(999).optional(),
  active: z.boolean().optional(),
};
const idParams = z.object({ id: z.string().min(1).max(80) });

// Public : seules les catégories qui ont des produits (+ « Nouveautés » si applicable).
router.get('/', async (req, res) => res.json({ items: await service.listPublicCategories() }));

router.get('/all', requireAuth, canManage, async (req, res) => res.json({ items: await service.listAllCategories() }));

router.post('/', requireAuth, canManage, validate(z.object({ body: z.object(body) })), async (req, res) => {
  const category = await service.createCategory(req.body);
  audit(req, { action: 'category.created', entityType: 'Category', entityId: category.id, metadata: { slug: category.slug } });
  res.status(201).json(category);
});

router.patch('/:id', requireAuth, canManage, validate(z.object({ params: idParams, body: z.object(body).partial() })), async (req, res) => {
  const category = await service.updateCategory(req.params.id, req.body);
  audit(req, { action: 'category.updated', entityType: 'Category', entityId: category.id });
  res.json(category);
});

router.delete('/:id', requireAuth, canManage, validate(z.object({ params: idParams })), async (req, res) => {
  await service.deleteCategory(req.params.id);
  audit(req, { action: 'category.deleted', entityType: 'Category', entityId: req.params.id });
  res.status(204).send();
});

export default router;
