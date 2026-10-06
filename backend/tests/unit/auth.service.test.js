import { randomUUID } from 'node:crypto';
import { setupTestDb } from '../testDb.js';
import { run, get } from '../../src/db/client.js';
import {
  registerWithPassword,
  loginWithPassword,
  verifyPhoneOtpAndAuthenticate,
  findOrCreateOAuthUser,
  refreshSession,
  logout,
  logoutEverywhere,
} from '../../src/modules/auth/auth.service.js';
import { requestOtp } from '../../src/modules/auth/otp.service.js';
import { smsSender } from '../../src/modules/notifications/sms.js';
import { verifyAccessToken } from '../../src/utils/tokens.js';

setupTestDb();
beforeEach(() => smsSender._reset());

async function seedDeliveryZone() {
  const id = randomUUID();
  await run(
    `INSERT INTO DeliveryZone (id, country, feeFcfa, etaMinHours, etaMaxHours, codAvailable, paymentMethods)
     VALUES (?, 'Cameroun', 1500, 24, 48, 1, '["mobile_money","card","cod"]')`,
    [id]
  );
  return id;
}

async function seedGuestOrder(phone, zoneId) {
  const id = randomUUID();
  await run(
    `INSERT INTO "Order" (id, reference, guestName, guestPhone, deliveryZoneId, addressCountry, addressCity, addressStreet,
       paymentMethod, subtotalFcfa, deliveryFeeFcfa, totalFcfa)
     VALUES (?, ?, 'Invité Test', ?, ?, 'Cameroun', 'Douala', 'Makepé', 'MOBILE_MONEY', 6500, 1500, 8000)`,
    [id, `KS-TEST-${id.slice(0, 5)}`, phone, zoneId]
  );
  return id;
}

describe('registerWithPassword / loginWithPassword', () => {
  test('crée un compte et permet ensuite de se connecter avec le même mot de passe', async () => {
    await registerWithPassword({ name: 'Aïcha', email: 'aicha@example.com', password: 'SuperSecret123!' });
    const { accessToken, user } = await loginWithPassword({ email: 'aicha@example.com', password: 'SuperSecret123!' });
    expect(user.email).toBe('aicha@example.com');
    expect(verifyAccessToken(accessToken).sub).toBe(user.id);
  });

  test('refuse un second compte avec le même email (409)', async () => {
    await registerWithPassword({ name: 'A', email: 'dup@example.com', password: 'Password123!' });
    await expect(registerWithPassword({ name: 'B', email: 'dup@example.com', password: 'Password123!' }))
      .rejects.toMatchObject({ statusCode: 409 });
  });

  test('refuse une connexion avec un mauvais mot de passe (401)', async () => {
    await registerWithPassword({ name: 'C', email: 'c@example.com', password: 'CorrectHorse1!' });
    await expect(loginWithPassword({ email: 'c@example.com', password: 'wrong' }))
      .rejects.toMatchObject({ statusCode: 401 });
  });

  test('ne révèle pas si c’est l’email ou le mot de passe qui est erroné', async () => {
    await expect(loginWithPassword({ email: 'inconnu@example.com', password: 'x' }))
      .rejects.toMatchObject({ message: 'Email ou mot de passe incorrect.' });
  });

  test('ne renvoie jamais le hash du mot de passe au client', async () => {
    const { user } = await registerWithPassword({ name: 'D', email: 'd@example.com', password: 'Password123!' });
    expect(user.passwordHash).toBeUndefined();
  });
});

describe('verifyPhoneOtpAndAuthenticate', () => {
  test('crée un compte au premier code vérifié et rattache les commandes invité existantes', async () => {
    const zoneId = await seedDeliveryZone();
    await seedGuestOrder('+237611111111', zoneId);

    await requestOtp('+237611111111');
    const [, code] = smsSender._sentMessages[0].message.match(/(\d{6})/);

    const { user } = await verifyPhoneOtpAndAuthenticate({ phone: '+237611111111', code, name: 'Junior' });

    expect(user.phone).toBe('+237611111111');
    const order = await get(`SELECT * FROM "Order" WHERE guestPhone = ?`, ['+237611111111']);
    expect(order.userId).toBe(user.id);
  });

  test('un second passage OTP réutilise le même compte plutôt que d’en créer un autre', async () => {
    await requestOtp('+237622222222');
    let [, code] = smsSender._sentMessages[0].message.match(/(\d{6})/);
    const first = await verifyPhoneOtpAndAuthenticate({ phone: '+237622222222', code });

    await requestOtp('+237622222222');
    [, code] = smsSender._sentMessages[1].message.match(/(\d{6})/);
    const second = await verifyPhoneOtpAndAuthenticate({ phone: '+237622222222', code });

    expect(second.user.id).toBe(first.user.id);
  });
});

describe('findOrCreateOAuthUser', () => {
  test('crée un compte au premier login Google', async () => {
    const { user } = await findOrCreateOAuthUser({ provider: 'GOOGLE', providerId: 'g-123', email: 'g@example.com', name: 'Gwen' });
    expect(user.provider).toBe('GOOGLE');
    expect(user.email).toBe('g@example.com');
  });

  test('relie le provider à un compte existant avec le même email plutôt que de dupliquer', async () => {
    const { user: passwordUser } = await registerWithPassword({ name: 'Eve', email: 'eve@example.com', password: 'Password123!' });
    const { user: oauthUser } = await findOrCreateOAuthUser({ provider: 'GOOGLE', providerId: 'g-eve', email: 'eve@example.com', name: 'Eve' });
    expect(oauthUser.id).toBe(passwordUser.id);
    expect(oauthUser.provider).toBe('GOOGLE');
  });

  test('un second login avec le même providerId retrouve le même compte', async () => {
    const first = await findOrCreateOAuthUser({ provider: 'FACEBOOK', providerId: 'fb-1', email: 'f@example.com', name: 'F' });
    const second = await findOrCreateOAuthUser({ provider: 'FACEBOOK', providerId: 'fb-1', email: 'f@example.com', name: 'F' });
    expect(second.user.id).toBe(first.user.id);
  });
});

describe('refreshSession', () => {
  test('émet un nouveau access token valide à partir d’un refresh token valide', async () => {
    const { refreshToken, user } = await registerWithPassword({ name: 'R', email: 'r@example.com', password: 'Password123!' });
    const refreshed = await refreshSession(refreshToken);
    expect(refreshed.user.id).toBe(user.id);
    expect(verifyAccessToken(refreshed.accessToken).sub).toBe(user.id);
  });

  test('rejette un refresh token invalide', async () => {
    await expect(refreshSession('token-invalide')).rejects.toThrow();
  });

  test('rotation : l’ancien refresh token est refusé après renouvellement', async () => {
    const { refreshToken } = await registerWithPassword({ name: 'R', email: 'rot@example.com', password: 'Password123!' });
    const refreshed = await refreshSession(refreshToken);
    expect(refreshed.refreshToken).not.toBe(refreshToken);
    // Rejeu immédiat (autre onglet) : refusé sans révoquer la session.
    await expect(refreshSession(refreshToken)).rejects.toMatchObject({ statusCode: 401, code: 'REFRESH_SUPERSEDED' });
    await expect(refreshSession(refreshed.refreshToken)).resolves.toHaveProperty('accessToken');
  });

  test('rejeu d’un refresh token ancien (hors délai de grâce) : la session est révoquée', async () => {
    const { refreshToken } = await registerWithPassword({ name: 'R', email: 'vol@example.com', password: 'Password123!' });
    const first = await refreshSession(refreshToken);
    const second = await refreshSession(first.refreshToken);
    await expect(refreshSession(refreshToken)).rejects.toMatchObject({ statusCode: 401 });
    // Le jeton volé a provoqué la révocation : même le dernier jeton légitime est refusé.
    await expect(refreshSession(second.refreshToken)).rejects.toMatchObject({ statusCode: 401 });
  });

  test('déconnexion : la session révoquée ne peut plus être renouvelée', async () => {
    const { refreshToken, accessToken } = await registerWithPassword({ name: 'R', email: 'out@example.com', password: 'Password123!' });
    await logout(verifyAccessToken(accessToken).sid);
    await expect(refreshSession(refreshToken)).rejects.toMatchObject({ statusCode: 401 });
  });

  test('déconnexion de tous les appareils', async () => {
    const a = await registerWithPassword({ name: 'R', email: 'all@example.com', password: 'Password123!' });
    const b = await loginWithPassword({ email: 'all@example.com', password: 'Password123!' });
    await logoutEverywhere(a.user.id);
    await expect(refreshSession(a.refreshToken)).rejects.toMatchObject({ statusCode: 401 });
    await expect(refreshSession(b.refreshToken)).rejects.toMatchObject({ statusCode: 401 });
  });
});