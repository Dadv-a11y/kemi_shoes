import { SmsProvider } from './SmsProvider.js';

/**
 * Développement uniquement : affiche le message (donc le code OTP) dans la
 * console du backend au lieu de l'envoyer. Refusé en production (env.js).
 */
export class ConsoleSmsProvider extends SmsProvider {
  constructor(channel = 'sms') {
    super();
    this.channel = channel;
  }

  get name() {
    return `console-${this.channel}`;
  }

  async send(phone, message) {
    // eslint-disable-next-line no-console
    console.log(`[${this.channel.toUpperCase()} dev -> ${phone}] ${message}`);
    return { provider: this.name };
  }
}
