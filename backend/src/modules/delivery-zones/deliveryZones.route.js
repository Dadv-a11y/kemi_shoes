import { z } from 'zod';
import { Router } from 'express';
import * as service from './deliveryZones.service.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { audit } from '../../middleware/audit.js';

const zoneBase = {
  country: z.string().min(1),
  regionOrCity: z.string().optional(),
  feeFcfa: z.number().int().min(0),
  etaMinHours: z.number().int().min(1),
  etaMaxHours: z.number().int().min(1),
  codAvailable: z.boolean().optional(),
  paymentMethods: z.array(z.enum(['mobile_money', 'card', 'cod'])).min(1),
  active: z.boolean().optional(),
};
const createZoneSchema = z.object({ body: z.object(zoneBase) });
const updateZoneSchema = z.object({ params: z.object({ id: z.string().uuid() }), body: z.object(zoneBase).partial() });
const zoneIdSchema = z.object({ params: z.object({ id: z.string().uuid() }) });

const controller = {
  async list(req, res) {
    res.json(await service.listZones({ activeOnly: req.query.activeOnly === 'true' }));
  },
  async getById(req, res) {
    res.json(await service.getZoneById(req.params.id));
  },
  async create(req, res) {
    const zone = await service.createZone(req.body);
    audit(req, { action: 'delivery_zone.created', entityType: 'DeliveryZone', entityId: zone.id, metadata: req.body });
    res.status(201).json(zone);
  },
  async update(req, res) {
    const zone = await service.updateZone(req.params.id, req.body);
    audit(req, { action: 'delivery_zone.updated', entityType: 'DeliveryZone', entityId: zone.id, metadata: req.body });
    res.json(zone);
  },
  async remove(req, res) {
    await service.deleteZone(req.params.id);
    audit(req, { action: 'delivery_zone.deleted', entityType: 'DeliveryZone', entityId: req.params.id });
    res.status(204).send();
  },
};

const router = Router();
const canManageZones = requireRole('ADMIN');

router.get('/', controller.list); // public : le checkout doit pouvoir lire les zones actives
router.get('/:id', validate(zoneIdSchema), controller.getById);
router.post('/', requireAuth, canManageZones, validate(createZoneSchema), controller.create);
router.patch('/:id', requireAuth, canManageZones, validate(updateZoneSchema), controller.update);
router.delete('/:id', requireAuth, canManageZones, validate(zoneIdSchema), controller.remove);

export default router;