import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { computeInspectionCameraDistance, createBaseScene } from '../../src/scene/baseEnvironment.js';
import {
  createEquipmentInspectionSystem,
  getInspectionCircuitContext,
  inferImportedInspectionRole,
  INSPECTION_CIRCUIT_ORDER,
} from '../../src/scene/inspection/equipmentInspection.js';

describe('equipment internal inspection modes', () => {
  it('indexes machines, conveyors and piping as inspectable targets', () => {
    const scene = createBaseScene();
    const ids = scene.equipmentInspection.getTargets().map((item) => item.id);
    expect(ids).toContain('MILL-01');
    expect(ids).toContain('PUMP-01');
    expect(ids).toContain('PRIMARY-CRUSHER');
    expect(ids).toContain('CV-03-STOCKPILE-TO-GRINDING');
    expect(ids).toContain('P-PUMP-01-TO-CIP');
    expect(ids).toContain('LOADER-01');
    expect(ids).toContain('EXCAVATOR-01');
    expect(ids).toEqual([...INSPECTION_CIRCUIT_ORDER]);
    expect(ids).toHaveLength(38);
  });

  it('orders inspection targets by process circuit instead of alphabetically', () => {
    const scene = createBaseScene();
    const ids = scene.equipmentInspection.getTargets().map((item) => item.id);
    const sequence = [
      'ROM-HOPPER',
      'APRON-FEEDER',
      'PRIMARY-CRUSHER',
      'STOCKPILE-RECLAIM',
      'MILL-01',
      'SUMP-01',
      'SLURRY-PUMP-01',
      'CLASS-01',
      'R-01',
      'R-02',
      'R-03',
      'R-04',
      'PUMP-01',
      'CIP-ADSORPTION',
      'ELUTION-SKID',
      'EW-CELLS',
      'SMELTING-FURNACE',
    ];
    const positions = sequence.map((id) => ids.indexOf(id));
    expect(positions.every((index) => index >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });

  it('exposes upstream/downstream neighbors from the explicit circuit order', () => {
    const context = getInspectionCircuitContext('MILL-01');
    expect(context.previousId).toBe('CV-03-STOCKPILE-TO-GRINDING');
    expect(context.nextId).toBe('P-MILL-TO-SUMP');
    expect(context.index).toBeGreaterThan(0);
  });

  it('classifies imported close-view parts by component token without equipment-name collisions', () => {
    const roleFor = (name) => inferImportedInspectionRole({ name, userData: { blenderImported: true } });

    expect(roleFor('SLURRY-PUMP-01_BASEPLATE')).toBe('structure');
    expect(roleFor('SLURRY-PUMP-01_MOTOR')).toBe('structure');
    expect(roleFor('SLURRY-PUMP-01_DETAIL_CASING_CORE')).toBe('shell');
    expect(roleFor('SLURRY-PUMP-01_SHAFT')).toBe('interior');
    expect(roleFor('PRIMARY-CRUSHER_DISCHARGE_CHUTE')).toBe('structure');
    expect(roleFor('PRIMARY-CRUSHER_MOVING_JAW_PLATE')).toBe('interior');
    expect(roleFor('ROM-HOPPER_DISCHARGE_THROAT')).toBe('structure');
    expect(roleFor('ROM-HOPPER_ORE')).toBe('interior');
    expect(roleFor('CLASS-01_CYCLONE_01_BARREL')).toBe('shell');
    expect(roleFor('LEACH-REACTOR_BAFFLE_01')).toBe('interior');
    expect(roleFor('CIP-ADSORPTION_BLADE_+167_0')).toBe('interior');
    expect(roleFor('EW-CELLS_CELL_1')).toBe('shell');
    expect(roleFor('EW-CELLS_ELECTROLYTE_1')).toBe('interior');
    expect(roleFor('SMELTING-FURNACE_MELT')).toBe('interior');
  });

  it('overrides broad GLB role metadata when inspecting pump shell, structure and internals', () => {
    const environmentRoot = new THREE.Group();
    const target = new THREE.Group();
    target.name = 'SLURRY-PUMP-01';
    target.userData.inspectableEquipment = true;
    const makePart = (name) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
      mesh.name = name;
      mesh.userData.blenderImported = true;
      // Reproduces metadata produced by the broad legacy loader heuristic.
      mesh.userData.inspectionRole = 'interior';
      target.add(mesh);
      return mesh;
    };
    const baseplate = makePart('SLURRY-PUMP-01_BASEPLATE');
    const casing = makePart('SLURRY-PUMP-01_DETAIL_CASING_CORE');
    const shaft = makePart('SLURRY-PUMP-01_SHAFT');
    environmentRoot.add(target);

    const inspection = createEquipmentInspectionSystem({ environmentRoot });
    inspection.setTarget('SLURRY-PUMP-01');
    inspection.setMode('interior');

    expect(casing.visible).toBe(false);
    expect(shaft.visible).toBe(true);
    expect(shaft.material.opacity).toBeGreaterThanOrEqual(0.76);
    expect(baseplate.visible).toBe(true);
    expect(baseplate.material.opacity).toBeCloseTo(0.10, 3);
    inspection.dispose();
  });

  it('renders inspection context boxes for selected, upstream and downstream targets', () => {
    const scene = createBaseScene();
    scene.equipmentInspection.setTarget('MILL-01');
    const roles = scene.equipmentInspection.contextOverlay.children.map((child) => child.userData.role);
    expect(roles).toContain('selected');
    expect(roles).toContain('upstream');
    expect(roles).toContain('downstream');
  });

  it('computes camera framing from object dimensions and viewport aspect', () => {
    const compact = computeInspectionCameraDistance([2, 2, 2], 42, 16 / 9);
    const large = computeInspectionCameraDistance([20, 8, 12], 42, 16 / 9);
    expect(compact).toBeGreaterThan(2);
    expect(large).toBeGreaterThan(compact);
  });

  it('refreshes context boxes when an inspected mobile target moves', () => {
    const scene = createBaseScene();
    const excavator = scene.scene.getObjectByName('EXCAVATOR-01');
    scene.equipmentInspection.setTarget('EXCAVATOR-01');
    const helper = scene.equipmentInspection.contextOverlay.children.find((child) => child.userData.role === 'selected');
    const before = helper.box.getCenter(new THREE.Vector3());
    excavator.position.x += 3;
    scene.equipmentInspection.refreshContextOverlay();
    const after = helper.box.getCenter(new THREE.Vector3());
    expect(after.x - before.x).toBeCloseTo(3, 1);
  });

  it('reveals a pump impeller in cutaway and restores normal visibility', () => {
    const scene = createBaseScene();
    const pump = scene.equipmentSystem.getEquipment('PUMP-01').group3D;
    const impeller = pump.getObjectByName('pump-impeller');
    expect(impeller).toBeTruthy();
    scene.equipmentInspection.setTarget('PUMP-01');
    scene.equipmentInspection.setMode('cutaway');
    expect(impeller.visible).toBe(true);
    const casing = pump.getObjectByName('pump-volute');
    const clipping = Array.isArray(casing.material) ? casing.material[0].clippingPlanes : casing.material.clippingPlanes;
    expect(clipping?.length).toBe(1);
    scene.equipmentInspection.setMode('normal');
    const restored = Array.isArray(casing.material) ? casing.material[0].clippingPlanes : casing.material.clippingPlanes;
    expect(restored ?? []).toHaveLength(0);
  });

  it('reveals internal pipe slurry without changing physical diameter metadata', () => {
    const scene = createBaseScene();
    const pipe = scene.scene.getObjectByName('P-PUMP-01-TO-CIP');
    const fluid = pipe.getObjectByName('P-PUMP-01-TO-CIP-slurry-stream-1');
    expect(fluid.visible).toBe(false);
    const physical = pipe.userData.physicalDiameterM;
    scene.equipmentInspection.setTarget('P-PUMP-01-TO-CIP');
    scene.equipmentInspection.setMode('transparent');
    expect(fluid.visible).toBe(true);
    expect(pipe.userData.physicalDiameterM).toBe(physical);
    expect(pipe.userData.visualDiameterM).toBeGreaterThanOrEqual(physical);
  });
});
