import { describe, expect, it } from 'vitest';
import { createOperationalSurfaceDetails } from '../../src/scene/environment/operationalSurfaceDetails.js';
import { getTerrainHeight } from '../../src/scene/environment/terrainHeight.js';
import { createRoadAlignment } from '../../src/scene/environment/haulRoads.js';

describe('V24 Bloque 7 - huellas y desgaste operacional', () => {
  it('adds surface-only wear/spill cues while reusing the existing tracks and drainage', () => {
    const details = createOperationalSurfaceDetails();
    expect(details.userData.visualOnly).toBe(true);
    expect(details.userData.authoritativeTerrain).toBe(false);
    expect(details.userData.reusesExistingRoadTracks).toBe(true);
    expect(details.userData.reusesExistingDrainage).toBe(true);
    expect(details.userData.surfacePatchCount).toBe(4);
    expect(details.userData.controlledSpillCount).toBe(3);
    expect(details.getObjectByName('v24-stockpile-loader-scuffs')).toBeTruthy();
  });

  it('does not mutate terrain heights or ROAD-01..04 alignments', () => {
    const terrainSamples = [[-110, -30], [16, -21], [73, -7], [206, -78]];
    const beforeHeights = terrainSamples.map(([x, z]) => getTerrainHeight(x, z));
    const beforeRoads = ['ROAD-01', 'ROAD-02', 'ROAD-03', 'ROAD-04'].map((id) => {
      const curve = createRoadAlignment(id);
      return [curve.getPoint(0.25).toArray(), curve.getPoint(0.5).toArray(), curve.getPoint(0.75).toArray()];
    });

    createOperationalSurfaceDetails();

    expect(terrainSamples.map(([x, z]) => getTerrainHeight(x, z))).toEqual(beforeHeights);
    ['ROAD-01', 'ROAD-02', 'ROAD-03', 'ROAD-04'].forEach((id, roadIndex) => {
      const curve = createRoadAlignment(id);
      expect([curve.getPoint(0.25).toArray(), curve.getPoint(0.5).toArray(), curve.getPoint(0.75).toArray()]).toEqual(beforeRoads[roadIndex]);
    });
  });
});
