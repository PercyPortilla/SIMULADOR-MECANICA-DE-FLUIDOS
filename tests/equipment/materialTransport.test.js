import { describe, expect, it } from 'vitest';
import { createApronFeederAsset } from '../../src/equipment/crushing/apronFeeder.js';
import { createRomHopperAsset } from '../../src/equipment/crushing/romHopper.js';
import { createConveyorAsset } from '../../src/equipment/conveying/conveyor.js';
import { createStockpileReclaimEquipment } from '../../src/scene/integration/supportEquipment.js';
import { createIntegratedPlant } from '../../src/scene/integration/integratedPlant.js';

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

  it('freezes and resumes apron feeder motion with the global animation contract', () => {
    const asset = createApronFeederAsset();
    const pan = asset.root.getObjectByName('apron-pan-0');
    const rotor = asset.root.getObjectByName('feeder-shaft-pivot--3.82');
    asset.update(0.1);
    asset.setAnimationEnabled(false);
    const frozenPan = pan.position.clone();
    const frozenRotor = rotor.rotation.z;
    asset.update(0.1);
    expect(pan.position.distanceTo(frozenPan)).toBeLessThan(1e-12);
    expect(rotor.rotation.z).toBeCloseTo(frozenRotor, 12);
    asset.setAnimationEnabled(true);
    asset.update(0.1);
    expect(pan.position.distanceTo(frozenPan)).toBeGreaterThan(0);
    expect(rotor.rotation.z).not.toBeCloseTo(frozenRotor, 12);
  });

  it('vibrates the ROM grizzly and respects Animaciones ON/OFF', () => {
    const asset = createRomHopperAsset();
    const grizzly = asset.root.getObjectByName('rom-grizzly');
    expect(grizzly).toBeTruthy();
    asset.update(0.1);
    const moving = grizzly.position.clone();
    expect(moving.length()).toBeGreaterThan(0);
    asset.setAnimationEnabled(false);
    asset.update(0.1);
    expect(grizzly.position.distanceTo(moving)).toBeLessThan(1e-12);
    asset.setAnimationEnabled(true);
    asset.update(0.1);
    expect(grizzly.position.distanceTo(moving)).toBeGreaterThan(0);
  });

  it('moves only the stockpile reclaim feeder/grizzly/ore overlay', () => {
    const equipment = createStockpileReclaimEquipment();
    const staticHopper = equipment.group3D.getObjectByName('STOCKPILE-RECLAIM-hopper');
    const feederBed = equipment.group3D.getObjectByName('STOCKPILE-RECLAIM-reclaim-feeder-bed');
    const grizzly = equipment.group3D.getObjectByName('STOCKPILE-RECLAIM-reclaim-grizzly');
    const ore = equipment.group3D.getObjectByName('STOCKPILE-RECLAIM-reclaim-ore-1');
    const hopperBefore = staticHopper.position.clone();
    const feederBefore = feederBed.position.clone();
    const grizzlyBefore = grizzly.position.clone();
    const oreBefore = ore.position.clone();
    equipment.update(0.1);
    expect(staticHopper.position.distanceTo(hopperBefore)).toBeLessThan(1e-12);
    expect(feederBed.position.distanceTo(feederBefore)).toBeGreaterThan(0);
    expect(grizzly.position.distanceTo(grizzlyBefore)).toBeGreaterThan(0);
    expect(ore.position.distanceTo(oreBefore)).toBeGreaterThan(0);
  });

  it('freezes and resumes stockpile reclaim motion through the integrated Animaciones toggle', () => {
    const plant = createIntegratedPlant();
    const ore = plant.stockpile.group3D.getObjectByName('STOCKPILE-RECLAIM-reclaim-ore-1');
    plant.updateAssets(0.1);
    plant.setAnimationsEnabled(false);
    const frozen = ore.position.clone();
    plant.updateAssets(0.1);
    expect(ore.position.distanceTo(frozen)).toBeLessThan(1e-12);
    plant.setAnimationsEnabled(true);
    plant.updateAssets(0.1);
    expect(ore.position.distanceTo(frozen)).toBeGreaterThan(0);
  });
});
