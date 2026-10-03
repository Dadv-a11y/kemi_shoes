import { z } from 'zod';
import { Router } from 'express';
import { all } from '../../db/client.js';
import { validate } from '../../middleware/validate.js';

const listSchema = z.object({ query: z.object({ category: z.string().max(40).optional() }) });

const router = Router();

// Public : visuels de marque utilisés par l'accueil et « Notre histoire ».
router.get('/', validate(listSchema), async (req, res) => {
  const { category } = req.query;
  res.json(await all(
    `SELECT key, category, url, altFr, altEn FROM MediaAsset ${category ? 'WHERE category = ?' : ''} ORDER BY key`,
    category ? [category] : []
  ));
});

export default router;
