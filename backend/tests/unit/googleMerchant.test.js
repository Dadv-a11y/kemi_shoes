import { jest } from '@jest/globals';
import { mapProductToMerchantOffer, createMerchantClient } from '../../src/modules/integrations/googleMerchant.js';

const baseProduct = {
  id: 'prod-1',
  nameFr: 'Multicolore Black and White',
  descriptionFr: 'Cuir pleine fleur tressé',
  slugFr: 'multicolore-black-and-white',
  category: 'Homme',
  price: 6500,
  status: 'active',
  colorCustomizable: true,
  materialCustomizable: true,
};

const relations = {
  images: [{ url: 'https://cdn.kemishoes.com/a.jpg', isMain: true }, { url: 'https://cdn.kemishoes.com/b.jpg', isMain: false }],
  colors: [{ name: 'Noir', hex: '#161616' }, { name: 'Marron', hex: '#8B4A2B' }],
  sizes: [{ size: '40', available: true }, { size: '41', available: true }, { size: '42', available: false }],
};

describe('mapProductToMerchantOffer', () => {
  test('construit une offre Merchant Center valide à partir d’un produit actif', () => {
    const offer = mapProductToMerchantOffer(baseProduct, relations);
    expect(offer.offerId).toBe('prod-1');
    expect(offer.title).toBe('Multicolore Black and White');
    expect(offer.link).toContain('multicolore-black-and-white');
    expect(offer.imageLink).toBe('https://cdn.kemishoes.com/a.jpg');
    expect(offer.additionalImageLinks).toEqual(['https://cdn.kemishoes.com/b.jpg']);
    expect(offer.price).toEqual({ value: '6500', currency: 'XAF' });
    expect(offer.availability).toBe('in stock');
    expect(offer.sizes).toEqual(['40', '41']);
    expect(offer.customLabel0).toBe('personnalisable');
  });

  test('marque "out of stock" un produit sans aucune taille disponible', () => {
    const offer = mapProductToMerchantOffer(baseProduct, { ...relations, sizes: [{ size: '40', available: false }] });
    expect(offer.availability).toBe('out of stock');
  });

  test('marque "out of stock" un produit dont le statut est out_of_stock', () => {
    const offer = mapProductToMerchantOffer({ ...baseProduct, status: 'out_of_stock' }, relations);
    expect(offer.availability).toBe('out of stock');
  });

  test('un brouillon avec des tailles disponibles est traité comme "preorder"', () => {
    const offer = mapProductToMerchantOffer({ ...baseProduct, status: 'draft' }, relations);
    expect(offer.availability).toBe('preorder');
  });
});

describe('createMerchantClient', () => {
  test('ignore proprement la synchronisation si aucun merchantId n’est configuré', async () => {
    const client = createMerchantClient({ merchantId: undefined, fetcher: jest.fn() });
    const result = await client.syncProduct(baseProduct, relations);
    expect(result).toEqual({ skipped: true });
  });

  test('appelle l’API Content avec la bonne URL et le bon corps quand configuré', async () => {
    const fetcher = jest.fn().mockResolvedValue({ ok: true });
    const client = createMerchantClient({ merchantId: '123456', fetcher });

    const result = await client.syncProduct(baseProduct, relations);

    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe('https://shoppingcontent.googleapis.com/content/v2.1/123456/products');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body).offerId).toBe('prod-1');
    expect(result.ok).toBe(true);
  });

  test('remonte un échec sans lever d’exception', async () => {
    const fetcher = jest.fn().mockResolvedValue({ ok: false, status: 400, text: async () => 'bad request' });
    const client = createMerchantClient({ merchantId: '123456', fetcher });
    const result = await client.syncProduct(baseProduct, relations);
    expect(result).toEqual({ skipped: false, ok: false, status: 400 });
  });

  test('deleteProduct appelle DELETE sur l’offre correspondante', async () => {
    const fetcher = jest.fn().mockResolvedValue({ ok: true });
    const client = createMerchantClient({ merchantId: '123456', fetcher });
    await client.deleteProduct('prod-1');
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toContain('products/online:fr:CM:prod-1');
    expect(options.method).toBe('DELETE');
  });
});