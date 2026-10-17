import { describe, expect, it } from 'vitest';
import { calculateNormalizedSensitivity } from '../../src/ui/sensitivityPanel.js';

describe('sensitivity panel helpers', () => {
  it('computes normalized endpoint sensitivity when baseline is nonzero', () => {
    const rows = [{ x: 8, y: 18 }, { x: 12, y: 22 }];
    expect(calculateNormalizedSensitivity(rows, 10, 20)).toBeCloseTo(0.5, 12);
  });

  it('returns null when normalization would divide by zero', () => {
    expect(calculateNormalizedSensitivity([{ x: 0, y: 1 }, { x: 1, y: 2 }], 0, 1)).toBeNull();
  });
});
