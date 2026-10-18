import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { describe, expect, it } from 'vitest';
import { getPlantZone } from '../../src/scene/layout/plantLayout.js';
import {
  BABYLON_TECHNICAL_GRID_SPACING_M,
  BABYLON_TECHNICAL_GRID_ZONE_IDS,
  createBabylonTechnicalGrid,
} from '../../src/babylon/environment/technicalGrid.js';

describe('Babylon V30 technical grid parity', () => {
  it('keeps the Z4/Z5 engineering datums and 1.5 m spacing', () => {
    const engine = new NullEngine({ renderWidth: 64, renderHeight: 64 });
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    const result = createBabylonTechnicalGrid({ scene });
    expect([...result.grids.keys()]).toEqual(BABYLON_TECHNICAL_GRID_ZONE_IDS);
    result.grids.forEach((grid, zoneId) => {
      const zone = getPlantZone(zoneId);
      expect(grid.metadata.spacingM).toBe(BABYLON_TECHNICAL_GRID_SPACING_M);
      expect(grid.metadata.engineeringDatumY).toBe(zone.elevation);
      expect(grid.metadata.renderLiftM).toBe(0.015);
      expect(grid.getBoundingInfo().boundingBox.minimumWorld.y).toBeCloseTo(zone.elevation + 0.015, 6);
      expect(grid.getBoundingInfo().boundingBox.maximumWorld.y).toBeCloseTo(zone.elevation + 0.015, 6);
    });
    result.root.dispose(false, true);
    scene.dispose();
    engine.dispose();
  });

  it('rejects left-handed scenes', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    scene.useRightHandedSystem = false;
    expect(() => createBabylonTechnicalGrid({ scene })).toThrow(/right-handed/i);
    scene.dispose();
    engine.dispose();
  });
});
