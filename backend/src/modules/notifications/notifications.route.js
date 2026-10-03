import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import * as service from "./notifications.service.js";

const router = Router();
router.use(requireAuth);
router.get("/", async (req, res) =>
  res.json(await service.listNotifications(req.user.id)),
);
router.patch("/:id/read", async (req, res) => {
  await service.markNotificationRead(req.params.id, req.user.id);
  res.status(204).send();
});

export default router;
