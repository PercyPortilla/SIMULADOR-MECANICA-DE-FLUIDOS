import { describe, expect, it } from 'vitest';
import { createMineralFrontEnd } from '../../src/scene/equipment/mineralFrontEnd.js';
import { createFrontEndConveyors } from '../../src/scene/conveyors/frontEndConveyors.js';
import { getTerrainHeight } from '../../src/scene/environment/terrainHeight.js';
import * as THREE from 'three';

describe('mineral front end', () => {
  it('creates reception, crushing and stockpile modules in their intended zones', () => {
    const frontEnd = createMineralFrontEnd();
    expect(frontEnd.root.getObjectByName('MINERAL-RECEPTION')).toBeTruthy();
    expect(frontEnd.root.getObjectByName('PRIMARY-CRUSHING')).toBeTruthy();
    expect(frontEnd.root.getObjectByName('STOCKPILE-AREA')).toBeTruthy();
    expect(frontEnd.root.getObjectByName('ROM-hopper')).toBeTruthy();
    expect(frontEnd.root.getObjectByName('ROM-grizzly')).toBeTruthy();
    expect(frontEnd.root.getObjectByName('primary-crusher-body')).toBeTruthy();
    expect(frontEnd.root.getObjectByName('crusher-drive-motor')).toBeTruthy();
    expect(frontEnd.root.getObjectByName('crusher-lower-maintenance-platform')).toBeTruthy();
    expect(frontEnd.root.getObjectByName('mineral-stockpile')).toBeTruthy();
  });

  it('provides finite transfer points for the two required conveyors', () => {
    const frontEnd = createMineralFrontEnd();
    Object.values(frontEnd.transferPoints).forEach((point) => {
      expect([point.x, point.y, point.z].every(Number.isFinite)).toBe(true);
    });
  });

  it('creates two separate conveyors with supports that touch terrain', () => {
    const frontEnd = createMineralFrontEnd();
    const conveyors = createFrontEndConveyors({ transferPoints: frontEnd.transferPoints });
    expect(conveyors.root.children).toHaveLength(2);
    expect(conveyors.conveyor01.name).toBe('CV-01-RECEPTION-TO-CRUSHING');
    expect(conveyors.conveyor02.name).toBe('CV-02-CRUSHING-TO-STOCKPILE');

    conveyors.root.updateMatrixWorld(true);
    conveyors.root.traverse((child) => {
      if (!child.name?.endsWith('-leg') || !child.geometry?.parameters) return;
      const world = child.getWorldPosition(new THREE.Vector3());
      const expectedTerrainY = getTerrainHeight(world.x, world.z);
      const halfHeight = child.geometry.parameters.height / 2;
      expect(Math.abs((world.y - halfHeight) - expectedTerrainY)).toBeLessThan(1e-6);
    });
  });
});
