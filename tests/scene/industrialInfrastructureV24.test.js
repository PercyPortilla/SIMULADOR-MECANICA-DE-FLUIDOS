import { describe, expect, it } from 'vitest';
import { createIndustrialInfrastructure } from '../../src/scene/infrastructure/industrialInfrastructure.js';
import { createRoadAlignment } from '../../src/scene/environment/haulRoads.js';
import { createMineProps } from '../../src/scene/environment/mineProps.js';

function minRoadDistance(x, z, roadId, samples = 800) {
  const curve = createRoadAlignment(roadId);
  let min = Infinity;
  for (let index = 0; index <= samples; index += 1) {
    const p = curve.getPoint(index / samples);
    min = Math.min(min, Math.hypot(x - p.x, z - p.z));
  }
  return min;
}

describe('V24 Bloque 6 - infraestructura industrial', () => {
  it('adds only missing utility/maintenance/scale cues and reuses existing control/lighting assets', () => {
    const root = createIndustrialInfrastructure();
    expect(root.userData.v24IndustrialInfrastructure).toBe(true);
    expect(root.userData.assetCount).toBe(5);
    expect(root.userData.reusesExistingControlBuilding).toBe(true);
    expect(root.userData.reusesExistingLightingPoles).toBe(true);
    expect(root.getObjectByName('v24-transformer-yard')).toBeTruthy();
    expect(root.getObjectByName('v24-maintenance-workshop')).toBeTruthy();
    expect(root.getObjectByName('v24-electrical-cable-tray')).toBeTruthy();
    expect(root.getObjectByName('v24-supervision-pickup')).toBeTruthy();
    expect(root.getObjectByName('v24-human-scale-workshop')?.userData.referenceHeightM).toBeCloseTo(1.75, 6);
    expect(root.getObjectByName('v24-human-scale-recovery')).toBeFalsy();
  });

  it('keeps new infrastructure outside the service-road operating envelope', () => {
    const root = createIndustrialInfrastructure();
    for (const name of ['v24-transformer-yard', 'v24-maintenance-workshop', 'v24-electrical-cable-tray', 'v24-supervision-pickup']) {
      const object = root.getObjectByName(name);
      const [x, z] = object.userData.centerXZ;
      expect(minRoadDistance(x, z, 'ROAD-02'), `${name} vs ROAD-02`).toBeGreaterThan(12.0);
    }
  });

  it('keeps the reused MCC and first lighting pole out of the road envelopes', () => {
    const props = createMineProps();
    const control = props.getObjectByName('control-mcc-building');
    const pole = props.getObjectByName('lighting-pole-1');
    expect(minRoadDistance(control.position.x, control.position.z, 'ROAD-04')).toBeGreaterThan(20.0);
    expect(minRoadDistance(control.position.x, control.position.z, 'ROAD-02')).toBeGreaterThan(25.0);
    expect(minRoadDistance(pole.position.x, pole.position.z, 'ROAD-01')).toBeGreaterThan(12.0);
  });
});
