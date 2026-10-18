import { describe, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Scene } from '@babylonjs/core/scene.js';
import { getTerrainHeight } from '../../src/scene/environment/terrainHeight.js';
import { FINAL_EQUIPMENT_LAYOUT } from '../../src/scene/integration/finalLayout.js';
import {
  BABYLON_FIXED_PROCESS_IDS,
  createBabylonFixedEquipmentSystem,
} from '../../src/babylon/equipment/fixedEquipmentSystem.js';

function createContainer(scene, url) {
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

describe('Babylon fixed process equipment system', () => {
  it('grounds every V30 fixed equipment root at the authoritative layout X/Z and getTerrainHeight Y', async () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    const loadContainer = vi.fn(async (url) => createContainer(scene, url));
    const system = createBabylonFixedEquipmentSystem({ scene, loadContainer });
    await system.ready;

    expect(system.registry.entries()).toHaveLength(BABYLON_FIXED_PROCESS_IDS.length);
    expect(system.loadedVisualCount).toBe(BABYLON_FIXED_PROCESS_IDS.length);
    BABYLON_FIXED_PROCESS_IDS.forEach((id) => {
      const definition = FINAL_EQUIPMENT_LAYOUT[id];
      const equipment = system.getEquipment(id);
      expect(equipment.root.position.x, `${id}.x`).toBe(definition.x);
      expect(equipment.root.position.z, `${id}.z`).toBe(definition.z);
      expect(equipment.root.position.y, `${id}.y`).toBeCloseTo(getTerrainHeight(definition.x, definition.z), 8);
      expect(equipment.root.metadata.authoritativeXZ).toEqual([definition.x, definition.z]);
    });

    system.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('preserves V30 port aliases and exact front-end world endpoints', async () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    const system = createBabylonFixedEquipmentSystem({
      scene,
      instanceIds: ['ROM-HOPPER', 'APRON-FEEDER', 'PRIMARY-CRUSHER', 'MILL-01', 'CLASS-01'],
      loadContainer: async (url) => createContainer(scene, url),
    });
    await system.ready;

    const romRootY = getTerrainHeight(-110, -30);
    const feed = system.getPortWorldPosition('ROM-HOPPER', 'feedIn');
    const discharge = system.getPortWorldPosition('ROM-HOPPER', 'dischargeOut');
    expect(feed.x).toBeCloseTo(-116.72, 6);
    expect(feed.y).toBeCloseTo(romRootY + 2.18, 6);
    expect(feed.z).toBeCloseTo(-30, 6);
    expect(discharge.x).toBeCloseTo(-110, 6);
    expect(discharge.y).toBeCloseTo(romRootY + 1.95, 6);
    expect(discharge.z).toBeCloseTo(-30, 6);
    expect(system.getPort('MILL-01', 'feed').aliasOf).toBe('feedIn');
    expect(system.getPort('CLASS-01', 'outlet').aliasOf).toBe('overflow');
    expect(system.getPort('CLASS-01', 'outlet').nominalDiameterM).toBe(0.22);

    system.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('propagates global animation enablement to loaded Blender handles', async () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    const animation = { name: 'Animation', stop: vi.fn(), play: vi.fn(), pause: vi.fn() };
    const loadContainer = vi.fn(async (url) => {
      const container = createContainer(scene, url);
      container.animationGroups = [animation];
      return container;
    });
    const system = createBabylonFixedEquipmentSystem({
      scene,
      instanceIds: ['APRON-FEEDER'],
      loadContainer,
    });
    await system.ready;
    system.setAnimationsEnabled(true);
    system.setAnimationsEnabled(false);
    expect(animation.play).toHaveBeenCalledWith(true);
    expect(animation.pause).toHaveBeenCalled();

    system.dispose();
    scene.dispose();
    engine.dispose();
  });
});
