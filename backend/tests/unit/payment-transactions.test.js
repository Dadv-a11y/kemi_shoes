import { setupTestDb } from '../testDb.js';
import { createProduct } from '../../src/modules/products/products.service.js';
import { createZone } from '../../src/modules/delivery-zones/deliveryZones.service.js';
import { createOrder, getOrderById } from '../../src/modules/orders/orders.service.js';
import { recordAttempt, syncTransaction, findByAnyReference } from '../../src/modules/payments/payments.transactions.js';

setupTestDb();

async function newOrder(paymentMethod = 'MOBILE_MONEY') {
  const product = await createProduct({
    nameFr: 'Mule', nameEn: 'Mule', descriptionFr: 'Cuir', descriptionEn: 'Leather', category: 'Homme', price: 6500,
    status: 'active', sizes: [{ size: '40', available: true }], colorCustomizable: false, materialCustomizable: false,
  });
  const zone = await createZone({
    country: 'Cameroun', regionOrCity: 'Douala', feeFcfa: 1500, etaMinHours: 24, etaMaxHours: 48,
    codAvailable: true, paymentMethods: ['mobile_money', 'card', 'cod'],
  });
  const { order } = await createOrder({
    items: [{ productId: product.id, size: '40', quantity: 1 }], deliveryZoneId: zone.id,
    address: { country: 'Cameroun', city: 'Douala', street: 'Makepé' },
    guest: { name: 'Daril', phone: '+237600000000' }, paymentMethod,
  });
  return order;
}

describe('PaymentTransaction', () => {
  test('conserve la référence opérateur et le statut renvoyés par la vérification', async () => {
    const order = await newOrder();
    await recordAttempt({ orderId: order.id, reference: 'campay-ref-1', amountFcfa: 25, operator: 'MTN' });
    await recordAttempt({ orderId: order.id, reference: 'campay-ref-1', amountFcfa: 25 }); // idempotent

    await syncTransaction({
      orderId: order.id, reference: 'campay-ref-1',
      transaction: { status: 'paid', operator: 'MTN', operatorReference: '19122597010', raw: { code: 'D261007D0091TU' } },
    });

    const { paymentTransactions } = await getOrderById(order.id);
    const tx = paymentTransactions.find((row) => row.reference === 'campay-ref-1');
    expect(paymentTransactions.filter((row) => row.reference === 'campay-ref-1')).toHaveLength(1);
    expect(tx).toMatchObject({ status: 'PAID', operator: 'MTN', operatorReference: '19122597010', amountFcfa: 25 });
    expect(tx.rawPayload).toBeUndefined(); // la réponse brute n'est jamais renvoyée par l'API
    expect((await findByAnyReference('19122597010')).orderId).toBe(order.id);
  });

  test('un paiement à la livraison ne crée aucune transaction en ligne', async () => {
    const order = await newOrder('CASH_ON_DELIVERY');
    expect((await getOrderById(order.id)).paymentTransactions).toEqual([]);
  });
});
