import { describe, expect, it } from 'vitest';
import { createBaseScene } from '../../src/scene/baseEnvironment.js';

function meshShadowStats(root) {
  const stats = { meshes: 0, cast: 0, receive: 0 };
  root.traverse((object) => {
    if (!object.isMesh) return;
    stats.meshes += 1;
    if (object.castShadow) stats.cast += 1;
    if (object.receiveShadow) stats.receive += 1;
  });
  return stats;
}

describe('V24E zone lighting readability', () => {
  it('keeps reception fully integrated with the shadow model', () => {
    const base = createBaseScene();
    const reception = base.scene.getObjectByName('ROM-HOPPER');
    const stats = meshShadowStats(reception);
    expect(stats.meshes).toBeGreaterThan(0);
    expect(stats.cast).toBeGreaterThan(0);
    expect(stats.receive).toBeGreaterThan(0);
  });

  it('centers the key sun on the expanded mine+plant site instead of the world origin', () => {
    const base = createBaseScene();
    const key = base.environmentRoot.getObjectByName('mine-sun-key-light');
    const target = base.environmentRoot.getObjectByName('mine-sun-target');
    expect(key?.userData.lightingRole).toBe('key-sun');
    expect(target).toBeTruthy();
    expect(key.target).toBe(target);
    expect(key.shadow.camera.right - key.shadow.camera.left).toBeGreaterThan(700);
  });

  it('gives all reactor mesh details consistent cast/receive shadows', () => {
    const base = createBaseScene();
    const reactor = base.scene.getObjectByName('R-01');
    const stats = meshShadowStats(reactor);
    expect(stats.meshes).toBeGreaterThan(0);
    expect(stats.cast).toBeGreaterThan(0);
    expect(stats.receive).toBeGreaterThan(0);
  });

  it('gives recovery equipment consistent mesh shadows without changing fog', () => {
    const base = createBaseScene();
    for (const id of ['CIP-ADSORPTION', 'ELUTION-SKID', 'EW-CELLS', 'SMELTING-FURNACE']) {
      const equipment = base.scene.getObjectByName(id);
      const stats = meshShadowStats(equipment);
      expect(stats.meshes).toBeGreaterThan(0);
      expect(stats.cast).toBeGreaterThan(0);
      expect(stats.receive).toBeGreaterThan(0);
    }
    expect(base.scene.fog).toBeNull();
  });
});
