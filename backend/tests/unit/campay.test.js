import jwt from 'jsonwebtoken';
import { jest } from '@jest/globals';
import { env } from '../../src/config/env.js';
import { CampayGateway, chargeableAmount, normalizeCampayPhone } from '../../src/modules/payments/gateways/CampayGateway.js';

function mockFetch(payload, ok = true) {
  return jest.fn().mockResolvedValue({ ok, status: ok ? 200 : 400, json: async () => payload });
}

describe('CampayGateway', () => {
  const originalFetch = global.fetch;
  beforeEach(() => {
    env.CAMPAY_ACCESS_TOKEN = 'test-token';
    env.CAMPAY_MAX_AMOUNT_XAF = undefined;
  });
  afterEach(() => {
    global.fetch = originalFetch;
    env.CAMPAY_ACCESS_TOKEN = '';
  });

  test('normalise les numéros camerounais au format 237XXXXXXXXX', () => {
    expect(normalizeCampayPhone('+237 677 77 77 77')).toBe('237677777777');
    expect(normalizeCampayPhone('677777777')).toBe('237677777777');
  });

  test('plafonne le montant facturé quand CAMPAY_MAX_AMOUNT_XAF est défini (compte demo)', () => {
    expect(chargeableAmount(15000)).toBe(15000);
    env.CAMPAY_MAX_AMOUNT_XAF = 25;
    expect(chargeableAmount(15000)).toBe(25);
    expect(chargeableAmount(10)).toBe(10);
  });

  test('collect envoie le montant, le numéro et la commande en external_reference', async () => {
    global.fetch = mockFetch({ reference: 'abc-123', ussd_code: '*126#', operator: 'MTN' });
    env.CAMPAY_MAX_AMOUNT_XAF = 25;
    const result = await new CampayGateway().createPayment({ orderId: 'order-1', amountFcfa: 12000, phone: '677777777' });

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe(`${env.CAMPAY_BASE_URL}/collect/`);
    expect(options.headers.Authorization).toBe('Token test-token');
    const body = JSON.parse(options.body);
    expect(body).toMatchObject({ amount: '25', currency: 'XAF', from: '237677777777' });
    // Référence unique par tentative (CamPay dédoublonne sur external_reference).
    expect(body.external_reference).toMatch(/^order-1\./);
    expect(result).toEqual({ status: 'pending', reference: 'abc-123', ussdCode: '*126#', operator: 'MTN' });
  });

  test('refuse un numéro non camerounais avant tout appel réseau', async () => {
    global.fetch = mockFetch({});
    await expect(new CampayGateway().createPayment({ orderId: 'o', amountFcfa: 10, phone: '+33612345678' })).rejects.toMatchObject({ statusCode: 400 });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('le mode carte renvoie un lien de paiement hébergé', async () => {
    global.fetch = mockFetch({ link: 'https://demo.campay.net/pay/xyz', reference: 'link-ref' });
    const result = await new CampayGateway({ mode: 'card' }).createPayment({ orderId: 'o1', amountFcfa: 10, name: 'Awa Ngo' });
    expect(result).toEqual({ status: 'pending', reference: 'link-ref', redirectUrl: 'https://demo.campay.net/pay/xyz' });
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toMatchObject({ payment_options: 'CARD', first_name: 'Awa', last_name: 'Ngo' });
  });

  test.each([['SUCCESSFUL', 'paid'], ['FAILED', 'failed'], ['PENDING', 'pending']])('verifyPayment traduit %s en %s', async (campayStatus, expected) => {
    global.fetch = mockFetch({ status: campayStatus, amount: '25', external_reference: 'o1.abc123' });
    expect(await new CampayGateway().verifyPayment('ref')).toMatchObject({ status: expected, amount: 25, externalReference: 'o1' });
  });
});

describe('webhook CamPay', () => {
  test('rejette une signature invalide', async () => {
    env.CAMPAY_WEBHOOK_KEY = 'webhook-secret';
    const { handleCampayWebhook } = await import('../../src/modules/payments/payments.service.js');
    const forged = jwt.sign({}, 'mauvaise-cle');
    await expect(handleCampayWebhook({ signature: forged, reference: 'r', external_reference: 'o' })).rejects.toMatchObject({ statusCode: 401 });
    env.CAMPAY_WEBHOOK_KEY = '';
  });
});
