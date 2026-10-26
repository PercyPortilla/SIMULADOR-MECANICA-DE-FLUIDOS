import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup.js';

export const B82_SOURCE_CYCLE_SECONDS = 24;
export const B82_MOBILE_ANIMATION_SPEED = 0.55;
export const B82_CRUSHER_JAW_SPEED = 0.80;
export const B82_SMELTING_ANIMATION_SPEED = 0.50;
export const B82_ROM_DUMP_WINDOW_SOURCE_SECONDS = Object.freeze({
  start: 5.45,
  end: 7.25,
});

const MOBILE_TARGET = /^(?:TRUCK-0[1-3]|EXCAVATOR-01|STOCKPILE-LOADER-01)(?:$|_)/;
const CONVEYOR_SPINNER_TARGET = /^(?:CV-01|CV-02|CV-02A|CV-03)_.*_SPINNER$/;
const EW_SOLIDS_TARGET = /^(?:B53_EW_GOLD_SOLIDS|B53_CALCINE_TO_SMELTING)_/;
const EW_GOLD_DEPOSIT_TARGET = /^EW-CELL-\d{2}-GOLD-DEPOSIT-/;
const CIP_MOVING_TARGET = /^CIP-0[1-6]_MOVING$/;
const TRUCK1_WHEEL_TARGET = /^TRUCK-01_WHEEL_SPIN_/;

function visitHierarchy(root, callback) {
  callback(root);
  root.getDescendants?.(false)?.forEach(callback);
}

function findNode(rootNodes, name) {
  for (const root of rootNodes) {
    let match = null;
    visitHierarchy(root, (node) => {
      if (!match && node?.name === name) match = node;
    });
    if (match) return match;
  }
  return null;
}

function targetName(target) {
  return String(target?.name ?? target?.id ?? '');
}

function cloneValue(value) {
  if (value?.clone) return value.clone();
  if (Array.isArray(value)) return [...value];
  if (value && typeof value === 'object') return { ...value };
  return value;
}

function animationKeys(animation) {
  return typeof animation?.getKeys === 'function' ? animation.getKeys() : [];
}

function replaceAnimationKeys(animation, keys) {
  if (typeof animation?.setKeys !== 'function') return false;
  animation.setKeys(keys, true);
  return true;
}

function animationProperty(animation) {
  return String(animation?.targetProperty ?? animation?.targetPropertyPath?.join?.('.') ?? '');
}

function isQuaternionValue(value) {
  return value && ['x', 'y', 'z', 'w'].every((key) => Number.isFinite(Number(value[key])));
}

function isVectorValue(value) {
  return value && ['x', 'y', 'z'].every((key) => Number.isFinite(Number(value[key])))
    && !Number.isFinite(Number(value.w));
}

function smoothstep01(value) {
  const t = Math.max(0, Math.min(1, Number(value) || 0));
  return t * t * (3 - 2 * t);
}

function smoothLoopTail(animation, tailFraction = 0.10) {
  const source = animationKeys(animation);
  if (source.length < 4) return false;
  const firstValue = source[0]?.value;
  const cutIndex = Math.max(1, Math.min(source.length - 2, Math.floor((source.length - 1) * (1 - tailFraction))));
  const cutValue = source[cutIndex]?.value;
  if ((!isQuaternionValue(firstValue) || !isQuaternionValue(cutValue))
    && (!isVectorValue(firstValue) || !isVectorValue(cutValue))) return false;

  const keys = source.map((key) => ({ ...key, value: cloneValue(key.value) }));
  for (let index = cutIndex; index < keys.length; index += 1) {
    const t = smoothstep01((index - cutIndex) / Math.max(1, keys.length - 1 - cutIndex));
    if (isQuaternionValue(firstValue)) {
      keys[index].value = Quaternion.Slerp(cutValue, firstValue, t).normalize();
    } else {
      keys[index].value = Vector3.Lerp(cutValue, firstValue, t);
    }
  }
  keys[keys.length - 1].value = cloneValue(firstValue);
  return replaceAnimationKeys(animation, keys);
}

function closeCrusherJawLoop(animation) {
  const source = animationKeys(animation);
  if (source.length < 2 || !isQuaternionValue(source[0]?.value)) return false;
  const keys = source.map((key) => ({ ...key, value: cloneValue(key.value) }));
  keys[keys.length - 1].value = cloneValue(keys[0].value);
  return replaceAnimationKeys(animation, keys);
}

function closeCipAgitatorLoop(animation) {
  const source = animationKeys(animation);
  if (source.length < 3 || !isQuaternionValue(source[0]?.value)) return false;
  const keys = source.map((key, index) => {
    const progress = index / Math.max(1, source.length - 1);
    const correction = Quaternion.RotationAxis(Vector3.Up(), Math.PI * 0.5 * progress);
    return {
      ...key,
      value: key.value.multiply(correction).normalize(),
    };
  });
  keys[keys.length - 1].value = cloneValue(keys[0].value);
  return replaceAnimationKeys(animation, keys);
}

function scalarScale(value, scalar) {
  if (isVectorValue(value)) return new Vector3(scalar, scalar, scalar);
  if (Array.isArray(value)) return [scalar, scalar, scalar];
  return value;
}

function rewriteTruck3OreThreePasses(animation) {
  const source = animationKeys(animation);
  if (source.length < 4) return false;
  const total = source.length - 1;
  const passes = [
    [2.0, 4.3, 0.001, 0.34],
    [8.3, 10.7, 0.34, 0.67],
    [14.7, 17.1, 0.67, 1.0],
  ];
  const scaleAt = (time) => {
    if (time < passes[0][0]) return 0.001;
    for (const [start, end, from, to] of passes) {
      if (time <= end) {
        if (time < start) return from;
        return from + (to - from) * smoothstep01((time - start) / (end - start));
      }
    }
    if (time < 21.5) return 1.0;
    return 1.0 - 0.999 * smoothstep01((time - 21.5) / 2.5);
  };
  const keys = source.map((key, index) => {
    const time = (index / total) * B82_SOURCE_CYCLE_SECONDS;
    return { ...key, value: scalarScale(key.value, scaleAt(time)) };
  });
  return replaceAnimationKeys(animation, keys);
}

function rewriteTruck2OreLoop(animation) {
  const source = animationKeys(animation);
  if (source.length < 4) return false;
  const total = source.length - 1;
  const keys = source.map((key, index) => {
    const time = (index / total) * B82_SOURCE_CYCLE_SECONDS;
    let scale = 1;
    if (time >= 6.15 && time <= 6.95) {
      scale = 1 - 0.999 * smoothstep01((time - 6.15) / 0.8);
    } else if (time > 6.95 && time < 21.5) scale = 0.001;
    else if (time >= 21.5) scale = 0.001 + 0.999 * smoothstep01((time - 21.5) / 2.5);
    return { ...key, value: scalarScale(key.value, scale) };
  });
  return replaceAnimationKeys(animation, keys);
}

function cumulativeDistances(keys) {
  const result = [0];
  for (let index = 1; index < keys.length; index += 1) {
    const a = keys[index - 1]?.value;
    const b = keys[index]?.value;
    const distance = isVectorValue(a) && isVectorValue(b) ? Vector3.Distance(a, b) : 0;
    result.push(result[index - 1] + distance);
  }
  return result;
}

function repairTruck1WheelSpin(targetedAnimations) {
  const rootTrack = targetedAnimations.find((targeted) => (
    targetName(targeted?.target) === 'TRUCK-01'
    && /position/i.test(animationProperty(targeted?.animation))
  ));
  const rootKeys = animationKeys(rootTrack?.animation);
  if (rootKeys.length < 4) return 0;
  const distances = cumulativeDistances(rootKeys);
  const totalDistance = distances.at(-1);
  if (!(totalDistance > 1)) return 0;
  const radiusM = 1.42;
  const closedTurns = Math.max(1, Math.round(totalDistance / (2 * Math.PI * radiusM)));
  let repaired = 0;
  targetedAnimations.filter((targeted) => TRUCK1_WHEEL_TARGET.test(targetName(targeted?.target))).forEach((targeted) => {
    const source = animationKeys(targeted.animation);
    if (source.length < 4 || !isQuaternionValue(source[0]?.value)) return;
    const q0 = source[0].value.clone();
    const keys = source.map((key, index) => {
      const rootIndex = Math.round((index / Math.max(1, source.length - 1)) * (rootKeys.length - 1));
      const progress = distances[rootIndex] / totalDistance;
      const spin = Quaternion.RotationAxis(Vector3.Forward(), -progress * closedTurns * Math.PI * 2);
      return { ...key, value: q0.multiply(spin).normalize() };
    });
    keys[keys.length - 1].value = cloneValue(keys[0].value);
    if (replaceAnimationKeys(targeted.animation, keys)) repaired += 1;
  });
  return repaired;
}

function removeTargeted(group, targeted) {
  if (typeof group?.removeTargetedAnimation === 'function') {
    group.removeTargetedAnimation(targeted.animation);
    return true;
  }
  const array = group?.targetedAnimations;
  const index = Array.isArray(array) ? array.indexOf(targeted) : -1;
  if (index >= 0) {
    array.splice(index, 1);
    return true;
  }
  return false;
}

function extractGroup(scene, sourceGroups, name, predicate, speedRatio = 1) {
  const derived = new AnimationGroup(name, scene);
  sourceGroups.forEach((group) => {
    [...(group?.targetedAnimations ?? [])].forEach((targeted) => {
      if (!predicate(targeted)) return;
      if (!removeTargeted(group, targeted)) return;
      derived.addTargetedAnimation(targeted.animation, targeted.target);
    });
  });
  derived.speedRatio = speedRatio;
  derived.metadata = {
    visualOnly: true,
    visualBuild: 'B82',
    speedRatio,
    extractedTargetCount: derived.targetedAnimations.length,
  };
  return derived;
}

export function createB82AnimationController(scene, animationGroups = []) {
  animationGroups.forEach((group) => group?.stop?.());
  const allTargeted = animationGroups.flatMap((group) => [...(group?.targetedAnimations ?? [])]);

  const truck1WheelTrackCount = repairTruck1WheelSpin(allTargeted);
  let cipLoopRepairCount = 0;
  let ewDepositLoopRepairCount = 0;
  let loaderLoopRepairCount = 0;
  let truckOreLoopRepairCount = 0;
  allTargeted.forEach((targeted) => {
    const name = targetName(targeted?.target);
    if (CIP_MOVING_TARGET.test(name) && /rotation/i.test(animationProperty(targeted.animation))) {
      if (closeCipAgitatorLoop(targeted.animation)) cipLoopRepairCount += 1;
    }
    if (EW_GOLD_DEPOSIT_TARGET.test(name) && /scal/i.test(animationProperty(targeted.animation))) {
      if (smoothLoopTail(targeted.animation, 0.10)) ewDepositLoopRepairCount += 1;
    }
    if (name === 'STOCKPILE-LOADER-01' && /rotation/i.test(animationProperty(targeted.animation))) {
      if (smoothLoopTail(targeted.animation, 0.12)) loaderLoopRepairCount += 1;
    }
    if (name === 'TRUCK-02_ORE_LOAD' && /scal/i.test(animationProperty(targeted.animation))) {
      if (rewriteTruck2OreLoop(targeted.animation)) truckOreLoopRepairCount += 1;
    }
    if (name === 'TRUCK-03_ORE_LOAD' && /scal/i.test(animationProperty(targeted.animation))) {
      if (rewriteTruck3OreThreePasses(targeted.animation)) truckOreLoopRepairCount += 1;
    }
  });

  let disabledConveyorSpinnerTrackCount = 0;
  let disabledEwSolidTrackCount = 0;
  animationGroups.forEach((group) => {
    [...(group?.targetedAnimations ?? [])].forEach((targeted) => {
      const name = targetName(targeted?.target);
      const property = animationProperty(targeted?.animation);
      if (CONVEYOR_SPINNER_TARGET.test(name) && /rotation/i.test(property)) {
        if (removeTargeted(group, targeted)) disabledConveyorSpinnerTrackCount += 1;
      } else if (EW_SOLIDS_TARGET.test(name) && /position/i.test(property)) {
        if (removeTargeted(group, targeted)) disabledEwSolidTrackCount += 1;
      }
    });
  });

  const mobile = extractGroup(
    scene,
    animationGroups,
    'B82_MOBILE_FLEET',
    (targeted) => MOBILE_TARGET.test(targetName(targeted?.target)),
    B82_MOBILE_ANIMATION_SPEED,
  );
  const crusherJaw = extractGroup(
    scene,
    animationGroups,
    'B82_CRUSHER_JAW',
    (targeted) => targetName(targeted?.target) === 'PRIMARY-CRUSHER_MOVING_JAW_PIVOT.001',
    B82_CRUSHER_JAW_SPEED,
  );
  crusherJaw.targetedAnimations.forEach((targeted) => closeCrusherJawLoop(targeted.animation));
  const smelting = extractGroup(
    scene,
    animationGroups,
    'B82_SMELTING',
    (targeted) => targetName(targeted?.target).startsWith('SMELTING-FURNACE'),
    B82_SMELTING_ANIMATION_SPEED,
  );
  const derivedGroups = [mobile, crusherJaw, smelting].filter((group) => group.targetedAnimations.length > 0);
  let enabled = false;

  function sync(enabledValue) {
    enabled = Boolean(enabledValue);
    derivedGroups.forEach((group) => {
      if (enabled) {
        group.speedRatio = Number(group.metadata?.speedRatio) || 1;
        if (group.isStarted) group.play?.(true);
        else group.start?.(true, group.speedRatio, group.from, group.to, false);
      } else group.pause?.();
    });
    return enabled;
  }

  function mobileSourceTimeSeconds() {
    if (!mobile.targetedAnimations.length) return null;
    const fps = Number(mobile.targetedAnimations[0]?.animation?.framePerSecond);
    const frame = Number(mobile.getRetainedCurrentFrame?.() ?? mobile.getCurrentFrame?.());
    const from = Number(mobile.from);
    if (!(fps > 0) || !Number.isFinite(frame) || !Number.isFinite(from)) return null;
    const span = B82_SOURCE_CYCLE_SECONDS;
    return (((frame - from) / fps) % span + span) % span;
  }

  return {
    derivedGroups,
    mobileGroup: mobile,
    crusherJawGroup: crusherJaw,
    smeltingGroup: smelting,
    disabledConveyorSpinnerTrackCount,
    disabledEwSolidTrackCount,
    truck1WheelTrackCount,
    cipLoopRepairCount,
    ewDepositLoopRepairCount,
    loaderLoopRepairCount,
    truckOreLoopRepairCount,
    sync,
    mobileSourceTimeSeconds,
    get enabled() { return enabled; },
    dispose() {
      derivedGroups.forEach((group) => group.dispose?.());
    },
  };
}

function createOreMaterial(scene) {
  const material = new StandardMaterial('b82-rom-dump-ore-material', scene);
  material.diffuseColor = new Color3(0.34, 0.23, 0.15);
  material.ambientColor = new Color3(0.07, 0.045, 0.028);
  material.specularColor = new Color3(0.025, 0.02, 0.015);
  material.specularPower = 4;
  return material;
}

function nodeWorldPositionToRef(node, result) {
  node?.computeWorldMatrix?.(true);
  const world = node?.getWorldMatrix?.();
  if (!world?.getTranslationToRef) return false;
  world.getTranslationToRef(result);
  return result.asArray().every(Number.isFinite);
}

function boundsCenterWorldToRef(node, result) {
  node?.computeWorldMatrix?.(true);
  const box = node?.getBoundingInfo?.()?.boundingBox;
  if (!box?.centerWorld) return nodeWorldPositionToRef(node, result);
  result.copyFrom(box.centerWorld);
  return result.asArray().every(Number.isFinite);
}

export function applyB82OperationalAnimationVisual({
  scene,
  rootNodes = [],
  host,
  animationGroups = [],
} = {}) {
  if (!scene || !host) throw new TypeError('B82 operational animation visual requires scene and host.');

  const root = new TransformNode('B82_OPERATIONAL_ANIMATION_CLOSURE', scene);
  root.parent = host;
  root.metadata = {
    visualOnly: true,
    siteRevision: 'V57',
    visualBuild: 'B82',
    v57AuthoritativeVisual: true,
  };

  const animationController = createB82AnimationController(scene, animationGroups);
  const truckOre = findNode(rootNodes, 'TRUCK-02_ORE_LOAD');
  const truck1Ore = findNode(rootNodes, 'TRUCK-01_ORE_LOAD');
  const hopperOre = findNode(rootNodes, 'ROM-HOPPER_ORE_BULK');
  const dumpAvailable = Boolean(truckOre && hopperOre);
  const material = createOreMaterial(scene);
  const chunks = [];
  const chunkCount = 20;
  for (let index = 0; index < chunkCount; index += 1) {
    const chunk = CreateSphere(`B82_ROM_DUMP_ORE_${String(index + 1).padStart(2, '0')}`, {
      diameter: 0.42 + (index % 5) * 0.055,
      segments: 4,
    }, scene);
    chunk.parent = root;
    chunk.material = material;
    chunk.isPickable = false;
    chunk.receiveShadows = true;
    chunk.scaling.set(1.0 + (index % 3) * 0.12, 0.72 + (index % 4) * 0.08, 0.88);
    chunk.metadata = {
      visualOnly: true,
      siteRevision: 'V57',
      visualBuild: 'B82',
      v57AuthoritativeVisual: true,
      b82RomDumpOre: true,
      sourceEquipmentId: 'TRUCK-02',
      targetEquipmentId: 'ROM-HOPPER',
    };
    chunk.setEnabled(false);
    chunks.push(chunk);
  }

  let animationsEnabled = true;
  let labActive = false;
  let dumpActive = false;
  const startWorld = new Vector3();
  const targetWorld = new Vector3();
  const position = new Vector3();

  function sourceCycleTime() {
    return animationController.mobileSourceTimeSeconds() ?? 0;
  }

  function setTruck1OreState(sourceTime) {
    if (!truck1Ore) return false;
    const loaded = sourceTime < 11.65;
    truck1Ore.setEnabled?.(loaded);
    if ('isVisible' in truck1Ore) truck1Ore.isVisible = loaded;
    truck1Ore.metadata = {
      ...(truck1Ore.metadata ?? {}),
      b82LoadStateManaged: true,
      b82LoadedOutbound: loaded,
    };
    return loaded;
  }

  function setDumpVisible(visible) {
    dumpActive = Boolean(visible && dumpAvailable && !labActive);
    chunks.forEach((chunk) => chunk.setEnabled(dumpActive));
    root.metadata.dumpActive = dumpActive;
  }

  function renderDumpStream(sourceTime) {
    if (!dumpAvailable || labActive) {
      setDumpVisible(false);
      return false;
    }
    const { start, end } = B82_ROM_DUMP_WINDOW_SOURCE_SECONDS;
    const active = sourceTime >= start && sourceTime <= end;
    if (!active) {
      setDumpVisible(false);
      return false;
    }
    if (!nodeWorldPositionToRef(truckOre, startWorld)
      || !boundsCenterWorldToRef(hopperOre, targetWorld)) {
      setDumpVisible(false);
      return false;
    }

    setDumpVisible(true);
    const windowProgress = (sourceTime - start) / (end - start);
    const fade = Math.min(
      smoothstep01(windowProgress / 0.18),
      smoothstep01((1 - windowProgress) / 0.18),
    );
    chunks.forEach((chunk, index) => {
      const phase = (windowProgress * 2.35 + index / chunks.length) % 1;
      Vector3.LerpToRef(startWorld, targetWorld, phase, position);
      const lateral = Math.sin((index + 1) * 2.17 + phase * Math.PI * 4) * 0.32 * (1 - phase);
      const forward = Math.cos((index + 1) * 1.43 + phase * Math.PI * 3) * 0.22 * (1 - phase);
      position.x += lateral;
      position.z += forward;
      position.y -= Math.sin(Math.PI * phase) * 0.72;
      chunk.position.copyFrom(position);
      const scale = Math.max(0.28, fade);
      chunk.scaling.y = (0.72 + (index % 4) * 0.08) * scale;
      chunk.visibility = 0.55 + fade * 0.45;
    });
    return true;
  }

  function setAnimationsEnabled(enabled) {
    animationsEnabled = Boolean(enabled);
    animationController.sync(animationsEnabled);
    root.metadata.animationsEnabled = animationsEnabled;
    return animationsEnabled;
  }

  function setLabState(nextState = {}) {
    labActive = Boolean(nextState.active);
    root.setEnabled(!labActive);
    if (labActive) setDumpVisible(false);
    root.metadata.labHidden = labActive;
    return !labActive;
  }

  function update(deltaSeconds) {
    if (!animationsEnabled) return false;
    const dt = Math.max(0, Number(deltaSeconds) || 0);
    if (!(dt > 0)) return false;
    const sourceTime = sourceCycleTime();
    setTruck1OreState(sourceTime);
    if (labActive) {
      setDumpVisible(false);
      return false;
    }
    return renderDumpStream(sourceTime);
  }

  root.metadata.mobileTargetAnimationCount = animationController.mobileGroup.targetedAnimations.length;
  root.metadata.mobileAnimationSpeedMultiplier = B82_MOBILE_ANIMATION_SPEED;
  root.metadata.crusherJawAnimationSpeedMultiplier = B82_CRUSHER_JAW_SPEED;
  root.metadata.smeltingAnimationSpeedMultiplier = B82_SMELTING_ANIMATION_SPEED;
  root.metadata.sourceCycleSeconds = B82_SOURCE_CYCLE_SECONDS;
  root.metadata.dumpAvailable = dumpAvailable;
  root.metadata.dumpWindowSourceSeconds = { ...B82_ROM_DUMP_WINDOW_SOURCE_SECONDS };
  root.metadata.disabledConveyorSpinnerTrackCount = animationController.disabledConveyorSpinnerTrackCount;
  root.metadata.disabledEwSolidTrackCount = animationController.disabledEwSolidTrackCount;
  root.metadata.truck1WheelTrackCount = animationController.truck1WheelTrackCount;
  root.metadata.cipLoopRepairCount = animationController.cipLoopRepairCount;
  root.metadata.ewDepositLoopRepairCount = animationController.ewDepositLoopRepairCount;
  root.metadata.loaderLoopRepairCount = animationController.loaderLoopRepairCount;
  root.metadata.truckOreLoopRepairCount = animationController.truckOreLoopRepairCount;
  host.metadata = {
    ...(host.metadata ?? {}),
    b82OperationalAnimationClosure: true,
    b82MobileAnimationSpeedMultiplier: B82_MOBILE_ANIMATION_SPEED,
    b82MobileTargetAnimationCount: animationController.mobileGroup.targetedAnimations.length,
    b82RomDumpStreamAvailable: dumpAvailable,
    b82DisabledConveyorSpinnerTrackCount: animationController.disabledConveyorSpinnerTrackCount,
    b82DisabledEwSolidTrackCount: animationController.disabledEwSolidTrackCount,
    b82CipLoopRepairCount: animationController.cipLoopRepairCount,
  };

  return {
    root,
    animationController,
    chunks,
    setAnimationsEnabled,
    setLabState,
    update,
    get sourceTimeSeconds() { return sourceCycleTime(); },
    get dumpActive() { return dumpActive; },
    dispose() {
      animationController.dispose();
      root.dispose(false, true);
      material.dispose(false, true);
      chunks.length = 0;
    },
  };
}
