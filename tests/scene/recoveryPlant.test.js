import { describe, expect, it } from 'vitest';
import { createEquipmentSystem } from '../../src/scene/equipment/equipmentSystem.js';
import { createRecoveryConnections } from '../../src/scene/piping/recoveryConnections.js';
import { getProcessRoute } from '../../src/process/processRoute.js';
import { getZoneTransform } from '../../src/scene/layout/plantLayout.js';

function expectEndpoint(actual, expected, precision = 6) {
  expect(actual[0]).toBeCloseTo(expected.x, precision);
  expect(actual[1]).toBeCloseTo(expected.y, precision);
  expect(actual[2]).toBeCloseTo(expected.z, precision);
}

describe('recovery plant Z8', () => {
  it('creates exactly the equipment declared by the renderable recovery route', () => {
    const system = createEquipmentSystem();
    const route = getProcessRoute();
    const zone = getZoneTransform('Z8');
    const ids = ['CIP-ADSORPTION', 'ELUTION-SKID', 'EW-CELLS', 'SMELTING-FURNACE'];

    expect(route.validation.canRender3D).toBe(true);
    expect(route.validation.canCalculateRecovery).toBe(true);
    expect(route.recoveryModel.requiresExplicitStageEfficiencies).toBe(true);
    expect(route.recoveryModel.predictsIntrinsicEfficiency).toBe(false);
    ids.forEach((id) => {
      const equipment = system.getEquipment(id);
      expect(equipment.metadata.zoneId).toBe('Z8');
      expect(equipment.group3D.position.x).toBeGreaterThanOrEqual(zone.position.x - zone.width / 2);
      expect(equipment.group3D.position.x).toBeLessThanOrEqual(zone.position.x + zone.width / 2);
      expect(equipment.group3D.position.z).toBeGreaterThanOrEqual(zone.position.z - zone.depth / 2);
      expect(equipment.group3D.position.z).toBeLessThanOrEqual(zone.position.z + zone.depth / 2);
    });
  });

  it('connects pump, CIP, elution and EW exactly port-to-port', () => {
    const system = createEquipmentSystem();
    const recovery = createRecoveryConnections({ equipmentSystem: system });
    const checks = [
      ['P-PUMP-01-TO-CIP', 'PUMP-01', 'discharge', 'CIP-ADSORPTION', 'inlet'],
      ['P-CIP-TO-ELUTION', 'CIP-ADSORPTION', 'outlet', 'ELUTION-SKID', 'inlet'],
      ['P-ELUTION-TO-EW', 'ELUTION-SKID', 'outlet', 'EW-CELLS', 'inlet'],
    ];

    checks.forEach(([id, sourceEquipment, sourcePort, targetEquipment, targetPort]) => {
      const group = recovery.engine.getConnectionGroup(id);
      const points = group.userData.routePoints;
      expectEndpoint(points[0], system.getPortWorldPosition(sourceEquipment, sourcePort));
      expectEndpoint(points.at(-1), system.getPortWorldPosition(targetEquipment, targetPort));
    });
  });

  it('uses a non-hydraulic product transfer from EW to smelting and exposes doré', () => {
    const system = createEquipmentSystem();
    const recovery = createRecoveryConnections({ equipmentSystem: system });
    expect(recovery.productTransfer.userData.transferType).toBe('solid-product');
    expect(recovery.productTransfer.userData.connectionId).toBe('REC-C03');
    expect(system.getEquipment('SMELTING-FURNACE').metadata.finalProductId).toBe('DORE');
    expect(system.getEquipment('SMELTING-FURNACE').group3D.getObjectByName('SMELTING-FURNACE-dore-product')).toBeTruthy();
  });
});

describe('recovery equipment visual identity', () => {
  it('gives every recovery stage a distinct silhouette without changing its route ports', () => {
    const system = createEquipmentSystem();
    const cip = system.getEquipment('CIP-ADSORPTION').group3D;
    const elution = system.getEquipment('ELUTION-SKID').group3D;
    const ew = system.getEquipment('EW-CELLS').group3D;
    const smelting = system.getEquipment('SMELTING-FURNACE').group3D;

    expect(cip.getObjectByName('CIP-ADSORPTION-upper-manifold')).toBeTruthy();
    expect(cip.getObjectByName('CIP-ADSORPTION-access-deck')).toBeTruthy();
    expect(elution.getObjectByName('ELUTION-SKID-heat-exchanger')).toBeTruthy();
    expect(elution.getObjectByName('ELUTION-SKID-service-deck')).toBeTruthy();
    expect(ew.getObjectByName('EW-CELLS-cell-5')).toBeTruthy();
    expect(ew.getObjectByName('EW-CELLS-busbar-a')).toBeTruthy();
    expect(smelting.getObjectByName('SMELTING-FURNACE-hearth')).toBeTruthy();
    expect(smelting.getObjectByName('SMELTING-FURNACE-service-platform')).toBeTruthy();
  });
});
