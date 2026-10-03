import { z } from 'zod';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as service from './payments.service.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { isTest } from '../../config/env.js';

const orderIdParams = z.object({ id: z.string().uuid() });

const retrySchema = z.object({
  params: orderIdParams,
  body: z.object({
    phone: z.string().min(6).optional(),
    paymentMethod: z.enum(['MOBILE_MONEY', 'CARD']).optional(),
  }),
});

const confirmSchema = z.object({
  params: orderIdParams,
  body: z.object({ reference: z.string().min(1).max(100) }),
});

// Relancer un paiement déclenche un push USSD sur un téléphone : limite stricte.
const retryLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isTest,
  message: { error: { code: 'TOO_MANY_REQUESTS', message: 'Trop de tentatives de paiement, réessayez plus tard.' } },
});

const router = Router();

// Webhook CamPay — GET ou POST selon la configuration de l'application CamPay.
router.all('/campay/webhook', async (req, res) => {
  res.json(await service.handleCampayWebhook({ ...req.query, ...(req.body ?? {}) }));
});

router.get('/providers', requireAuth, requireRole('ADMIN', 'PRODUCT_MANAGER'), (req, res) => {
  res.json(service.getProviders());
});

// Accessibles sans compte : l'UUID de commande (non devinable) sert de jeton
// d'accès et seules des informations de statut sont renvoyées.
router.get('/:id/status', validate(z.object({ params: orderIdParams })), async (req, res) => {
  res.json(await service.getPaymentStatus(req.params.id));
});
router.post('/:id/confirm', validate(confirmSchema), async (req, res) => {
  res.json(await service.confirmPayment(req.params.id, req.body.reference));
});
router.post('/:id/retry', retryLimiter, validate(retrySchema), async (req, res) => {
  res.json(await service.retryPayment(req.params.id, req.body));
});

export default router;
