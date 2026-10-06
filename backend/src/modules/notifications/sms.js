import { getSmsProvider, getWhatsappProvider } from './sms/sms.factory.js';

/**
 * Point d'entrée historique (otp.service, tests) : délègue au fournisseur
 * configuré (sms/sms.factory.js). `null` = canal non branché.
 */
export const smsSender = {
  get available() {
    return Boolean(getSmsProvider());
  },
  send(phone, message) {
    const provider = getSmsProvider();
    if (!provider) throw new Error('sms_provider_not_configured');
    return provider.send(phone, message);
  },
  // Tests (SMS_PROVIDER=memory) : messages envoyés, SMS et repli WhatsApp confondus.
  get _sentMessages() {
    return [...(getSmsProvider()?.sent ?? []), ...(getWhatsappProvider()?.sent ?? [])];
  },
  _reset() {
    getSmsProvider()?.reset?.();
    getWhatsappProvider()?.reset?.();
  },
};

export const whatsappSender = {
  get available() {
    return Boolean(getWhatsappProvider());
  },
  send(phone, message) {
    const provider = getWhatsappProvider();
    if (!provider) throw new Error('whatsapp_provider_not_configured');
    return provider.send(phone, message);
  },
};
