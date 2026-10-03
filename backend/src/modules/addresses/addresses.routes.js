import { z } from 'zod';
import { Router } from 'express';
import * as service from './addresses.service.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';

const addressBody = z.object({
  label: z.string().max(60).optional(),
  fullName: z.string().min(1).max(120),
  phone: z.string().min(6).max(20),
  country: z.string().min(1).max(60),
  city: z.string().min(1).max(80),
  district: z.string().max(80).optional(),
  street: z.string().min(1).max(200),
  isDefault: z.boolean().optional(),
});
const idParams = z.object({ id: z.string().uuid() });

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => res.json(await service.listAddresses(req.user.id)));
router.post('/', validate(z.object({ body: addressBody })), async (req, res) => {
  res.status(201).json(await service.createAddress(req.user.id, req.body));
});
router.patch('/:id', validate(z.object({ params: idParams, body: addressBody.partial() })), async (req, res) => {
  res.json(await service.updateAddress(req.params.id, req.user.id, req.body));
});
router.delete('/:id', validate(z.object({ params: idParams })), async (req, res) => {
  await service.deleteAddress(req.params.id, req.user.id);
  res.status(204).send();
});

export default router;
