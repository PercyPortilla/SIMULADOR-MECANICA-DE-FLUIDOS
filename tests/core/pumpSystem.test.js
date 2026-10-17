import { describe, expect, it } from 'vitest';
import {
  assessNpsh,
  calculateNpshAvailable,
  calculateNpshRequired,
  calculatePumpHead,
  calculateSystemHead,
  samplePumpSystemCurves,
  solvePumpSystemOperatingPoint,
} from '../../src/core/hydraulics/index.js';

describe('pump/system curves and NPSH', () => {
  const pumpCurve = { shutoffHeadM: 50, quadraticHeadCoefficientS2_M5: 20000 };
  const systemCurve = { staticHeadM: 10, resistanceCoefficientS2_M5: 10000 };

  it('evaluates pump and system curves and finds their physical intersection', () => {
    expect(calculatePumpHead({ flowRateM3s: 0, ...pumpCurve })).toBe(50);
    expect(calculateSystemHead({ flowRateM3s: 0, ...systemCurve })).toBe(10);

    const operatingPoint = solvePumpSystemOperatingPoint({
      pumpCurve,
      systemCurve,
      maxFlowRateM3s: 0.1,
    });
    const expectedFlow = Math.sqrt(40 / 30000);
    expect(operatingPoint.flowRateM3s).toBeCloseTo(expectedFlow, 8);
    expect(operatingPoint.pumpHeadM).toBeCloseTo(operatingPoint.systemHeadM, 7);
    expect(operatingPoint.pumpHeadM).toBeCloseTo(23.3333333333, 7);
  });

  it('samples both curves on the same flow grid for plotting', () => {
    const curves = samplePumpSystemCurves({ pumpCurve, systemCurve, maxFlowRateM3s: 0.1, pointCount: 6 });
    expect(curves.flowRateM3s).toHaveLength(6);
    expect(curves.pumpHeadM).toHaveLength(6);
    expect(curves.systemHeadM).toHaveLength(6);
    expect(curves.flowRateM3s[0]).toBe(0);
    expect(curves.flowRateM3s.at(-1)).toBeCloseTo(0.1, 12);
  });

  it('computes NPSHa from absolute surface pressure and compares it with an NPSHr curve', () => {
    const availableNpshM = calculateNpshAvailable({
      surfaceAbsolutePressurePa: 101325,
      vaporPressurePa: 3000,
      densityKgM3: 1200,
      suctionStaticHeadM: 2,
      suctionHeadLossM: 0.5,
    });
    const expectedAvailable = (101325 - 3000) / (1200 * 9.80665) + 2 - 0.5;
    expect(availableNpshM).toBeCloseTo(expectedAvailable, 12);

    const requiredNpshM = calculateNpshRequired({
      flowRateM3s: 0.04,
      baseNpshM: 2,
      quadraticNpshCoefficientS2_M5: 1000,
    });
    expect(requiredNpshM).toBeCloseTo(3.6, 12);

    const assessment = assessNpsh({ availableNpshM, requiredNpshM, minimumMarginM: 1 });
    expect(assessment.marginM).toBeCloseTo(availableNpshM - requiredNpshM, 12);
    expect(assessment.meetsRequirement).toBe(true);
    expect(assessment.marginRatio).toBeGreaterThan(1);
  });
});
