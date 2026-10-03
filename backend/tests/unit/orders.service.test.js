import { setupTestDb } from '../testDb.js';
import { createProduct } from '../../src/modules/products/products.service.js';
import { createZone } from '../../src/modules/delivery-zones/deliveryZones.service.js';
import { createOrder, updateOrderStatus, setInternalNote, getOrderById, listOrders } from '../../src/modules/orders/orders.service.js';

setupTestDb();

async function seedProductAndZone(overrides = {}) {
  const product = await createProduct({
    nameFr: 'Multicolore Black and White', nameEn: 'Multicolore Black and White',
    descriptionFr: 'Cuir', descriptionEn: 'Leather', category: 'Homme', price: 6500, status: 'active',
    sizes: [{ size: '40', available: true }, { size: '42', available: false }],
    colorCustomizable: true, materialCustomizable: false,
  });
  const zone = await createZone({
    country: 'Cameroun', regionOrCity: 'Douala', feeFcfa: 1500, etaMinHours: 24, etaMaxHours: 48,
    codAvailable: true, paymentMethods: ['mobile_money', 'card', 'cod'], ...overrides,
  });
  return { product, zone };
}

describe('createOrder', () => {
  test('crée une commande, calcule correctement le total et l’historique de statut initial', async () => {
    const { product, zone } = await seedProductAndZone();

    const { order } = await createOrder({
      items: [{ productId: product.id, size: '40', quantity: 2 }],
      deliveryZoneId: zone.id,
      address: { country: 'Cameroun', city: 'Douala', street: 'Makepé' },
      guest: { name: 'Daril M.', phone: '+237600000000', email: 'daril@example.com' },
      paymentMethod: 'MOBILE_MONEY',
    });

    expect(order.subtotalFcfa).toBe(13000);
    expect(order.deliveryFeeFcfa).toBe(1500);
    expect(order.totalFcfa).toBe(14500);
    expect(order.reference).toMatch(/^KS-\d{5}$/);
    expect(order.items).toHaveLength(1);
    expect(order.statusHistory[0].status).toBe('PENDING');
  });

  test('rejette une commande avec un panier vide', async () => {
    const { zone } = await seedProductAndZone();
    await expect(createOrder({
      items: [], deliveryZoneId: zone.id,
      address: { country: 'Cameroun', city: 'Douala', street: 'X' },
      guest: { name: 'A', phone: '+237600000001' }, paymentMethod: 'MOBILE_MONEY',
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  test('rejette une taille indisponible pour le produit', async () => {
    const { product, zone } = await seedProductAndZone();
    await expect(createOrder({
      items: [{ productId: product.id, size: '42' }], deliveryZoneId: zone.id,
      address: { country: 'Cameroun', city: 'Douala', street: 'X' },
      guest: { name: 'A', phone: '+237600000002' }, paymentMethod: 'MOBILE_MONEY',
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  test('rejette une demande de personnalisation matière si le produit ne l’autorise pas', async () => {
    const { product, zone } = await seedProductAndZone();
    await expect(createOrder({
      items: [{ productId: product.id, size: '40', customMaterial: 'Daim' }], deliveryZoneId: zone.id,
      address: { country: 'Cameroun', city: 'Douala', street: 'X' },
      guest: { name: 'A', phone: '+237600000003' }, paymentMethod: 'MOBILE_MONEY',
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  test('rejette le paiement à la livraison si la zone ne le permet pas', async () => {
    const { product, zone } = await seedProductAndZone({ codAvailable: false, paymentMethods: ['card'] });
    await expect(createOrder({
      items: [{ productId: product.id, size: '40' }], deliveryZoneId: zone.id,
      address: { country: 'International', city: 'Paris', street: 'X' },
      guest: { name: 'A', phone: '+33600000000' }, paymentMethod: 'CASH_ON_DELIVERY',
    })).rejects.toMatchObject({ statusCode: 400 });
  });

  test('rejette un moyen de paiement non listé pour la zone', async () => {
    const { product, zone } = await seedProductAndZone({ paymentMethods: ['card'] });
    await expect(createOrder({
      items: [{ productId: product.id, size: '40' }], deliveryZoneId: zone.id,
      address: { country: 'Cameroun', city: 'Douala', street: 'X' },
      guest: { name: 'A', phone: '+237600000004' }, paymentMethod: 'MOBILE_MONEY',
    })).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('updateOrderStatus', () => {
  test('autorise une transition valide et l’enregistre dans l’historique', async () => {
    const { product, zone } = await seedProductAndZone();
    const { order } = await createOrder({
      items: [{ productId: product.id, size: '40' }], deliveryZoneId: zone.id,
      address: { country: 'Cameroun', city: 'Douala', street: 'X' },
      guest: { name: 'A', phone: '+237600000005' }, paymentMethod: 'CASH_ON_DELIVERY',
    });

    const updated = await updateOrderStatus(order.id, 'CONFIRMED', 'Confirmée par téléphone');
    expect(updated.status).toBe('CONFIRMED');
    expect(updated.statusHistory).toHaveLength(2);
  });

  test('rejette une transition invalide (ex. PENDING -> DELIVERED directement)', async () => {
    const { product, zone } = await seedProductAndZone();
    const { order } = await createOrder({
      items: [{ productId: product.id, size: '40' }], deliveryZoneId: zone.id,
      address: { country: 'Cameroun', city: 'Douala', street: 'X' },
      guest: { name: 'A', phone: '+237600000006' }, paymentMethod: 'CASH_ON_DELIVERY',
    });
    await expect(updateOrderStatus(order.id, 'DELIVERED')).rejects.toMatchObject({ statusCode: 409 });
  });

  test('aucune transition n’est permise depuis DELIVERED (état terminal)', async () => {
    const { product, zone } = await seedProductAndZone();
    const { order } = await createOrder({
      items: [{ productId: product.id, size: '40' }], deliveryZoneId: zone.id,
      address: { country: 'Cameroun', city: 'Douala', street: 'X' },
      guest: { name: 'A', phone: '+237600000007' }, paymentMethod: 'CASH_ON_DELIVERY',
    });
    await updateOrderStatus(order.id, 'CONFIRMED');
    await updateOrderStatus(order.id, 'PREPARING');
    await updateOrderStatus(order.id, 'SHIPPED');
    await updateOrderStatus(order.id, 'DELIVERED');
    await expect(updateOrderStatus(order.id, 'CANCELLED')).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('setInternalNote / getOrderById / listOrders', () => {
  test('ajoute une note interne consultable ensuite', async () => {
    const { product, zone } = await seedProductAndZone();
    const { order } = await createOrder({
      items: [{ productId: product.id, size: '40' }], deliveryZoneId: zone.id,
      address: { country: 'Cameroun', city: 'Douala', street: 'X' },
      guest: { name: 'A', phone: '+237600000008' }, paymentMethod: 'CASH_ON_DELIVERY',
    });
    await setInternalNote(order.id, 'Client à rappeler avant livraison');
    expect((await getOrderById(order.id)).internalNote).toBe('Client à rappeler avant livraison');
  });

  test('listOrders filtre par statut', async () => {
    const { product, zone } = await seedProductAndZone();
    await createOrder({
      items: [{ productId: product.id, size: '40' }], deliveryZoneId: zone.id,
      address: { country: 'Cameroun', city: 'Douala', street: 'X' },
      guest: { name: 'A', phone: '+237600000009' }, paymentMethod: 'CASH_ON_DELIVERY',
    });
    const result = await listOrders({ status: 'PENDING' });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((o) => o.status === 'PENDING')).toBe(true);
  });
});