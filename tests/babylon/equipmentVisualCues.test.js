import { describe, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Scene } from '@babylonjs/core/scene.js';
import { getBlenderEquipmentContract } from '../../src/scene/integration/blenderEquipmentContracts.js';
import { getTerrainHeight } from '../../src/scene/environment/terrainHeight.js';
import { FINAL_EQUIPMENT_LAYOUT } from '../../src/scene/integration/finalLayout.js';
import { createBabylonEquipmentVisualCues } from '../../src/babylon/equipment/equipmentVisualCues.js';
import { createBabylonFixedEquipmentSystem } from '../../src/babylon/equipment/fixedEquipmentSystem.js';
import { createBabylonSupportEquipmentSystem } from '../../src/babylon/equipment/supportEquipmentSystem.js';

function sceneFixture() {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  scene.useRightHandedSystem = true;
  return { engine, scene };
}

function descendant(root, name) {
  return [root, ...root.getDescendants(false)].find((node) => node.name === name) ?? null;
}

function loadedContainer(scene, names = []) {
  const root = new TransformNode('__root__', scene);
  names.forEach((name) => {
    const mesh = new Mesh(name, scene);
    mesh.parent = root;
  });
  return {
    rootNodes: [root],
    animationGroups: [],
    addAllToScene: vi.fn(),
    dispose: vi.fn(),
  };
}

describe('Babylon V30 equipment visual cues', () => {
  it('consumes the ROM/crusher/mill/pump/cyclone preservation contracts with named process overlays', () => {
    const { engine, scene } = sceneFixture();
    const ids = ['ROM-HOPPER', 'PRIMARY-CRUSHER', 'MILL-01', 'SLURRY-PUMP-01', 'CLASS-01'];
    const expectedNames = {
      'ROM-HOPPER': ['rom-grizzly', 'rom-truck-dump-throat'],
      'PRIMARY-CRUSHER': ['PRIMARY-CRUSHER-v29-ore-flow'],
      'MILL-01': ['mill-charge'],
      'SLURRY-PUMP-01': ['pump-impeller', 'pump-slurry-path'],
      'CLASS-01': ['cyclone-1-swirl', 'cyclone-6-swirl', 'cyclone-manifold-suspended-solids'],
    };
    ids.forEach((instanceId) => {
      const host = new TransformNode(instanceId, scene);
      const cues = createBabylonEquipmentVisualCues({ scene, instanceId, hostRoot: host });
      expect(cues.root.metadata.preserveProceduralOverlays).toEqual([
        ...(getBlenderEquipmentContract(instanceId).preserveProceduralOverlays ?? []),
      ]);
      expectedNames[instanceId].forEach((name) => expect(descendant(cues.root, name), `${instanceId}:${name}`).toBeTruthy());
      cues.dispose();
      host.dispose();
    });
    scene.dispose();
    engine.dispose();
  });

  it('ports sump slurry and stockpile material-motion cues while keeping them visual-only', async () => {
    const { engine, scene } = sceneFixture();
    const system = createBabylonSupportEquipmentSystem({
      scene,
      loadContainer: async (url) => loadedContainer(scene, [url.includes('SUMP') ? 'SUMP-01_BODY' : 'STOCKPILE-RECLAIM_BODY']),
    });
    await system.ready;
    const sumpCues = system.visualCues.get('SUMP-01');
    const stockCues = system.visualCues.get('STOCKPILE-RECLAIM');
    const slurry = descendant(sumpCues.root, 'SUMP-01-slurry');
    const solids = descendant(sumpCues.root, 'SUMP-01-suspended-solids');
    const reclaim = descendant(stockCues.root, 'STOCKPILE-RECLAIM-motion');
    const feed = descendant(stockCues.root, 'STOCKPILE-RECLAIM-v24-feed-flow');

    expect(slurry.metadata).toMatchObject({ visualOnly: true, inspectionInterior: true });
    expect(solids.metadata).toMatchObject({ visualOnly: true, inspectionInterior: true });
    expect(reclaim.metadata).toMatchObject({ visualOnly: true, cueRole: 'stockpile-reclaim-motion' });
    expect(feed.metadata).toMatchObject({ visualOnly: true, cueRole: 'stockpile-feed-flow' });
    expect(system.getEquipment('SUMP-01').root.position.y).toBeCloseTo(
      getTerrainHeight(system.getEquipment('SUMP-01').root.position.x, system.getEquipment('SUMP-01').root.position.z),
      8,
    );

    system.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('binds imported educational liquids without changing the equipment root transform', () => {
    const { engine, scene } = sceneFixture();
    const host = new TransformNode('R-01', scene);
    host.position.set(101, 7.25, -33);
    host.rotation.y = 0.42;
    const beforePosition = host.position.clone();
    const beforeRotation = host.rotation.clone();
    const importedRoot = new TransformNode('R-01-imported', scene);
    const liquid = new Mesh('LEACH-REACTOR_SLURRY', scene);
    liquid.parent = importedRoot;
    const cues = createBabylonEquipmentVisualCues({ scene, instanceId: 'R-01', hostRoot: host });

    cues.bindImportedNodes([importedRoot]);

    expect(liquid.metadata).toMatchObject({
      neutralEducationalCue: true,
      inspectionInterior: true,
      cueRole: 'educational-liquid',
    });
    expect(cues.root.metadata.boundEducationalProcessNodeCount).toBe(1);
    expect(cues.root.metadata.educationalFallbackNodeCount).toBe(0);
    expect(host.position.asArray()).toEqual(beforePosition.asArray());
    expect(host.rotation.asArray()).toEqual(beforeRotation.asArray());

    cues.dispose();
    importedRoot.dispose(false, true);
    host.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('creates host educational cues for CIP, elution, EW and furnace glow when process nodes are not imported', () => {
    const { engine, scene } = sceneFixture();
    const cases = [
      ['CIP-ADSORPTION', 'CIP-ADSORPTION_SLURRY_-500'],
      ['ELUTION-SKID', 'elution-column-solution'],
      ['EW-CELLS', 'EW-CELLS_ELECTROLYTE_1'],
      ['SMELTING-FURNACE', 'SMELTING-FURNACE_MELT'],
    ];
    cases.forEach(([instanceId, expectedName]) => {
      const host = new TransformNode(instanceId, scene);
      const cues = createBabylonEquipmentVisualCues({ scene, instanceId, hostRoot: host });
      cues.bindImportedNodes([]);
      const cue = descendant(cues.root, expectedName);
      expect(cue, `${instanceId}:${expectedName}`).toBeTruthy();
      expect(cue.metadata.neutralEducationalCue).toBe(true);
      if (instanceId === 'SMELTING-FURNACE') expect(cue.metadata.cueRole).toBe('educational-glow');
      else expect(cue.metadata.cueRole).toBe('educational-liquid');
      cues.dispose();
      host.dispose();
    });
    scene.dispose();
    engine.dispose();
  });

  it('resolves the real CIP GLB decimal node names against the renderer-neutral contract names', () => {
    const { engine, scene } = sceneFixture();
    const host = new TransformNode('CIP-ADSORPTION', scene);
    const imported = new TransformNode('CIP-imported', scene);
    [
      'CIP-ADSORPTION_SLURRY_-5.00',
      'CIP-ADSORPTION_SLURRY_-1.67',
      'CIP-ADSORPTION_SLURRY_+1.67',
      'CIP-ADSORPTION_SLURRY_+5.00',
    ].forEach((name) => {
      const mesh = new Mesh(name, scene);
      mesh.parent = imported;
    });
    const cues = createBabylonEquipmentVisualCues({ scene, instanceId: 'CIP-ADSORPTION', hostRoot: host });
    cues.bindImportedNodes([imported]);

    expect(cues.root.metadata.boundEducationalProcessNodeCount).toBe(4);
    expect(cues.root.metadata.educationalFallbackNodeCount).toBe(0);
    const plus = descendant(imported, 'CIP-ADSORPTION_SLURRY_+1.67');
    expect(plus.metadata.educationalContractNodeName).toBe('CIP-ADSORPTION_SLURRY_+167');
    expect(plus.metadata.educationalResolvedNodeName).toBe('CIP-ADSORPTION_SLURRY_+1.67');

    cues.dispose();
    imported.dispose(false, true);
    host.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('freezes keepProceduralUpdate cues when Animaciones is OFF and resumes them when enabled', () => {
    const { engine, scene } = sceneFixture();
    vi.spyOn(engine, 'getDeltaTime').mockReturnValue(100);
    const host = new TransformNode('PRIMARY-CRUSHER', scene);
    const cues = createBabylonEquipmentVisualCues({ scene, instanceId: 'PRIMARY-CRUSHER', hostRoot: host });
    const ore = descendant(cues.root, 'PRIMARY-CRUSHER-v29-ore-1');
    const start = ore.position.clone();

    scene.onBeforeRenderObservable.notifyObservers(scene);
    expect(ore.position.asArray()).toEqual(start.asArray());
    cues.setAnimationsEnabled(true);
    scene.onBeforeRenderObservable.notifyObservers(scene);
    expect(ore.position.y).not.toBe(start.y);
    const running = ore.position.clone();
    cues.setAnimationsEnabled(false);
    scene.onBeforeRenderObservable.notifyObservers(scene);
    expect(ore.position.asArray()).toEqual(running.asArray());

    cues.dispose();
    host.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('falls back procedurally on GLB failure without moving fixed roots or process ports', async () => {
    const { engine, scene } = sceneFixture();
    const instanceIds = ['ROM-HOPPER', 'MILL-01', 'SLURRY-PUMP-01', 'R-01', 'SMELTING-FURNACE'];
    const system = createBabylonFixedEquipmentSystem({
      scene,
      instanceIds,
      loadContainer: vi.fn(async () => { throw new Error('fixture GLB failure'); }),
    });
    const before = Object.fromEntries(instanceIds.map((id) => {
      const equipment = system.getEquipment(id);
      const firstPort = [...equipment.ports.keys()][0];
      return [id, {
        position: equipment.root.position.asArray(),
        rotationY: equipment.root.rotation.y,
        portId: firstPort,
        port: system.getPortWorldPosition(id, firstPort).asArray(),
      }];
    }));
    await system.ready;

    instanceIds.forEach((id) => {
      const equipment = system.getEquipment(id);
      const visual = system.visuals.get(id);
      const cues = system.visualCues.get(id);
      expect(visual.loaded).toBe(false);
      expect(visual.host.metadata.blenderVisualStatus).toBe('error-procedural-fallback');
      expect(cues.fallbackActive).toBe(true);
      expect(cues.fallbackRoot.metadata).toMatchObject({ catalogFallback: true, preservesPortsAndLayout: true });
      expect(equipment.root.position.asArray()).toEqual(before[id].position);
      expect(equipment.root.rotation.y).toBe(before[id].rotationY);
      expect(system.getPortWorldPosition(id, before[id].portId).asArray()).toEqual(before[id].port);
      const layout = FINAL_EQUIPMENT_LAYOUT[id];
      expect(equipment.root.position.x).toBe(layout.x);
      expect(equipment.root.position.z).toBe(layout.z);
    });

    system.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('uses the same safe fallback policy for support equipment without changing support ports', async () => {
    const { engine, scene } = sceneFixture();
    const system = createBabylonSupportEquipmentSystem({
      scene,
      loadContainer: vi.fn(async () => { throw new Error('support GLB failure'); }),
    });
    const before = Object.fromEntries(['STOCKPILE-RECLAIM', 'SUMP-01'].map((id) => [
      id,
      system.getPortWorldPosition(id, id === 'SUMP-01' ? 'outlet' : 'reclaimOut').asArray(),
    ]));
    await system.ready;

    ['STOCKPILE-RECLAIM', 'SUMP-01'].forEach((id) => {
      expect(system.visuals.get(id).host.metadata.blenderVisualStatus).toBe('error-procedural-fallback');
      expect(system.visualCues.get(id).fallbackRoot.metadata.preservesPortsAndLayout).toBe(true);
      const portId = id === 'SUMP-01' ? 'outlet' : 'reclaimOut';
      expect(system.getPortWorldPosition(id, portId).asArray()).toEqual(before[id]);
    });

    system.dispose();
    scene.dispose();
    engine.dispose();
  });
});
