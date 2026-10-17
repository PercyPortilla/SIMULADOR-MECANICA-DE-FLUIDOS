import { describe, expect, it } from 'vitest';
import {
  calculateCstrSeriesStages,
  calculateCstrsInSeriesConversion,
  calculateEmpiricalLeachingRateConstant,
  calculateResidenceTimeHours,
} from '../../src/core/leaching/index.js';

describe('leaching residence-time model', () => {
  it('derives residence time only from explicit useful volume and flow', () => {
    expect(calculateResidenceTimeHours({ usefulVolumeM3: 360, flowRateM3s: 0.01 })).toBe(10);
  });

  it('uses equal-volume first-order CSTRs in series with explicit k', () => {
    const conversion = calculateCstrsInSeriesConversion({ rateConstantPerH: 0.1, residenceTimeH: 10, reactorCount: 4 });
    expect(conversion).toBeCloseTo(1 - (1 / 1.25) ** 4, 12);
  });

  it('keeps k unchanged when empirical couplings are disabled', () => {
    const result = calculateEmpiricalLeachingRateConstant({ baseRateConstantPerH: 0.1, temperatureC: 40, referenceTemperatureC: 25, betaTemperaturePerC: 0.05 });
    expect(result.effectiveRateConstantPerH).toBe(0.1);
    expect(result.couplingEnabled).toBe(false);
  });

  it('applies only user-enabled empirical correction terms and reports stage conversion', () => {
    const effective = calculateEmpiricalLeachingRateConstant({
      baseRateConstantPerH: 0.1,
      temperatureC: 35,
      referenceTemperatureC: 25,
      coupleTemperature: true,
      betaTemperaturePerC: 0.02,
    });
    expect(effective.effectiveRateConstantPerH).toBeCloseTo(0.1 * Math.exp(0.2), 12);
    expect(effective.calibrated).toBe(false);
    const stages = calculateCstrSeriesStages({ rateConstantPerH: effective.effectiveRateConstantPerH, residenceTimeH: 8, reactorCount: 4, feedGradeGL: 5 });
    expect(stages).toHaveLength(4);
    expect(stages[3].conversion).toBeGreaterThan(stages[0].conversion);
    expect(stages[3].estimatedGradeGL).toBeLessThan(stages[0].estimatedGradeGL);
  });
});
