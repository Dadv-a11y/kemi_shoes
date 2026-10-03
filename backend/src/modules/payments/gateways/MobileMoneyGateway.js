import { randomUUID } from 'node:crypto';
import { PaymentGateway } from './PaymentGateway.js';
import { env } from '../../../config/env.js';
import { logger } from '../../../config/logger.js';
import { badRequest } from '../../../middleware/errorHandler.js';

/**
 * Adaptateur Mobile Money — Orange Money / MTN Mobile Money, Cameroun.
 *
 * Le choix définitif de l'agrégateur (Monetbil, Campay, CinetPay...) est
 * encore en cours d'évaluation côté client. En attendant, cette
 * implémentation simule le comportement attendu d'un agrégateur réel :
 * création d'une session de paiement en attente de confirmation par
 * l'utilisateur sur son téléphone. Basculer vers un vrai fournisseur =
 * remplacer le corps de createPayment/verifyPayment par les appels HTTP
 * réels de son API, sans toucher au reste de l'app.
 */
export class MobileMoneyGateway extends PaymentGateway {
  constructor({ simulateInstantSuccess = !env.MOBILE_MONEY_API_KEY } = {}) {
    super();
    this.simulateInstantSuccess = simulateInstantSuccess;
    this._sessions = new Map(); // uniquement pour le mode simulé
  }

  async createPayment({ orderId, amountFcfa, phone }) {
    if (!phone) throw badRequest('Numéro Mobile Money requis.');

    const reference = `MM-${randomUUID().slice(0, 8).toUpperCase()}`;

    if (!env.MOBILE_MONEY_API_KEY) {
      logger.warn({ orderId }, 'mobile_money_mock — aucun agrégateur réel configuré, simulation locale');
    }

    const status = this.simulateInstantSuccess ? 'paid' : 'pending';
    this._sessions.set(reference, { status, orderId, amountFcfa, phone });
    return { status, reference };
  }

  async verifyPayment(reference) {
    const session = this._sessions.get(reference);
    if (!session) return { status: 'pending' };
    return { status: session.status };
  }

  // Réservé aux tests / à un futur webhook agrégateur.
  _markPaid(reference) {
    const session = this._sessions.get(reference);
    if (session) session.status = 'paid';
  }
}