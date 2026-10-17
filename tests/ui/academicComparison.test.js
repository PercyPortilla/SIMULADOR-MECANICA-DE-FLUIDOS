import { describe, expect, it } from 'vitest';
import {
  ACADEMIC_COMPARISON_METRICS,
  compareAcademicCases,
} from '../../src/ui/academicComparison.js';

describe('academic case comparison', () => {
  it('compares the same result metrics for any two valid cases', () => {
    const comparison = compareAcademicCases('newtonian-reference', 'high-solids-bingham');
    expect(comparison.metrics).toHaveLength(ACADEMIC_COMPARISON_METRICS.length);
    expect(comparison.metrics.find((row) => row.key === 'density').delta).toBeGreaterThan(0);
    expect(comparison.metrics.find((row) => row.key === 'pressure').delta).toBeGreaterThan(0);
    expect(comparison.insights.some((item) => item.key === 'slurry-density')).toBe(true);
    expect(comparison.insights.some((item) => item.key === 'rheology')).toBe(true);
    expect(comparison.insights.some((item) => item.key === 'velocity')).toBe(true);
  });

  it('isolates length and elevation in the static-head teaching comparison', () => {
    const comparison = compareAcademicCases('newtonian-reference', 'static-head-energy');
    expect(comparison.leftState.transport.pipe1.velocityMps).toBe(comparison.rightState.transport.pipe1.velocityMps);
    expect(comparison.metrics.find((row) => row.key === 'flow').delta).toBeCloseTo(0, 12);
    expect(comparison.metrics.find((row) => row.key === 'pressure').delta).toBeGreaterThan(190);
    expect(comparison.insights.some((item) => item.key === 'length')).toBe(true);
    expect(comparison.insights.some((item) => item.key === 'elevation')).toBe(true);
  });

  it('surfaces result quality when an educational non-Newtonian estimate is compared', () => {
    const comparison = compareAcademicCases('herschel-bulkley', 'power-law-scope');
    expect(comparison.rightResults.transport.resultQuality).toBe('educational-estimate');
    expect(comparison.insights.some((item) => item.key === 'scope')).toBe(true);
  });

  it('explains explicit metallurgical inputs without claiming end-to-end coupling', () => {
    const comparison = compareAcademicCases('newtonian-reference', 'metallurgical-scope');
    expect(comparison.insights.some((item) => item.key === 'leach-volume')).toBe(true);
    expect(comparison.insights.some((item) => item.key === 'recovery')).toBe(true);
    const text = comparison.insights.map((item) => item.explanation).join(' ');
    expect(text).not.toMatch(/feedGoldKgH.*deriv/i);
  });

  it('rejects unknown cases', () => {
    expect(() => compareAcademicCases('missing', 'newtonian-reference')).toThrow(/válidos/i);
  });
});
