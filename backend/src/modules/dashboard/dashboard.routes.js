import { z } from 'zod';
import { Router } from 'express';
import * as service from './dashboard.service.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';

const periodSchema = z.object({
  query: z.object({
    from: z.string().datetime(),
    to: z.string().datetime(),
    limit: z.coerce.number().int().min(1).max(50).optional(),
  }),
});

const router = Router();
const isStaff = requireRole('ADMIN', 'PRODUCT_MANAGER');
router.use(requireAuth, isStaff);

router.get('/kpis', validate(periodSchema), async (req, res) => {
  res.json(await service.getKPIs(req.query));
});

router.get('/top-products', validate(periodSchema), async (req, res) => {
  res.json(await service.getTopProducts(req.query));
});

router.get('/alerts', async (req, res) => {
  res.json(await service.getAlerts());
});

export default router;