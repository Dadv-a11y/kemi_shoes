import client from 'prom-client';

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Durée des requêtes HTTP en secondes',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});
register.registerMetric(httpRequestDuration);

export const ordersCreatedTotal = new client.Counter({
  name: 'kemi_orders_created_total',
  help: 'Nombre total de commandes créées, par méthode de paiement',
  labelNames: ['payment_method'],
});
register.registerMetric(ordersCreatedTotal);

export const authFailuresTotal = new client.Counter({
  name: 'kemi_auth_failures_total',
  help: "Nombre d'échecs d'authentification, par type",
  labelNames: ['type'],
});
register.registerMetric(authFailuresTotal);

export const otpRequestsTotal = new client.Counter({
  name: 'kemi_otp_requests_total',
  help: 'Nombre de codes OTP envoyés',
});
register.registerMetric(otpRequestsTotal);

/**
 * Middleware Express : mesure la durée de chaque requête et l'enregistre
 * dans l'histogramme Prometheus, labellisée par route (pas par URL brute,
 * pour éviter l'explosion de cardinalité avec des IDs dynamiques).
 */
export function metricsMiddleware(req, res, next) {
  const stop = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path;
    stop({ method: req.method, route, status_code: res.statusCode });
  });
  next();
}