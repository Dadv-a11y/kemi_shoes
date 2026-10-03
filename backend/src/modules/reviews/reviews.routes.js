import { z } from "zod";
import { Router } from "express";
import * as service from "./reviews.service.js";
import { validate } from "../../middleware/validate.js";
import {
  requireAuth,
  requireRole,
  optionalAuth,
} from "../../middleware/auth.js";
import { audit } from "../../middleware/audit.js";

const createReviewSchema = z.object({
  body: z.object({
    productId: z.string().uuid(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().min(1).max(1000),
  }),
});
const moderateSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ status: z.enum(["pending", "approved", "hidden"]) }),
});
const listSchema = z.object({
  query: z.object({
    productId: z.string().uuid().optional(),
    status: z.string().optional(),
  }),
});

const controller = {
  async create(req, res) {
    const review = await service.createReview({
      ...req.body,
      userId: req.user?.id,
    });
    res.status(201).json(review);
  },
  async list(req, res) {
    res.json(await service.listReviews(req.query));
  },
  async listPublic(req, res) {
    res.json(
      await service.listReviews({
        productId: req.params.productId,
        status: "approved",
      }),
    );
  },
  async moderate(req, res) {
    const review = await service.moderateReview(req.params.id, req.body.status);
    audit(req, {
      action: "review.moderated",
      entityType: "Review",
      entityId: review.id,
      metadata: { status: req.body.status },
    });
    res.json(review);
  },
  async summary(req, res) {
    res.json(await service.getProductRatingSummary(req.params.productId));
  },
};

const router = Router();
const isStaff = requireRole("ADMIN", "PRODUCT_MANAGER");

router.post("/", optionalAuth, validate(createReviewSchema), controller.create);
router.get("/product/:productId", controller.listPublic);
router.get("/", requireAuth, isStaff, validate(listSchema), controller.list);
router.get("/product/:productId/summary", controller.summary);
router.patch(
  "/:id/moderate",
  requireAuth,
  isStaff,
  validate(moderateSchema),
  controller.moderate,
);

export default router;
