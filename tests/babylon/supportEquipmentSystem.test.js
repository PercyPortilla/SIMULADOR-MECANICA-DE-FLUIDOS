import { describe, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Scene } from '@babylonjs/core/scene.js';
import { getTerrainHeight } from '../../src/scene/environment/terrainHeight.js';
import { SUPPORT_LAYOUT } from '../../src/scene/integration/finalLayout.js';
import {
  BABYLON_SUPPORT_EQUIPMENT_IDS,
  createBabylonSupportEquipmentSystem,
} from '../../src/babylon/equipment/supportEquipmentSystem.js';

function container(scene, url) {
  const root = new TransformNode(`root-${url}`, scene);
  const mesh = new Mesh(`mesh-${url}`, scene);
  mesh.parent = root;
  return {
    rootNodes: [root],
    animationGroups: [],
    addAllToScene: vi.fn(),
    dispose: vi.fn(),
  };
}

describe('Babylon support equipment system', () => {
  it('grounds stockpile and sump at their authoritative V30 support positions', async () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    const system = createBabylonSupportEquipmentSystem({
      scene,
      loadContainer: async (url) => container(scene, url),
    });
    await system.ready;
    expect(system.registry.entries()).toHaveLength(BABYLON_SUPPORT_EQUIPMENT_IDS.length);
    const stock = system.getEquipment('STOCKPILE-RECLAIM');
    const sump = system.getEquipment('SUMP-01');
    expect(stock.root.position.asArray()).toEqual([
      SUPPORT_LAYOUT.stockpile.x,
      getTerrainHeight(SUPPORT_LAYOUT.stockpile.x, SUPPORT_LAYOUT.stockpile.z),
      SUPPORT_LAYOUT.stockpile.z,
    ]);
    expect(sump.root.position.asArray()).toEqual([
      SUPPORT_LAYOUT.sump.x,
      getTerrainHeight(SUPPORT_LAYOUT.sump.x, SUPPORT_LAYOUT.sump.z),
      SUPPORT_LAYOUT.sump.z,
    ]);
    system.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('preserves the V30 support process ports in world space', async () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    const system = createBabylonSupportEquipmentSystem({
      scene,
      loadContainer: async (url) => container(scene, url),
    });
    await system.ready;
    const stockY = getTerrainHeight(SUPPORT_LAYOUT.stockpile.x, SUPPORT_LAYOUT.stockpile.z);
    const feed = system.getPortWorldPosition('STOCKPILE-RECLAIM', 'feedIn');
    expect(feed.x).toBeCloseTo(-5, 6);
    expect(feed.y).toBeCloseTo(stockY + 9.4, 6);
    expect(feed.z).toBeCloseTo(-38, 6);
    const sumpOutlet = system.getPortWorldPosition('SUMP-01', 'outlet');
    expect(sumpOutlet.x).toBeCloseTo(SUPPORT_LAYOUT.sump.x + 2.2, 6);
    expect(sumpOutlet.y).toBeCloseTo(getTerrainHeight(SUPPORT_LAYOUT.sump.x, SUPPORT_LAYOUT.sump.z) + 0.85, 6);
    expect(system.getPort('SUMP-01', 'outlet').nominalDiameterM).toBe(0.3);
    system.dispose();
    scene.dispose();
    engine.dispose();
  });
});
