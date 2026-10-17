import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createEquipmentSystem } from '../../src/scene/equipment/equipmentSystem.js';
import { getZoneTransform } from '../../src/scene/layout/plantLayout.js';
import { INDUSTRIAL_PAD_THICKNESS } from '../../src/scene/environment/industrialPads.js';

function expectVectorClose(actual, expected, precision = 6) {
  expect(actual.x).toBeCloseTo(expected.x, precision);
  expect(actual.y).toBeCloseTo(expected.y, precision);
  expect(actual.z).toBeCloseTo(expected.z, precision);
}

describe('equipment and ports architecture', () => {
  it('registers the reusable leaching train without the temporary piping receiver', () => {
    const system = createEquipmentSystem();
    const zone = getZoneTransform('Z6');
    const reactor = system.getEquipment('R-01');

    expect(system.root.name).toBe('plant-equipment');
    expect(() => system.getEquipment('PT-01')).toThrow();
    ['R-01', 'R-02', 'R-03', 'R-04'].forEach((id) => {
      expect(system.getEquipment(id).type).toBe('leach-reactor');
    });
    expect(reactor.metadata.zoneId).toBe('Z6');
    expect(Math.abs(reactor.group3D.position.x - zone.position.x)).toBeLessThan(zone.width / 2);
    expect(Math.abs(reactor.group3D.position.z - zone.position.z)).toBeLessThan(zone.depth / 2);
    expect(reactor.group3D.position.y).toBeCloseTo(zone.position.y + INDUSTRIAL_PAD_THICKNESS, 6);
  });

  it('moves ports automatically when the equipment moves', () => {
    const system = createEquipmentSystem();
    const reactor = system.getEquipment('R-01');
    const before = system.getPortWorldPosition('R-01', 'outlet');

    reactor.group3D.position.x += 4;
    reactor.group3D.position.z -= 2;
    const after = system.getPortWorldPosition('R-01', 'outlet');

    expect(after.x - before.x).toBeCloseTo(4, 6);
    expect(after.z - before.z).toBeCloseTo(-2, 6);
  });

  it('rotates port positions and directions with the equipment', () => {
    const system = createEquipmentSystem();
    const reactor = system.getEquipment('R-01');
    reactor.group3D.position.set(0, 0, 0);
    reactor.group3D.rotation.y = Math.PI / 2;

    const port = system.getPort('R-01', 'outlet');
    const expectedPosition = port.localPosition.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
    const expectedDirection = port.direction.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);

    expectVectorClose(system.getPortWorldPosition('R-01', 'outlet'), expectedPosition);
    expectVectorClose(system.getPortWorldDirection('R-01', 'outlet'), expectedDirection);
  });

  it('keeps ports coherent with reactor dimensions and exposes finite world transforms', () => {
    const system = createEquipmentSystem();
    const reactor = system.getEquipment('R-01');
    const inlet = system.getPort('R-01', 'inlet');
    const outlet = system.getPort('R-01', 'outlet');
    const radius = reactor.dimensions.diameter / 2;

    expect(Math.abs(inlet.localPosition.x)).toBeGreaterThanOrEqual(radius);
    expect(Math.abs(outlet.localPosition.x)).toBeGreaterThanOrEqual(radius);
    expect(inlet.nominalDiameterM).toBeGreaterThan(0);
    expect(outlet.nominalDiameterM).toBeGreaterThan(0);

    [
      system.getPortWorldPosition('R-01', 'inlet'),
      system.getPortWorldPosition('R-01', 'outlet'),
      system.getPortWorldDirection('R-01', 'inlet'),
      system.getPortWorldDirection('R-01', 'outlet'),
    ].forEach((vector) => {
      expect(Number.isFinite(vector.x)).toBe(true);
      expect(Number.isFinite(vector.y)).toBe(true);
      expect(Number.isFinite(vector.z)).toBe(true);
    });
  });
});
