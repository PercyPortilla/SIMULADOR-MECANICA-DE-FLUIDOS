import { describe, expect, it } from 'vitest';
import { createBallMillAsset } from '../../src/equipment/grinding/ballMill.js';

describe('Ball mill isolated rotating assembly', () => {
  it('rotates only rotatingGroup and keeps staticGroup fixed', () => {
    const mill = createBallMillAsset();
    const staticBefore = mill.staticGroup.rotation.clone();
    const rotatingBefore = mill.rotatingGroup.rotation.clone();
    mill.update(1);
    expect(mill.rotatingGroup.rotation.x).not.toBe(rotatingBefore.x);
    expect(mill.staticGroup.rotation.x).toBe(staticBefore.x);
    expect(mill.staticGroup.rotation.y).toBe(staticBefore.y);
    expect(mill.staticGroup.rotation.z).toBe(staticBefore.z);
    expect(mill.axisY).toBeGreaterThan(2.25);
    mill.dispose();
  });

  it('freezes and resumes without resetting the rotating state', () => {
    const mill = createBallMillAsset();
    mill.update(0.5);
    const angle = mill.rotatingGroup.rotation.x;
    mill.setAnimationEnabled(false);
    mill.update(1);
    expect(mill.rotatingGroup.rotation.x).toBe(angle);
    mill.setAnimationEnabled(true);
    mill.update(0.5);
    expect(mill.rotatingGroup.rotation.x).not.toBe(angle);
    mill.dispose();
  });
});
