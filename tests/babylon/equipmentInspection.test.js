import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Scene } from '@babylonjs/core/scene.js';
import { describe, expect, it } from 'vitest';
import { INSPECTION_CIRCUIT_ORDER } from '../../src/scene/inspection/inspectionContracts.js';
import {
  computeBabylonInspectionFraming,
  createBabylonEquipmentInspectionSystem,
} from '../../src/babylon/inspection/equipmentInspection.js';

function target(scene, id, position, size = [4, 3, 2], metadata = {}) {
  const root = new TransformNode(id, scene);
  root.position.set(...position);
  root.metadata = metadata;
  const shell = CreateBox(`${id}_SHELL`, { width: size[0], height: size[1], depth: size[2] }, scene);
  shell.parent = root;
  shell.material = new StandardMaterial(`${id}-material`, scene);
  const interior = CreateBox(`${id}_IMPELLER`, { width: 0.8, height: 0.8, depth: 0.8 }, scene);
  interior.parent = root;
  interior.material = new StandardMaterial(`${id}-interior-material`, scene);
  return { root, shell, interior };
}

function makeScene() {
  const engine = new NullEngine({ renderWidth: 64, renderHeight: 64 });
  const scene = new Scene(engine);
  scene.useRightHandedSystem = true;
  return { engine, scene };
}

describe('Babylon Inspection parity', () => {
  it('uses the renderer-neutral V30 circuit order and context', () => {
    const { engine, scene } = makeScene();
    target(scene, 'EXCAVATOR-01', [-10, 0, 0]);
    target(scene, 'TRUCK-01', [-4, 0, 0]);
    target(scene, 'ROM-HOPPER', [2, 0, 0]);
    const system = createBabylonEquipmentInspectionSystem({ scene });
    expect(system.getTargets().map((item) => item.id)).toEqual(INSPECTION_CIRCUIT_ORDER.slice(0, 3));
    expect(system.getTargets()[1]).toMatchObject({ previousId: 'EXCAVATOR-01', nextId: 'ROM-HOPPER' });
    system.dispose(); scene.dispose(); engine.dispose();
  });

  it('focuses long route targets without changing their route points', () => {
    const { engine, scene } = makeScene();
    const routePoints = [[0, 2, 0], [20, 3, 0], [80, 4, 10]];
    const { root } = target(scene, 'CV-02-CRUSHER-TO-STOCKPILE', [40, 3, 5], [84, 3, 12], { routePoints });
    const framing = computeBabylonInspectionFraming(root, root.name);
    expect(framing.focused).toBe(true);
    expect(framing.source).toBe('route-metadata');
    expect(framing.size.x).toBeLessThanOrEqual(28);
    expect(root.metadata.routePoints).toEqual(routePoints);
    scene.dispose(); engine.dispose();
  });

  it('frames V57 stockpile and cyclone clusters from focused authored children instead of whole-route bounds', () => {
    const { engine, scene } = makeScene();
    const stockRoot = new TransformNode('STOCKPILE-RECLAIM_ROOT', scene);
    stockRoot.metadata = { v57AuthoritativeVisual: true };
    const stock = CreateBox('STOCKPILE_MAIN_ORE', { width: 18, height: 8, depth: 12 }, scene);
    stock.position.set(10, 4, -20);
    stock.parent = stockRoot;
    stock.metadata = { v57AuthoritativeVisual: true };
    const reclaimRoot = new TransformNode('STOCKPILE-RECLAIM-FEEDER_ROOT', scene);
    reclaimRoot.position.set(42, 3, -4);
    reclaimRoot.parent = stockRoot;
    reclaimRoot.metadata = { v57AuthoritativeVisual: true };
    const reclaimFeeder = CreateBox('STOCKPILE-RECLAIM-FEEDER_BODY', { width: 8, height: 3, depth: 5 }, scene);
    reclaimFeeder.parent = reclaimRoot;
    reclaimFeeder.metadata = { v57AuthoritativeVisual: true };
    const remote = CreateBox('TRANSFER-TOWER-03_REMOTE', { size: 2 }, scene);
    remote.position.set(120, 4, -20);
    remote.parent = stockRoot;
    remote.metadata = { v57AuthoritativeVisual: true };

    const classRoot = new TransformNode('CLASS-01_ROOT', scene);
    classRoot.metadata = { v57AuthoritativeVisual: true };
    for (let index = 0; index < 4; index += 1) {
      const cyclone = CreateBox(`CLASS-01_TRANS_CYCLONE_${index}_BARREL`, { width: 1.5, height: 5, depth: 1.5 }, scene);
      cyclone.position.set(40 + index * 2, 6, -30);
      cyclone.parent = classRoot;
      cyclone.metadata = { v57AuthoritativeVisual: true };
    }
    const longPipe = CreateBox('CLASS-01_FEED_LINE_VERY_LONG', { width: 90, height: 1, depth: 1 }, scene);
    longPipe.position.set(0, 6, -30);
    longPipe.parent = classRoot;
    longPipe.metadata = { v57AuthoritativeVisual: true };

    const system = createBabylonEquipmentInspectionSystem({ scene });
    const stockFrame = system.getFraming('STOCKPILE-RECLAIM');
    const classFrame = system.getFraming('CLASS-01');
    expect(stockFrame.source).toBe('profile-objects');
    expect(stockFrame.center.x).toBeCloseTo(42, 1);
    expect(stockFrame.center.z).toBeCloseTo(-4, 1);
    expect(stockFrame.size.x).toBeLessThanOrEqual(24);
    expect(classFrame.source).toBe('profile-objects');
    expect(classFrame.center.x).toBeGreaterThan(39);
    expect(classFrame.size.x).toBeLessThanOrEqual(18);
    system.dispose(); scene.dispose(); engine.dispose();
  });

  it('maps LOADER-01 Inspection to the authoritative STOCKPILE-LOADER-01 hierarchy', () => {
    const { engine, scene } = makeScene();
    const legacy = target(scene, 'LOADER-01', [300, 2, 0], [8, 4, 4]);
    const loaderRoot = new TransformNode('STOCKPILE-LOADER-01', scene);
    loaderRoot.position.set(-118, 35, -109);
    loaderRoot.metadata = { v57AuthoritativeVisual: true };
    const loaderBody = CreateBox('STOCKPILE-LOADER-01_REAR_BODY', { width: 7, height: 4, depth: 4 }, scene);
    loaderBody.parent = loaderRoot;
    loaderBody.metadata = { v57AuthoritativeVisual: true };
    const system = createBabylonEquipmentInspectionSystem({ scene });
    const selected = system.setTarget('LOADER-01');
    const framing = system.getFraming('LOADER-01');
    expect(selected.metadata.v57InspectionAlias).toBe(true);
    expect(framing.center.x).toBeLessThan(-100);
    expect(framing.followTarget).toBe(true);
    expect(system.resolvePickTargetId(legacy.shell)).toBeNull();
    expect(loaderBody.isPickable).toBe(true);
    system.dispose(); scene.dispose(); engine.dispose();
  });

  it('applies transparent/cutaway/interior modes and restores original materials/visibility', () => {
    const { engine, scene } = makeScene();
    const { shell, interior } = target(scene, 'MILL-01', [0, 1, 0]);
    const originalShellMaterial = shell.material;
    const system = createBabylonEquipmentInspectionSystem({ scene });
    system.setTarget('MILL-01');
    system.setMode('transparent');
    expect(shell.material).not.toBe(originalShellMaterial);
    expect(shell.material.alpha).toBeCloseTo(0.20, 8);
    expect(interior.isVisible).toBe(true);
    system.setMode('cutaway');
    expect(shell.material.clipPlane).toBeTruthy();
    system.setMode('interior');
    expect(shell.isVisible).toBe(false);
    expect(interior.isVisible).toBe(true);
    system.setMode('normal');
    expect(shell.material).toBe(originalShellMaterial);
    expect(shell.isVisible).toBe(true);
    system.dispose(); scene.dispose(); engine.dispose();
  });

  it('reuses one inspection material variant for meshes that share the same original material and role', () => {
    const { engine, scene } = makeScene();
    const root = new TransformNode('MILL-01', scene);
    const sharedShellMaterial = new StandardMaterial('mill-shared-shell', scene);
    const shells = Array.from({ length: 6 }, (_, index) => {
      const mesh = CreateBox(`MILL-01_SHELL_${index}`, { size: 1 }, scene);
      mesh.parent = root;
      mesh.position.x = index * 1.1;
      mesh.material = sharedShellMaterial;
      return mesh;
    });
    const system = createBabylonEquipmentInspectionSystem({ scene });
    system.setTarget('MILL-01');
    system.setMode('transparent');
    const sharedVariant = shells[0].material;
    expect(sharedVariant).not.toBe(sharedShellMaterial);
    expect(shells.every((mesh) => mesh.material === sharedVariant)).toBe(true);
    system.setMode('normal');
    expect(shells.every((mesh) => mesh.material === sharedShellMaterial)).toBe(true);
    system.dispose(); scene.dispose(); engine.dispose();
  });

  it('draws compact selected/upstream/downstream markers without wireframe boxes', () => {
    const { engine, scene } = makeScene();
    target(scene, 'EXCAVATOR-01', [-10, 0, 0]);
    target(scene, 'TRUCK-01', [-4, 0, 0]);
    target(scene, 'ROM-HOPPER', [2, 0, 0]);
    const system = createBabylonEquipmentInspectionSystem({ scene });
    system.setTarget('TRUCK-01');
    const markers = system.contextOverlay.getChildMeshes(false);
    const roles = markers.map((mesh) => mesh.metadata.role).sort();
    expect(roles).toEqual(['downstream', 'selected', 'upstream']);
    expect(markers.find((mesh) => mesh.metadata.role === 'selected')?.metadata.markerKind).toBe('floor-halo');
    expect(markers.filter((mesh) => mesh.metadata.role !== 'selected').every((mesh) => mesh.metadata.markerKind === 'compact-marker')).toBe(true);
    expect(markers.every((mesh) => mesh.isPickable === false)).toBe(true);
    expect(markers.every((mesh) => mesh.material?.wireframe !== true)).toBe(true);
    expect(scene.effectLayers).toHaveLength(0);
    system.dispose(); scene.dispose(); engine.dispose();
  });

  it('resolves canonical conveyor Inspection to authoritative V57 alias geometry instead of hidden procedural roots', () => {
    const { engine, scene } = makeScene();
    const legacy = target(scene, 'CV-02-CRUSHER-TO-STOCKPILE', [-60, 2, 0], [30, 2, 3]);
    const v49A = CreateBox('V49_CV02_BELT_01', { width: 18, height: 0.4, depth: 2 }, scene);
    const v49B = CreateBox('V49_CV02_BELT_02', { width: 18, height: 0.4, depth: 2 }, scene);
    v49A.position.set(210, 4, 0);
    v49B.position.set(226, 5, 0);
    v49A.metadata = { v57AuthoritativeVisual: true };
    v49B.metadata = { v57AuthoritativeVisual: true };
    v49A.material = new StandardMaterial('v49-cv02-a', scene);
    v49B.material = new StandardMaterial('v49-cv02-b', scene);
    const originalV49Material = v49A.material;
    const originalLegacyMaterial = legacy.shell.material;
    const system = createBabylonEquipmentInspectionSystem({ scene });
    const selected = system.setTarget('CV-02-CRUSHER-TO-STOCKPILE');
    const framing = system.getFraming('CV-02-CRUSHER-TO-STOCKPILE');
    expect(selected.metadata.v57InspectionAlias).toBe(true);
    expect(framing.center.x).toBeGreaterThan(190);
    system.setMode('transparent');
    expect(v49A.material).not.toBe(originalV49Material);
    expect(legacy.shell.material).toBe(originalLegacyMaterial);
    system.setMode('normal');
    expect(v49A.material).toBe(originalV49Material);
    system.dispose(); scene.dispose(); engine.dispose();
  });

  it('maps only authoritative V57 Inspection meshes to canonical click targets', () => {
    const { engine, scene } = makeScene();
    const root = new TransformNode('MILL-01_ROOT', scene);
    root.metadata = { v57AuthoritativeVisual: true };
    const shell = CreateBox('MILL-01_SHELL', { size: 2 }, scene);
    shell.parent = root;
    shell.metadata = { v57AuthoritativeVisual: true };
    shell.isPickable = false;
    const terrain = CreateBox('V57_TERRAIN_INTEGRATED', { size: 4 }, scene);
    terrain.metadata = { v57AuthoritativeVisual: true };
    terrain.isPickable = false;

    const system = createBabylonEquipmentInspectionSystem({ scene });
    expect(system.resolvePickTargetId(shell)).toBe('MILL-01');
    expect(shell.isPickable).toBe(true);
    expect(system.resolvePickTargetId(terrain)).toBeNull();
    expect(terrain.isPickable).toBe(false);
    expect(system.getPickableMeshCount()).toBeGreaterThan(0);

    system.dispose();
    expect(shell.isPickable).toBe(false);
    scene.dispose(); engine.dispose();
  });

  it('changes the canonical Inspection objective without leaving stale context', () => {
    const { engine, scene } = makeScene();
    target(scene, 'EXCAVATOR-01', [-8, 1, 0]);
    target(scene, 'TRUCK-01', [0, 1, 0]);
    target(scene, 'ROM-HOPPER', [8, 1, 0]);
    const system = createBabylonEquipmentInspectionSystem({ scene });

    system.setTarget('EXCAVATOR-01');
    expect(system.targetId).toBe('EXCAVATOR-01');
    system.setTarget('TRUCK-01');
    expect(system.targetId).toBe('TRUCK-01');
    const ids = system.contextOverlay.getChildMeshes(false).map((mesh) => mesh.metadata.targetId);
    expect(ids).toEqual(expect.arrayContaining(['EXCAVATOR-01', 'TRUCK-01', 'ROM-HOPPER']));
    expect(ids.filter((id) => id === 'EXCAVATOR-01')).toHaveLength(1);

    system.dispose(); scene.dispose(); engine.dispose();
  });

  it('uses a separate hover overlay and suppresses it for the selected target', () => {
    const { engine, scene } = makeScene();
    target(scene, 'EXCAVATOR-01', [-8, 1, 0]);
    target(scene, 'TRUCK-01', [0, 1, 0]);
    const system = createBabylonEquipmentInspectionSystem({ scene });

    expect(system.setHoverTarget('TRUCK-01')).toBeTruthy();
    expect(system.hoverTargetId).toBe('TRUCK-01');
    expect(system.hoverOverlay.getChildMeshes(false)).toHaveLength(1);
    expect(system.hoverOverlay.getChildMeshes(false)[0].metadata).toMatchObject({
      role: 'hover',
      targetId: 'TRUCK-01',
    });

    system.setTarget('TRUCK-01');
    expect(system.hoverOverlay.getChildMeshes(false)).toHaveLength(0);
    expect(system.contextOverlay.getChildMeshes(false).some((mesh) => mesh.metadata.role === 'selected')).toBe(true);

    expect(system.setHoverTarget('NOT-A-TARGET')).toBeNull();
    expect(system.hoverTargetId).toBeNull();
    system.dispose(); scene.dispose(); engine.dispose();
  });

  it('renders a non-pickable operational status beacon above the selected target', () => {
    const { engine, scene } = makeScene();
    target(scene, 'MILL-01', [0, 1, 0], [6, 4, 3]);
    target(scene, 'SUMP-01', [10, 1, 0], [4, 2, 3]);
    const system = createBabylonEquipmentInspectionSystem({ scene });

    system.setTarget('MILL-01');
    expect(system.statusOverlay.getChildMeshes(false)).toHaveLength(0);
    expect(system.setOperationalStatus({ tone: 'valid', label: 'Hidráulica calculada' })).toEqual({
      tone: 'valid',
      label: 'Hidráulica calculada',
    });

    const [validBeacon] = system.statusOverlay.getChildMeshes(false);
    expect(validBeacon).toBeTruthy();
    expect(validBeacon.isPickable).toBe(false);
    expect(validBeacon.metadata).toMatchObject({
      inspectionOperationalStatus: true,
      targetId: 'MILL-01',
      tone: 'valid',
      visualOnly: true,
    });
    expect(validBeacon.position.y).toBeGreaterThan(1);

    system.setOperationalStatus({ tone: 'invalid', label: 'Bomba no calculable' });
    const [invalidBeacon] = system.statusOverlay.getChildMeshes(false);
    expect(invalidBeacon.metadata.tone).toBe('invalid');
    expect(invalidBeacon.name).toBe('inspection-status-MILL-01');

    system.setTarget('SUMP-01');
    expect(system.operationalStatus).toBeNull();
    expect(system.statusOverlay.getChildMeshes(false)).toHaveLength(0);

    system.dispose(); scene.dispose(); engine.dispose();
  });

  it('marks semantic-only V57 inspection routes as non-cutaway and keeps their mode normal', () => {
    const { engine, scene } = makeScene();
    const v55Marker = CreateBox('V55_SITE_MARKER', { size: 1 }, scene);
    v55Marker.metadata = { v57AuthoritativeVisual: true };
    const system = createBabylonEquipmentInspectionSystem({ scene });
    const route = system.getTargets().find((item) => item.id === 'MT-ELUTION-TO-CIP-BARREN-CARBON');
    expect(route).toMatchObject({ supportsModes: false, semanticOnly: true });
    system.setTarget(route.id);
    expect(system.setMode('cutaway')).toBe('normal');
    expect(system.mode).toBe('normal');
    system.dispose(); scene.dispose(); engine.dispose();
  });
});
