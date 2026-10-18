import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  applyInspectionCameraFraming,
  computeInspectionCameraDistance,
  createBaseScene,
} from '../../src/scene/baseEnvironment.js';
import {
  createEquipmentInspectionSystem,
  computeInspectionFraming,
  getInspectionCircuitContext,
  inferImportedInspectionRole,
  INSPECTION_FOCUS_PROFILES,
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
    expect(roleFor('ELUTION-SKID_COLUMN')).toBe('shell');
    expect(roleFor('ELUTION-SKID_HEAT_EXCHANGER')).toBe('shell');
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
    const legacyPadded = computeInspectionCameraDistance([20, 8, 12], 42, 16 / 9, 2.05);
    expect(compact).toBeGreaterThan(2);
    expect(large).toBeGreaterThan(compact);
    expect(large).toBeLessThan(legacyPadded);
  });

  it('pushes Inspection outward on a narrow resize without changing the current orbit direction', () => {
    const camera = new THREE.PerspectiveCamera(42, 1096 / 520, 0.1, 1200);
    const target = new THREE.Vector3(4, 3, -2);
    camera.position.copy(target).add(new THREE.Vector3(18, 10, 16));
    const controls = {
      target: target.clone(),
      minDistance: 0,
      maxDistance: 0,
      updateCalls: 0,
      update() { this.updateCalls += 1; },
    };
    const framing = {
      center: new THREE.Vector3(4, 3, -2),
      size: new THREE.Vector3(20, 8, 12),
    };
    applyInspectionCameraFraming(camera, controls, framing);
    const desktopDistance = camera.position.distanceTo(controls.target);
    const desktopDirection = camera.position.clone().sub(controls.target).normalize();

    camera.aspect = 390 / 520;
    camera.updateProjectionMatrix();
    const result = applyInspectionCameraFraming(camera, controls, framing, {
      minimumOnly: true,
      recenter: false,
    });
    const mobileDistance = camera.position.distanceTo(controls.target);
    const mobileDirection = camera.position.clone().sub(controls.target).normalize();

    expect(mobileDistance).toBeGreaterThan(desktopDistance);
    expect(mobileDistance).toBeGreaterThanOrEqual(result.requiredDistance - 1e-9);
    expect(mobileDirection.dot(desktopDirection)).toBeGreaterThan(0.999999);
    expect(controls.target.distanceTo(target)).toBeLessThan(1e-9);
    expect(controls.updateCalls).toBe(2);
  });

  it('defines close-view focus profiles only for reproduced long targets', () => {
    expect(Object.keys(INSPECTION_FOCUS_PROFILES)).toEqual([
      'CV-02-CRUSHER-TO-STOCKPILE',
      'STOCKPILE-RECLAIM',
      'CV-03-STOCKPILE-TO-GRINDING',
      'P-CYCLONE-UNDERFLOW-RETURN',
      'P-CLASSIFICATION-TO-LEACH',
      'P-LEACHING-TO-PUMP-01',
      'P-PUMP-01-TO-CIP',
    ]);
  });

  it('frames long conveyor and piping targets around a close route segment without moving the route', () => {
    const scene = createBaseScene();
    for (const id of [
      'CV-02-CRUSHER-TO-STOCKPILE',
      'CV-03-STOCKPILE-TO-GRINDING',
      'P-CYCLONE-UNDERFLOW-RETURN',
      'P-LEACHING-TO-PUMP-01',
      'P-PUMP-01-TO-CIP',
    ]) {
      const target = scene.scene.getObjectByName(id);
      const routeBefore = structuredClone(target.userData.routePoints);
      const framing = computeInspectionFraming(target, id);
      expect(framing.focused).toBe(true);
      expect(framing.source).toBe('route-metadata');
      expect(Math.max(framing.size.x, framing.size.z)).toBeLessThanOrEqual(
        INSPECTION_FOCUS_PROFILES[id].maxSpanM + 1e-9,
      );
      expect(target.userData.routePoints).toEqual(routeBefore);
    }
  });

});
