import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createEquipmentSystem } from '../../src/scene/equipment/equipmentSystem.js';
import { createMineralFrontEnd } from '../../src/scene/equipment/mineralFrontEnd.js';
import { createGrindingFeedConveyor } from '../../src/scene/conveyors/grindingFeedConveyor.js';
import { createGrindingClassificationConnection } from '../../src/scene/piping/grindingClassificationConnection.js';

function closeVec(a, b, tolerance = 1e-6) {
  return a.distanceTo(b) <= tolerance;
}

describe('grinding and classification', () => {
  it('creates a recognizable mill and a generic unvalidated classification skid', () => {
    const system = createEquipmentSystem();
    const mill = system.getEquipment('MILL-01');
    const classifier = system.getEquipment('CLASS-01');
    expect(mill.type).toBe('grinding-mill');
    expect(mill.group3D.getObjectByName('MILL-01-shell')).toBeTruthy();
    expect(classifier.type).toBe('generic-classification-skid');
    expect(classifier.metadata.genericPlaceholder).toBe(true);
    expect(classifier.metadata.validatedProcessModel).toBe(false);
    expect(mill.group3D.getObjectByName('MILL-01-access-ladder-rail')).toBeTruthy();
    expect(mill.group3D.getObjectByName('MILL-01-drive-gearbox')).toBeTruthy();
    expect(classifier.group3D.getObjectByName('CLASS-01-access-ladder-rail')).toBeTruthy();
    expect(classifier.group3D.getObjectByName('CLASS-01-manifold-drop-1')).toBeTruthy();
  });

  it('connects stockpile reclaim exactly to mill feed with CV-03', () => {
    const system = createEquipmentSystem();
    const frontEnd = createMineralFrontEnd();
    const millFeed = system.getPortWorldPosition('MILL-01', 'feed');
    const result = createGrindingFeedConveyor({
      stockpileReclaim: frontEnd.transferPoints.stockpileReclaim,
      millFeed,
    });
    const route = result.conveyor.userData.routePoints;
    expect(route[0]).toEqual(frontEnd.transferPoints.stockpileReclaim.toArray());
    expect(route.at(-1)).toEqual(millFeed.toArray());
  });

  it('connects mill discharge port-to-port with classification inlet', () => {
    const system = createEquipmentSystem();
    const result = createGrindingClassificationConnection({ equipmentSystem: system });
    const start = system.getPortWorldPosition('MILL-01', 'discharge');
    const end = system.getPortWorldPosition('CLASS-01', 'inlet');
    const points = result.group.userData.routePoints;
    const first = { x: points[0][0], y: points[0][1], z: points[0][2] };
    const last = { x: points.at(-1)[0], y: points.at(-1)[1], z: points.at(-1)[2] };
    expect(closeVec(start, new THREE.Vector3(first.x, first.y, first.z))).toBe(true);
    expect(closeVec(end, new THREE.Vector3(last.x, last.y, last.z))).toBe(true);
  });
});
