import { describe, expect, it } from 'vitest';
import {
  Animation,
  AnimationGroup,
  CreateBox,
  NullEngine,
  Quaternion,
  Scene,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import {
  applyB82OperationalAnimationVisual,
  B82_CRUSHER_JAW_SPEED,
  B82_MOBILE_ANIMATION_SPEED,
  B82_ROM_DUMP_WINDOW_SOURCE_SECONDS,
  B82_SMELTING_ANIMATION_SPEED,
  createB82AnimationController,
} from '../../src/babylon/assets/b82OperationalAnimationVisual.js';

function addTrack(group, target, property, type, values, fps = 60) {
  const animation = new Animation(
    target.name + '-' + property,
    property,
    fps,
    type,
    Animation.ANIMATIONLOOPMODE_CYCLE,
  );
  animation.setKeys(values.map((value, index) => ({
    frame: index * (1440 / Math.max(1, values.length - 1)),
    value,
  })));
  group.addTargetedAnimation(animation, target);
  return animation;
}

function qY(degrees) {
  return Quaternion.RotationAxis(Vector3.Up(), degrees * Math.PI / 180);
}

function qZ(degrees) {
  return Quaternion.RotationAxis(Vector3.Forward(), degrees * Math.PI / 180);
}

function quatGapDeg(a, b) {
  const dot = Math.min(1, Math.abs(Quaternion.Dot(a, b)));
  return 2 * Math.acos(dot) * 180 / Math.PI;
}

describe('B82 operational animation closure', () => {
  it('splits independent clocks and repairs the known V57 animation defects', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    const source = new AnimationGroup('Scene', scene);

    const truck = new TransformNode('TRUCK-01', scene);
    addTrack(source, truck, 'position', Animation.ANIMATIONTYPE_VECTOR3, [
      new Vector3(0, 0, 0),
      new Vector3(30, 0, 0),
      new Vector3(60, 0, 0),
      new Vector3(0, 0, 0),
    ]);
    const wheel = new TransformNode('TRUCK-01_WHEEL_SPIN_FL', scene);
    const wheelAnimation = addTrack(source, wheel, 'rotationQuaternion', Animation.ANIMATIONTYPE_QUATERNION, [
      qZ(0), qZ(170), qZ(-170), qZ(12),
    ]);
    const excavator = new TransformNode('EXCAVATOR-01_BUCKET_PIVOT', scene);
    addTrack(source, excavator, 'rotationQuaternion', Animation.ANIMATIONTYPE_QUATERNION, [
      qZ(0), qZ(20), qZ(0), qZ(-20),
    ]);
    const loader = new TransformNode('STOCKPILE-LOADER-01', scene);
    const loaderAnimation = addTrack(source, loader, 'rotationQuaternion', Animation.ANIMATIONTYPE_QUATERNION, [
      qY(0), qY(80), qY(160), qY(179),
    ]);
    const spinner = new TransformNode('CV-01_HEAD_PULLEY_SPINNER', scene);
    addTrack(source, spinner, 'rotationQuaternion', Animation.ANIMATIONTYPE_QUATERNION, [
      qZ(0), qZ(90), qZ(180), qZ(270),
    ]);
    const pulley = new TransformNode('CV-01_HEAD_PULLEY', scene);
    addTrack(source, pulley, 'rotationQuaternion', Animation.ANIMATIONTYPE_QUATERNION, [
      qZ(0), qZ(90), qZ(180), qZ(270),
    ]);
    const jaw = new TransformNode('PRIMARY-CRUSHER_MOVING_JAW_PIVOT.001', scene);
    const jawAnimation = addTrack(source, jaw, 'rotationQuaternion', Animation.ANIMATIONTYPE_QUATERNION, [
      qZ(-2), qZ(2), qZ(-2), qZ(2),
    ]);
    const cip = new TransformNode('CIP-01_MOVING', scene);
    const cipAnimation = addTrack(source, cip, 'rotationQuaternion', Animation.ANIMATIONTYPE_QUATERNION, [
      qY(0), qY(-90), qY(-180), qY(-270),
    ]);
    const ewDeposit = new TransformNode('EW-CELL-01-GOLD-DEPOSIT-0', scene);
    const ewDepositAnimation = addTrack(source, ewDeposit, 'scaling', Animation.ANIMATIONTYPE_VECTOR3, [
      new Vector3(0.1, 0.1, 0.1),
      new Vector3(0.6, 0.6, 0.6),
      new Vector3(1, 1, 1),
      new Vector3(0.98, 0.98, 0.98),
    ]);
    const ewSolid = new TransformNode('B53_EW_GOLD_SOLIDS_00', scene);
    addTrack(source, ewSolid, 'position', Animation.ANIMATIONTYPE_VECTOR3, [
      new Vector3(0, 0, 0),
      new Vector3(2, 0, 0),
      new Vector3(4, 0, 0),
      new Vector3(6, 0, 0),
    ]);
    const smelting = new TransformNode('SMELTING-FURNACE_MOVING', scene);
    addTrack(source, smelting, 'rotationQuaternion', Animation.ANIMATIONTYPE_QUATERNION, [
      qZ(0), qZ(20), qZ(0), qZ(-20),
    ]);
    const mill = new TransformNode('MILL-01_MOVING', scene);
    addTrack(source, mill, 'rotationQuaternion', Animation.ANIMATIONTYPE_QUATERNION, [
      qZ(0), qZ(90), qZ(180), qZ(270),
    ]);

    const controller = createB82AnimationController(scene, [source]);
    expect(controller.mobileGroup.speedRatio).toBeCloseTo(B82_MOBILE_ANIMATION_SPEED, 8);
    expect(controller.crusherJawGroup.speedRatio).toBeCloseTo(B82_CRUSHER_JAW_SPEED, 8);
    expect(controller.smeltingGroup.speedRatio).toBeCloseTo(B82_SMELTING_ANIMATION_SPEED, 8);
    expect(source.targetedAnimations.some((item) => item.target.name === 'CV-01_HEAD_PULLEY_SPINNER')).toBe(false);
    expect(source.targetedAnimations.some((item) => item.target.name === 'CV-01_HEAD_PULLEY')).toBe(true);
    expect(source.targetedAnimations.some((item) => item.target.name === 'B53_EW_GOLD_SOLIDS_00')).toBe(false);
    expect(source.targetedAnimations.some((item) => item.target.name === 'MILL-01_MOVING')).toBe(true);
    expect(controller.disabledConveyorSpinnerTrackCount).toBe(1);
    expect(controller.disabledEwSolidTrackCount).toBe(1);
    expect(controller.truck1WheelTrackCount).toBe(1);
    expect(controller.cipLoopRepairCount).toBe(1);
    expect(controller.ewDepositLoopRepairCount).toBe(1);
    expect(controller.loaderLoopRepairCount).toBe(1);
    expect(quatGapDeg(wheelAnimation.getKeys()[0].value, wheelAnimation.getKeys().at(-1).value)).toBeLessThan(0.01);
    expect(quatGapDeg(loaderAnimation.getKeys()[0].value, loaderAnimation.getKeys().at(-1).value)).toBeLessThan(0.01);
    expect(quatGapDeg(jawAnimation.getKeys()[0].value, jawAnimation.getKeys().at(-1).value)).toBeLessThan(0.01);
    expect(quatGapDeg(cipAnimation.getKeys()[0].value, cipAnimation.getKeys().at(-1).value)).toBeLessThan(0.01);
    expect(Vector3.Distance(ewDepositAnimation.getKeys()[0].value, ewDepositAnimation.getKeys().at(-1).value)).toBeLessThan(1e-8);

    controller.sync(true);
    expect(controller.mobileGroup.isStarted).toBe(true);
    controller.sync(false);
    const retained = controller.mobileGroup.getRetainedCurrentFrame();
    controller.sync(true);
    expect(controller.mobileGroup.getRetainedCurrentFrame()).toBeCloseTo(retained, 6);
    controller.dispose();
    source.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('renders TRUCK-02 ore from the actual mobile playhead and freezes it with Animaciones OFF', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    const host = new TransformNode('PULPA-LAB-V57-SITE', scene);
    const imported = new TransformNode('imported', scene);
    imported.parent = host;
    const truckOre = CreateBox('TRUCK-02_ORE_LOAD', { width: 4, height: 1.4, depth: 3 }, scene);
    truckOre.position.set(-315, 68, -206);
    truckOre.parent = imported;
    const hopperOre = CreateBox('ROM-HOPPER_ORE_BULK', { width: 8, height: 2, depth: 5 }, scene);
    hopperOre.position.set(-304, 65.5, -206);
    hopperOre.parent = imported;
    const dumpPivot = new TransformNode('TRUCK-02_DUMP_PIVOT', scene);
    dumpPivot.parent = imported;
    const source = new AnimationGroup('Scene', scene);
    addTrack(source, dumpPivot, 'rotationQuaternion', Animation.ANIMATIONTYPE_QUATERNION, [
      qZ(0), qZ(40), qZ(40), qZ(0),
    ]);

    const visual = applyB82OperationalAnimationVisual({
      scene,
      rootNodes: [imported],
      host,
      animationGroups: [source],
    });
    expect(visual.chunks.every((chunk) => chunk.isEnabled() === false)).toBe(true);
    visual.setAnimationsEnabled(true);
    const mobile = visual.animationController.mobileGroup;
    const fps = mobile.targetedAnimations[0].animation.framePerSecond;
    const dumpTime = B82_ROM_DUMP_WINDOW_SOURCE_SECONDS.start + 0.35;
    mobile.goToFrame(mobile.from + dumpTime * fps);
    visual.update(0.016);
    expect(visual.sourceTimeSeconds).toBeCloseTo(dumpTime, 2);
    expect(visual.dumpActive).toBe(true);
    expect(visual.chunks.some((chunk) => chunk.isEnabled())).toBe(true);
    const frozen = visual.chunks[0].position.clone();
    visual.setAnimationsEnabled(false);
    expect(visual.update(0.1)).toBe(false);
    expect(visual.chunks[0].position.equalsWithEpsilon(frozen, 1e-8)).toBe(true);

    visual.setLabState({ active: true });
    expect(visual.root.isEnabled()).toBe(false);
    expect(visual.dumpActive).toBe(false);
    visual.setLabState({ active: false });
    mobile.goToFrame(mobile.from + dumpTime * fps);
    visual.setAnimationsEnabled(true);
    visual.update(0.016);
    expect(visual.dumpActive).toBe(true);

    visual.dispose();
    source.dispose();
    scene.dispose();
    engine.dispose();
  });
});
