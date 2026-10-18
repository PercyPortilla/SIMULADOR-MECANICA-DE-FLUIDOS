import { describe, expect, it } from 'vitest';
import { createBaseScene } from '../../src/scene/baseEnvironment.js';
import { createIntegratedMobile } from '../../src/scene/integration/integratedMobile.js';
import { createIntegratedPlant } from '../../src/scene/integration/integratedPlant.js';
import { IntegratedEquipmentRegistry } from '../../src/scene/integration/assetIntegrationLayer.js';
import { createJawCrusherAsset } from '../../src/equipment/crushing/jawCrusher.js';
import { createSlurryPumpAsset } from '../../src/equipment/classification/slurryPump.js';
import * as THREE from 'three';

describe('V29 operational machinery animation contract', () => {
  it('keeps crusher ore moving and aligns the slurry-pump impeller with the shaft X axis', () => {
    const crusher = createJawCrusherAsset();
    const oreFlow = crusher.root.getObjectByName('PRIMARY-CRUSHER-v29-ore-flow');
    const rock = oreFlow?.getObjectByName('crusher-ore-0');
    const beforeY = rock.position.y;
    crusher.update(0.5, 3.0);
    expect(oreFlow?.userData.proceduralMaterialFlow).toBe(true);
    expect(rock.position.y).not.toBeCloseTo(beforeY, 6);

    const pump = createSlurryPumpAsset();
    const impeller = pump.root.getObjectByName('pump-impeller');
    const visual = pump.root.getObjectByName('pump-impeller-visual');
    const beforeX = impeller.rotation.x;
    pump.update(0.25, 1.0);
    expect(impeller.userData.rotationAxis).toBe('x');
    expect(visual.rotation.y).toBeCloseTo(Math.PI / 2, 8);
    expect(impeller.rotation.x).not.toBeCloseTo(beforeX, 6);
    expect(impeller.rotation.z).toBeCloseTo(0, 8);
  });

  it('gives the dedicated ROM loader a meaningful trim cycle and freezes it with Animaciones OFF', () => {
    const mobile = createIntegratedMobile({
      plantRoot: new THREE.Group(),
      registry: new IntegratedEquipmentRegistry(),
    });
    const loader = mobile.romLoader;
    const articulation = loader.root.getObjectByName('loader-articulation');
    const arm = loader.root.getObjectByName('loader-arm-pivot');
    const bucket = loader.root.getObjectByName('loader-bucket-pivot');
    const startArm = arm.rotation.z;
    const startBucket = bucket.rotation.z;
    const startPosition = loader.root.position.clone();

    for (let index = 0; index < 90; index += 1) mobile.update(0.1);
    expect(loader.root.userData.operationalState).toBe('loaded-trimming-pass');
    expect(Math.abs(arm.rotation.z - startArm)).toBeGreaterThan(0.01);
    expect(Math.abs(bucket.rotation.z - startBucket)).toBeGreaterThan(0.01);
    expect(loader.root.position.distanceTo(startPosition)).toBeGreaterThan(0.5);

    mobile.setEnabled(false);
    const frozenArticulation = articulation.rotation.y;
    const frozenArm = arm.rotation.z;
    const frozenBucket = bucket.rotation.z;
    const frozenElapsed = mobile.elapsedSeconds;
    for (let index = 0; index < 20; index += 1) mobile.update(0.1);
    expect(mobile.elapsedSeconds).toBe(frozenElapsed);
    expect(articulation.rotation.y).toBeCloseTo(frozenArticulation, 12);
    expect(arm.rotation.z).toBeCloseTo(frozenArm, 12);
    expect(bucket.rotation.z).toBeCloseTo(frozenBucket, 12);

    mobile.setEnabled(true);
    mobile.update(0.1);
    expect(
      Math.abs(articulation.rotation.y - frozenArticulation)
      + Math.abs(arm.rotation.z - frozenArm)
      + Math.abs(bucket.rotation.z - frozenBucket),
    ).toBeGreaterThan(1e-5);
  });

  it('derives each truck ROM dump from the real side-entry hopper throat with a meaningful downhill trajectory', () => {
    const plant = createIntegratedPlant();
    const mobile = createIntegratedMobile({ plantRoot: plant.root, registry: plant.registry });
    const receiverPort = plant.getPortWorldPosition('ROM-HOPPER', 'feedIn');
    const hopper = plant.getEquipment('ROM-HOPPER');
    const throat = hopper.group3D.getObjectByName('rom-truck-dump-throat');
    expect(throat).toBeTruthy();
    const throatBounds = new THREE.Box3().setFromObject(throat);
    const seen = new Set();
    for (let step = 0; step < 1100; step += 1) {
      mobile.update(0.1);
      mobile.trucks.forEach((truck) => {
        if (truck.root.userData.operationalState !== 'dumping-at-rom') return;
        const cascade = truck.root.getObjectByName(`${truck.root.name}-v24-dump-ore`);
        expect(cascade?.userData.receiverEquipmentId).toBe('ROM-HOPPER');
        expect(cascade?.userData.receiverPortId).toBe('feedIn');
        const source = new THREE.Vector3(...cascade.userData.sourceWorld);
        const port = new THREE.Vector3(...cascade.userData.receiverPortWorld);
        const target = new THREE.Vector3(...cascade.userData.receiverWorld);
        expect(port.distanceTo(receiverPort)).toBeLessThan(1e-6);
        expect(target.y).toBeLessThan(source.y);
        expect(throatBounds.containsPoint(target)).toBe(true);
        const horizontal = Math.hypot(target.x - source.x, target.z - source.z);
        const dropAngleDeg = THREE.MathUtils.radToDeg(Math.atan2(source.y - target.y, horizontal));
        expect(source.y - target.y).toBeGreaterThan(0.45);
        expect(dropAngleDeg).toBeGreaterThan(7.5);
        seen.add(truck.root.name);
      });
    }
    expect([...seen].sort()).toEqual(['TRUCK-01', 'TRUCK-02', 'TRUCK-03']);
  });

  it('keeps LOADER-01 reclaim discharge downhill from its bucket into the loaderDump receiver', () => {
    const plant = createIntegratedPlant();
    const mobile = createIntegratedMobile({ plantRoot: plant.root, registry: plant.registry });
    for (let index = 0; index < 180; index += 1) mobile.update(0.1);
    const cascade = mobile.loader.root.getObjectByName('LOADER-01-v24-dump-ore');
    expect(cascade?.userData.receiverEquipmentId).toBe('STOCKPILE-RECLAIM');
    expect(cascade?.userData.receiverPortId).toBe('loaderDump');
    const source = new THREE.Vector3(...cascade.userData.sourceWorld);
    const target = new THREE.Vector3(...cascade.userData.receiverWorld);
    const port = new THREE.Vector3(...cascade.userData.receiverPortWorld);
    const reclaimHopper = plant.root.getObjectByName('STOCKPILE-RECLAIM-hopper');
    const reclaimHopperBounds = new THREE.Box3().setFromObject(reclaimHopper);
    expect(port.distanceTo(plant.getPortWorldPosition('STOCKPILE-RECLAIM', 'loaderDump'))).toBeLessThan(1e-6);
    expect(target.y).toBeLessThan(source.y);
    expect(reclaimHopper).toBeTruthy();
    expect(reclaimHopperBounds.containsPoint(target)).toBe(true);
  });

  it('shows a downhill EXCAVATOR-01 transfer only when a real haul truck is loading at the pit', () => {
    const mobile = createIntegratedMobile({
      plantRoot: new THREE.Group(),
      registry: new IntegratedEquipmentRegistry(),
    });
    let observed = null;
    for (let index = 0; index < 2200 && !observed; index += 1) {
      mobile.update(0.1);
      const cascade = mobile.shovelTruckCascade.mesh;
      if (!cascade.visible) continue;
      const receiver = mobile.trucks.find((truck) => truck.root.name === cascade.userData.receiverEquipmentId);
      observed = {
        receiverState: receiver?.root.userData.operationalState,
        source: new THREE.Vector3(...cascade.userData.sourceWorld),
        target: new THREE.Vector3(...cascade.userData.receiverWorld),
      };
    }
    expect(observed).toBeTruthy();
    expect(observed.receiverState).toBe('loading-at-pit');
    expect(observed.target.y).toBeLessThan(observed.source.y);
  });

  it('freezes and resumes conveyor mineral, chute mineral and ROM loader from the global animation control', () => {
    const base = createBaseScene();
    const conveyorOre = base.environmentRoot
      .getObjectByName('CV-01-FEEDER-TO-CRUSHER')
      ?.getObjectByName('conveyor-ore-0');
    const chuteOre = base.environmentRoot
      .getObjectByName('ROM-TO-FEEDER-CHUTE')
      ?.getObjectByName('rom-feeder-chute-ore-0');
    const romLoaderArm = base.environmentRoot
      .getObjectByName('ROM-LOADER-01')
      ?.getObjectByName('loader-arm-pivot');
    expect(conveyorOre).toBeTruthy();
    expect(chuteOre).toBeTruthy();
    expect(romLoaderArm).toBeTruthy();

    base.industrialAnimations.update(0.1);
    base.industrialAnimations.setEnabled(false);
    const frozen = {
      conveyorX: conveyorOre.position.x,
      chuteX: chuteOre.position.x,
      loaderArm: romLoaderArm.rotation.z,
    };
    for (let index = 0; index < 10; index += 1) {
      base.industrialAnimations.update(0.1);
    }
    expect(conveyorOre.position.x).toBeCloseTo(frozen.conveyorX, 12);
    expect(chuteOre.position.x).toBeCloseTo(frozen.chuteX, 12);
    expect(romLoaderArm.rotation.z).toBeCloseTo(frozen.loaderArm, 12);

    base.industrialAnimations.setEnabled(true);
    base.industrialAnimations.update(0.1);
    expect(
      Math.abs(conveyorOre.position.x - frozen.conveyorX)
      + Math.abs(chuteOre.position.x - frozen.chuteX)
      + Math.abs(romLoaderArm.rotation.z - frozen.loaderArm),
    ).toBeGreaterThan(1e-5);
  }, 30000);
});
