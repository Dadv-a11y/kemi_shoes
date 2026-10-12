import { setupTestDb } from '../testDb.js';
import { createProduct } from '../../src/modules/products/products.service.js';
import { createZone } from '../../src/modules/delivery-zones/deliveryZones.service.js';
import { createWhatsappOrder, confirmDelivery, getOrderById, updateOrderStatus } from '../../src/modules/orders/orders.service.js';

setupTestDb();

async function seed() {
  const product = await createProduct({
    nameFr: 'Mule', nameEn: 'Mule', descriptionFr: 'Cuir', descriptionEn: 'Leather', category: 'homme', price: 20000,
    status: 'active', sizes: [{ size: '40', available: true }, { size: '42', available: false }],
  });
  await createZone({ country: 'Cameroun', regionOrCity: 'Douala', feeFcfa: 1500, etaMinHours: 24, etaMaxHours: 48, codAvailable: true, paymentMethods: ['cod'] });
  return product;
}

describe('commandes WhatsApp', () => {
  test('la commande est enregistrée avec le canal WHATSAPP, sans frais ni paiement en ligne', async () => {
    const product = await seed();
    const order = await createWhatsappOrder({ items: [{ productId: product.id, size: '40', quantity: 2 }] });
    expect(order).toMatchObject({ channel: 'WHATSAPP', status: 'PENDING', paymentMethod: 'CASH_ON_DELIVERY', subtotalFcfa: 40000, deliveryFeeFcfa: 0, totalFcfa: 40000 });
    expect(order.statusHistory[0].note).toMatch(/WhatsApp/);
    expect(order.paymentTransactions).toEqual([]);
  });

  test('refuse une taille indisponible et un panier vide', async () => {
    const product = await seed();
    await expect(createWhatsappOrder({ items: [{ productId: product.id, size: '42' }] })).rejects.toMatchObject({ statusCode: 400 });
    await expect(createWhatsappOrder({ items: [] })).rejects.toMatchObject({ statusCode: 400 });
  });

  test('la confirmation de livraison parcourt les étapes, solde la remise et reste idempotente', async () => {
    const product = await seed();
    const { id } = await createWhatsappOrder({ items: [{ productId: product.id, size: '40' }] });
    await updateOrderStatus(id, 'CONFIRMED');
    const delivered = await confirmDelivery(id);
    expect(delivered).toMatchObject({ status: 'DELIVERED', paymentStatus: 'PAID' });
    expect(delivered.statusHistory.map((event) => event.status)).toEqual(['PENDING', 'CONFIRMED', 'PREPARING', 'SHIPPED', 'DELIVERED']);
    expect((await confirmDelivery(id)).status).toBe('DELIVERED');
  });

  test('une commande annulée ne peut pas être confirmée livrée', async () => {
    const product = await seed();
    const { id } = await createWhatsappOrder({ items: [{ productId: product.id, size: '40' }] });
    await updateOrderStatus(id, 'CANCELLED');
    await expect(confirmDelivery(id)).rejects.toMatchObject({ statusCode: 409 });
    expect((await getOrderById(id)).status).toBe('CANCELLED');
  });
});
