/**
 * Génère une référence de commande lisible, style "KS-10234".
 * Le compteur de base est fourni par l'appelant (nombre de commandes existantes + 1)
 * pour rester déterministe et testable sans dépendre d'un état global.
 */
export function generateOrderReference(sequence) {
  const padded = String(10000 + sequence);
  return `KS-${padded}`;
}