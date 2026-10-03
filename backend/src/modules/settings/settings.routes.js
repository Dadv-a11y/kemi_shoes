import { z } from 'zod';
import { Router } from 'express';
import * as service from './settings.service.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { audit } from '../../middleware/audit.js';

const updateSchema = z.object({
  body: z.object(Object.fromEntries(service.PUBLIC_SETTING_KEYS.map((key) => [key, z.string().max(200).optional()]))),
});

const router = Router();

router.get('/', async (req, res) => res.json(await service.getPublicSettings())); // public : coordonnées boutique
router.put('/', requireAuth, requireRole('ADMIN'), validate(updateSchema), async (req, res) => {
  const settings = await service.updateSettings(req.body);
  audit(req, { action: 'settings.updated', entityType: 'Setting', metadata: { keys: Object.keys(req.body) } });
  res.json(settings);
});

export default router;
