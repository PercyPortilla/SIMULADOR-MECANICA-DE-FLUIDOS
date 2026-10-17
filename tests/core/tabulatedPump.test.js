import { describe, expect, it } from 'vitest';
import {
  interpolateTabulatedCurve,
  sampleTabulatedPumpSystemCurves,
  solveTabulatedPumpSystemOperatingPoint,
} from '../../src/core/hydraulics/index.js';

describe('tabulated pump curves', () => {
  const curve = [
    { flowRateM3s: 0, headM: 50 },
    { flowRateM3s: 0.05, headM: 30 },
    { flowRateM3s: 0.1, headM: 0 },
  ];

  it('interpolates inside the supplied table and refuses extrapolation', () => {
    expect(interpolateTabulatedCurve(curve, 0.025, 'headM', { name: 'pumpCurve' })).toBeCloseTo(40, 12);
    expect(interpolateTabulatedCurve(curve, 0.11, 'headM', { name: 'pumpCurve' })).toBeNull();
  });

  it('finds a unique operating point against an arbitrary system evaluator', () => {
    const solved = solveTabulatedPumpSystemOperatingPoint({ pumpCurve: curve, systemHeadAtFlow: (q) => 10 + 2000 * q ** 2 });
    expect(solved.status).toBe('unique');
    expect(solved.operatingPoint).toBeTruthy();
    expect(solved.operatingPoint.pumpHeadM).toBeCloseTo(solved.operatingPoint.systemHeadM, 5);
  });

  it('samples both curves without extrapolating', () => {
    const sampled = sampleTabulatedPumpSystemCurves({ pumpCurve: curve, systemHeadAtFlow: (q) => 5 + q * 10, pointCount: 9 });
    expect(sampled.flowRateM3s).toHaveLength(9);
    expect(sampled.pumpHeadM[0]).toBe(50);
    expect(sampled.pumpHeadM.at(-1)).toBe(0);
  });
});
