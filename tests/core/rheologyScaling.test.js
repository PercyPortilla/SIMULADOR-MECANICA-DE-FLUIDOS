import { describe, expect, it } from 'vitest';
import { calculateEmpiricalRheologyScale } from '../../src/core/rheology/index.js';
import { calculateChurchillDarcyFrictionFactor } from '../../src/core/hydraulics/index.js';

describe('advanced rheology scaling and transition', () => {
  it('returns unity for the legacy reference condition', () => {
    const scale = calculateEmpiricalRheologyScale({
      solidVolumeFraction: 0.113636363636,
      referenceSolidVolumeFraction: 0.113636363636,
      concentrationExponent: 2,
      temperatureC: 25,
      referenceTemperatureC: 25,
      ph: 2,
      referencePh: 2,
      dissolvedGradeGL: 5,
      referenceDissolvedGradeGL: 5,
      betaTemperaturePerC: 0.025,
    });
    expect(scale.factor).toBeCloseTo(1, 12);
    expect(scale.calibrated).toBe(false);
  });

  it('clamps the empirical exponential correction to the documented ±7 range', () => {
    const scale = calculateEmpiricalRheologyScale({
      solidVolumeFraction: 0.1,
      referenceSolidVolumeFraction: 0.1,
      temperatureC: 1000,
      referenceTemperatureC: 0,
      betaTemperaturePerC: -1,
    });
    expect(scale.clampedExponent).toBe(7);
    expect(scale.exponentWasClamped).toBe(true);
    expect(scale.warning).toContain('±7');
  });

  it('clamps the total exponent including the concentration power-law term', () => {
    const scale = calculateEmpiricalRheologyScale({
      solidVolumeFraction: 1,
      referenceSolidVolumeFraction: 0.001,
      concentrationExponent: 2,
    });
    expect(scale.rawCorrectionExponent).toBe(0);
    expect(scale.rawExponent).toBeGreaterThan(7);
    expect(scale.clampedExponent).toBe(7);
    expect(scale.factor).toBeCloseTo(Math.exp(7), 12);
    expect(scale.exponentWasClamped).toBe(true);
  });

  it('provides a finite Churchill Darcy factor through Newtonian transition', () => {
    const f2300 = calculateChurchillDarcyFrictionFactor({ reynoldsNumber: 2300, relativeRoughness: 0.0005 });
    const f3000 = calculateChurchillDarcyFrictionFactor({ reynoldsNumber: 3000, relativeRoughness: 0.0005 });
    const f4000 = calculateChurchillDarcyFrictionFactor({ reynoldsNumber: 4000, relativeRoughness: 0.0005 });
    expect(f2300).toBeGreaterThan(0);
    expect(f3000).toBeGreaterThan(0);
    expect(f4000).toBeGreaterThan(0);
  });
});
