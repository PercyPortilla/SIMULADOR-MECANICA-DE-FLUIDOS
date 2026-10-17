import { describe, expect, it } from 'vitest';
import { createEquipmentSystem } from '../../src/scene/equipment/equipmentSystem.js';
import { createLeachingTrainPiping } from '../../src/scene/piping/leachingTrainPiping.js';
import { createPipe1System } from '../../src/scene/piping/pipe1.js';
import { LEACHING_REACTOR_IDS } from '../../src/scene/equipment/leachingTrain.js';
import { getZoneTransform } from '../../src/scene/layout/plantLayout.js';

function expectVectorClose(actual, expected, precision = 6) {
  expect(actual.x).toBeCloseTo(expected.x, precision);
  expect(actual.y).toBeCloseTo(expected.y, precision);
  expect(actual.z).toBeCloseTo(expected.z, precision);
}

describe('leaching train', () => {
  it('creates four reusable reactors inside Z6 with valid ports', () => {
    const system = createEquipmentSystem();
    const zone = getZoneTransform('Z6');
    expect(LEACHING_REACTOR_IDS).toEqual(['R-01', 'R-02', 'R-03', 'R-04']);

    LEACHING_REACTOR_IDS.forEach((id) => {
      const reactor = system.getEquipment(id);
      expect(reactor.type).toBe('leach-reactor');
      expect(reactor.metadata.label).toBe(id);
      expect(reactor.metadata.zoneId).toBe('Z6');
      expect(Math.abs(reactor.group3D.position.x - zone.position.x)).toBeLessThan(zone.width / 2);
      expect(Math.abs(reactor.group3D.position.z - zone.position.z)).toBeLessThan(zone.depth / 2);
      expect(system.getPort(id, 'inlet')).toBeTruthy();
      expect(system.getPort(id, 'outlet')).toBeTruthy();
      expect(reactor.group3D.getObjectByName(`${id}-access-ladder-rail`)).toBeTruthy();
      expect(reactor.group3D.getObjectByName(`${id}-mid-safety-rail`)).toBeTruthy();
    });
  });

  it('uses Pipe 1 as the real R-01 to R-02 interstage connection', () => {
    const equipmentSystem = createEquipmentSystem();
    const pipe1 = createPipe1System({ equipmentSystem });
    const mesh = pipe1.update({ innerDiameterM: 0.05, lengthM: 1.2, roughnessM: 0, material: 'steel', velocityMps: 0 });

    expect(mesh).toBeTruthy();
    expect(mesh.userData.targetEquipmentId).toBe('R-02');
    expect(mesh.userData.targetPortId).toBe('inlet');
    expect(mesh.userData.lengthM).toBeCloseTo(1.2, 6);
    expectVectorClose(equipmentSystem.getPortWorldPosition('R-02', 'inlet'), { x: mesh.userData.end[0], y: mesh.userData.end[1], z: mesh.userData.end[2] });
  });

  it('connects R-02→R-03→R-04 port-to-port with continuous routes', () => {
    const equipmentSystem = createEquipmentSystem();
    const piping = createLeachingTrainPiping({ equipmentSystem });
    expect(piping.connections).toHaveLength(2);

    piping.connections.forEach((connection) => {
      const group = piping.engine.getConnectionGroup(connection.id);
      const points = group.userData.routePoints;
      expect(points.length).toBeGreaterThanOrEqual(2);
      const source = equipmentSystem.getPortWorldPosition(connection.source.equipmentId, connection.source.portId);
      const target = equipmentSystem.getPortWorldPosition(connection.target.equipmentId, connection.target.portId);
      expect(points[0][0]).toBeCloseTo(source.x, 6);
      expect(points[0][1]).toBeCloseTo(source.y, 6);
      expect(points[0][2]).toBeCloseTo(source.z, 6);
      const last = points.at(-1);
      expect(last[0]).toBeCloseTo(target.x, 6);
      expect(last[1]).toBeCloseTo(target.y, 6);
      expect(last[2]).toBeCloseTo(target.z, 6);
    });
  });
});
