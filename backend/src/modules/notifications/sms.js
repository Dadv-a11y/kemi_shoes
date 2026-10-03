import { logger } from '../../config/logger.js';
import { isTest } from '../../config/env.js';

/**
 * Abstraction d'envoi de SMS — même logique "ports & adapters" que les
 * passerelles de paiement. Aujourd'hui : implémentation "log" (aucun SMS réel
 * envoyé, le code atterrit dans les logs applicatifs pour le développement).
 * Demain : brancher un vrai fournisseur (Twilio, ou un agrégateur local) en
 * remplaçant uniquement `send()` ci-dessous, sans toucher au reste de l'app.
 */
const sentMessages = []; // utilisé uniquement par les tests pour inspecter les envois

export const smsSender = {
  async send(phone, message) {
    if (isTest) {
      sentMessages.push({ phone, message });
      return { provider: 'mock', accepted: true };
    }
    logger.info({ phone }, 'sms_dispatch (mock provider — brancher un vrai fournisseur SMS en prod)');
    // eslint-disable-next-line no-console
    console.log(`[SMS -> ${phone}] ${message}`);
    return { provider: 'mock', accepted: true };
  },

  // Réservé aux tests.
  _sentMessages: sentMessages,
  _reset() {
    sentMessages.length = 0;
  },
};

/**
 * Repli WhatsApp si l'envoi SMS échoue — même interface, message identique.
 * Architecture volontairement symétrique au SMS pour rester simple à brancher
 * sur l'API WhatsApp Business plus tard.
 */
export const whatsappSender = {
  async send(phone, message) {
    if (isTest) {
      sentMessages.push({ phone, message, channel: 'whatsapp' });
      return { provider: 'mock-whatsapp', accepted: true };
    }
    logger.info({ phone }, 'whatsapp_dispatch (mock provider)');
    return { provider: 'mock-whatsapp', accepted: true };
  },
};