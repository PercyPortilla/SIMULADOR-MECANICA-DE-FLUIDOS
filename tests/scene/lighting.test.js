import { describe, expect, it } from 'vitest';
import { createBaseScene } from '../../src/scene/baseEnvironment.js';

describe('industrial lighting', () => {
  it('keeps a shadow-casting sun key sized for the expanded mine + plant footprint', () => {
    const base = createBaseScene();
    const key = base.environmentRoot.getObjectByName('mine-sun-key-light');
    expect(key).toBeTruthy();
    expect(key.castShadow).toBe(true);
    expect(key.shadow.camera.left).toBeLessThanOrEqual(-300);
    expect(key.shadow.camera.right).toBeGreaterThanOrEqual(300);
    expect(key.shadow.camera.top).toBeGreaterThanOrEqual(250);
    expect(key.shadow.camera.bottom).toBeLessThanOrEqual(-250);
    expect(key.shadow.camera.far).toBeGreaterThanOrEqual(700);
  });

  it('adds a non-shadow fill without introducing fog', () => {
    const base = createBaseScene();
    const fill = base.environmentRoot.getObjectByName('soft-fill-light');
    expect(fill).toBeTruthy();
    expect(fill.castShadow).toBe(false);
    expect(fill.intensity).toBeGreaterThan(0);
    expect(fill.intensity).toBeLessThan(0.7);
    expect(base.scene.fog).toBeNull();
  });
});
