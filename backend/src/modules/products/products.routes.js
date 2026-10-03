import { Router } from 'express';
import * as controller from './products.controller.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth, requireRole } from '../../middleware/auth.js';
import { uploadProductImage } from './products.upload.js';
import {
  createProductSchema, updateProductSchema, listProductsSchema,
  productIdSchema, sizeAvailabilitySchema,
} from './products.schema.js';

const router = Router();
const canManageProducts = requireRole('ADMIN', 'PRODUCT_MANAGER');

// --- Public (catalogue boutique) ---
router.get('/', validate(listProductsSchema), controller.list);
router.get('/slug/:slug', controller.getBySlug);
router.get('/:id', validate(productIdSchema), controller.getById);

// --- Admin / gestionnaire produit ---
router.post('/', requireAuth, canManageProducts, validate(createProductSchema), controller.create);
router.patch('/:id', requireAuth, canManageProducts, validate(updateProductSchema), controller.update);
router.delete('/:id', requireAuth, canManageProducts, validate(productIdSchema), controller.remove);
router.patch('/:id/sizes', requireAuth, canManageProducts, validate(sizeAvailabilitySchema), controller.updateSizeAvailability);

router.post('/upload-image', requireAuth, canManageProducts, uploadProductImage, controller.uploadImage);

export default router;