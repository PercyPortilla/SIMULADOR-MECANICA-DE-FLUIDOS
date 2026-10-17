import { describe, expect, it } from 'vitest';
import { createIntegratedPlant } from '../../src/scene/integration/integratedPlant.js';
import { createProcessInstrumentation, INSTRUMENT_SPECS } from '../../src/scene/infrastructure/processInstrumentation.js';

describe('V24 Bloque 4 - instrumentación visual', () => {
  it('adds compact PI/PT/FT/LT visuals without solver coupling', () => {
    const plant = createIntegratedPlant();
    const instrumentation = createProcessInstrumentation({ equipmentSystem: plant });
    expect(instrumentation.instruments).toHaveLength(INSTRUMENT_SPECS.length);
    expect(instrumentation.root.userData.visualOnly).toBe(true);
    expect(instrumentation.root.userData.solverCoupled).toBe(false);
    const types = new Set(instrumentation.instruments.map((item) => item.userData.instrumentType));
    expect([...types].sort()).toEqual(['FT', 'LT', 'PI', 'PT']);
    instrumentation.instruments.forEach((instrument) => {
      expect(instrument.userData.visualOnly).toBe(true);
      expect(instrument.userData.solverCoupled).toBe(false);
      expect(instrument.userData.sourceVariable).toBeNull();
      expect(instrument.getObjectByName(`${instrument.name}-visual-branch`)).toBeTruthy();
    });
  });

  it('does not move equipment transforms or authoritative ports', () => {
    const plant = createIntegratedPlant();
    const ids = ['SLURRY-PUMP-01', 'PUMP-01', 'CLASS-01', 'R-01', 'R-02', 'R-03', 'R-04', 'CIP-ADSORPTION', 'ELUTION-SKID', 'EW-CELLS'];
    const transforms = new Map(ids.map((id) => {
      const root = plant.getEquipment(id).group3D;
      return [id, { position: root.position.clone(), quaternion: root.quaternion.clone(), scale: root.scale.clone() }];
    }));
    const ports = INSTRUMENT_SPECS.map((spec) => ({
      key: `${spec.equipmentId}.${spec.portId}`,
      point: plant.getPortWorldPosition(spec.equipmentId, spec.portId),
    }));

    createProcessInstrumentation({ equipmentSystem: plant });

    ids.forEach((id) => {
      const root = plant.getEquipment(id).group3D;
      const before = transforms.get(id);
      expect(root.position.distanceTo(before.position)).toBeLessThan(1e-12);
      expect(root.quaternion.angleTo(before.quaternion)).toBeLessThan(1e-12);
      expect(root.scale.distanceTo(before.scale)).toBeLessThan(1e-12);
    });
    ports.forEach(({ key, point }) => {
      const [equipmentId, portId] = key.split('.');
      expect(plant.getPortWorldPosition(equipmentId, portId).distanceTo(point)).toBeLessThan(1e-12);
    });
  });
});
