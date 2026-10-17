import { describe, expect, it } from 'vitest';
import {
  calculateDarcyFrictionFactor,
  calculateDarcyWeisbachPressureDrop,
  calculateMinorLossPressureDrop,
  calculateReynoldsNumber,
  calculateStaticPressureChange,
  classifyNewtonianRegime,
} from '../../src/core/hydraulics/index.js';

describe('advanced Newtonian hydraulics', () => {
  it('classifies laminar, transition and turbulent without smoothing transition', () => {
    expect(classifyNewtonianRegime(1000)).toBe('laminar');
    expect(classifyNewtonianRegime(3000)).toBe('transition');
    expect(classifyNewtonianRegime(10000)).toBe('turbulent');
    expect(calculateDarcyFrictionFactor({ reynoldsNumber: 3000, relativeRoughness: 0 })).toBeNull();
  });

  it('uses 64/Re in Newtonian laminar flow', () => {
    expect(calculateDarcyFrictionFactor({ reynoldsNumber: 1600 })).toBeCloseTo(0.04, 12);
  });

  it('solves a finite Colebrook-White turbulent Darcy factor', () => {
    const factor = calculateDarcyFrictionFactor({ reynoldsNumber: 100000, relativeRoughness: 0.001 });
    expect(factor).toBeGreaterThan(0.015);
    expect(factor).toBeLessThan(0.03);
  });

  it('combines standard distributed, local and static terms independently', () => {
    const re = calculateReynoldsNumber({ densityKgM3: 1000, velocityMps: 1, innerDiameterM: 0.1, viscosityPaS: 0.001 });
    expect(re).toBe(100000);
    const distributed = calculateDarcyWeisbachPressureDrop({
      frictionFactor: 0.02,
      lengthM: 10,
      innerDiameterM: 0.1,
      densityKgM3: 1000,
      velocityMps: 1,
    });
    expect(distributed).toBe(1000);
    expect(calculateMinorLossPressureDrop({ lossCoefficient: 2, densityKgM3: 1000, velocityMps: 1 })).toBe(1000);
    expect(calculateStaticPressureChange({ densityKgM3: 1000, elevationChangeM: 10 })).toBeCloseTo(98066.5, 6);
  });
});
