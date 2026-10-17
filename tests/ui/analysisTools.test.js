import { describe, expect, it } from 'vitest';
import { createNumericSeries, seriesToSvgPolyline } from '../../src/ui/chartSeries.js';
import {
  buildRadialProbeRows,
  radialProbeToCsv,
  radialProbeToHtmlTable,
} from '../../src/ui/radialProbe.js';

describe('chart series helpers', () => {
  it('maps physical series to deterministic SVG coordinates', () => {
    const series = createNumericSeries([0, 5, 10], [0, 50, 100]);
    const geometry = seriesToSvgPolyline(series, {
      width: 120,
      height: 120,
      padding: { left: 10, right: 10, top: 10, bottom: 10 },
    });

    expect(geometry.xDomain).toEqual([0, 10]);
    expect(geometry.yDomain).toEqual([0, 100]);
    expect(geometry.points).toBe('10.00,110.00 60.00,60.00 110.00,10.00');
  });

  it('preserves a caller-specified zero-based domain for comparable charts', () => {
    const geometry = seriesToSvgPolyline(
      createNumericSeries([2, 4], [10, 20]),
      {
        width: 100,
        height: 50,
        xDomain: [0, 4],
        yDomain: [0, 20],
        decimals: 1,
      },
    );
    expect(geometry.points).toBe('50.0,25.0 100.0,0.0');
  });
});

describe('radial probe exports', () => {
  const profile = {
    radiusM: [0, 0.05, 0.1],
    velocityMps: [2, 1, 0],
  };

  it('derives normalized radius, wall distance and velocity ratio from SI data', () => {
    const rows = buildRadialProbeRows(profile);
    expect(rows[0]).toMatchObject({
      radiusM: 0,
      radiusRatio: 0,
      wallDistanceM: 0.1,
      velocityMps: 2,
      velocityRatio: 1,
    });
    expect(rows[1].radiusRatio).toBeCloseTo(0.5, 12);
    expect(rows[1].wallDistanceM).toBeCloseTo(0.05, 12);
    expect(rows.at(-1)).toMatchObject({
      radiusRatio: 1,
      wallDistanceM: 0,
      velocityMps: 0,
      velocityRatio: 0,
    });
  });

  it('exports the same radial data to CSV and an escaped HTML table', () => {
    const csv = radialProbeToCsv(profile, { decimals: 3 });
    expect(csv).toContain('"radius_m","radius_ratio","wall_distance_m","velocity_m_s"');
    expect(csv).toContain('"1","0.050","0.500","0.050","1.000","0.500"');

    const html = radialProbeToHtmlTable(profile, {
      decimals: 2,
      caption: 'Sonda <Pipe 1>',
    });
    expect(html).toContain('Sonda &lt;Pipe 1&gt;');
    expect(html).toContain('<td>1.00</td>');
    expect(html).toContain('<td>0.50</td>');
  });

  it('rejects profiles that are not ordered from center to wall', () => {
    expect(() => buildRadialProbeRows({
      radiusM: [0, 0.1, 0.05],
      velocityMps: [2, 0, 1],
    })).toThrow(/ordenado/);
  });
});
