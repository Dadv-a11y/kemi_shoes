/**
 * Interface commune à toute passerelle de paiement (Stripe, Mobile Money...).
 * Le reste de l'application (orders.service) ne dépend jamais d'un SDK
 * spécifique — uniquement de ce contrat. Ajouter un nouvel agrégateur =
 * ajouter une classe qui l'implémente, sans toucher au reste du code.
 */
export class PaymentGateway {
  /**
   * @param {{ orderId: string, amountFcfa: number, phone?: string, email?: string }} input
   * @returns {Promise<{ status: 'pending'|'paid'|'failed', reference: string, redirectUrl?: string }>}
   */
  // eslint-disable-next-line no-unused-vars
  async createPayment(input) {
    throw new Error('createPayment() doit être implémentée par la passerelle.');
  }

  /**
   * @param {string} reference
   * @returns {Promise<{ status: 'pending'|'paid'|'failed' }>}
   */
  // eslint-disable-next-line no-unused-vars
  async verifyPayment(reference) {
    throw new Error('verifyPayment() doit être implémentée par la passerelle.');
  }
}