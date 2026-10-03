/**
 * Calcule la tendance d'un produit entre deux périodes.
 * Seuil de ±3% pour éviter qu'un simple bruit statistique déclenche
 * une flèche haussière/baissière (règle validée avec le client).
 *
 * @returns {{ direction: 'up'|'down'|'flat', percent: number }}
 */
export function computeTrend(currentValue, previousValue) {
  if (previousValue === 0) {
    return { direction: currentValue > 0 ? 'up' : 'flat', percent: currentValue > 0 ? 100 : 0 };
  }
  const percent = ((currentValue - previousValue) / previousValue) * 100;
  const rounded = Math.round(percent * 10) / 10;

  if (Math.abs(rounded) < 3) return { direction: 'flat', percent: rounded };
  return { direction: rounded > 0 ? 'up' : 'down', percent: rounded };
}