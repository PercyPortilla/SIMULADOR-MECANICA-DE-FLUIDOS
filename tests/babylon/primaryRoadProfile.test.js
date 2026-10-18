import { describe, expect, it } from 'vitest';
import {
  getPrimaryRoadControlPoints,
  nearestOnPrimaryRoadProfile,
  samplePrimaryRoadAt,
} from '../../src/scene/environment/primaryRoadProfile.js';

describe('renderer-neutral ROAD-01 profile', () => {
  it('keeps the validated V31 alignment endpoints and a finite continuous profile', () => {
    const controls = getPrimaryRoadControlPoints();
    expect(samplePrimaryRoadAt(0)).toEqual(controls[0]);
    const end = samplePrimaryRoadAt(1);
    expect(end.x).toBeCloseTo(controls.at(-1).x, 12);
    expect(end.y).toBeCloseTo(controls.at(-1).y, 12);
    expect(end.z).toBeCloseTo(controls.at(-1).z, 12);
    let previous = samplePrimaryRoadAt(0);
    for (let index = 1; index <= 500; index += 1) {
      const current = samplePrimaryRoadAt(index / 500);
      expect([current.x, current.y, current.z].every(Number.isFinite)).toBe(true);
      expect(Math.hypot(current.x - previous.x, current.y - previous.y, current.z - previous.z)).toBeLessThan(6);
      previous = current;
    }
  });

  it('keeps nearest-road queries bounded to the validated ROAD-01 profile', () => {
    for (const [x, z] of [[-270, 80], [-190, 20], [-122, -30], [-90, -42], [-40, 60]]) {
      const nearest = nearestOnPrimaryRoadProfile(x, z);
      expect(nearest.fraction).toBeGreaterThanOrEqual(0);
      expect(nearest.fraction).toBeLessThanOrEqual(1);
      expect(nearest.distance).toBeGreaterThanOrEqual(0);
      expect([nearest.x, nearest.z, nearest.elevation].every(Number.isFinite)).toBe(true);
    }
  });
});
