import * as THREE from 'three';
import { createCatalogInstance } from './assetIntegrationLayer.js';
import { getTerrainHeight } from '../environment/terrainHeight.js';
import { createRoadLaneCurve, getRoadSurfaceOffset } from '../environment/haulRoads.js';
import { MOBILE_ROUTE_LAYOUT, SUPPORT_LAYOUT } from './finalLayout.js';

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
  const position = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();

  function update(timeSeconds, active) {
    mesh.visible = Boolean(active);
    if (!mesh.visible) return;
    phases.forEach((offset, index) => {
      const phase = (timeSeconds * 0.72 + offset) % 1;
      position.copy(start).lerp(end, phase);
      position.z += Math.sin(index * 2.2 + phase * Math.PI * 2) * radius * 1.1;
      quaternion.setFromEuler(new THREE.Euler(phase * 2.6, index * 0.37, phase * 1.7));
      const s = 0.76 + (index % 4) * 0.08;
      scale.set(s, s, s);
      matrix.compose(position, quaternion, scale);
      mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }
  return { mesh, update };
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

  // Truck wheel centres are referenced to the engineered road surface, which sits
  // slightly above the terrain mesh. Keep the vehicle root on that surface rather
  // than on the underlying terrain to avoid visible tyre burial/floating.
  const truckLaneOffset = 3.4;
  const loadedLane = createRoadLaneCurve('ROAD-01', truckLaneOffset);
  const returnLane = createRoadLaneCurve('ROAD-01', -truckLaneOffset, { reverse: true });
  const loaderCurve = curveFromXZ(MOBILE_ROUTE_LAYOUT.loaderOutbound);
  const loaderReturn = curveFromXZ(MOBILE_ROUTE_LAYOUT.loaderReturn);
  // Scratch vectors avoid transient allocations during the managed vehicle loop.
  const loaderPositionScratch = new THREE.Vector3();
  const loaderTangentScratch = new THREE.Vector3();
  const loaderHeadingScratch = new THREE.Vector3();
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
      truckHandle.root.rotation.y = Math.PI;
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
    if (!preserveDumpHeading) orientAlong(truckHandle.root, tangent);
    truckHandle.setSteering?.(preserveDumpHeading ? 0 : steeringAngle);
    if (travelDistanceM > 0) truckHandle.advanceWheelTravel?.(travelDistanceM);
    truckHandle.root.userData.operationalState = state;
    truckHandle.root.userData.routeProgress = routeProgress;
    truckHandle.root.userData.routeDirection = routeDirection;
    truckHandle.root.userData.roadSurfaceY = position.y;
    truckDumpCascades.get(truckHandle)?.update(cycleSeconds, dumpVisualPhase >= 0.18 && dumpVisualPhase <= 0.82);
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

  trucks.forEach((truckHandle, index) => {
    updateTruck(truckHandle, truckPhaseOffsets[index], { initialize: true });
  });
  loaderCurve.getPoint(0, loaderPositionScratch);
  loader.root.position.copy(loaderPositionScratch);
  loaderHeadingScratch.set(6, loaderPositionScratch.y, -36).sub(loaderPositionScratch).normalize();
  orientAlong(loader.root, loaderHeadingScratch);
  loader.root.userData.terrainY = getTerrainHeight(loader.root.position.x, loader.root.position.z);
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
    updateLoader(safeDt);
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    shovel.setAnimationEnabled(enabled);
    loader.setAnimationEnabled(enabled);
  }

  return {
    root,
    truck,
    trucks,
    truck02: trucks[1],
    truck03: trucks[2],
    shovel,
    loader,
    update,
    setEnabled,
    get enabled() { return enabled; },
    get elapsedSeconds() { return elapsed; },
    truckRoute: loadedLane,
    returnRoute: returnLane,
  };
}
