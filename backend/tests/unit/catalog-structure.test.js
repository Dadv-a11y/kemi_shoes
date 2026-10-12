import { setupTestDb } from '../testDb.js';
import { run } from '../../src/db/client.js';
import { createProduct, listProducts, getFacets, updateProduct } from '../../src/modules/products/products.service.js';
import { createCategory, deleteCategory, listPublicCategories, listAllCategories } from '../../src/modules/categories/categories.service.js';
import { createCollection, listPublicCollections, MIN_COLLECTIONS_FOR_SHOWCASE } from '../../src/modules/collections/collections.service.js';
import { createZone } from '../../src/modules/delivery-zones/deliveryZones.service.js';
import { createOrder } from '../../src/modules/orders/orders.service.js';

setupTestDb();

const base = { nameFr: 'Mule', nameEn: 'Mule', descriptionFr: 'Cuir', descriptionEn: 'Leather', category: 'homme', price: 20000, status: 'active', sizes: [{ size: '40', available: true }] };
const make = (overrides) => createProduct({ ...base, ...overrides });
const age = (id, days) => run(`UPDATE Product SET createdAt = ? WHERE id = ?`, [new Date(Date.now() - days * 86400000).toISOString(), id]);

describe('catégories dynamiques', () => {
  test('les catégories sans produit publié et « Nouveautés » sans nouveauté disparaissent côté public', async () => {
    const old = await make({ nameFr: 'Ancien', nameEn: 'Old' });
    await age(old.id, 30);
    let slugs = (await listPublicCategories()).map((category) => category.slug);
    expect(slugs).toEqual(['homme']); // plus aucune nouveauté → plus de route « nouveautes »

    await make({ nameFr: 'Récent', nameEn: 'Recent', category: 'femme' });
    slugs = (await listPublicCategories()).map((category) => category.slug);
    expect(slugs).toEqual(['homme', 'femme', 'nouveautes']);
  });

  test('une catégorie créée par l’admin accepte des produits, et ne se supprime que vide', async () => {
    const category = await createCategory({ nameFr: 'Sacs & accessoires' });
    expect(category.slug).toBe('sacs-accessoires');
    const product = await make({ category: 'sacs-accessoires' });
    expect(product.category).toBe('sacs-accessoires');
    await expect(deleteCategory(category.id)).rejects.toMatchObject({ statusCode: 409 });
    await updateProduct(product.id, { category: 'femme' });
    await deleteCategory(category.id);
    expect((await listAllCategories()).find((row) => row.slug === 'sacs-accessoires')).toBeUndefined();
    await expect(createCategory({ nameFr: 'Nouveautés' })).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('filtres et meilleures ventes', () => {
  test('filtre par taille, couleur et prix, et expose les facettes réelles', async () => {
    await make({ nameFr: 'A', nameEn: 'A', price: 15000, colors: [{ name: 'Noir', hex: '#111111' }], sizes: [{ size: '38', available: true }, { size: '41', available: false }] });
    await make({ nameFr: 'B', nameEn: 'B', price: 30000, colors: [{ name: 'Cognac', hex: '#92502f' }], sizes: [{ size: '40', available: true }] });

    expect((await listProducts({ size: '38' })).items.map((item) => item.nameFr)).toEqual(['A']);
    expect((await listProducts({ size: '41' })).total).toBe(0); // taille indisponible
    expect((await listProducts({ color: 'cognac' })).items.map((item) => item.nameFr)).toEqual(['B']);
    expect((await listProducts({ minPrice: 20000 })).items.map((item) => item.nameFr)).toEqual(['B']);
    expect((await listProducts({ sort: 'priceAsc' })).items.map((item) => item.nameFr)).toEqual(['A', 'B']);

    const facets = await getFacets({});
    expect(facets).toMatchObject({ sizes: ['38', '40'], minPrice: 15000, maxPrice: 30000 });
    expect(facets.colors.map((color) => color.name).sort()).toEqual(['Cognac', 'Noir']);
  });

  test('« popular » classe par unités vendues (commandes annulées exclues)', async () => {
    const a = await make({ nameFr: 'A', nameEn: 'A' });
    const b = await make({ nameFr: 'B', nameEn: 'B' });
    const zone = await createZone({ country: 'Cameroun', regionOrCity: 'Douala', feeFcfa: 1000, etaMinHours: 24, etaMaxHours: 48, codAvailable: true, paymentMethods: ['cod'] });
    const order = (productId, quantity) => createOrder({
      items: [{ productId, size: '40', quantity }], deliveryZoneId: zone.id, address: { country: 'Cameroun', city: 'Douala', street: 'X' },
      guest: { name: 'A', phone: '+237600000000' }, paymentMethod: 'CASH_ON_DELIVERY',
    });
    await order(b.id, 3);
    const cancelled = await order(a.id, 9);
    await run(`UPDATE "Order" SET status = 'CANCELLED' WHERE id = ?`, [cancelled.order.id]);

    const ranked = (await listProducts({ sort: 'popular' })).items;
    expect(ranked.map((item) => item.nameFr)).toEqual(['B', 'A']);
    expect(ranked[0].unitsSold).toBe(3);
  });
});

describe('collections', () => {
  test('un produit rejoint plusieurs collections ; la section n’apparaît qu’avec 3 collections garnies', async () => {
    const names = ['Été', 'Cérémonie', 'Atelier'];
    const collections = [];
    for (const nameFr of names) collections.push(await createCollection({ nameFr }));
    const product = await make({ collectionIds: [collections[0].id, collections[1].id] });
    expect((await listProducts({ collection: 'ete' })).items.map((item) => item.id)).toEqual([product.id]);
    expect(product.collectionIds).toHaveLength(2);

    let publics = await listPublicCollections();
    expect(publics.map((collection) => collection.slug)).toEqual(['ete', 'ceremonie']); // « Atelier » est vide
    expect(publics.length).toBeLessThan(MIN_COLLECTIONS_FOR_SHOWCASE);

    await updateProduct(product.id, { collectionIds: collections.map((collection) => collection.id) });
    publics = await listPublicCollections();
    expect(publics.length).toBeGreaterThanOrEqual(MIN_COLLECTIONS_FOR_SHOWCASE);
    await expect(make({ nameFr: 'X', nameEn: 'X', collectionIds: ['00000000-0000-4000-8000-000000000000'] })).rejects.toMatchObject({ statusCode: 400 });
  });
});
