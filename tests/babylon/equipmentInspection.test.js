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
});
