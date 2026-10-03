import { z } from 'zod';
import { Router } from 'express';
import * as service from './users.service.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { audit } from '../../middleware/audit.js';

const roles = z.enum(['CUSTOMER', 'PRODUCT_MANAGER', 'ADMIN']);

const listSchema = z.object({
  query: z.object({
    role: roles.optional(),
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

const roleSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ role: roles }),
});

const router = Router();
router.use(requireAuth);

router.get('/', requireRole('ADMIN', 'PRODUCT_MANAGER'), validate(listSchema), async (req, res) => {
  res.json(await service.listUsers(req.query));
});
router.patch('/:id/role', requireRole('ADMIN'), validate(roleSchema), async (req, res) => {
  const user = await service.updateUserRole(req.params.id, req.body.role, req.user.id);
  audit(req, { action: 'user.role_changed', entityType: 'User', entityId: user.id, metadata: { role: req.body.role } });
  res.json(user);
});

export default router;
