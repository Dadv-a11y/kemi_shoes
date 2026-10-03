import { z } from 'zod';
import { Router } from 'express';
import * as service from './orders.service.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole, optionalAuth } from '../../middleware/auth.js';
import { audit } from '../../middleware/audit.js';
import { forbidden } from '../../middleware/errorHandler.js';

const itemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive().default(1),
  size: z.string().min(1),
  color: z.string().optional(),
  customColor: z.string().optional(),
  customMaterial: z.string().optional(),
});

const createOrderSchema = z.object({
  body: z.object({
    items: z.array(itemSchema).min(1),
    deliveryZoneId: z.string().uuid(),
    address: z.object({
      country: z.string().min(1),
      city: z.string().min(1),
      district: z.string().optional(),
      street: z.string().min(1),
    }),
    guest: z.object({
      name: z.string().min(1),
      phone: z.string().min(6),
      email: z.string().email().optional(),
    }),
    paymentMethod: z.enum(['MOBILE_MONEY', 'CARD', 'CASH_ON_DELIVERY']),
    paymentPhone: z.string().min(6).optional(),
  }),
});

const updateStatusSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    status: z.enum(['PENDING', 'CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
    note: z.string().max(500).optional(),
  }),
});

const noteSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ note: z.string().max(1000) }),
});

const myOrdersSchema = z.object({
  query: z.object({
    status: z.enum(['PENDING', 'CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED', 'CANCELLED']).optional(),
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

const orderIdSchema = z.object({ params: z.object({ id: z.string().uuid() }) });

const listOrdersSchema = z.object({
  query: z.object({
    status: z.string().optional(),
    deliveryZoneId: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

const controller = {
  async create(req, res) {
    const result = await service.createOrder({ ...req.body, userId: req.user?.id });
    audit(req, { action: 'order.created', entityType: 'Order', entityId: result.order.id, metadata: { reference: result.order.reference } });
    res.status(201).json(result);
  },

  async list(req, res) {
    res.json(await service.listOrders(req.query));
  },

  async getById(req, res) {
    const order = await service.getOrderById(req.params.id);
    const isStaffUser = ['ADMIN', 'PRODUCT_MANAGER'].includes(req.user?.role);
    if (!isStaffUser && order.userId !== req.user?.id) throw forbidden();
    res.json(order);
  },

  async updateStatus(req, res) {
    const order = await service.updateOrderStatus(req.params.id, req.body.status, req.body.note);
    audit(req, { action: 'order.status_changed', entityType: 'Order', entityId: order.id, metadata: { status: req.body.status } });
    res.json(order);
  },

  async setNote(req, res) {
    const order = await service.setInternalNote(req.params.id, req.body.note);
    audit(req, { action: 'order.note_added', entityType: 'Order', entityId: order.id });
    res.json(order);
  },

  async myOrders(req, res) {
    // userId toujours imposé par le token : jamais lu depuis la query (IDOR).
    const { page, pageSize, status } = req.query;
    res.json(await service.listOrders({ page, pageSize, status, userId: req.user.id }));
  },
};

const router = Router();
const isStaff = requireRole('ADMIN', 'PRODUCT_MANAGER');

router.post('/', optionalAuth, validate(createOrderSchema), controller.create); // invité ou connecté
router.get('/me', requireAuth, validate(myOrdersSchema), controller.myOrders);
router.get('/', requireAuth, isStaff, validate(listOrdersSchema), controller.list);
router.get('/:id', requireAuth, validate(orderIdSchema), controller.getById);
router.patch('/:id/status', requireAuth, isStaff, validate(updateStatusSchema), controller.updateStatus);
router.patch('/:id/note', requireAuth, isStaff, validate(noteSchema), controller.setNote);

export default router;