import { env } from '../../../config/env.js';
import { ConsoleSmsProvider } from './ConsoleSmsProvider.js';
import { MemorySmsProvider } from './MemorySmsProvider.js';

/**
 * Fournisseurs disponibles, choisis par SMS_PROVIDER / WHATSAPP_PROVIDER.
 * Pour brancher un fournisseur réel (Twilio, Orange SMS API, agrégateur local…) :
 *   1. créer `XxxSmsProvider.js` qui étend SmsProvider (voir README.md) ;
 *   2. l'ajouter ici, par ex. `twilio: (channel) => new TwilioSmsProvider({ channel, ...env })` ;
 *   3. ajouter la valeur à l'enum SMS_PROVIDER de config/env.js et ses identifiants.
 * Aucune autre partie du code n'est à modifier.
 */
const registry = {
  none: () => null,
  console: (channel) => new ConsoleSmsProvider(channel),
  memory: (channel) => new MemorySmsProvider(channel),
};

function build(key, channel) {
  const factory = registry[key];
  if (!factory) throw new Error(`Fournisseur de messages inconnu : ${key}`);
  return factory(channel);
}

// Instanciés une fois au démarrage : `null` = canal non configuré.
const smsProvider = build(env.SMS_PROVIDER, 'sms');
const whatsappProvider = build(env.WHATSAPP_PROVIDER, 'whatsapp');

export const getSmsProvider = () => smsProvider;
export const getWhatsappProvider = () => whatsappProvider;

/** La connexion par téléphone (OTP) n'est proposée que si au moins un canal est branché. */
export const isPhoneAuthAvailable = () => Boolean(smsProvider || whatsappProvider);
