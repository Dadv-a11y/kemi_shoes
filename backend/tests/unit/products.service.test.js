import { setupTestDb } from '../testDb.js';
import { updateProductSchema } from '../../src/modules/products/products.schema.js';
import {
  createProduct, updateProduct, deleteProduct, getProductById,
  getProductBySlug, listProducts, setSizeAvailability,
} from '../../src/modules/products/products.service.js';

setupTestDb();

const sampleInput = {
  nameFr: 'Multicolore Black and White',
  nameEn: 'Multicolore Black and White',
  descriptionFr: 'Cuir pleine fleur tressé, semelle cuir cousue main.',
  descriptionEn: 'Full-grain braided leather, hand-stitched leather sole.',
  category: 'Homme',
  price: 6500,
  status: 'active',
  images: [{ url: 'https://cdn.kemishoes.com/a.jpg' }, { url: 'https://cdn.kemishoes.com/b.jpg' }],
  colors: [{ name: 'Noir', hex: '#161616' }],
  sizes: [{ size: '40', available: true }, { size: '41', available: true }],
};

describe('products.service', () => {
  test('createProduct génère des slugs FR/EN et persiste les relations', async () => {
    const product = await createProduct(sampleInput);
    expect(product.slugFr).toBe('multicolore-black-and-white');
    expect(product.images).toHaveLength(2);
    expect(product.images[0].isMain).toBe(true);
    expect(product.colors).toHaveLength(1);
    expect(product.sizes.map((s) => s.size)).toEqual(['40', '41']);
  });

  test('refuse deux produits avec le même slug', async () => {
    await createProduct(sampleInput);
    await expect(createProduct(sampleInput)).rejects.toMatchObject({ statusCode: 400 });
  });

  test('getProductBySlug retrouve le produit par slug FR ou EN', async () => {
    await createProduct(sampleInput);
    expect((await getProductBySlug('multicolore-black-and-white', 'fr')).nameFr).toBe(sampleInput.nameFr);
  });

  test('getProductById lève une 404 si le produit n’existe pas', async () => {
    await expect(getProductById('inconnu')).rejects.toMatchObject({ statusCode: 404 });
  });

  test('updateProduct remplace entièrement les tailles fournies', async () => {
    const created = await createProduct(sampleInput);
    const updated = await updateProduct(created.id, { sizes: [{ size: '42', available: true }] });
    expect(updated.sizes.map((s) => s.size)).toEqual(['42']);
  });

  test('updateProduct conserve les relations non fournies (images/colors intactes)', async () => {
    const created = await createProduct(sampleInput);
    const updated = await updateProduct(created.id, { price: 7000 });
    expect(updated.price).toBe(7000);
    expect(updated.images).toHaveLength(2);
  });

  test('setSizeAvailability retire une taille sans supprimer le produit', async () => {
    const created = await createProduct(sampleInput);
    const updated = await setSizeAvailability(created.id, '40', false);
    const size40 = updated.sizes.find((s) => s.size === '40');
    expect(size40.available).toBe(false);
    expect(updated.sizes).toHaveLength(2);
  });

  test('deleteProduct supprime le produit et ses relations (cascade)', async () => {
    const created = await createProduct(sampleInput);
    await deleteProduct(created.id);
    await expect(getProductById(created.id)).rejects.toMatchObject({ statusCode: 404 });
  });

  test('listProducts filtre par catégorie et statut, avec pagination', async () => {
    await createProduct(sampleInput);
    await createProduct({ ...sampleInput, nameFr: 'Jani.', nameEn: 'Jani', category: 'Femme', status: 'draft' });

    const homme = await listProducts({ category: 'Homme' });
    expect(homme.items).toHaveLength(1);

    const draft = await listProducts({ status: 'draft' });
    expect(draft.items).toHaveLength(1);
    expect(draft.items[0].nameFr).toBe('Jani.');

    expect((await listProducts({})).total).toBe(2);
  });

  test('un produit lu est accepté tel quel par le schéma de mise à jour (back-office)', async () => {
    const created = await createProduct(sampleInput);
    const product = await getProductById(created.id);
    const parsed = updateProductSchema.safeParse({
      params: { id: product.id },
      body: {
        colorCustomizable: product.colorCustomizable,
        materialCustomizable: product.materialCustomizable,
        images: product.images.map(({ url, isMain }) => ({ url, isMain })),
        sizes: product.sizes.map(({ size, available }) => ({ size, available })),
      },
    });
    expect(parsed.success).toBe(true);
  });
});
