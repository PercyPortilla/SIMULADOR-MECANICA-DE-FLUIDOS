import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { getTerrainHeight } from '../../scene/environment/terrainHeight.js';
import { REFERENCE_EQUIPMENT_DIMENSIONS } from '../../scene/config/siteDesign.js';
import { MOBILE_ROUTE_LAYOUT, SUPPORT_LAYOUT } from '../../scene/integration/finalLayout.js';
import { createNumericCatmullRom } from '../../scene/math/numericCatmullRom.js';
import { attachBabylonEquipmentVisual } from '../assets/equipmentVisual.js';
import {
  createBabylonPrimaryLaneCurve,
  groundBabylonRoadLaneTransition,
} from '../environment/primaryHaulRoad.js';

export const BABYLON_MOBILE_EQUIPMENT_IDS = Object.freeze([
  'TRUCK-01',
  'TRUCK-02',
  'TRUCK-03',
  'EXCAVATOR-01',
  'LOADER-01',
]);

export const BABYLON_TRUCK_PHASE_OFFSETS_SECONDS = Object.freeze([0, 34, 68]);
export const BABYLON_TRUCK_TIMINGS = Object.freeze({
  loading: 10,
  haul: 40,
  dump: 8,
  romTurnaround: 5,
  return: 35,
  pitTurnaround: 5,
});

const TRUCK_LANE_OFFSET_M = 3.4;
const LOADER_ROUTE_ELEVATION_OFFSET_M = 0.04;
const DEG = Math.PI / 180;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep01(value) {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function headingFromTangent(tangent) {
  return Math.atan2(-tangent.z, tangent.x);
}

function signedHeadingDelta(a, b) {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}

function easedDriveProgress(progress) {
  const t = clamp(progress, 0, 1);
  const ramp = 0.12;
  const maxNormalizedSpeed = 1 / (1 - ramp);
  if (t < ramp) return 0.5 * maxNormalizedSpeed * t * t / ramp;
  if (t > 1 - ramp) {
    const remaining = 1 - t;
    return 1 - 0.5 * maxNormalizedSpeed * remaining * remaining / ramp;
  }
  return 0.5 * maxNormalizedSpeed * ramp + maxNormalizedSpeed * (t - ramp);
}

function steeringFromCurve(curve, progress) {
  const p0 = clamp(progress, 0.001, 0.989);
  const p1 = clamp(p0 + 0.010, 0.002, 0.999);
  const heading0 = headingFromTangent(curve.getTangent(p0));
  const heading1 = headingFromTangent(curve.getTangent(p1));
  return clamp(signedHeadingDelta(heading0, heading1) * 2.4, -0.34, 0.34);
}

function distance3(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function copyPoint(target, point) {
  target.set(point.x, point.y, point.z);
  return target;
}

function lerpPoint(a, b, t) {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
  };
}

function orientAlong(root, tangent) {
  root.rotationQuaternion = null;
  root.rotation.set(0, headingFromTangent(tangent), 0);
}

function orientTruckAlongGrade(root, tangent) {
  const length = Math.hypot(tangent.x, tangent.y, tangent.z);
  if (length < 1e-10) return;
  const normalized = {
    x: tangent.x / length,
    y: tangent.y / length,
    z: tangent.z / length,
  };
  const horizontal = Math.hypot(normalized.x, normalized.z);
  root.rotationQuaternion = null;
  root.rotation.set(
    0,
    headingFromTangent(normalized),
    Math.atan2(normalized.y, Math.max(horizontal, 1e-10)),
  );
}

function routeFromXZ(points) {
  return createNumericCatmullRom(points.map(([x, z]) => ({
    x,
    y: getTerrainHeight(x, z) + LOADER_ROUTE_ELEVATION_OFFSET_M,
    z,
  })));
}

function descendants(rootNodes) {
  const nodes = [];
  rootNodes.forEach((root) => {
    nodes.push(root);
    nodes.push(...(root.getDescendants?.(false) ?? []));
  });
  return nodes;
}

function findVisualNode(visual, name) {
  return descendants(visual.rootNodes).find((node) => node.name === name) ?? null;
}

const visualRestRotations = new WeakMap();

function visualRestRotation(node) {
  let rest = visualRestRotations.get(node);
  if (rest) return rest;
  rest = node.rotationQuaternion?.toEulerAngles?.() ?? node.rotation?.clone?.() ?? new Vector3();
  visualRestRotations.set(node, rest.clone());
  node.rotationQuaternion = null;
  if (node.rotation?.copyFrom) node.rotation.copyFrom(rest);
  return rest;
}

function setVisualAxisDelta(node, axis, delta) {
  if (!node?.rotation) return false;
  const rest = visualRestRotation(node);
  node.rotation[axis] = rest[axis] + delta;
  return true;
}

function setNodeVisible(node, visible) {
  if (!node) return false;
  node.setEnabled?.(Boolean(visible));
  if ('isVisible' in node) node.isVisible = Boolean(visible);
  return true;
}

function makeVisual(scene, instanceId, loadContainer) {
  return attachBabylonEquipmentVisual({
    scene,
    instanceId,
    ...(loadContainer ? { loadContainer } : {}),
  });
}

function createTruck(scene, id, loadContainer) {
  const root = new TransformNode(id, scene);
  root.metadata = {
    instanceId: id,
    type: 'haul-truck',
    mobileEquipment: true,
    integrationManagedAnimation: true,
    routeId: 'ROAD-01',
    targetDimensionsM: { ...REFERENCE_EQUIPMENT_DIMENSIONS.haulTruck },
    groundedBy: 'ROAD-01 engineered surface',
  };

  const dumpPivot = new TransformNode('haul-truck-dump-pivot', scene);
  dumpPivot.parent = root;
  dumpPivot.position.set(-2.7, 2.48, 0);
  dumpPivot.metadata = { dumpHinge: 'rear', dumpAxis: 'local-z', dumpDirection: 'rearward' };

  const wheelAssemblies = [];
  for (let index = 0; index < 6; index += 1) {
    const steerPivot = new TransformNode(`truck-wheel-steer-pivot-${index + 1}`, scene);
    steerPivot.parent = root;
    steerPivot.metadata = { wheelSteerPivot: true, frontSteer: index < 2, rotationAxis: 'y' };
    const spinPivot = new TransformNode(`truck-wheel-spin-pivot-${index + 1}`, scene);
    spinPivot.parent = steerPivot;
    spinPivot.metadata = { wheelSpinPivot: true, wheelRadiusM: 1.42, rotationAxis: 'z' };
    wheelAssemblies.push({ steerPivot, spinPivot, frontSteer: index < 2 });
  }

  const visual = makeVisual(scene, id, loadContainer);
  visual.host.parent = root;
  const handle = {
    id,
    root,
    visual,
    dumpPivot,
    wheelAssemblies,
    cumulativeWheelTravelM: 0,
    loaded: true,
    dumpAngle: 0,
    steeringAngle: 0,
  };

  function syncVisual() {
    setNodeVisible(findVisualNode(visual, 'HAUL-TRUCK_ORE_LOAD'), handle.loaded);
    setVisualAxisDelta(findVisualNode(visual, 'HAUL-TRUCK_DUMP_PIVOT'), 'z', handle.dumpAngle);
    ['HAUL-TRUCK_WHEEL_STEER_FL', 'HAUL-TRUCK_WHEEL_STEER_FR'].forEach((name) => {
      setVisualAxisDelta(findVisualNode(visual, name), 'y', handle.steeringAngle);
    });
    const spinNames = ['FL', 'FR', 'RL1', 'RL2', 'RR1', 'RR2'].map((code) => `HAUL-TRUCK_WHEEL_SPIN_${code}`);
    spinNames.forEach((name) => {
      setVisualAxisDelta(findVisualNode(visual, name), 'z', -handle.cumulativeWheelTravelM / 1.42);
    });
  }

  handle.setLoaded = (loaded) => {
    handle.loaded = Boolean(loaded);
    root.metadata.loadState = handle.loaded ? 'loaded' : 'empty';
    syncVisual();
  };
  handle.setDumpAngle = (radians) => {
    handle.dumpAngle = clamp(Number(radians) || 0, 0, 52 * DEG);
    dumpPivot.rotation.z = handle.dumpAngle;
    root.metadata.dumpAngleRad = handle.dumpAngle;
    syncVisual();
  };
  handle.setSteering = (radians) => {
    handle.steeringAngle = clamp(Number(radians) || 0, -28 * DEG, 28 * DEG);
    wheelAssemblies.forEach(({ steerPivot, frontSteer }) => {
      steerPivot.rotation.y = frontSteer ? handle.steeringAngle : 0;
    });
    syncVisual();
  };
  handle.advanceWheelTravel = (distanceM) => {
    if (!Number.isFinite(distanceM) || Math.abs(distanceM) < 1e-8) return;
    handle.cumulativeWheelTravelM += distanceM;
    wheelAssemblies.forEach(({ spinPivot }) => {
      spinPivot.rotation.z -= distanceM / 1.42;
    });
    syncVisual();
  };
  handle.syncVisual = syncVisual;
  visual.ready.then(syncVisual);
  return handle;
}

function createExcavator(scene, loadContainer) {
  const id = 'EXCAVATOR-01';
  const root = new TransformNode(id, scene);
  root.position.set(
    SUPPORT_LAYOUT.truckLoad.x + 10,
    getTerrainHeight(SUPPORT_LAYOUT.truckLoad.x + 10, SUPPORT_LAYOUT.truckLoad.z - 2),
    SUPPORT_LAYOUT.truckLoad.z - 2,
  );
  root.rotation.y = Math.PI - 0.10;
  root.metadata = {
    instanceId: id,
    type: 'hydraulic-mining-shovel',
    mobileEquipment: true,
    integrationManagedAnimation: true,
    groundedBy: 'getTerrainHeight',
    targetDimensionsM: { ...REFERENCE_EQUIPMENT_DIMENSIONS.miningShovel },
  };

  const upper = new TransformNode('shovel-upper-structure', scene);
  upper.parent = root;
  upper.position.set(-0.35, 2.35, 0);
  upper.metadata = { rotationAxis: 'y' };
  const boomPivot = new TransformNode('boom-pivot', scene);
  boomPivot.parent = upper;
  boomPivot.position.set(1.45, 1.4, 0);
  boomPivot.metadata = { rotationAxis: 'z' };
  const stickPivot = new TransformNode('stick-pivot', scene);
  stickPivot.parent = boomPivot;
  stickPivot.position.set(5.1, 0, 0);
  stickPivot.metadata = { rotationAxis: 'z' };
  const bucketPivot = new TransformNode('bucket-pivot', scene);
  bucketPivot.parent = stickPivot;
  bucketPivot.position.set(3.65, 0, 0);
  bucketPivot.metadata = { rotationAxis: 'z' };

  const visual = makeVisual(scene, id, loadContainer);
  visual.host.parent = root;
  return { id, root, visual, upper, boomPivot, stickPivot, bucketPivot };
}

function createLoader(scene, loadContainer) {
  const id = 'LOADER-01';
  const root = new TransformNode(id, scene);
  root.metadata = {
    instanceId: id,
    type: 'wheel-loader',
    mobileEquipment: true,
    integrationManagedAnimation: true,
    groundedBy: 'getTerrainHeight + 0.04 m route offset',
    targetDimensionsM: { ...REFERENCE_EQUIPMENT_DIMENSIONS.wheelLoader },
  };
  const articulation = new TransformNode('loader-articulation', scene);
  articulation.parent = root;
  articulation.position.set(0, 1.35, 0);
  articulation.metadata = { rotationAxis: 'y' };
  const armPivot = new TransformNode('loader-arm-pivot', scene);
  armPivot.parent = articulation;
  armPivot.position.set(1.15, 0.3, 0);
  armPivot.metadata = { rotationAxis: 'z' };
  const bucketPivot = new TransformNode('loader-bucket-pivot', scene);
  bucketPivot.parent = armPivot;
  bucketPivot.position.set(4.05, 0.05, 0);
  bucketPivot.metadata = { rotationAxis: 'z' };
  const wheels = [];
  for (let index = 0; index < 4; index += 1) {
    const wheel = new TransformNode(`loader-wheel-${index + 1}`, scene);
    wheel.parent = index < 2 ? root : articulation;
    wheel.metadata = { wheelRadiusM: 1.25, rotationAxis: 'z' };
    wheels.push(wheel);
  }
  const visual = makeVisual(scene, id, loadContainer);
  visual.host.parent = root;
  return {
    id,
    root,
    visual,
    articulation,
    armPivot,
    bucketPivot,
    wheels,
    cumulativeWheelTravelM: 0,
  };
}

export function createBabylonMobileEquipmentSystem({ scene, loadContainer } = {}) {
  if (!scene) throw new TypeError('Babylon mobile equipment system requires a Scene.');
  if (scene.useRightHandedSystem !== true) throw new Error('Babylon mobile equipment system requires a right-handed Scene.');

  const root = new TransformNode('babylon-mobile-equipment', scene);
  root.metadata = {
    migrationStage: 'V31-mobile',
    renderer: 'babylon',
    animatedTruckCount: 3,
  };
  const loadedLane = createBabylonPrimaryLaneCurve(TRUCK_LANE_OFFSET_M);
  const returnLane = createBabylonPrimaryLaneCurve(-TRUCK_LANE_OFFSET_M, { reverse: true });
  const loaderOutbound = routeFromXZ(MOBILE_ROUTE_LAYOUT.loaderOutbound);
  const loaderReturn = routeFromXZ(MOBILE_ROUTE_LAYOUT.loaderReturn);
  const trucks = BABYLON_TRUCK_PHASE_OFFSETS_SECONDS.map((_, index) => createTruck(scene, `TRUCK-0${index + 1}`, loadContainer));
  const excavator = createExcavator(scene, loadContainer);
  const loader = createLoader(scene, loadContainer);
  [...trucks, excavator, loader].forEach((handle) => { handle.root.parent = root; });

  let enabled = true;
  let elapsed = 0;
  const truckCycle = Object.values(BABYLON_TRUCK_TIMINGS).reduce((sum, seconds) => sum + seconds, 0);
  const loadedEnd = loadedLane.getPoint(1);
  const returnStart = returnLane.getPoint(0);
  const returnEnd = returnLane.getPoint(1);
  const loadedStart = loadedLane.getPoint(0);

  function updateTruck(handle, cycleSeconds, { initialize = false } = {}) {
    const t = ((cycleSeconds % truckCycle) + truckCycle) % truckCycle;
    let position;
    let tangent;
    let steeringAngle = 0;
    let preserveDumpHeading = false;
    let state = 'loading-at-pit';
    let routeProgress = 0;
    let routeDirection = 1;
    const loadingEnd = BABYLON_TRUCK_TIMINGS.loading;
    const haulEnd = loadingEnd + BABYLON_TRUCK_TIMINGS.haul;
    const dumpEnd = haulEnd + BABYLON_TRUCK_TIMINGS.dump;
    const romTurnaroundEnd = dumpEnd + BABYLON_TRUCK_TIMINGS.romTurnaround;
    const returnEndTime = romTurnaroundEnd + BABYLON_TRUCK_TIMINGS.return;

    if (t < loadingEnd) {
      position = loadedLane.getPoint(0);
      tangent = loadedLane.getTangent(0.01);
      handle.setLoaded(true);
      handle.setDumpAngle(0);
    } else if (t < haulEnd) {
      const p = easedDriveProgress((t - loadingEnd) / BABYLON_TRUCK_TIMINGS.haul);
      position = loadedLane.getPoint(p);
      tangent = loadedLane.getTangent(Math.min(0.999, p));
      handle.setLoaded(true);
      handle.setDumpAngle(0);
      steeringAngle = steeringFromCurve(loadedLane, p);
      state = 'loaded-haul';
      routeProgress = p;
    } else if (t < dumpEnd) {
      const p = (t - haulEnd) / BABYLON_TRUCK_TIMINGS.dump;
      position = loadedLane.getPoint(1);
      tangent = loadedLane.getTangent(0.999);
      handle.setDumpAngle(48 * DEG * Math.sin(Math.PI * p));
      handle.setLoaded(p < 0.58);
      handle.root.rotationQuaternion = null;
      handle.root.rotation.set(0, Math.PI, 0);
      preserveDumpHeading = true;
      state = 'dumping-at-rom';
      routeProgress = 1;
    } else if (t < romTurnaroundEnd) {
      const p = smoothstep01((t - dumpEnd) / BABYLON_TRUCK_TIMINGS.romTurnaround);
      position = lerpPoint(loadedEnd, returnStart, p);
      position = groundBabylonRoadLaneTransition(position, lerp(TRUCK_LANE_OFFSET_M, -TRUCK_LANE_OFFSET_M, p));
      tangent = {
        x: returnStart.x - loadedEnd.x,
        y: returnStart.y - loadedEnd.y,
        z: returnStart.z - loadedEnd.z,
      };
      handle.setLoaded(false);
      handle.setDumpAngle(0);
      steeringAngle = 0.28;
      state = 'rom-turnaround';
      routeProgress = 1;
      routeDirection = -1;
    } else if (t < returnEndTime) {
      const p = easedDriveProgress((t - romTurnaroundEnd) / BABYLON_TRUCK_TIMINGS.return);
      position = returnLane.getPoint(p);
      tangent = returnLane.getTangent(Math.min(0.999, p));
      handle.setLoaded(false);
      handle.setDumpAngle(0);
      steeringAngle = steeringFromCurve(returnLane, p);
      state = 'empty-return';
      routeProgress = p;
      routeDirection = -1;
    } else {
      const p = smoothstep01((t - returnEndTime) / BABYLON_TRUCK_TIMINGS.pitTurnaround);
      position = lerpPoint(returnEnd, loadedStart, p);
      position = groundBabylonRoadLaneTransition(position, lerp(-TRUCK_LANE_OFFSET_M, TRUCK_LANE_OFFSET_M, p));
      tangent = {
        x: loadedStart.x - returnEnd.x,
        y: loadedStart.y - returnEnd.y,
        z: loadedStart.z - returnEnd.z,
      };
      handle.setLoaded(false);
      handle.setDumpAngle(0);
      steeringAngle = -0.28;
      state = 'pit-turnaround';
      routeProgress = 0;
      routeDirection = 1;
    }

    const travelDistanceM = initialize ? 0 : distance3(handle.root.position, position);
    copyPoint(handle.root.position, position);
    if (!preserveDumpHeading) orientTruckAlongGrade(handle.root, tangent);
    handle.setSteering(preserveDumpHeading ? 0 : steeringAngle);
    if (travelDistanceM > 0) handle.advanceWheelTravel(travelDistanceM);
    handle.root.metadata.operationalState = state;
    handle.root.metadata.routeProgress = routeProgress;
    handle.root.metadata.routeDirection = routeDirection;
    handle.root.metadata.roadSurfaceY = position.y;
    handle.root.metadata.terrainY = getTerrainHeight(position.x, position.z);
  }

  function updateLoader(dt) {
    const cycle = 32;
    const t = elapsed % cycle;
    let curve = loaderOutbound;
    let p = 0;
    if (t < 7) p = 0;
    else if (t < 16) p = (t - 7) / 9;
    else if (t < 21) p = 1;
    else {
      curve = loaderReturn;
      p = (t - 21) / 11;
    }
    const normalizedP = clamp(p, 0, 1);
    const position = curve.getPoint(normalizedP);
    const tangent = curve.getTangent(clamp(p, 0.001, 0.999));
    const travelDistanceM = distance3(loader.root.position, position);
    copyPoint(loader.root.position, position);
    if (t < 7) {
      orientAlong(loader.root, { x: 6 - position.x, y: 0, z: -36 - position.z });
    } else if (t >= 16 && t < 21) {
      orientAlong(loader.root, { x: 29.5 - position.x, y: 0, z: -26 - position.z });
    } else {
      orientAlong(loader.root, tangent);
    }

    let liftDeg = 8;
    let bucketDeg = -8;
    let articulateDeg = 0;
    if (t < 7) {
      const phase = smoothstep01(t / 7);
      liftDeg = lerp(5, 13, phase);
      bucketDeg = lerp(10, -18, phase);
      articulateDeg = lerp(-4, 0, phase);
    } else if (t < 16) {
      liftDeg = 13;
      bucketDeg = -18;
      articulateDeg = Math.sin(((t - 7) / 9) * Math.PI) * 4;
    } else if (t < 21) {
      const phase = smoothstep01((t - 16) / 5);
      liftDeg = lerp(13, 32, phase);
      bucketDeg = lerp(-18, 34, phase);
      articulateDeg = lerp(2, -2, phase);
    } else {
      const phase = smoothstep01((t - 21) / 11);
      liftDeg = lerp(24, 8, phase);
      bucketDeg = lerp(12, -8, phase);
      articulateDeg = Math.sin(((t - 21) / 11) * Math.PI) * -4;
    }
    loader.articulation.rotation.y = articulateDeg * DEG;
    loader.armPivot.rotation.z = liftDeg * DEG;
    loader.bucketPivot.rotation.z = bucketDeg * DEG;
    if (travelDistanceM > 0) {
      loader.cumulativeWheelTravelM += travelDistanceM;
      loader.wheels.forEach((wheel) => { wheel.rotation.z -= travelDistanceM / 1.25; });
    }
    const importedWheelNames = ['FL', 'FR', 'RL', 'RR'].map((code) => `WHEEL-LOADER_WHEEL_${code}`);
    importedWheelNames.forEach((name) => {
      setVisualAxisDelta(findVisualNode(loader.visual, name), 'z', -loader.cumulativeWheelTravelM / 1.25);
    });
    const loaded = t >= 5 && t < 19.3;
    loader.visual.setMaterialLoadVisible(loaded);
    loader.root.metadata.loadState = loaded ? 'loaded' : 'empty';
    loader.root.metadata.operationalState = t < 7
      ? 'loading-stockpile'
      : t < 16
        ? 'loaded-to-reclaim'
        : t < 21
          ? 'dumping-to-reclaim'
          : 'empty-return';
    loader.root.metadata.terrainY = getTerrainHeight(position.x, position.z);
    loader.root.metadata.routeElevationOffsetM = position.y - loader.root.metadata.terrainY;
    loader.root.metadata.lastDeltaSeconds = dt;
  }

  function updateExcavator() {
    const shovelTime = elapsed % 20;
    const cycle = shovelTime / 20;
    const swing = Math.sin((cycle - 0.22) * Math.PI * 2) * 0.5 + 0.5;
    excavator.upper.rotation.y = lerp(-0.46, 0.62, smoothstep01((swing - 0.12) / (0.88 - 0.12)));
    excavator.boomPivot.rotation.z = (22 + 16 * (0.5 + 0.5 * Math.sin((cycle + 0.08) * Math.PI * 2))) * DEG;
    excavator.stickPivot.rotation.z = (-48 + 27 * (0.5 + 0.5 * Math.sin((cycle + 0.22) * Math.PI * 2))) * DEG;
    excavator.bucketPivot.rotation.z = (-22 + 58 * (0.5 + 0.5 * Math.sin((cycle + 0.37) * Math.PI * 2))) * DEG;
    const loaded = cycle > 0.22 && cycle < 0.7;
    excavator.visual.setMaterialLoadVisible(loaded);
    excavator.root.metadata.loadState = loaded ? 'loaded' : 'empty';
    excavator.root.metadata.operationalState = cycle < 0.35
      ? 'digging'
      : cycle < 0.7
        ? 'swing-loaded'
        : 'returning';
    const activeTruck = trucks.find((truck) => truck.root.metadata.operationalState === 'loading-at-pit');
    excavator.root.metadata.loadingTruckId = activeTruck?.id ?? null;
  }

  trucks.forEach((truckHandle, index) => {
    updateTruck(truckHandle, BABYLON_TRUCK_PHASE_OFFSETS_SECONDS[index], { initialize: true });
  });
  const initialLoader = loaderOutbound.getPoint(0);
  copyPoint(loader.root.position, initialLoader);
  orientAlong(loader.root, { x: 6 - initialLoader.x, y: 0, z: -36 - initialLoader.z });
  loader.root.metadata.terrainY = getTerrainHeight(initialLoader.x, initialLoader.z);

  const visuals = [...trucks.map((truck) => truck.visual), excavator.visual, loader.visual];
  const ready = Promise.allSettled(visuals.map((visual) => visual.ready)).then(() => {
    trucks.forEach((truck) => truck.visual.setAnimationsEnabled(false));
    excavator.visual.setAnimationsEnabled(enabled);
    loader.visual.setAnimationsEnabled(enabled);
    trucks.forEach((truck) => truck.syncVisual());
    return root;
  });

  function update(deltaSeconds) {
    if (!enabled || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
    const dt = Math.min(deltaSeconds, 0.1);
    elapsed += dt;
    trucks.forEach((truckHandle, index) => {
      updateTruck(truckHandle, elapsed + BABYLON_TRUCK_PHASE_OFFSETS_SECONDS[index]);
    });
    updateExcavator();
    updateLoader(dt);
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    trucks.forEach((truck) => truck.visual.setAnimationsEnabled(false));
    excavator.visual.setAnimationsEnabled(enabled);
    loader.visual.setAnimationsEnabled(enabled);
    return enabled;
  }

  function dispose() {
    visuals.forEach((visual) => visual.dispose());
    root.dispose();
  }

  return {
    root,
    trucks,
    truck: trucks[0],
    truck02: trucks[1],
    truck03: trucks[2],
    excavator,
    shovel: excavator,
    loader,
    visuals,
    ready,
    update,
    setEnabled,
    dispose,
    truckRoute: loadedLane,
    returnRoute: returnLane,
    loaderRoute: loaderOutbound,
    loaderReturnRoute: loaderReturn,
    get enabled() { return enabled; },
    get elapsedSeconds() { return elapsed; },
    get truckCycleSeconds() { return truckCycle; },
  };
}
