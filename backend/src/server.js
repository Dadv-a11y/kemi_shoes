import "express-async-errors";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "node:path";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { openDb } from "./db/client.js";
import { metricsMiddleware, register } from "./config/metrics.js";
import authRoutes from "./modules/auth/auth.route.js";
import productsRoutes from "./modules/products/products.routes.js";
import deliveryZonesRoutes from "./modules/delivery-zones/deliveryZones.route.js";
import ordersRoutes from "./modules/orders/orders.routes.js";
import reviewsRoutes from "./modules/reviews/reviews.routes.js";
import contentRoutes from "./modules/content/content.route.js";
import dashboardRoutes from "./modules/dashboard/dashboard.routes.js";
import notificationsRoutes from "./modules/notifications/notifications.route.js";
import paymentsRoutes from "./modules/payments/payments.routes.js";
import addressesRoutes from "./modules/addresses/addresses.routes.js";
import usersRoutes from "./modules/users/users.routes.js";
import settingsRoutes from "./modules/settings/settings.routes.js";
import mediaRoutes from "./modules/media/media.routes.js";
import { notFoundHandler, errorHandler } from "./middleware/errorHandler.js";
import { requireAuth, requireRole, requireTrustedOrigin } from "./middleware/auth.js";

const app = express();
const allowedOrigins = env.CORS_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.set("trust proxy", 1);
// cross-origin : les images /uploads sont affichées par le frontend (autre domaine).
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(compression());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(requireTrustedOrigin(allowedOrigins));
app.use(pinoHttp({ logger }));
app.use(metricsMiddleware);
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

app.get("/health", (req, res) => res.json({ status: "ok" }));
// Métriques Prometheus : réservées aux administrateurs (Bearer d'un compte ADMIN).
app.get("/metrics", requireAuth, requireRole("ADMIN"), async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/products", productsRoutes);
app.use("/api/v1/delivery-zones", deliveryZonesRoutes);
app.use("/api/v1/orders", ordersRoutes);
app.use("/api/v1/reviews", reviewsRoutes);
app.use("/api/v1/content", contentRoutes);
app.use("/api/v1/dashboard", dashboardRoutes);
app.use("/api/v1/notifications", notificationsRoutes);
app.use("/api/v1/payments", paymentsRoutes);
app.use("/api/v1/addresses", addressesRoutes);
app.use("/api/v1/users", usersRoutes);
app.use("/api/v1/settings", settingsRoutes);
app.use("/api/v1/media", mediaRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

export { app };

if (process.env.NODE_ENV !== "test") {
  openDb()
    .then(() =>
      app.listen(env.PORT, () =>
        logger.info({ port: env.PORT }, "server_started"),
      ),
    )
    .catch((error) => {
      logger.fatal({ err: error }, "database_initialisation_failed");
      process.exit(1);
    });
}
