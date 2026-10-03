import { mailer, getTransporter } from '../../src/modules/notifications/mailer.js';

describe('mailer', () => {
  test('sendOrderConfirmation envoie un email avec la référence et le total', async () => {
    const info = await mailer.sendOrderConfirmation({
      to: 'client@example.com',
      reference: 'KS-10234',
      totalFcfa: 28000,
      etaLabel: '24–48h',
    });
    const message = JSON.parse(info.message);
    expect(message.to[0].address).toBe('client@example.com');
    expect(message.subject).toContain('KS-10234');
    expect(message.html).toContain('28');
    expect(message.html).toContain('24–48h');
  });

  test('sendWelcomeEmail personnalise le message avec le nom', async () => {
    const info = await mailer.sendWelcomeEmail({ to: 'a@b.com', name: 'Daril' });
    const message = JSON.parse(info.message);
    expect(message.html).toContain('Daril');
  });

  test('sendPasswordReset inclut le lien de réinitialisation', async () => {
    const info = await mailer.sendPasswordReset({ to: 'a@b.com', resetUrl: 'https://kemishoes.com/reset/xyz' });
    const message = JSON.parse(info.message);
    expect(message.html).toContain('https://kemishoes.com/reset/xyz');
  });

  test('getTransporter renvoie toujours la même instance (singleton)', () => {
    expect(getTransporter()).toBe(getTransporter());
  });
});