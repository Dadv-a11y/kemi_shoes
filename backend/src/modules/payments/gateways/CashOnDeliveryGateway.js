import { randomUUID } from 'node:crypto';
import { PaymentGateway } from './PaymentGateway.js';

/**
 * Paiement à la livraison — aucune transaction en ligne, mais implémente la
 * même interface que les autres passerelles pour que orders.service n'ait
 * jamais besoin de savoir "si c'est du COD, saute l'étape paiement".
 */
export class CashOnDeliveryGateway extends PaymentGateway {
  async createPayment({ orderId }) {
    return { status: 'pending', reference: `COD-${orderId}-${randomUUID().slice(0, 6)}` };
  }

  async verifyPayment() {
    // La confirmation réelle se fait manuellement par l'équipe à la livraison
    // (changement de statut de commande côté admin), pas via cette passerelle.
    return { status: 'pending' };
  }
}