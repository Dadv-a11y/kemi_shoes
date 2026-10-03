import { z } from 'zod';
import { Router } from 'express';
import * as service from './content.service.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { audit } from '../../middleware/audit.js';

const upsertSchema = z.object({
  params: z.object({ slug: z.string().min(1) }),
  body: z.object({
    titleFr: z.string().min(1),
    titleEn: z.string().optional(),
    bodyFr: z.string().min(1),
    bodyEn: z.string().optional(),
  }),
});

const router = Router();

router.get('/', async (req, res) => res.json(await service.listPages())); // public
router.get('/:slug', async (req, res) => res.json(await service.getPageBySlug(req.params.slug))); // public

router.put('/:slug', requireAuth, requireRole('ADMIN', 'PRODUCT_MANAGER'), validate(upsertSchema), async (req, res) => {
  const page = await service.upsertPage(req.params.slug, req.body);
  audit(req, { action: 'content.updated', entityType: 'ContentPage', entityId: page.id, metadata: { slug: req.params.slug } });
  res.json(page);
});

export default router;