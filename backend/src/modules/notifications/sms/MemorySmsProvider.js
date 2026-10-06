import { SmsProvider } from './SmsProvider.js';

/** Tests : conserve les messages en mémoire pour inspection (aucun envoi). */
export class MemorySmsProvider extends SmsProvider {
  constructor(channel = 'sms') {
    super();
    this.channel = channel;
    this.sent = [];
  }

  get name() {
    return `memory-${this.channel}`;
  }

  async send(phone, message) {
    this.sent.push({ phone, message, channel: this.channel });
    return { provider: this.name, messageId: String(this.sent.length) };
  }

  reset() {
    this.sent.length = 0;
  }
}
