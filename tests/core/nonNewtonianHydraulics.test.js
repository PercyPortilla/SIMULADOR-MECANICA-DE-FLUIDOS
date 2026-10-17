import { describe, expect, it } from 'vitest';
import {
  calculateDodgeMetznerFanningFactor,
  calculateLegacyDurandCriticalVelocity,
  calculateLocalMetznerReedParameters,
  calculateNonNewtonianFrictionFactor,
  calculateReynoldsStar,
} from '../../src/core/hydraulics/index.js';
import { calculateMixtureDensity } from '../../src/core/slurry/index.js';

describe('generalized non-Newtonian hydraulics', () => {
  it('recovers n prime and K prime for an exact power-law fluid', () => {
    const local = calculateLocalMetznerReedParameters({
      model: 'power',
      parameters: { consistencyIndex: 0.2, flowIndex: 0.6 },
      radiusM: 0.05,
      targetMeanVelocityMps: 1,
      densityKgM3: 1200,
    });
    const expectedKPrime = 0.2 * ((3 * 0.6 + 1) / (4 * 0.6)) ** 0.6;
    expect(local.nPrime).toBeCloseTo(0.6, 5);
    expect(local.kPrimePaSn).toBeCloseTo(expectedKPrime, 4);
    expect(local.reynoldsMetznerReed).toBeCloseTo(local.reynoldsStar, 8);
  });

  it('reproduces the historical HB wall stress and builds a consistent local Metzner-Reed Re*', () => {
    const densityKgM3 = calculateMixtureDensity({
      solidsMassFraction: 0.35,
      solidDensityKgM3: 4200,
      liquidDensityKgM3: 1000,
    });
    expect(densityKgM3).toBeCloseTo(1363.6363636364, 10);

    const local = calculateLocalMetznerReedParameters({
      model: 'hb',
      parameters: { yieldStressPa: 20, consistencyIndex: 0.8, flowIndex: 0.55 },
      radiusM: 0.075,
      targetMeanVelocityMps: 1.5,
      densityKgM3,
      empiricalStressScale: 1,
    });

    expect(local.wallStressPa).toBeCloseTo(33.60542, 5);
    expect(local.nPrime).toBeGreaterThan(0);
    expect(local.nPrime).toBeLessThan(1);
    expect(local.reynoldsMetznerReed).toBeCloseTo(local.reynoldsStar, 8);
    expect(local.reynoldsStar).toBeCloseTo(calculateReynoldsStar({
      densityKgM3,
      velocityMps: 1.5,
      wallStressPa: local.wallStressPa,
    }), 12);
  });

  it('reduces Dodge-Metzner to the smooth-pipe Fanning form for n prime = 1', () => {
    const factor = calculateDodgeMetznerFanningFactor({ reynoldsStar: 100000, nPrime: 1 });
    expect(factor).toBeGreaterThan(0.004);
    expect(factor).toBeLessThan(0.005);
  });

  it('marks the 2100-4000 interpolation explicitly as educational', () => {
    const laminar = calculateNonNewtonianFrictionFactor({ reynoldsStar: 1000, nPrime: 0.7 });
    expect(laminar.regime).toBe('laminar');
    expect(laminar.fanningFrictionFactor).toBeCloseTo(0.016, 12);

    const transition = calculateNonNewtonianFrictionFactor({ reynoldsStar: 3000, nPrime: 0.7 });
    expect(transition.regime).toBe('transition');
    expect(transition.educationalTransition).toBe(true);
    expect(transition.transitionFraction).toBeGreaterThan(0);
    expect(transition.transitionFraction).toBeLessThan(1);
    expect(transition.darcyFrictionFactor).toBeCloseTo(4 * transition.fanningFrictionFactor, 12);

    const turbulent = calculateNonNewtonianFrictionFactor({ reynoldsStar: 10000, nPrime: 0.7 });
    expect(turbulent.regime).toBe('turbulent');
    expect(turbulent.correlation).toContain('Dodge-Metzner');
  });

  it('keeps the legacy critical-velocity method identified as Durand with explicit F_L', () => {
    const result = calculateLegacyDurandCriticalVelocity({
      innerDiameterM: 0.15,
      solidDensityKgM3: 4200,
      liquidDensityKgM3: 1000,
      durandFactor: 1.1,
    });
    const expected = 1.1 * Math.sqrt(2 * 9.80665 * 0.15 * (4.2 - 1));
    expect(result.velocityMps).toBeCloseTo(expected, 12);
    expect(result.method).toContain('Durand');
    expect(result.durandFactor).toBe(1.1);
  });
});
