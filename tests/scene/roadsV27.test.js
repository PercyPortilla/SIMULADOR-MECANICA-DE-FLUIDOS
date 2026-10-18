import { describe, expect, it } from 'vitest';
import {
  createRoadAlignment,
  getRoadDesignMetrics,
} from '../../src/scene/environment/haulRoads.js';
import { getTerrainHeight } from '../../src/scene/environment/terrainHeight.js';
import { ROAD_DEFINITIONS } from '../../src/scene/config/siteDesign.js';

const SERVICE_ROADS = ['ROAD-02', 'ROAD-03', 'ROAD-04'];

function nearestElevation(curve, x, z, samples = 720) {
  let nearest = curve.getPointAt(0);
  let distance = Infinity;
  for (let index = 0; index <= samples; index += 1) {
    const point = curve.getPointAt(index / samples);
    const current = Math.hypot(point.x - x, point.z - z);
    if (current < distance) {
      distance = current;
      nearest = point;
    }
  }
  return nearest.y;
}

describe('V27 engineered service-road network', () => {
  it('keeps all service-road grades and radii inside their design envelopes', () => {
    SERVICE_ROADS.forEach((roadId) => {
      const metrics = getRoadDesignMetrics(roadId, { samples: 800 });
      expect(metrics.maximumGrade).toBeLessThanOrEqual(ROAD_DEFINITIONS[roadId].maximumGrade);
      expect(metrics.minimumRadiusM).toBeGreaterThanOrEqual(ROAD_DEFINITIONS[roadId].minimumCurveRadiusM);
    });
  });

  it('preserves exact shared-junction elevations between the service roads', () => {
    const junctions = [
      { x: -136, z: -48, roads: ['ROAD-02', 'ROAD-03'] },
      { x: 154, z: -66, roads: ['ROAD-02', 'ROAD-04'] },
      { x: 270, z: -56, roads: ['ROAD-02', 'ROAD-03', 'ROAD-04'] },
    ];
    junctions.forEach(({ x, z, roads }) => {
      const expected = getTerrainHeight(x, z) + 0.10;
      roads.forEach((roadId) => {
        const y = nearestElevation(createRoadAlignment(roadId), x, z);
        expect(y).toBeCloseTo(expected, 1);
      });
    });
  });

  it('uses bounded civil cut/fill instead of floating service roads', () => {
    SERVICE_ROADS.forEach((roadId) => {
      const curve = createRoadAlignment(roadId);
      let maxFill = -Infinity;
      let maxCut = Infinity;
      for (let index = 0; index <= 720; index += 1) {
        const point = curve.getPointAt(index / 720);
        const delta = point.y - (getTerrainHeight(point.x, point.z) + 0.10);
        maxFill = Math.max(maxFill, delta);
        maxCut = Math.min(maxCut, delta);
      }
      expect(maxFill).toBeLessThanOrEqual(1.2);
      expect(maxCut).toBeGreaterThanOrEqual(-1.2);
    });
  });

  it('keeps the primary ROM haul-road contract unchanged', () => {
    const metrics = getRoadDesignMetrics('ROAD-01', { samples: 800 });
    expect(metrics.maximumGrade).toBeLessThanOrEqual(ROAD_DEFINITIONS['ROAD-01'].maximumGrade);
    expect(metrics.minimumRadiusM).toBeGreaterThanOrEqual(ROAD_DEFINITIONS['ROAD-01'].minimumCurveRadiusM);
  });
});
