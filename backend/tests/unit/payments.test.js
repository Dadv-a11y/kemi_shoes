import { getGateway } from '../../src/modules/payments/payments.factory.js';
import { MobileMoneyGateway } from '../../src/modules/payments/gateways/MobileMoneyGateway.js';
import { CashOnDeliveryGateway } from '../../src/modules/payments/gateways/CashOnDeliveryGateway.js';

describe('payments.factory', () => {
  test('retourne une MobileMoneyGateway pour MOBILE_MONEY', () => {
    expect(getGateway('MOBILE_MONEY')).toBeInstanceOf(MobileMoneyGateway);
  });

  test('retourne une CashOnDeliveryGateway pour CASH_ON_DELIVERY', () => {
    expect(getGateway('CASH_ON_DELIVERY')).toBeInstanceOf(CashOnDeliveryGateway);
  });

  test('refuse CARD car Stripe n’est pas utilisé', () => {
    expect(() => getGateway('CARD')).toThrow(expect.objectContaining({ statusCode: 400 }));
  });

  test('rejette un moyen de paiement inconnu', () => {
    expect(() => getGateway('BITCOIN')).toThrow(expect.objectContaining({ statusCode: 400 }));
  });
});

describe('MobileMoneyGateway (mode simulé, sans agrégateur réel configuré)', () => {
  test('createPayment exige un numéro de téléphone', async () => {
    const gw = new MobileMoneyGateway();
    await expect(gw.createPayment({ orderId: 'o1', amountFcfa: 1000 })).rejects.toMatchObject({ statusCode: 400 });
  });

  test('createPayment renvoie une référence et un statut', async () => {
    const gw = new MobileMoneyGateway({ simulateInstantSuccess: false });
    const result = await gw.createPayment({ orderId: 'o1', amountFcfa: 1000, phone: '+237600000000' });
    expect(result.reference).toMatch(/^MM-/);
    expect(result.status).toBe('pending');
  });

  test('verifyPayment reflète le statut de la session simulée', async () => {
    const gw = new MobileMoneyGateway({ simulateInstantSuccess: false });
    const { reference } = await gw.createPayment({ orderId: 'o1', amountFcfa: 1000, phone: '+237600000000' });
    expect((await gw.verifyPayment(reference)).status).toBe('pending');
    gw._markPaid(reference);
    expect((await gw.verifyPayment(reference)).status).toBe('paid');
  });
});

describe('CashOnDeliveryGateway', () => {
  test('createPayment renvoie toujours un statut pending (confirmation manuelle à la livraison)', async () => {
    const gw = new CashOnDeliveryGateway();
    const result = await gw.createPayment({ orderId: 'o1', amountFcfa: 5000 });
    expect(result.status).toBe('pending');
    expect(result.reference).toContain('COD-o1');
  });
});
