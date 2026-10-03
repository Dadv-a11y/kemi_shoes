import { setupTestDb } from '../testDb.js';
import { createProduct } from '../../src/modules/products/products.service.js';
import { createReview, getProductRatingSummary, listReviews, moderateReview } from '../../src/modules/reviews/reviews.service.js';

setupTestDb();

async function seedProduct() {
  return createProduct({
    nameFr: 'Avis', nameEn: 'Review', descriptionFr: 'Produit', descriptionEn: 'Product',
    category: 'Homme', price: 6500, sizes: [{ size: '40', available: true }],
  });
}

describe('reviews.service', () => {
  test('crée, liste et modère un avis', async () => {
    const product = await seedProduct();
    const review = await createReview({ productId: product.id, rating: 5, comment: 'Excellent' });
    expect(review.status).toBe('pending');
    expect((await listReviews({ productId: product.id }))).toHaveLength(1);
    const approved = await moderateReview(review.id, 'approved');
    expect(approved.status).toBe('approved');
    await expect(getProductRatingSummary(product.id)).resolves.toEqual({ count: 1, average: 5 });
  });
});