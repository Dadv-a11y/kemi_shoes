import { jest } from '@jest/globals';
import { mapSettingsToBusinessProfile, createBusinessProfileClient } from '../../src/modules/integrations/googleBusinessProfile.js';

const settings = {
  storeName: 'KEMI SHOES',
  phone: '+237678666069',
  address: { street: 'pk11', city: 'Douala' },
  websiteUrl: 'https://kemishoes.com',
};

describe('mapSettingsToBusinessProfile', () => {
  test('construit une fiche établissement valide', () => {
    const location = mapSettingsToBusinessProfile(settings);
    expect(location.title).toBe('KEMI SHOES');
    expect(location.phoneNumbers).toEqual({ primaryPhone: '+237678666069' });
    expect(location.storefrontAddress).toEqual({ addressLines: ['pk11'], locality: 'Douala', regionCode: 'CM' });
    expect(location.websiteUri).toBe('https://kemishoes.com');
  });

  test('omet les champs absents plutôt que d’envoyer des valeurs vides', () => {
    const location = mapSettingsToBusinessProfile({ storeName: 'KEMI SHOES' });
    expect(location.phoneNumbers).toBeUndefined();
    expect(location.storefrontAddress).toBeUndefined();
  });
});

describe('createBusinessProfileClient', () => {
  test('ignore la synchronisation si accountId/locationId ne sont pas configurés', async () => {
    const client = createBusinessProfileClient({ fetcher: jest.fn() });
    const result = await client.syncLocation(settings);
    expect(result).toEqual({ skipped: true });
  });

  test('envoie un PATCH avec le bon updateMask quand configuré', async () => {
    const fetcher = jest.fn().mockResolvedValue({ ok: true });
    const client = createBusinessProfileClient({ accountId: 'acc-1', locationId: 'loc-1', fetcher });

    const result = await client.syncLocation(settings);

    expect(result.ok).toBe(true);
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toContain('loc-1');
    expect(url).toContain('updateMask=');
    expect(options.method).toBe('PATCH');
    expect(JSON.parse(options.body).title).toBe('KEMI SHOES');
  });
});