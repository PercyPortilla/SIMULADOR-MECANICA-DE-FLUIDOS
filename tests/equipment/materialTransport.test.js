import { describe, expect, it } from 'vitest';
import { createApronFeederAsset } from '../../src/equipment/crushing/apronFeeder.js';
import { createConveyorAsset } from '../../src/equipment/conveying/conveyor.js';

describe('solid material transport motion', () => {
  it('advances belt travel, ore and pulley rotation from one conveyor speed', () => {
    const asset = createConveyorAsset({ length: 18, width: 1.5, incline: 0.08 });
    const belt = asset.root.getObjectByName('conveyor-belt');
    const ore = asset.root.getObjectByName('conveyor-ore-0');
    const head = asset.root.getObjectByName('conveyor-head-pulley-pivot');
    const before = { travel: belt.userData.beltTravelM, oreX: ore.position.x, rotor: head.rotation.z };
    asset.update(0.1, 0.1);
    expect(belt.userData.beltTravelM).toBeGreaterThan(before.travel);
    expect(ore.position.x).toBeGreaterThan(before.oreX);
    expect(head.rotation.z).toBeLessThan(before.rotor);
    expect(belt.userData.beltSpeedMps).toBeCloseTo((ore.position.x - before.oreX) / 0.1, 6);
  });

  it('moves apron pans continuously around a closed upper/return loop', () => {
    const asset = createApronFeederAsset();
    const pan = asset.root.getObjectByName('apron-pan-0');
    let previous = pan.position.clone();
    let maxStep = 0;
    let sawReturnBranch = false;
    for (let index = 0; index < 500; index += 1) {
      asset.update(0.1, index * 0.1);
      maxStep = Math.max(maxStep, pan.position.distanceTo(previous));
      if (pan.position.y < 0.7) sawReturnBranch = true;
      previous = pan.position.clone();
    }
    expect(maxStep).toBeLessThan(0.08);
    expect(sawReturnBranch).toBe(true);
  });
});
