import { setupTestDb } from '../testDb.js';
import { env } from '../../src/config/env.js';
import { setTransporter } from '../../src/modules/notifications/mailer.js';
import { registerWithPassword, loginWithPassword, verifyEmailAndAuthenticate, resendEmailVerification } from '../../src/modules/auth/auth.service.js';
import { emailVerificationMode } from '../../src/modules/auth/emailCode.service.js';
import { run, get } from '../../src/db/client.js';

setupTestDb();

const sent = [];
const originalMode = env.EMAIL_VERIFICATION;
beforeEach(() => {
  sent.length = 0;
  env.EMAIL_VERIFICATION = 'on';
  setTransporter({ sendMail: async (message) => { sent.push(message); return { messageId: 'test' }; } });
});
afterAll(() => { env.EMAIL_VERIFICATION = originalMode; });

const codeFrom = (message) => message.html.match(/<strong>(\d{6})<\/strong>/)[1];
const input = { name: 'Awa', email: 'awa@example.com', password: 'motdepasse123' };

describe('vérification de l’adresse e-mail', () => {
  test('l’inscription n’ouvre aucune session et envoie un code par e-mail', async () => {
    const result = await registerWithPassword(input);
    expect(result).toMatchObject({ verificationRequired: true, email: input.email });
    expect(result.accessToken).toBeUndefined();
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(input.email);
    expect(codeFrom(sent[0])).toMatch(/^\d{6}$/);
  });

  test('le bon code valide l’adresse et ouvre la session', async () => {
    await registerWithPassword(input);
    const session = await verifyEmailAndAuthenticate({ email: input.email, code: codeFrom(sent[0]) });
    expect(session.accessToken).toBeTruthy();
    expect((await get(`SELECT emailVerified FROM User WHERE email = ?`, [input.email])).emailVerified).toBeTruthy();
    await expect(registerWithPassword(input)).rejects.toMatchObject({ statusCode: 409 });
  });

  test('un mauvais code est refusé, puis le compte reste non vérifié', async () => {
    await registerWithPassword(input);
    await expect(verifyEmailAndAuthenticate({ email: input.email, code: '000000' })).rejects.toMatchObject({ statusCode: 400 });
    expect(Number((await get(`SELECT emailVerified FROM User WHERE email = ?`, [input.email])).emailVerified)).toBe(0);
  });

  test('la connexion d’un compte non vérifié renvoie un code au lieu d’une session', async () => {
    await registerWithPassword(input);
    await run(`UPDATE EmailCode SET expiresAt = ?`, [new Date(Date.now() - 1000).toISOString()]);
    const result = await loginWithPassword({ email: input.email, password: input.password });
    expect(result.verificationRequired).toBe(true);
    expect(sent).toHaveLength(2); // l'ancien code avait expiré : un nouveau est envoyé
  });

  test('un code encore valable n’est pas renvoyé en double', async () => {
    await registerWithPassword(input);
    const again = await resendEmailVerification(input.email);
    expect(again.resent ?? false).toBe(false);
    expect(sent).toHaveLength(1);
  });

  test('le renvoi pour une adresse inconnue ne révèle rien et n’envoie rien', async () => {
    expect(await resendEmailVerification('inconnu@example.com')).toEqual({ email: 'inconnu@example.com' });
    expect(sent).toHaveLength(0);
  });

  test('un échec SMTP supprime le code et renvoie une erreur explicite', async () => {
    setTransporter({ sendMail: async () => { throw Object.assign(new Error('Invalid login'), { code: 'EAUTH' }); } });
    await expect(registerWithPassword(input)).rejects.toMatchObject({ statusCode: 502, code: 'EMAIL_DELIVERY_FAILED' });
    expect((await get(`SELECT COUNT(*) AS total FROM EmailCode`)).total).toBe(0);
  });

  test('en production sans SMTP, l’inscription est refusée plutôt que non vérifiée', async () => {
    const mode = env.NODE_ENV;
    env.NODE_ENV = 'production';
    try {
      expect(emailVerificationMode()).toBe('unavailable');
      await expect(registerWithPassword(input)).rejects.toMatchObject({ statusCode: 503, code: 'EMAIL_UNAVAILABLE' });
    } finally { env.NODE_ENV = mode; }
  });
});
