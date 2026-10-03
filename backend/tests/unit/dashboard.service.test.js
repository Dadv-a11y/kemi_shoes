import { setupTestDb } from '../testDb.js';
import { createProduct } from '../../src/modules/products/products.service.js';
import { createZone } from '../../src/modules/delivery-zones/deliveryZones.service.js';
import { createOrder } from '../../src/modules/orders/orders.service.js';
import { run } from '../../src/db/client.js';
import { getKPIs, getTopProducts, getAlerts } from '../../src/modules/dashboard/dashboard.service.js';

setupTestDb();

async function seed() {
  const product = await createProduct({
    nameFr: 'Multicolore Black and White', nameEn: 'x', descriptionFr: 'd', descriptionEn: 'd',
    category: 'Homme', price: 6500, status: 'active', sizes: [{ size: '40', available: true }, { size: '42', available: false }],
  });
  const zone = await createZone({
    country: 'Cameroun', feeFcfa: 1500, etaMinHours: 24, etaMaxHours: 48,
    codAvailable: true, paymentMethods: ['mobile_money', 'card', 'cod'],
  });
  return { product, zone };
}

async function placeOrder(product, zone, { quantity = 1, createdAt } = {}) {
  const { order } = await createOrder({
    items: [{ productId: product.id, size: '40', quantity }],
    deliveryZoneId: zone.id,
    address: { country: 'Cameroun', city: 'Douala', street: 'X' },
    guest: { name: 'Client', phone: `+2376${Math.floor(Math.random() * 100000000)}` },
    paymentMethod: 'CASH_ON_DELIVERY',
  });
  if (createdAt) await run(`UPDATE "Order" SET createdAt = ? WHERE id = ?`, [createdAt, order.id]);
  return order;
}

describe('dashboard.service', () => {
  test('getKPIs additionne correctement commandes, unités et CA sur la période', async () => {
    const { product, zone } = await seed();
    await placeOrder(product, zone, { quantity: 2, createdAt: '2026-08-10T10:00:00.000Z' });
    await placeOrder(product, zone, { quantity: 1, createdAt: '2026-08-12T10:00:00.000Z' });

    const kpis = await getKPIs({ from: '2026-08-01T00:00:00.000Z', to: '2026-08-31T23:59:59.000Z' });
    expect(kpis.orders).toBe(2);
    expect(kpis.unitsSold).toBe(3);
    expect(kpis.revenueFcfa).toBe((6500 * 2 + 1500) + (6500 + 1500));
    expect(kpis.averageBasketFcfa).toBeGreaterThan(0);
  });

  test('exclut les commandes annulées du chiffre d’affaires', async () => {
    const { product, zone } = await seed();
    const order = await placeOrder(product, zone, { createdAt: '2026-08-10T10:00:00.000Z' });
    await run(`UPDATE "Order" SET status = 'CANCELLED' WHERE id = ?`, [order.id]);

    const kpis = await getKPIs({ from: '2026-08-01T00:00:00.000Z', to: '2026-08-31T23:59:59.000Z' });
    expect(kpis.orders).toBe(0);
    expect(kpis.revenueFcfa).toBe(0);
  });

  test('getTopProducts calcule une tendance à la hausse vs la période précédente', async () => {
    const { product, zone } = await seed();
    await placeOrder(product, zone, { quantity: 10, createdAt: '2026-07-15T10:00:00.000Z' });
    await placeOrder(product, zone, { quantity: 20, createdAt: '2026-08-15T10:00:00.000Z' });

    const top = await getTopProducts({ from: '2026-08-01T00:00:00.000Z', to: '2026-08-31T00:00:00.000Z' });
    expect(top[0].units).toBe(20);
    expect(top[0].trend).toBe('up');
  });

  test('getAlerts remonte les tailles épuisées des produits actifs', async () => {
    await seed();
    const alerts = await getAlerts();
    expect(alerts.outOfStockSizes).toEqual(expect.arrayContaining([expect.objectContaining({ size: '42' })]));
  });
});