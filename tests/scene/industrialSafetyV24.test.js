import { describe, expect, it } from 'vitest';
import { createIndustrialSafety } from '../../src/scene/infrastructure/industrialSafety.js';
import { createRoadAlignment } from '../../src/scene/environment/haulRoads.js';

function minimumRoadDistanceXZ(point, curve, samples = 800) {
  let min = Infinity;
  for (let index = 0; index <= samples; index += 1) {
    const sample = curve.getPoint(index / samples);
    min = Math.min(min, Math.hypot(point.x - sample.x, point.z - sample.z));
  }
  return min;
}

describe('V24 Bloque 5 - seguridad industrial', () => {
  it('creates purposeful safety stations, eyewash, fence/gate and pedestrian markers', () => {
    const root = createIndustrialSafety();
    expect(root.userData.v24IndustrialSafety).toBe(true);
    expect(root.userData.signCount).toBe(8);
    expect(root.userData.extinguisherCount).toBe(6);
    expect(root.getObjectByName('recovery-eyewash-shower')?.userData.safetyRole).toBe('eyewash-shower');
    expect(root.getObjectByName('recovery-fence-west')).toBeTruthy();
    expect(root.getObjectByName('recovery-fence-east')).toBeTruthy();
    expect(root.getObjectByName('recovery-restricted-gate')?.userData.safetyRole).toBe('restricted-area-gate');
    expect(root.getObjectByName('v24-recovery-pedestrian-markers')).toBeTruthy();
  });

  it('keeps the recovery fence clear of the encoded ROAD-04 centerline', () => {
    const root = createIndustrialSafety();
    const road = createRoadAlignment('ROAD-04');
    for (const name of ['recovery-fence-west', 'recovery-fence-east']) {
      const object = root.getObjectByName(name);
      const [x, z] = object.userData.centerXZ;
      const point = { x, z };
      expect(minimumRoadDistanceXZ(point, road)).toBeGreaterThan(8.0);
    }
    const gate = root.getObjectByName('recovery-restricted-gate');
    expect(minimumRoadDistanceXZ(gate.position, road)).toBeGreaterThan(8.0);
  });
});
