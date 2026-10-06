import { setupTestDb } from '../testDb.js';
import { run } from '../../src/db/client.js';
import { requestOtp, verifyOtp } from '../../src/modules/auth/otp.service.js';
import { smsSender } from '../../src/modules/notifications/sms.js';
import { getSmsProvider, getWhatsappProvider } from '../../src/modules/notifications/sms/sms.factory.js';
import { get } from '../../src/db/client.js';

setupTestDb();

beforeEach(() => smsSender._reset());

describe('otp.service', () => {
  test('requestOtp envoie un SMS contenant un code à 6 chiffres', async () => {
    await requestOtp('+237600000001');
    expect(smsSender._sentMessages).toHaveLength(1);
    expect(smsSender._sentMessages[0].phone).toBe('+237600000001');
    expect(smsSender._sentMessages[0].message).toMatch(/\d{6}/);
  });

  test('verifyOtp accepte le bon code et le marque consommé', async () => {
    await requestOtp('+237600000002');
    const [, code] = smsSender._sentMessages[0].message.match(/(\d{6})/);
    await expect(verifyOtp('+237600000002', code)).resolves.toBe(true);
  });

  test('un même code ne peut pas être réutilisé deux fois', async () => {
    await requestOtp('+237600000003');
    const [, code] = smsSender._sentMessages[0].message.match(/(\d{6})/);
    await verifyOtp('+237600000003', code);
    await expect(verifyOtp('+237600000003', code)).rejects.toThrow(/Aucun code/);
  });

  test('un code incorrect est rejeté', async () => {
    await requestOtp('+237600000004');
    await expect(verifyOtp('+237600000004', '000000')).rejects.toThrow(/incorrect/);
  });

  test('rejette après le nombre maximal de tentatives', async () => {
    await requestOtp('+237600000005');
    for (let i = 0; i < 5; i++) {
      try { await verifyOtp('+237600000005', '000000'); } catch { /* attendu */ }
    }
    await expect(verifyOtp('+237600000005', '000000')).rejects.toThrow(/maximal/);
  });

  test('aucun code en attente pour un numéro jamais sollicité', async () => {
    await expect(verifyOtp('+237699999999', '123456')).rejects.toThrow(/Aucun code/);
  });

  test('pas de nouveau code tant que le précédent est valable (même échéance renvoyée)', async () => {
    const first = await requestOtp('+237600000006');
    const second = await requestOtp('+237600000006');
    expect(first.resent).toBe(true);
    expect(second).toEqual({ expiresAt: first.expiresAt, resent: false });
    expect(smsSender._sentMessages).toHaveLength(1);
  });

  test('un nouveau code est envoyé une fois le précédent expiré', async () => {
    await requestOtp('+237600000007');
    await run(`UPDATE OtpCode SET expiresAt = ? WHERE phone = ?`, [new Date(Date.now() - 1000).toISOString(), '+237600000007']);
    const renewed = await requestOtp('+237600000007');
    expect(renewed.resent).toBe(true);
    expect(smsSender._sentMessages).toHaveLength(2);
    const [, code] = smsSender._sentMessages[1].message.match(/(\d{6})/);
    await expect(verifyOtp('+237600000007', code)).resolves.toBe(true);
  });

  test('repli WhatsApp si le fournisseur SMS échoue', async () => {
    const sms = getSmsProvider();
    const original = sms.send;
    sms.send = async () => { throw new Error('sms_down'); };
    try {
      await requestOtp('+237600000008');
    } finally {
      sms.send = original;
    }
    expect(getWhatsappProvider().sent).toHaveLength(1);
    expect(getWhatsappProvider().sent[0]).toMatchObject({ phone: '+237600000008', channel: 'whatsapp' });
  });

  test('aucun canal ne délivre le code : 502 et le code est supprimé (nouvelle demande possible)', async () => {
    const providers = [getSmsProvider(), getWhatsappProvider()];
    const originals = providers.map((provider) => provider.send);
    providers.forEach((provider) => { provider.send = async () => { throw new Error('down'); }; });
    try {
      await expect(requestOtp('+237600000009')).rejects.toMatchObject({ statusCode: 502, code: 'OTP_DELIVERY_FAILED' });
    } finally {
      providers.forEach((provider, index) => { provider.send = originals[index]; });
    }
    expect(await get(`SELECT id FROM OtpCode WHERE phone = ?`, ['+237600000009'])).toBeUndefined();
  });
});
