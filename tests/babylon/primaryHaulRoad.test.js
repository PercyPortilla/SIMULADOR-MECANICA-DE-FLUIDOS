import { describe, expect, it } from 'vitest';
import { ROAD_CIVIL_DETAIL, ROAD_DEFINITIONS } from '../../src/scene/config/siteDesign.js';
import {
  BABYLON_ROAD_SURFACE_OFFSET_M,
  createBabylonPrimaryLaneCurve,
  getBabylonRoadSurfaceOffset,
} from '../../src/babylon/environment/primaryHaulRoad.js';

describe('Babylon ROAD-01 closure contract', () => {
  it('keeps the validated primary-haul crown/offset behavior', () => {
    expect(ROAD_DEFINITIONS['ROAD-01'].role).toBe('primary-haul-road');
    const halfRoad = ROAD_DEFINITIONS['ROAD-01'].widthM / 2;
    const crownRise = Math.min(0.22, halfRoad * 0.022);
    expect(getBabylonRoadSurfaceOffset(0, 0)).toBeCloseTo(BABYLON_ROAD_SURFACE_OFFSET_M + crownRise, 12);
    expect(getBabylonRoadSurfaceOffset(-9.25, 0)).toBeCloseTo(getBabylonRoadSurfaceOffset(9.25, 0), 12);
    expect(getBabylonRoadSurfaceOffset(0, 4.2)).toBeGreaterThan(getBabylonRoadSurfaceOffset(9.25, 4.2));
  });

  it('keeps loaded and return lanes finite and exactly reversed when requested', () => {
    for (const offset of [3.4, -3.4]) {
      const forward = createBabylonPrimaryLaneCurve(offset, { reverse: false });
      const reverse = createBabylonPrimaryLaneCurve(offset, { reverse: true });
      for (const t of [0, 0.25, 0.5, 0.75, 1]) {
        const a = forward.getPoint(t);
        const b = reverse.getPoint(1 - t);
        expect([a.x, a.y, a.z].every(Number.isFinite)).toBe(true);
        expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeLessThan(1e-8);
      }
    }
  });
});
