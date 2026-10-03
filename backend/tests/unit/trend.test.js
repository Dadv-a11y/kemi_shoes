import { computeTrend } from '../../src/utils/trend.js';

describe('computeTrend', () => {
  test('retourne "up" quand la hausse dépasse le seuil de 3%', () => {
    const t = computeTrend(42, 35);
    expect(t.direction).toBe('up');
    expect(t.percent).toBeCloseTo(20, 0);
  });

  test('retourne "down" quand la baisse dépasse le seuil de 3%', () => {
    const t = computeTrend(28, 31);
    expect(t.direction).toBe('down');
  });

  test('retourne "flat" pour une variation dans le bruit statistique (< 3%)', () => {
    const t = computeTrend(101, 100); // +1%
    expect(t.direction).toBe('flat');
  });

  test('gère une période précédente à zéro sans diviser par zéro', () => {
    const t = computeTrend(10, 0);
    expect(t.direction).toBe('up');
    expect(Number.isFinite(t.percent)).toBe(true);
  });

  test('deux périodes à zéro restent "flat"', () => {
    const t = computeTrend(0, 0);
    expect(t.direction).toBe('flat');
  });
});