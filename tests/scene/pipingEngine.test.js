import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createEquipmentSystem } from '../../src/scene/equipment/equipmentSystem.js';
import {
  buildOrthogonalRoute,
  createPipingEngine,
  createReducerMesh,
  getRenderedPipeDiameter,
  validateRoutePoints,
} from '../../src/scene/piping/pipingEngine.js';

function expectPointEqual(actual, expected, precision = 8) {
  expect(actual[0]).toBeCloseTo(expected.x, precision);
  expect(actual[1]).toBeCloseTo(expected.y, precision);
  expect(actual[2]).toBeCloseTo(expected.z, precision);
}

describe('universal piping engine', () => {
  it('builds deterministic orthogonal routes without duplicate zero-length segments', () => {
    const start = new THREE.Vector3(1, 2, 3);
    const end = new THREE.Vector3(5, 4, 8);
    const route = buildOrthogonalRoute({ start, end });

    expect(route[0].equals(start)).toBe(true);
    expect(route.at(-1).equals(end)).toBe(true);
    for (let index = 0; index < route.length - 1; index += 1) {
      expect(route[index].distanceTo(route[index + 1])).toBeGreaterThan(0);
    }
  });

  it('rejects duplicate consecutive route points', () => {
    expect(() => validateRoutePoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0),
    ])).toThrow(/epsilon/);
  });

  it('renders source-port to target-port and keeps every segment continuous', () => {
    const equipment = createEquipmentSystem();
    const source = equipment.getPortWorldPosition('R-01', 'outlet');
    const target = equipment.getPortWorldPosition('R-02', 'inlet');

    const engine = createPipingEngine({ equipmentSystem: equipment });
    const group = engine.renderConnection({
      id: 'TEST-CONNECTION',
      source: { equipmentId: 'R-01', portId: 'outlet' },
      target: { equipmentId: 'R-02', portId: 'inlet' },
      nominalDiameterM: 0.05,
      waypoints: [],
    });

    expectPointEqual(group.userData.routePoints[0], source);
    expectPointEqual(group.userData.routePoints.at(-1), target);
    const segments = group.children.filter((child) => child.name.includes('segment'));
    expect(segments.length).toBeGreaterThan(0);
    for (let index = 0; index < segments.length - 1; index += 1) {
      expect(segments[index].userData.end).toEqual(segments[index + 1].userData.start);
    }
  });

  it('creates elbows only at route joints and keeps one rendered diameter for equal nominal diameter', () => {
    const equipment = createEquipmentSystem();
    const source = equipment.getPortWorldPosition('R-01', 'outlet');
    const target = equipment.getPortWorldPosition('R-04', 'inlet');
    const engine = createPipingEngine({ equipmentSystem: equipment });
    const group = engine.renderConnection({
      id: 'ORTHO',
      source: { equipmentId: 'R-01', portId: 'outlet' },
      target: { equipmentId: 'R-04', portId: 'inlet' },
      nominalDiameterM: 0.025,
      waypoints: [[source.x + 4, source.y, source.z], [source.x + 4, source.y, target.z]],
    });
    const segments = group.children.filter((child) => child.name.includes('segment'));
    const elbows = group.children.filter((child) => child.name.includes('elbow'));

    expect(elbows).toHaveLength(1);
    expect(group.userData.renderedDiameterM).toBe(getRenderedPipeDiameter(0.025));
    segments.forEach((segment) => {
      expect(segment.geometry.parameters.radiusTop * 2).toBeCloseTo(group.userData.renderedDiameterM, 8);
      expect(segment.geometry.parameters.radiusBottom * 2).toBeCloseTo(group.userData.renderedDiameterM, 8);
    });
  });

  it('creates a reducer only when explicitly requested', () => {
    const material = new THREE.MeshBasicMaterial();
    const reducer = createReducerMesh(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(1, 0, 0),
      0.05,
      0.025,
      material,
    );
    expect(reducer.userData.fittingType).toBe('reducer');
    expect(reducer.userData.startDiameterM).toBe(0.05);
    expect(reducer.userData.endDiameterM).toBe(0.025);
  });
});
