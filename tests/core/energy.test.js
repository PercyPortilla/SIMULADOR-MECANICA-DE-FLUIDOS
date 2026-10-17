import { describe, expect, it } from 'vitest';
import { calculatePumpEnergy } from '../../src/core/energy/index.js';

describe('pump energy', () => {
  it('propagates explicit pump/motor efficiencies and annual energy', () => {
    const result = calculatePumpEnergy({
      flowRateM3s: 0.01,
      requiredPressurePa: 100000,
      pumpEfficiency: 0.8,
      motorEfficiency: 0.9,
      operatingHoursPerYear: 1000,
      electricityPricePerKwh: 0.12,
    });
    expect(result.hydraulicPowerW).toBe(1000);
    expect(result.shaftPowerW).toBeCloseTo(1250, 12);
    expect(result.electricalPowerW).toBeCloseTo(1388.8888888889, 8);
    expect(result.annualEnergyKwh).toBeCloseTo(1388.8888888889, 8);
    expect(result.annualEnergyCost).toBeCloseTo(166.6666666667, 8);
  });
});
