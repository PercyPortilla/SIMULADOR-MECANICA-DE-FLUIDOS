import { describe, expect, it } from 'vitest';
import {
  calculateBinghamShearRate,
  calculateBinghamStress,
  calculateCassonShearRate,
  calculateCassonStress,
  calculateHerschelBulkleyShearRate,
  calculateHerschelBulkleyStress,
  calculateLaminarProfile,
  calculatePowerLawStress,
  solveWallStressForMeanVelocity,
} from '../../src/core/rheology/index.js';

describe('rheology calculations', () => {
  it('matches Herschel–Bulkley stress and inverse', () => {
    const input = { shearRateS_1: 10, yieldStressPa: 4, consistencyIndex: 0.12, flowIndex: 0.72 };
    const stress = calculateHerschelBulkleyStress(input);
    expect(stress).toBeCloseTo(4.6297689523, 10);
    expect(calculateHerschelBulkleyShearRate({ ...input, shearStressPa: stress }))
      .toBeCloseTo(input.shearRateS_1, 10);
  });

  it('matches Bingham stress and inverse', () => {
    const input = { shearRateS_1: 10, yieldStressPa: 4, plasticViscosityPaS: 0.05 };
    expect(calculateBinghamStress(input)).toBeCloseTo(4.5, 12);
    expect(calculateBinghamShearRate({ ...input, shearStressPa: 4.5 })).toBeCloseTo(10, 12);
  });

  it('matches Casson stress and inverse on the yielded branch', () => {
    const input = { shearRateS_1: 25, yieldStressPa: 9, cassonViscosityPaS: 0.04 };
    const stress = calculateCassonStress(input);
    expect(stress).toBeCloseTo(16, 12);
    expect(calculateCassonShearRate({ ...input, shearStressPa: stress })).toBeCloseTo(25, 12);
    expect(calculateCassonShearRate({ ...input, shearStressPa: 8 })).toBe(0);
  });

  it('matches the power-law model', () => {
    expect(calculatePowerLawStress({ shearRateS_1: 10, consistencyIndex: 0.8, flowIndex: 0.55 }))
      .toBeCloseTo(2.84, 2);
  });

  it('reproduces the V1 laminar profile convention', () => {
    const result = calculateLaminarProfile({
      model: 'bingham',
      parameters: { yieldStressPa: 4, plasticViscosityPaS: 0.05 },
      radiusM: 0.075,
      wallStressPa: 10,
      nodeCount: 401,
    });
    expect(result.meanVelocityMps).toBeCloseTo(1.7819878125, 10);
    expect(result.velocityMps.at(-1)).toBe(0);
  });

  it('inverts the laminar profile without introducing a separate correlation', () => {
    const result = solveWallStressForMeanVelocity({
      model: 'bingham',
      parameters: { yieldStressPa: 4, plasticViscosityPaS: 0.05 },
      radiusM: 0.075,
      targetMeanVelocityMps: 1.7819878125,
      nodeCount: 401,
    });
    expect(result.wallStressPa).toBeCloseTo(10, 6);
    expect(result.profile.meanVelocityMps).toBeCloseTo(1.7819878125, 7);
  });

  it('returns the complete radial inversion including tau, gamma, u and apparent viscosity', () => {
    const result = calculateLaminarProfile({
      model: 'casson',
      parameters: { yieldStressPa: 9, cassonViscosityPaS: 0.04 },
      radiusM: 0.05,
      wallStressPa: 25,
      nodeCount: 101,
    });
    expect(result.radiusM).toHaveLength(101);
    expect(result.shearStressPa).toHaveLength(101);
    expect(result.shearRateS_1).toHaveLength(101);
    expect(result.velocityMps).toHaveLength(101);
    expect(result.apparentViscosityPaS).toHaveLength(101);
    expect(result.apparentViscosityPaS[0]).toBeNull();
    expect(result.shearRateS_1.at(-1)).toBeCloseTo(100, 10);
    expect(result.apparentViscosityPaS.at(-1)).toBeCloseTo(0.25, 10);
    expect(result.velocityMps.at(-1)).toBe(0);
  });

  it('applies optional empirical stress scaling without changing the reproduced velocity profile', () => {
    const base = solveWallStressForMeanVelocity({
      model: 'bingham',
      parameters: { yieldStressPa: 4, plasticViscosityPaS: 0.05 },
      radiusM: 0.075,
      targetMeanVelocityMps: 1.7819878125,
    });
    const scaled = solveWallStressForMeanVelocity({
      model: 'bingham',
      parameters: { yieldStressPa: 4, plasticViscosityPaS: 0.05 },
      radiusM: 0.075,
      targetMeanVelocityMps: 1.7819878125,
      empiricalStressScale: 2,
    });
    expect(base.wallStressPa).toBeCloseTo(10, 6);
    expect(scaled.wallStressPa).toBeCloseTo(20, 6);
    expect(scaled.profile.meanVelocityMps).toBeCloseTo(base.profile.meanVelocityMps, 8);
  });

  it('locks the legacy HB benchmark at Cw 35%, rho_s 4200/rho_l 1000, D 0.15 m and V 1.5 m/s', () => {
    const result = solveWallStressForMeanVelocity({
      model: 'hb',
      parameters: { yieldStressPa: 20, consistencyIndex: 0.8, flowIndex: 0.55 },
      radiusM: 0.075,
      targetMeanVelocityMps: 1.5,
      empiricalStressScale: 1,
    });
    expect(result.wallStressPa).toBeCloseTo(33.60542, 5);
    expect(result.profile.meanVelocityMps).toBeCloseTo(1.5, 7);
  });
});
