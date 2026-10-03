import { MobileMoneyGateway } from './gateways/MobileMoneyGateway.js';
import { CashOnDeliveryGateway } from './gateways/CashOnDeliveryGateway.js';
import { CampayGateway, isCampayConfigured } from './gateways/CampayGateway.js';
import { badRequest } from '../../middleware/errorHandler.js';

// Sans identifiants CamPay (dev local, tests), le Mobile Money reste simulé
// et la carte est indisponible.
const gateways = {
  MOBILE_MONEY: () => (isCampayConfigured() ? new CampayGateway({ mode: 'momo' }) : new MobileMoneyGateway()),
  CARD: () => {
    if (!isCampayConfigured()) throw badRequest('Le paiement par carte n’est pas disponible.');
    return new CampayGateway({ mode: 'card' });
  },
  CASH_ON_DELIVERY: () => new CashOnDeliveryGateway(),
};

/**
 * Point d'entrée unique pour obtenir la passerelle correspondant à un moyen
 * de paiement. orders.service et payments.service (et rien d'autre) doivent
 * passer par cette fonction — jamais d'import direct d'un SDK de paiement
 * ailleurs dans la logique métier.
 */
export function getGateway(paymentMethod) {
  const factory = gateways[paymentMethod];
  if (!factory) throw badRequest(`Moyen de paiement non supporté : ${paymentMethod}`);
  return factory();
}
