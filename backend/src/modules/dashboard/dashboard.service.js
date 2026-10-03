import { all, get } from '../../db/client.js';
import { computeTrend } from '../../utils/trend.js';

function previousPeriod(fromDate, toDate) {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  const durationMs = to.getTime() - from.getTime();
  return {
    from: new Date(from.getTime() - durationMs).toISOString(),
    to: from.toISOString(),
  };
}

/**
 * Indicateurs clés pour la Vue d'ensemble du dashboard : nombre de commandes,
 * unités vendues, chiffre d'affaires, panier moyen — sur une période donnée.
 * Les commandes annulées sont exclues du CA et du panier moyen.
 */
export async function getKPIs({ from, to }) {
  const orderStats = await get(
    `SELECT COUNT(*) as orderCount, COALESCE(SUM(totalFcfa),0) as revenue
     FROM "Order" WHERE createdAt >= ? AND createdAt < ? AND status != 'CANCELLED'`,
    [from, to]
  );
  const unitStats = await get(
    `SELECT COALESCE(SUM(oi.quantity),0) as units
     FROM OrderItem oi JOIN "Order" o ON o.id = oi.orderId
     WHERE o.createdAt >= ? AND o.createdAt < ? AND o.status != 'CANCELLED'`,
    [from, to]
  );

  const averageBasketFcfa = orderStats.orderCount > 0 ? Math.round(orderStats.revenue / orderStats.orderCount) : 0;

  return {
    orders: orderStats.orderCount,
    unitsSold: unitStats.units,
    revenueFcfa: orderStats.revenue,
    averageBasketFcfa,
  };
}

/**
 * Top produits sur la période, avec tendance vs la période précédente de même
 * durée. Desktop affiche ceci en barres horizontales, mobile en cartes avec
 * flèche — même source de données, seul le rendu diffère (règle validée).
 */
export async function getTopProducts({ from, to, limit = 10 }) {
  const { from: prevFrom, to: prevTo } = previousPeriod(from, to);

  const current = await all(
    `SELECT oi.productId, oi.productNameFr, SUM(oi.quantity) as units
     FROM OrderItem oi JOIN "Order" o ON o.id = oi.orderId
     WHERE o.createdAt >= ? AND o.createdAt < ? AND o.status != 'CANCELLED'
    GROUP BY oi.productId, oi.productNameFr ORDER BY units DESC LIMIT ?`,
    [from, to, limit]
  );

  return Promise.all(current.map(async (row) => {
    const prevRow = await get(
      `SELECT COALESCE(SUM(oi.quantity),0) as units
       FROM OrderItem oi JOIN "Order" o ON o.id = oi.orderId
       WHERE oi.productId = ? AND o.createdAt >= ? AND o.createdAt < ? AND o.status != 'CANCELLED'`,
      [row.productId, prevFrom, prevTo]
    );
    const trend = computeTrend(row.units, prevRow.units);
    return {
      productId: row.productId,
      productNameFr: row.productNameFr,
      units: row.units,
      previousUnits: prevRow.units,
      trend: trend.direction,
      trendPercent: trend.percent,
    };
  }));
}

/**
 * Alertes simples pour la Vue d'ensemble : tailles épuisées et demandes de
 * personnalisation encore en attente de préparation.
 */
export async function getAlerts() {
  const outOfStockSizes = await all(
    `SELECT p.nameFr as productName, s.size
     FROM ProductSize s JOIN Product p ON p.id = s.productId
     WHERE s.available = 0 AND p.status = 'active'`
  );
  const pendingCustomizations = await get(
    `SELECT COUNT(*) as count FROM OrderItem oi JOIN "Order" o ON o.id = oi.orderId
     WHERE (oi.customColor IS NOT NULL OR oi.customMaterial IS NOT NULL) AND o.status IN ('PENDING','CONFIRMED')`
  );
  return { outOfStockSizes, pendingCustomizationsCount: pendingCustomizations.count };
}