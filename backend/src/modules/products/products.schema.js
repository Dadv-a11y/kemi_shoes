import { z } from 'zod';

const imageSchema = z.object({ url: z.union([z.string().url(), z.string().regex(/^\/uploads\/products\/[a-zA-Z0-9-]+\.(jpg|png|webp)$/)]), isMain: z.boolean().optional() });
const colorSchema = z.object({ name: z.string().min(1), hex: z.string().regex(/^#[0-9a-fA-F]{6}$/) });
const sizeSchema = z.object({ size: z.string().min(1), available: z.boolean().optional() });

const productBase = {
  nameFr: z.string().min(1).max(160),
  nameEn: z.string().min(1).max(160),
  descriptionFr: z.string().min(1),
  descriptionEn: z.string().min(1),
  category: z.enum(['Homme', 'Femme', 'Nouveautes', 'Couple-Enfant']),
  price: z.number().int().positive(),
  compareAtPrice: z.number().int().positive().optional(),
  status: z.enum(['draft', 'active', 'out_of_stock']).optional(),
  colorCustomizable: z.boolean().optional(),
  materialCustomizable: z.boolean().optional(),
  images: z.array(imageSchema).optional(),
  colors: z.array(colorSchema).optional(),
  sizes: z.array(sizeSchema).optional(),
};

export const createProductSchema = z.object({ body: z.object(productBase) });

export const updateProductSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object(productBase).partial(),
});

export const listProductsSchema = z.object({
  query: z.object({
    category: z.string().optional(),
    status: z.string().optional(),
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
  }),
});

export const productIdSchema = z.object({ params: z.object({ id: z.string().uuid() }) });

export const sizeAvailabilitySchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ size: z.string().min(1), available: z.boolean() }),
});