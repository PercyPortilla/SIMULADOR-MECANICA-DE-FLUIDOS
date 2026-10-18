import * as THREE from 'three';
import { createCatalogInstance } from './assetIntegrationLayer.js';
import { getTerrainHeight } from '../environment/terrainHeight.js';
import { createRoadLaneCurve, getRoadSurfaceOffset } from '../environment/haulRoads.js';
import { MOBILE_ROUTE_LAYOUT, SUPPORT_LAYOUT } from './finalLayout.js';
import { createWheelLoaderAsset } from '../../equipment/mining/wheelLoader.js';

function headingFromTangent(tangent) {
  return Math.atan2(-tangent.z, tangent.x);
}

function offsetPolyline(points, offset) {
  return points.map(([x, z], index) => {
    const prev = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const dx = next[0] - prev[0];
    const dz = next[1] - prev[1];
    const length = Math.max(1e-6, Math.hypot(dx, dz));
    const sideX = -dz / length;
    const sideZ = dx / length;
    return [x + sideX * offset, z + sideZ * offset];
  });
}

function curveFromXZ(points, elevationOffset = 0.04) {
  return new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, getTerrainHeight(x, z) + elevationOffset, z)), false, 'centripetal');
}

function orientAlong(root, tangent) {
  root.rotation.set(0, headingFromTangent(tangent), 0);
}

function orientTruckAlongGrade(root, tangent) {
  const forward = tangent.clone().normalize();
  if (forward.lengthSq() < 1e-10) return;
  const worldUp = new THREE.Vector3(0, 1, 0);
  const lateral = new THREE.Vector3().crossVectors(forward, worldUp).normalize();
  if (lateral.lengthSq() < 1e-10) {
    orientAlong(root, tangent);
    return;
  }
  const up = new THREE.Vector3().crossVectors(lateral, forward).normalize();
  const basis = new THREE.Matrix4().makeBasis(forward, up, lateral);
  root.quaternion.setFromRotationMatrix(basis);
}

function signedHeadingDelta(a, b) {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}

function steeringFromCurve(curve, progress) {
  const p0 = THREE.MathUtils.clamp(progress, 0.001, 0.989);
  const p1 = THREE.MathUtils.clamp(p0 + 0.010, 0.002, 0.999);
  const heading0 = headingFromTangent(curve.getTangent(p0));
  const heading1 = headingFromTangent(curve.getTangent(p1));
  return THREE.MathUtils.clamp(signedHeadingDelta(heading0, heading1) * 2.4, -0.34, 0.34);
}

function easedDriveProgress(progress) {
  const t = THREE.MathUtils.clamp(progress, 0, 1);
  // Short acceleration/deceleration ramps keep starts and stops readable without
  // the 1.5x peak speed produced by a full smoothstep over the whole haul leg.
  const ramp = 0.12;
  const maxNormalizedSpeed = 1 / (1 - ramp);
  if (t < ramp) return 0.5 * maxNormalizedSpeed * t * t / ramp;
  if (t > 1 - ramp) {
    const remaining = 1 - t;
    return 1 - 0.5 * maxNormalizedSpeed * remaining * remaining / ramp;
  }
  return 0.5 * maxNormalizedSpeed * ramp + maxNormalizedSpeed * (t - ramp);
}

function groundRoadLaneTransition(position, lateralOffsetM) {
  position.y = getTerrainHeight(position.x, position.z) + getRoadSurfaceOffset('ROAD-01', lateralOffsetM);
  return position;
}

function createLocalOreCascade({ name, start, end, count = 10, radius = 0.13 } = {}) {
  const geometry = new THREE.DodecahedronGeometry(radius, 0);
  const material = new THREE.MeshStandardMaterial({ color: 0x76583f, roughness: 1, metalness: 0 });
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.name = name;
  mesh.visible = false;
  mesh.castShadow = false;
  mesh.userData.visualOnly = true;
  mesh.userData.educationalMaterialFlow = true;
  const phases = Array.from({ length: count }, (_, index) => index / count);
  const startPoint = start.clone();
  const endPoint = end.clone();
  const position = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  function update(timeSeconds, active) {
    mesh.visible = Boolean(active);
    if (!mesh.visible) return;
    phases.forEach((offset, index) => {
      const phase = (timeSeconds * 0.72 + offset) % 1;
      position.copy(startPoint).lerp(endPoint, phase);
      position.z += Math.sin(index * 2.2 + phase * Math.PI * 2) * radius * 1.1;
      quaternion.setFromEuler(new THREE.Euler(phase * 2.6, index * 0.37, phase * 1.7));
      const s = 0.76 + (index % 4) * 0.08;
      scale.set(s, s, s);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }
  function setEnd(nextEnd) {
    if (nextEnd?.isVector3) endPoint.copy(nextEnd);
  }
  function setStart(nextStart) {
    if (nextStart?.isVector3) startPoint.copy(nextStart);
  }
  return {
    mesh,
    update,
    setStart,
    setEnd,
    getStartLocal() { return startPoint.clone(); },
    getEndLocal() { return endPoint.clone(); },
  };
}

export function createIntegratedMobile({ plantRoot, registry }) {
  const root = new THREE.Group();
  root.name = 'integrated-mobile-equipment';
  plantRoot.add(root);

  const shovelCreated = createCatalogInstance({
    instanceId: 'EXCAVATOR-01',
    assetKey: 'miningShovel',
    position: new THREE.Vector3(SUPPORT_LAYOUT.truckLoad.x + 10, getTerrainHeight(SUPPORT_LAYOUT.truckLoad.x + 10, SUPPORT_LAYOUT.truckLoad.z - 2), SUPPORT_LAYOUT.truckLoad.z - 2),
    rotationY: Math.PI - 0.10,
    registry,
  });
  const truckPhaseOffsets = Object.freeze([0, 34, 68]);
  const truckCreated = ['TRUCK-01', 'TRUCK-02', 'TRUCK-03'].map((instanceId) => createCatalogInstance({
    instanceId,
    assetKey: 'haulTruck',
    position: new THREE.Vector3(SUPPORT_LAYOUT.truckLoad.x, getTerrainHeight(SUPPORT_LAYOUT.truckLoad.x, SUPPORT_LAYOUT.truckLoad.z), SUPPORT_LAYOUT.truckLoad.z),
    rotationY: 0,
    registry,
  }));
  const loaderCreated = createCatalogInstance({
    instanceId: 'LOADER-01',
    assetKey: 'wheelLoader',
    position: new THREE.Vector3(SUPPORT_LAYOUT.loaderPickup.x, getTerrainHeight(SUPPORT_LAYOUT.loaderPickup.x, SUPPORT_LAYOUT.loaderPickup.z), SUPPORT_LAYOUT.loaderPickup.z),
    rotationY: 0,
    registry,
  });
  // A second loader trims the small ROM staging pile. It is deliberately
  // visual-only and is not registered in the process/Inspection equipment
  // registry, so LOADER-01 keeps exclusive ownership of the stockpile/reclaim
  // cycle and no new process semantics or ports are introduced.
  const romLoader = createWheelLoaderAsset();
  romLoader.root.name = 'ROM-LOADER-01';
  romLoader.root.position.set(-121.5, getTerrainHeight(-121.5, -12.0) + 0.04, -12.0);
  romLoader.root.rotation.y = Math.PI;
  romLoader.root.userData.mobileEquipment = true;
  romLoader.root.userData.visualOnly = true;
  romLoader.root.userData.processCoupled = false;
  romLoader.root.userData.integrationManagedAnimation = true;
  romLoader.root.userData.inspectionExcluded = true;
  romLoader.root.userData.operationalState = 'rom-stockpile-trimming';
  root.add(romLoader.root);
  [shovelCreated, ...truckCreated, loaderCreated].forEach(({ handle }) => {
    handle.root.userData.mobileEquipment = true;
    handle.root.userData.integrationManagedAnimation = true;
    root.add(handle.root);
  });

  const trucks = truckCreated.map(({ handle }, index) => {
    handle.root.userData.routeId = 'ROAD-01';
    handle.root.userData.v24PhaseOffsetSeconds = truckPhaseOffsets[index];
    handle.setAnimationEnabled(false);
    return handle;
  });
  const truckDumpCascades = new Map();
  trucks.forEach((truckHandle) => {
    const cascade = createLocalOreCascade({
      name: `${truckHandle.root.name}-v24-dump-ore`,
      start: new THREE.Vector3(-4.15, 4.15, 0),
      end: new THREE.Vector3(-5.65, 0.82, 0),
      count: 12,
      radius: 0.16,
    });
    truckHandle.root.add(cascade.mesh);
    truckDumpCascades.set(truckHandle, cascade);
  });
  const truck = trucks[0];
  const shovel = shovelCreated.handle;
  const loader = loaderCreated.handle;
  const shovelTruckCascade = createLocalOreCascade({
    name: 'EXCAVATOR-01-v29-truck-loading-ore',
    start: new THREE.Vector3(),
    end: new THREE.Vector3(0, -1, 0),
    count: 12,
    radius: 0.15,
  });
  root.add(shovelTruckCascade.mesh);
  const loaderDumpCascade = createLocalOreCascade({
    name: 'LOADER-01-v24-dump-ore',
    start: new THREE.Vector3(5.05, 3.05, 0),
    end: new THREE.Vector3(6.0, 0.72, 0),
    count: 10,
    radius: 0.14,
  });
  loader.root.add(loaderDumpCascade.mesh);
  shovel.setAnimationEnabled(true);
  loader.setAnimationEnabled(true);
  romLoader.setAnimationEnabled(true);

  // Truck wheel centres are referenced to the engineered road surface, which sits
  // slightly above the terrain mesh. Keep the vehicle root on that surface rather
  // than on the underlying terrain to avoid visible tyre burial/floating.
  const truckLaneOffset = 3.4;
  const loadedLane = createRoadLaneCurve('ROAD-01', truckLaneOffset);
  const returnLane = createRoadLaneCurve('ROAD-01', -truckLaneOffset, { reverse: true });
  const loaderCurve = curveFromXZ(MOBILE_ROUTE_LAYOUT.loaderOutbound);
  const loaderReturn = curveFromXZ(MOBILE_ROUTE_LAYOUT.loaderReturn);
  // ROM-LOADER-01 is visual-only, but its motion should still read as a real
  // trimming cycle around the east/south-east face of the ROM staging pile.
  // The root stays outside the pile while the bucket reaches the toe.
  const romLoaderOutbound = curveFromXZ([
    [-119.0, -6.5],
    [-120.0, -5.3],
    [-120.5, -6.7],
  ]);
  const romLoaderReturn = curveFromXZ([
    [-120.5, -6.7],
    [-118.5, -5.4],
    [-119.0, -6.5],
  ]);
  const romLoaderDumpWorld = new THREE.Vector3(
    -128.2,
    getTerrainHeight(-128.2, -7.0) + 0.28,
    -7.0,
  );
  const romLoaderDumpCascade = createLocalOreCascade({
    name: 'ROM-LOADER-01-v29-trim-ore',
    start: new THREE.Vector3(5.0, 3.0, 0),
    end: new THREE.Vector3(6.0, 0.72, 0),
    count: 10,
    radius: 0.14,
  });
  romLoader.root.add(romLoaderDumpCascade.mesh);
  // Scratch vectors avoid transient allocations during the managed vehicle loop.
  const loaderPositionScratch = new THREE.Vector3();
  const loaderTangentScratch = new THREE.Vector3();
  const loaderHeadingScratch = new THREE.Vector3();
  const romLoaderPositionScratch = new THREE.Vector3();
  const romLoaderTangentScratch = new THREE.Vector3();
  const romLoaderHeadingScratch = new THREE.Vector3();
  const romReceiverWorldScratch = new THREE.Vector3();
  const romReceiverLocalScratch = new THREE.Vector3();
  const romReceiverPortWorldScratch = new THREE.Vector3();
  const dumpSourceWorldScratch = new THREE.Vector3();
  const dumpSourceLocalScratch = new THREE.Vector3();
  const receiverSourceLocalScratch = new THREE.Vector3();
  const receiverTargetLocalScratch = new THREE.Vector3();
  const loaderReceiverWorldScratch = new THREE.Vector3();
  const loaderReceiverLocalScratch = new THREE.Vector3();
  const loaderDumpSourceWorldScratch = new THREE.Vector3();
  const loaderDumpSourceLocalScratch = new THREE.Vector3();
  const truckDumpLipLocal = new THREE.Vector3(-1.45, 1.45, 0);
  const loaderBucketLipLocal = new THREE.Vector3(1.15, -0.05, 0);
  const shovelBucketLipLocal = new THREE.Vector3(1.75, -0.42, 0);
  const shovelTransferSourceWorldScratch = new THREE.Vector3();
  const shovelTransferTargetWorldScratch = new THREE.Vector3();
  const shovelTransferSourceLocalScratch = new THREE.Vector3();
  const shovelTransferTargetLocalScratch = new THREE.Vector3();
  const truckLoadBedLocal = new THREE.Vector3(1.55, 1.05, 0);
  const truckPositionScratch = new THREE.Vector3();
  const truckTangentScratch = new THREE.Vector3();

  let enabled = true;
  let elapsed = 0;
  const truckTimings = Object.freeze({
    loading: 10,
    haul: 40,
    dump: 8,
    romTurnaround: 5,
    return: 35,
    pitTurnaround: 5,
  });
  const truckCycle = Object.values(truckTimings).reduce((a, b) => a + b, 0);
  const loadedEnd = loadedLane.getPoint(1);
  const returnStart = returnLane.getPoint(0);
  const returnEnd = returnLane.getPoint(1);
  const loadedStart = loadedLane.getPoint(0);

  function updateTruck(truckHandle, cycleSeconds, { initialize = false } = {}) {
    const t = cycleSeconds % truckCycle;
    let position;
    let tangent;
    let steeringAngle = 0;
    let preserveDumpHeading = false;
    let state = 'loading-at-pit';
    let routeProgress = 0;
    let routeDirection = 1;
    let dumpVisualPhase = -1;
    if (t < truckTimings.loading) {
      position = loadedLane.getPoint(0, truckPositionScratch);
      tangent = loadedLane.getTangent(0.01, truckTangentScratch);
      truckHandle.setLoaded(true);
      truckHandle.setDumpAngle(0);
    } else if (t < truckTimings.loading + truckTimings.haul) {
      const p = easedDriveProgress((t - truckTimings.loading) / truckTimings.haul);
      position = loadedLane.getPoint(p, truckPositionScratch);
      tangent = loadedLane.getTangent(Math.min(0.999, p), truckTangentScratch);
      truckHandle.setLoaded(true);
      truckHandle.setDumpAngle(0);
      steeringAngle = steeringFromCurve(loadedLane, p);
      state = 'loaded-haul';
      routeProgress = p;
    } else if (t < truckTimings.loading + truckTimings.haul + truckTimings.dump) {
      const p = (t - truckTimings.loading - truckTimings.haul) / truckTimings.dump;
      position = loadedLane.getPoint(1, truckPositionScratch);
      tangent = loadedLane.getTangent(0.999, truckTangentScratch);
      const angle = THREE.MathUtils.degToRad(48) * Math.sin(Math.PI * p);
      truckHandle.setDumpAngle(angle);
      truckHandle.setLoaded(p < 0.58);
      // Rear of the rigid truck points toward the ROM hopper during dumping.
      // Preserve this heading for the dump phase instead of immediately replacing
      // it with the terminal road tangent below.
      truckHandle.root.rotation.set(0, Math.PI, 0);
      preserveDumpHeading = true;
      state = 'dumping-at-rom';
      routeProgress = 1;
      dumpVisualPhase = p;
    } else if (t < truckTimings.loading + truckTimings.haul + truckTimings.dump + truckTimings.romTurnaround) {
      const start = truckTimings.loading + truckTimings.haul + truckTimings.dump;
      const p = THREE.MathUtils.smoothstep((t - start) / truckTimings.romTurnaround, 0, 1);
      position = truckPositionScratch.copy(loadedEnd).lerp(returnStart, p);
      groundRoadLaneTransition(position, THREE.MathUtils.lerp(truckLaneOffset, -truckLaneOffset, p));
      tangent = truckTangentScratch.copy(returnStart).sub(loadedEnd).normalize();
      truckHandle.setLoaded(false);
      truckHandle.setDumpAngle(0);
      steeringAngle = 0.28;
      state = 'rom-turnaround';
      routeProgress = 1;
      routeDirection = -1;
    } else if (t < truckTimings.loading + truckTimings.haul + truckTimings.dump + truckTimings.romTurnaround + truckTimings.return) {
      const start = truckTimings.loading + truckTimings.haul + truckTimings.dump + truckTimings.romTurnaround;
      const p = easedDriveProgress((t - start) / truckTimings.return);
      position = returnLane.getPoint(p, truckPositionScratch);
      tangent = returnLane.getTangent(Math.min(0.999, p), truckTangentScratch);
      truckHandle.setLoaded(false);
      truckHandle.setDumpAngle(0);
      steeringAngle = steeringFromCurve(returnLane, p);
      state = 'empty-return';
      routeProgress = p;
      routeDirection = -1;
    } else {
      const start = truckTimings.loading + truckTimings.haul + truckTimings.dump + truckTimings.romTurnaround + truckTimings.return;
      const p = THREE.MathUtils.smoothstep((t - start) / truckTimings.pitTurnaround, 0, 1);
      position = truckPositionScratch.copy(returnEnd).lerp(loadedStart, p);
      groundRoadLaneTransition(position, THREE.MathUtils.lerp(-truckLaneOffset, truckLaneOffset, p));
      tangent = truckTangentScratch.copy(loadedStart).sub(returnEnd).normalize();
      truckHandle.setLoaded(false);
      truckHandle.setDumpAngle(0);
      steeringAngle = -0.28;
      state = 'pit-turnaround';
      routeProgress = 0;
      routeDirection = 1;
    }
    const travelDistanceM = initialize ? 0 : truckHandle.root.position.distanceTo(position);
    truckHandle.root.position.copy(position);
    if (!preserveDumpHeading) orientTruckAlongGrade(truckHandle.root, tangent);
    truckHandle.setSteering?.(preserveDumpHeading ? 0 : steeringAngle);
    if (travelDistanceM > 0) truckHandle.advanceWheelTravel?.(travelDistanceM);
    truckHandle.root.userData.operationalState = state;
    truckHandle.root.userData.routeProgress = routeProgress;
    truckHandle.root.userData.routeDirection = routeDirection;
    truckHandle.root.userData.roadSurfaceY = position.y;
    const dumpCascade = truckDumpCascades.get(truckHandle);
    if (dumpCascade && registry.items?.has('ROM-HOPPER')) {
      truckHandle.root.updateMatrixWorld(true);
      const dumpPivot = truckHandle.root.getObjectByName('haul-truck-dump-pivot');
      if (dumpPivot) {
        dumpSourceWorldScratch.copy(truckDumpLipLocal);
        dumpPivot.localToWorld(dumpSourceWorldScratch);
        dumpSourceLocalScratch.copy(dumpSourceWorldScratch);
        truckHandle.root.worldToLocal(dumpSourceLocalScratch);
        dumpCascade.setStart(dumpSourceLocalScratch);
      } else {
        dumpSourceWorldScratch.copy(dumpCascade.getStartLocal());
        truckHandle.root.localToWorld(dumpSourceWorldScratch);
      }

      const receiver = registry.getEquipment('ROM-HOPPER');
      romReceiverPortWorldScratch.copy(registry.getPortWorldPosition('ROM-HOPPER', 'feedIn'));
      receiver.group3D.updateMatrixWorld(true);
      receiverSourceLocalScratch.copy(dumpSourceWorldScratch);
      receiver.group3D.worldToLocal(receiverSourceLocalScratch);
      const feedPort = registry.getPort('ROM-HOPPER', 'feedIn');
      const halfMouthZ = Math.min(2.35, Number(receiver.dimensions?.width ?? 9.2) * 0.27);
      receiverTargetLocalScratch.set(
        feedPort.localPosition.x + 0.48,
        feedPort.localPosition.y - 0.18,
        THREE.MathUtils.clamp(
          receiverSourceLocalScratch.z,
          feedPort.localPosition.z - halfMouthZ,
          feedPort.localPosition.z + halfMouthZ,
        ),
      );
      romReceiverWorldScratch.copy(receiverTargetLocalScratch);
      receiver.group3D.localToWorld(romReceiverWorldScratch);
      // Do not fake a downhill stream by overwriting receiver Y. The receiver
      // geometry itself must stay physically below the truck dump lip.
      romReceiverLocalScratch.copy(romReceiverWorldScratch);
      truckHandle.root.worldToLocal(romReceiverLocalScratch);
      dumpCascade.setEnd(romReceiverLocalScratch);
      dumpCascade.mesh.userData.receiverEquipmentId = 'ROM-HOPPER';
      dumpCascade.mesh.userData.receiverPortId = 'feedIn';
      dumpCascade.mesh.userData.sourceWorld = dumpSourceWorldScratch.toArray();
      dumpCascade.mesh.userData.receiverPortWorld = romReceiverPortWorldScratch.toArray();
      dumpCascade.mesh.userData.receiverWorld = romReceiverWorldScratch.toArray();
    }
    dumpCascade?.update(cycleSeconds, dumpVisualPhase >= 0.18 && dumpVisualPhase <= 0.82);
  }

  function updateLoader(dt) {
    const cycle = 32;
    const t = elapsed % cycle;
    let curve;
    let p;
    if (t < 7) {
      curve = loaderCurve;
      p = 0;
    } else if (t < 16) {
      curve = loaderCurve;
      p = (t - 7) / 9;
    } else if (t < 21) {
      curve = loaderCurve;
      p = 1;
    } else {
      curve = loaderReturn;
      p = (t - 21) / 11;
    }
    const normalizedP = Math.min(1, Math.max(0, p));
    const tangentP = Math.min(0.999, Math.max(0.001, p));
    curve.getPoint(normalizedP, loaderPositionScratch);
    curve.getTangent(tangentP, loaderTangentScratch);
    const travelDistanceM = loader.root.position.distanceTo(loaderPositionScratch);
    loader.root.position.copy(loaderPositionScratch);
    if (t < 7) {
      loaderHeadingScratch.set(6, loaderPositionScratch.y, -36).sub(loaderPositionScratch).normalize();
      orientAlong(loader.root, loaderHeadingScratch);
    } else if (t >= 16 && t < 21) {
      loaderHeadingScratch.set(29.5, loaderPositionScratch.y, -26).sub(loaderPositionScratch).normalize();
      orientAlong(loader.root, loaderHeadingScratch);
    } else {
      orientAlong(loader.root, loaderTangentScratch);
    }
    loader.update(dt);
    loader.setVisualAnimationTime?.(t);
    if (travelDistanceM > 0) loader.advanceWheelTravel?.(travelDistanceM);
    loader.setMaterialLoadVisible?.(t >= 5 && t < 19.3);
    if (registry.items?.has('STOCKPILE-RECLAIM')) {
      loader.root.updateMatrixWorld(true);
      const bucketPivot = loader.root.getObjectByName('loader-bucket-pivot');
      if (bucketPivot) {
        loaderDumpSourceWorldScratch.copy(loaderBucketLipLocal);
        bucketPivot.localToWorld(loaderDumpSourceWorldScratch);
        loaderDumpSourceLocalScratch.copy(loaderDumpSourceWorldScratch);
        loader.root.worldToLocal(loaderDumpSourceLocalScratch);
        loaderDumpCascade.setStart(loaderDumpSourceLocalScratch);
      }
      loaderReceiverWorldScratch.copy(registry.getPortWorldPosition('STOCKPILE-RECLAIM', 'loaderDump'));
      const loaderReceiverDirection = registry.getPortWorldDirection('STOCKPILE-RECLAIM', 'loaderDump');
      loaderReceiverWorldScratch.addScaledVector(loaderReceiverDirection, 1.65);
      loaderReceiverWorldScratch.y = Math.min(loaderReceiverWorldScratch.y, loaderDumpSourceWorldScratch.y - 0.18);
      loaderReceiverLocalScratch.copy(loaderReceiverWorldScratch);
      loader.root.worldToLocal(loaderReceiverLocalScratch);
      loaderDumpCascade.setEnd(loaderReceiverLocalScratch);
      loaderDumpCascade.mesh.userData.receiverEquipmentId = 'STOCKPILE-RECLAIM';
      loaderDumpCascade.mesh.userData.receiverPortId = 'loaderDump';
      loaderDumpCascade.mesh.userData.sourceWorld = loaderDumpSourceWorldScratch.toArray();
      loaderDumpCascade.mesh.userData.receiverPortWorld = registry.getPortWorldPosition('STOCKPILE-RECLAIM', 'loaderDump').toArray();
      loaderDumpCascade.mesh.userData.receiverWorld = loaderReceiverWorldScratch.toArray();
    }
    loaderDumpCascade.update(t, t >= 17.0 && t <= 20.2);
    loader.root.userData.operationalState = t < 7
      ? 'loading-stockpile'
      : t < 16
        ? 'loaded-to-reclaim'
        : t < 21
          ? 'dumping-to-reclaim'
          : 'empty-return';
    loader.root.userData.terrainY = getTerrainHeight(loader.root.position.x, loader.root.position.z);
  }

  function updateRomLoader(dt) {
    const cycle = 32;
    const t = elapsed % cycle;
    let curve = romLoaderOutbound;
    let p = 0;
    if (t < 7) {
      p = 0;
    } else if (t < 16) {
      p = (t - 7) / 9;
    } else if (t < 21) {
      p = 1;
    } else {
      curve = romLoaderReturn;
      p = (t - 21) / 11;
    }
    const normalizedP = THREE.MathUtils.clamp(p, 0, 1);
    const tangentP = THREE.MathUtils.clamp(p, 0.001, 0.999);
    curve.getPoint(normalizedP, romLoaderPositionScratch);
    curve.getTangent(tangentP, romLoaderTangentScratch);
    const travelDistanceM = romLoader.root.position.distanceTo(romLoaderPositionScratch);
    romLoader.root.position.copy(romLoaderPositionScratch);
    if (t < 7) {
      romLoaderHeadingScratch
        .set(-134.5, romLoaderPositionScratch.y, -13.0)
        .sub(romLoaderPositionScratch)
        .normalize();
      orientAlong(romLoader.root, romLoaderHeadingScratch);
    } else if (t >= 16 && t < 21) {
      romLoaderHeadingScratch
        .set(romLoaderDumpWorld.x, romLoaderPositionScratch.y, romLoaderDumpWorld.z)
        .sub(romLoaderPositionScratch)
        .normalize();
      orientAlong(romLoader.root, romLoaderHeadingScratch);
    } else {
      orientAlong(romLoader.root, romLoaderTangentScratch);
    }
    romLoader.update(dt);
    romLoader.setVisualAnimationTime?.(t);
    if (travelDistanceM > 0) romLoader.advanceWheelTravel?.(travelDistanceM);
    romLoader.setMaterialLoadVisible?.(t >= 5 && t < 19.3);
    romLoader.root.updateMatrixWorld(true);
    const romBucketPivot = romLoader.root.getObjectByName('loader-bucket-pivot');
    if (romBucketPivot) {
      loaderDumpSourceWorldScratch.copy(loaderBucketLipLocal);
      romBucketPivot.localToWorld(loaderDumpSourceWorldScratch);
      loaderDumpSourceLocalScratch.copy(loaderDumpSourceWorldScratch);
      romLoader.root.worldToLocal(loaderDumpSourceLocalScratch);
      romLoaderDumpCascade.setStart(loaderDumpSourceLocalScratch);
      romLoaderDumpCascade.mesh.userData.sourceWorld = loaderDumpSourceWorldScratch.toArray();
    }
    romReceiverLocalScratch.copy(romLoaderDumpWorld);
    romLoader.root.worldToLocal(romReceiverLocalScratch);
    romLoaderDumpCascade.setEnd(romReceiverLocalScratch);
    romLoaderDumpCascade.mesh.userData.receiverWorld = romLoaderDumpWorld.toArray();
    romLoaderDumpCascade.update(t, t >= 17.0 && t <= 20.2);
    romLoader.root.userData.operationalState = t < 7
      ? 'loading-rom-staging-pile'
      : t < 16
        ? 'loaded-trimming-pass'
        : t < 21
          ? 'dumping-rom-trim'
          : 'resetting-rom-loader';
    romLoader.root.userData.terrainY = getTerrainHeight(romLoader.root.position.x, romLoader.root.position.z);
  }

  function updateShovelTruckTransfer(shovelTime) {
    const activeTruck = trucks.find((truckHandle) => truckHandle.root.userData.operationalState === 'loading-at-pit');
    const shovelCycle = shovelTime / 20;
    const transferActive = Boolean(activeTruck) && shovelCycle >= 0.56 && shovelCycle <= 0.69;
    if (!activeTruck) {
      shovelTruckCascade.update(shovelTime, false);
      return;
    }

    shovel.root.updateMatrixWorld(true);
    activeTruck.root.updateMatrixWorld(true);
    root.updateMatrixWorld(true);
    const importedBucketOre = shovel.root.getObjectByName('MINING-SHOVEL_BUCKET_ORE');
    if (importedBucketOre) {
      importedBucketOre.getWorldPosition(shovelTransferSourceWorldScratch);
    } else {
      const bucketPivot = shovel.root.getObjectByName('bucket-pivot');
      if (bucketPivot) {
        shovelTransferSourceWorldScratch.copy(shovelBucketLipLocal);
        bucketPivot.localToWorld(shovelTransferSourceWorldScratch);
      } else {
        shovel.getWorldPosition?.(shovelTransferSourceWorldScratch);
      }
    }

    const importedTruckOre = activeTruck.root.getObjectByName('HAUL-TRUCK_ORE_LOAD');
    if (importedTruckOre) {
      importedTruckOre.getWorldPosition(shovelTransferTargetWorldScratch);
    } else {
      const dumpPivot = activeTruck.root.getObjectByName('haul-truck-dump-pivot');
      if (dumpPivot) {
        shovelTransferTargetWorldScratch.copy(truckLoadBedLocal);
        dumpPivot.localToWorld(shovelTransferTargetWorldScratch);
      } else {
        activeTruck.root.getWorldPosition(shovelTransferTargetWorldScratch);
        shovelTransferTargetWorldScratch.y += 3.2;
      }
    }
    shovelTransferTargetWorldScratch.y = Math.min(
      shovelTransferTargetWorldScratch.y,
      shovelTransferSourceWorldScratch.y - 0.2,
    );
    shovelTransferSourceLocalScratch.copy(shovelTransferSourceWorldScratch);
    shovelTransferTargetLocalScratch.copy(shovelTransferTargetWorldScratch);
    root.worldToLocal(shovelTransferSourceLocalScratch);
    root.worldToLocal(shovelTransferTargetLocalScratch);
    shovelTruckCascade.setStart(shovelTransferSourceLocalScratch);
    shovelTruckCascade.setEnd(shovelTransferTargetLocalScratch);
    shovelTruckCascade.mesh.userData.sourceEquipmentId = 'EXCAVATOR-01';
    shovelTruckCascade.mesh.userData.receiverEquipmentId = activeTruck.root.name;
    shovelTruckCascade.mesh.userData.sourceWorld = shovelTransferSourceWorldScratch.toArray();
    shovelTruckCascade.mesh.userData.receiverWorld = shovelTransferTargetWorldScratch.toArray();
    shovelTruckCascade.update(shovelTime, transferActive);
  }

  trucks.forEach((truckHandle, index) => {
    updateTruck(truckHandle, truckPhaseOffsets[index], { initialize: true });
  });
  loaderCurve.getPoint(0, loaderPositionScratch);
  loader.root.position.copy(loaderPositionScratch);
  loaderHeadingScratch.set(6, loaderPositionScratch.y, -36).sub(loaderPositionScratch).normalize();
  orientAlong(loader.root, loaderHeadingScratch);
  loader.root.userData.terrainY = getTerrainHeight(loader.root.position.x, loader.root.position.z);
  romLoaderOutbound.getPoint(0, romLoaderPositionScratch);
  romLoader.root.position.copy(romLoaderPositionScratch);
  romLoaderHeadingScratch.set(-134.5, romLoaderPositionScratch.y, -13.0).sub(romLoaderPositionScratch).normalize();
  orientAlong(romLoader.root, romLoaderHeadingScratch);
  romLoader.root.userData.terrainY = getTerrainHeight(romLoader.root.position.x, romLoader.root.position.z);
  root.userData.v24OperationalFleet = true;
  root.userData.animatedTruckCount = trucks.length;

  function update(dt) {
    if (!enabled || !Number.isFinite(dt) || dt <= 0) return;
    const safeDt = Math.min(dt, 0.1);
    elapsed += safeDt;
    shovel.update(safeDt);
    const shovelTime = elapsed % 20;
    shovel.setVisualAnimationTime?.(shovelTime);
    const shovelCycle = shovelTime / 20;
    shovel.setMaterialLoadVisible?.(shovelCycle > 0.22 && shovelCycle < 0.7);
    trucks.forEach((truckHandle, index) => updateTruck(truckHandle, elapsed + truckPhaseOffsets[index]));
    updateShovelTruckTransfer(shovelTime);
    updateLoader(safeDt);
    updateRomLoader(safeDt);
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    shovel.setAnimationEnabled(enabled);
    loader.setAnimationEnabled(enabled);
    romLoader.setAnimationEnabled(enabled);
  }

  return {
    root,
    truck,
    trucks,
    truck02: trucks[1],
    truck03: trucks[2],
    shovel,
    loader,
    romLoader,
    shovelTruckCascade,
    update,
    setEnabled,
    get enabled() { return enabled; },
    get elapsedSeconds() { return elapsed; },
    truckRoute: loadedLane,
    returnRoute: returnLane,
  };
}
