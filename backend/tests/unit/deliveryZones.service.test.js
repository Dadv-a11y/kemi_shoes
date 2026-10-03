import { setupTestDb } from '../testDb.js';
import { createZone, deleteZone, getZoneById, listZones, updateZone } from '../../src/modules/delivery-zones/deliveryZones.service.js';

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
});