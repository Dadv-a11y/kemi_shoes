import { setupTestDb } from '../testDb.js';
import { createZone, deleteZone, getZoneById, listZones, updateZone } from '../../src/modules/delivery-zones/deliveryZones.service.js';
import { createProduct } from '../../src/modules/products/products.service.js';
import { createOrder } from '../../src/modules/orders/orders.service.js';

setupTestDb();

const input = {
  country: 'Cameroun', regionOrCity: 'Douala', feeFcfa: 1500,
  etaMinHours: 24, etaMaxHours: 48, codAvailable: true,
  paymentMethods: ['mobile_money', 'card', 'cod'],
};

describe('deliveryZones.service', () => {
  test('crée et hydrate une zone', async () => {
    const zone = await createZone(input);
    expect(zone.regionOrCity).toBe('Douala');
    expect(zone.paymentMethods).toEqual(input.paymentMethods);
    expect(zone.codAvailable).toBe(true);
  });

  test('liste uniquement les zones actives', async () => {
    await createZone(input);
    await createZone({ ...input, regionOrCity: 'Paris', active: false });
    const zones = await listZones({ activeOnly: true });
    expect(zones.every((zone) => zone.active)).toBe(true);
  });

  test('met à jour puis supprime une zone', async () => {
    const zone = await createZone(input);
    const updated = await updateZone(zone.id, { feeFcfa: 2000, active: false });
    expect(updated.feeFcfa).toBe(2000);
    await deleteZone(zone.id);
    await expect(getZoneById(zone.id)).rejects.toMatchObject({ statusCode: 404 });
  });

  test('refuse de supprimer une zone utilisée par une commande (409 au lieu d’une erreur SQL)', async () => {
    const zone = await createZone(input);
    const product = await createProduct({
      nameFr: 'Mule test', nameEn: 'Test mule', descriptionFr: 'Cuir', descriptionEn: 'Leather',
      category: 'Femme', price: 20000, status: 'active', sizes: [{ size: '38', available: true }],
    });
    await createOrder({
      items: [{ productId: product.id, size: '38', quantity: 1 }],
      deliveryZoneId: zone.id,
      address: { country: 'Cameroun', city: 'Douala', street: 'Akwa' },
      guest: { name: 'Cliente', phone: '+237600000000' },
      paymentMethod: 'CASH_ON_DELIVERY',
    });
    await expect(deleteZone(zone.id)).rejects.toMatchObject({ statusCode: 409 });
    expect((await getZoneById(zone.id)).id).toBe(zone.id);
  });
});
