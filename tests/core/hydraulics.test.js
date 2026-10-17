import { describe, expect, it } from 'vitest';
import {
  calculateLaminarPressureDrop,
  calculatePipeFlowRate,
} from '../../src/core/hydraulics/index.js';

describe('basic hydraulics calculations', () => {
  it('matches V1 laminar pressure drop', () => {
    expect(calculateLaminarPressureDrop({ wallStressPa: 10, lengthM: 100, innerDiameterM: 0.15 }))
      .toBeCloseTo(26666.6666666667, 10);
  });

  it('matches circular-pipe flow rate', () => {
    expect(calculatePipeFlowRate({ velocityMps: 1.5, innerDiameterM: 0.15 }))
      .toBeCloseTo(0.026507188, 9);
  });
});
