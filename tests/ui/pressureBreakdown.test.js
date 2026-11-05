import { describe, it, expect } from 'vitest';
import { buildPressureBreakdown, renderPressureBreakdown } from '../../src/ui/pressureBreakdown.js';

describe('pressure contribution diagram', () => {
  it('preserves the three positive pressure contributions and actual total', () => {
    const data = buildPressureBreakdown({
      distributedPressureDropPa: 60000,
      minorLossPressurePa: 20000,
      staticPressurePa: 10000,
      pressureDropPa: 90000,
    });
    expect(data.totalPa).toBe(90000);
    expect(data.reconciled).toBe(true);
    expect(data.baselinePercent).toBe(0);
    expect(data.bars.map((part) => part.widthPercent).reduce((sum, value) => sum + value, 0)).toBeCloseTo(100);
  });
  it('places negative elevation left of the baseline without losing its sign', () => {
    const data = buildPressureBreakdown({
      distributedPressureDropPa: 60000,
      minorLossPressurePa: 20000,
      staticPressurePa: -25000,
      pressureDropPa: 55000,
    });
    expect(data.totalPa).toBe(55000);
    expect(data.elevationEffect).toBe('downhill');
    expect(data.baselinePercent).toBeCloseTo(25_000 / 105_000 * 100);
    expect(data.bars[2].leftPercent).toBeCloseTo(0);
    expect(renderPressureBreakdown({
      distributedPressureDropPa: 60000,
      minorLossPressurePa: 20000,
      staticPressurePa: -25000,
      pressureDropPa: 55000,
    })).toContain('desnivel descendente');
  });
  it('does not invent data if any component is absent', () => {
    expect(buildPressureBreakdown({ distributedPressureDropPa: 50000 })).toBeNull();
    expect(renderPressureBreakdown({ distributedPressureDropPa: 50000 })).toContain('Sin datos calculables');
  });
  it('renders zero pressure without divide-by-zero and flags reconciliation mismatches', () => {
    const zeros = buildPressureBreakdown({
      distributedPressureDropPa: 0, minorLossPressurePa: 0, staticPressurePa: 0,
      pressureDropPa: 0,
    });
    expect(zeros.hasMagnitude).toBe(false);
    expect(zeros.baselinePercent).toBe(50);
    const inconsistent = renderPressureBreakdown({
      distributedPressureDropPa: 1000, minorLossPressurePa: 0, staticPressurePa: 0,
      pressureDropPa: 3000,
    });
    expect(inconsistent).toContain('no coincide exactamente');
  });
});
