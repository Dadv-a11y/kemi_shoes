/**
 * Contrat commun à tout fournisseur d'envoi de messages (SMS, WhatsApp…).
 * Le reste de l'application (otp.service…) ne dépend que de ce contrat, jamais
 * d'un SDK : brancher un fournisseur = écrire une classe qui l'implémente et
 * l'enregistrer dans sms.factory.js (voir README.md de ce dossier).
 */
export class SmsProvider {
  /** Identifiant du fournisseur (journalisation, métriques). */
  get name() {
    throw new Error('name doit être défini par le fournisseur.');
  }

  /**
   * Envoie un message texte.
   * @param {string} phone Numéro au format E.164 (+2376XXXXXXXX)
   * @param {string} message Texte brut (le code OTP y figure en clair)
   * @returns {Promise<{ provider: string, messageId?: string }>} lève une erreur en cas d'échec
   */
  // eslint-disable-next-line no-unused-vars
  async send(phone, message) {
    throw new Error('send() doit être implémentée par le fournisseur.');
  }
}
