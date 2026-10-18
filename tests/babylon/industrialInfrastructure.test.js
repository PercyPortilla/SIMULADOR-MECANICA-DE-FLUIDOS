import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { describe, expect, it } from 'vitest';
import { getTerrainHeight } from '../../src/scene/environment/terrainHeight.js';
import { createBabylonIndustrialInfrastructure } from '../../src/babylon/infrastructure/industrialInfrastructure.js';

function makeScene() {
  const engine = new NullEngine({ renderWidth: 32, renderHeight: 32 });
  const scene = new Scene(engine);
  scene.useRightHandedSystem = true;
  return { engine, scene };
}

describe('Babylon industrial infrastructure closure contract', () => {
  it('keeps the validated V30 industrial asset set and reuse policy', () => {
    const { engine, scene } = makeScene();
    const { root, assets } = createBabylonIndustrialInfrastructure({ scene });
    expect(root.name).toBe('v24-industrial-infrastructure');
    expect(root.metadata).toMatchObject({
      visualOnly: true,
      v24IndustrialInfrastructure: true,
      reusesExistingControlBuilding: true,
      reusesExistingLightingPoles: true,
      v28RealismInfrastructure: true,
      coordinateSystem: 'right-handed',
      worldUnitsPerMeter: 1,
      terrainHeightSource: 'getTerrainHeight',
    });
    expect(assets.map((asset) => asset.name)).toEqual([
      'v24-transformer-yard',
      'v24-maintenance-workshop',
      'v24-electrical-cable-tray',
      'v24-supervision-pickup',
      'v28-utility-pickup',
      'v24-human-scale-workshop',
      'v28-human-scale-transformer',
      'v28-human-scale-mcc',
      'v28-human-scale-workshop-2',
    ]);
    expect(root.metadata.assetCount).toBe(9);
    expect(root.metadata.humanScaleCount).toBe(4);
    expect(root.metadata.lightVehicleCount).toBe(2);
    expect(scene.getNodeByName('control-mcc-building')).toBeNull();
    expect(scene.getNodeByName('lighting-pole-1')).toBeNull();
    scene.dispose(); engine.dispose();
  });

  it('keeps light vehicles and human references grounded at 1 m world scale', () => {
    const { engine, scene } = makeScene();
    createBabylonIndustrialInfrastructure({ scene });
    for (const name of ['v24-supervision-pickup','v28-utility-pickup','v24-human-scale-workshop','v28-human-scale-transformer','v28-human-scale-mcc','v28-human-scale-workshop-2']) {
      const node = scene.getTransformNodeByName(name);
      expect(node).toBeTruthy();
      expect(node.position.y).toBeCloseTo(getTerrainHeight(node.position.x, node.position.z), 10);
    }
    for (const name of ['v24-human-scale-workshop','v28-human-scale-transformer','v28-human-scale-mcc','v28-human-scale-workshop-2']) {
      expect(scene.getTransformNodeByName(name).metadata.referenceHeightM).toBe(1.75);
    }
    scene.dispose(); engine.dispose();
  });

  it('keeps the Babylon module renderer-local', () => {
    const here=path.dirname(fileURLToPath(import.meta.url));
    const source=fs.readFileSync(path.resolve(here,'../../src/babylon/infrastructure/industrialInfrastructure.js'),'utf8');
    expect(source).not.toMatch(/from\s+['"]three(?:\/|['"])/i);
    expect(source).not.toMatch(/\bTHREE\b|WebGLRenderer|requestAnimationFrame/);
  });
});
