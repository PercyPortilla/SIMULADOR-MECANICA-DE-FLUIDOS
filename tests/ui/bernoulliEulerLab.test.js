import { describe, expect, it } from 'vitest';
import {
  BERNOULLI_EULER_LAB_POINTS,
  getBernoulliEulerLabReadout,
} from '../../src/ui/bernoulliEulerLab.js';

describe('B78 Bernoulli–Euler lab readout', () => {
  it('uses Qop when available and only derives educational values from existing results', () => {
    const readout = getBernoulliEulerLabReadout(
      { rheology: { model: 'bingham' } },
      {
        slurry: { densityKgM3: 1450 },
        transport: {
          flowRateM3s: 0.03,
          distributedPressureDropPa: 82000,
          minorLossPressurePa: 12000,
          staticPressurePa: 9000,
          pressureDropPa: 103000,
          totalHeadM: 7.24,
        },
        pump: {
          operatingFlowRateM3s: 0.04,
          operatingPoint: { pumpHeadM: 18.5, systemHeadM: 18.5 },
        },
      },
    );
    expect(readout.flowRateM3s).toBe(0.04);
    expect(readout.basis).toBe('pump-operating-point');
    expect(readout.points.A.velocityMps).toBeCloseTo(
      0.04 / (Math.PI * BERNOULLI_EULER_LAB_POINTS.A.diameterM ** 2 / 4),
      8,
    );
    expect(readout.points.B.velocityMps).toBeGreaterThan(readout.points.A.velocityMps);
    expect(readout.points.A.pressurePa).toBeNull();
    expect(readout.pumpHeadM).toBe(18.5);
    expect(readout.totalLossHeadM).toBeCloseTo((82000 + 12000) / (1450 * 9.80665), 8);
    expect(readout.scopeNote).toContain('no calcula una nueva presión nodal');
  });

  it('falls back to imposed transport flow when no operating point exists', () => {
    const readout = getBernoulliEulerLabReadout({}, {
      transport: { flowRateM3s: 0.025 },
      pump: {},
    });
    expect(readout.flowRateM3s).toBe(0.025);
    expect(readout.basis).toBe('transport-imposed-flow');
  });
});

