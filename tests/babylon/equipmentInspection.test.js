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

  it('applies transparent/cutaway/interior modes and restores original materials/visibility', () => {
    const { engine, scene } = makeScene();
    const { shell, interior } = target(scene, 'MILL-01', [0, 1, 0]);
    const originalShellMaterial = shell.material;
    const system = createBabylonEquipmentInspectionSystem({ scene });
    system.setTarget('MILL-01');
    system.setMode('transparent');
    expect(shell.material).not.toBe(originalShellMaterial);
    expect(shell.material.alpha).toBeCloseTo(0.26, 8);
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

  it('draws selected/upstream/downstream context boxes', () => {
    const { engine, scene } = makeScene();
    target(scene, 'EXCAVATOR-01', [-10, 0, 0]);
    target(scene, 'TRUCK-01', [-4, 0, 0]);
    target(scene, 'ROM-HOPPER', [2, 0, 0]);
    const system = createBabylonEquipmentInspectionSystem({ scene });
    system.setTarget('TRUCK-01');
    const roles = system.contextOverlay.getChildMeshes(false).map((mesh) => mesh.metadata.role).sort();
    expect(roles).toEqual(['downstream', 'selected', 'upstream']);
    system.dispose(); scene.dispose(); engine.dispose();
  });

  it('resolves canonical conveyor Inspection to V49 alias geometry instead of hidden V30 roots', () => {
    const { engine, scene } = makeScene();
    const legacy = target(scene, 'CV-02-CRUSHER-TO-STOCKPILE', [-60, 2, 0], [30, 2, 3]);
    const v49A = CreateBox('V49_CV02_BELT_01', { width: 18, height: 0.4, depth: 2 }, scene);
    const v49B = CreateBox('V49_CV02_BELT_02', { width: 18, height: 0.4, depth: 2 }, scene);
    v49A.position.set(210, 4, 0);
    v49B.position.set(226, 5, 0);
    v49A.metadata = { v49AuthoritativeVisual: true };
    v49B.metadata = { v49AuthoritativeVisual: true };
    v49A.material = new StandardMaterial('v49-cv02-a', scene);
    v49B.material = new StandardMaterial('v49-cv02-b', scene);
    const originalV49Material = v49A.material;
    const originalLegacyMaterial = legacy.shell.material;
    const system = createBabylonEquipmentInspectionSystem({ scene });
    const selected = system.setTarget('CV-02-CRUSHER-TO-STOCKPILE');
    const framing = system.getFraming('CV-02-CRUSHER-TO-STOCKPILE');
    expect(selected.metadata.v49InspectionAlias).toBe(true);
    expect(framing.center.x).toBeGreaterThan(190);
    system.setMode('transparent');
    expect(v49A.material).not.toBe(originalV49Material);
    expect(legacy.shell.material).toBe(originalLegacyMaterial);
    system.setMode('normal');
    expect(v49A.material).toBe(originalV49Material);
    system.dispose(); scene.dispose(); engine.dispose();
  });

  it('marks semantic-only V49 inspection routes as non-cutaway and keeps their mode normal', () => {
    const { engine, scene } = makeScene();
    const v49Marker = CreateBox('V49_SITE_MARKER', { size: 1 }, scene);
    v49Marker.metadata = { v49AuthoritativeVisual: true };
    const system = createBabylonEquipmentInspectionSystem({ scene });
    const route = system.getTargets().find((item) => item.id === 'P-CYCLONE-UNDERFLOW-RETURN');
    expect(route).toMatchObject({ supportsModes: false, semanticOnly: true });
    system.setTarget(route.id);
    expect(system.setMode('cutaway')).toBe('normal');
    expect(system.mode).toBe('normal');
    system.dispose(); scene.dispose(); engine.dispose();
  });
});
