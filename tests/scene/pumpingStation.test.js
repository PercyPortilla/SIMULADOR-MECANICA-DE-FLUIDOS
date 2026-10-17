import { describe, expect, it } from 'vitest';
import { createEquipmentSystem } from '../../src/scene/equipment/equipmentSystem.js';
import { createPumpingStationConnection } from '../../src/scene/piping/pumpingStationConnection.js';
import { getZoneTransform } from '../../src/scene/layout/plantLayout.js';
import { getTerrainHeight } from '../../src/scene/environment/terrainHeight.js';

function expectVectorClose(actual, expected, precision = 6) {
  expect(actual.x).toBeCloseTo(expected.x, precision);
  expect(actual.y).toBeCloseTo(expected.y, precision);
  expect(actual.z).toBeCloseTo(expected.z, precision);
}

describe('pumping station', () => {
  it('creates one recognizable slurry pump in Z7 with suction/discharge ports', () => {
    const system = createEquipmentSystem();
    const pump = system.getEquipment('PUMP-01');
    const zone = getZoneTransform('Z7');

    expect(pump.type).toBe('slurry-pump');
    expect(pump.metadata.zoneId).toBe('Z7');
    expect(system.getPort('PUMP-01', 'suction').type).toBe('suction');
    expect(system.getPort('PUMP-01', 'discharge').type).toBe('discharge');
    expect(pump.group3D.position.x).toBeCloseTo(zone.position.x, 6);
    expect(pump.group3D.position.z).toBeCloseTo(zone.position.z, 6);
    expect(pump.group3D.position.y).toBeCloseTo(getTerrainHeight(zone.position.x, zone.position.z), 6);
    expect(pump.group3D.getObjectByName('PUMP-01-pad')).toBeTruthy();
    expect(pump.group3D.getObjectByName('PUMP-01-volute-casing')).toBeTruthy();
    expect(pump.group3D.getObjectByName('PUMP-01-motor')).toBeTruthy();
  });

  it('connects R-04 outlet exactly to PUMP-01 suction', () => {
    const equipmentSystem = createEquipmentSystem();
    const piping = createPumpingStationConnection({ equipmentSystem });
    const group = piping.engine.getConnectionGroup('P-LEACHING-TO-PUMP-01');
    const points = group.userData.routePoints;

    const source = equipmentSystem.getPortWorldPosition('R-04', 'outlet');
    const target = equipmentSystem.getPortWorldPosition('PUMP-01', 'suction');
    const first = points[0];
    const last = points.at(-1);

    expectVectorClose({ x: first[0], y: first[1], z: first[2] }, source);
    expectVectorClose({ x: last[0], y: last[1], z: last[2] }, target);
  });

  it('leaves discharge free for the future recovery connection', () => {
    const system = createEquipmentSystem();
    const discharge = system.getPort('PUMP-01', 'discharge');
    expect(discharge.nominalDiameterM).toBeGreaterThan(0);
    expect(system.getEquipment('PUMP-01').metadata.futureTargetZoneId).toBe('Z8');
  });
});
