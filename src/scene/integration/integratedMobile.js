import * as THREE from 'three';
import { createCatalogInstance } from './assetIntegrationLayer.js';
import { getTerrainHeight } from '../environment/terrainHeight.js';
import { createRoadLaneCurve } from '../environment/haulRoads.js';
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
  const truckCreated = createCatalogInstance({
    instanceId: 'TRUCK-01',
    assetKey: 'haulTruck',
    position: new THREE.Vector3(SUPPORT_LAYOUT.truckLoad.x, getTerrainHeight(SUPPORT_LAYOUT.truckLoad.x, SUPPORT_LAYOUT.truckLoad.z), SUPPORT_LAYOUT.truckLoad.z),
    rotationY: 0,
    registry,
  });
  const loaderCreated = createCatalogInstance({
    instanceId: 'LOADER-01',
    assetKey: 'wheelLoader',
    position: new THREE.Vector3(SUPPORT_LAYOUT.loaderPickup.x, getTerrainHeight(SUPPORT_LAYOUT.loaderPickup.x, SUPPORT_LAYOUT.loaderPickup.z), SUPPORT_LAYOUT.loaderPickup.z),
    rotationY: 0,
    registry,
  });
  [shovelCreated, truckCreated, loaderCreated].forEach(({ handle }) => {
    handle.root.userData.mobileEquipment = true;
    handle.root.userData.integrationManagedAnimation = true;
    root.add(handle.root);
  });

  const truck = truckCreated.handle;
  const shovel = shovelCreated.handle;
  const loader = loaderCreated.handle;
  truck.setAnimationEnabled(false);
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

  truck.root.position.copy(loadedLane.getPoint(0));
  orientAlong(truck.root, loadedLane.getTangent(0.01));

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

  function updateTruck(dt) {
    const t = elapsed % truckCycle;
    let position;
    let tangent;
    let steeringAngle = 0;
    let preserveDumpHeading = false;
    if (t < truckTimings.loading) {
      position = loadedLane.getPoint(0, truckPositionScratch);
      tangent = loadedLane.getTangent(0.01, truckTangentScratch);
      truck.setLoaded(true);
      truck.setDumpAngle(0);
    } else if (t < truckTimings.loading + truckTimings.haul) {
      const p = (t - truckTimings.loading) / truckTimings.haul;
      position = loadedLane.getPoint(p, truckPositionScratch);
      tangent = loadedLane.getTangent(Math.min(0.999, p), truckTangentScratch);
      truck.setLoaded(true);
      truck.setDumpAngle(0);
      steeringAngle = steeringFromCurve(loadedLane, p);
    } else if (t < truckTimings.loading + truckTimings.haul + truckTimings.dump) {
      const p = (t - truckTimings.loading - truckTimings.haul) / truckTimings.dump;
      position = loadedLane.getPoint(1, truckPositionScratch);
      tangent = loadedLane.getTangent(0.999, truckTangentScratch);
      const angle = THREE.MathUtils.degToRad(48) * Math.sin(Math.PI * p);
      truck.setDumpAngle(angle);
      truck.setLoaded(p < 0.58);
      // Rear of the rigid truck points toward the ROM hopper during dumping.
      // Preserve this heading for the dump phase instead of immediately replacing
      // it with the terminal road tangent below.
      truck.root.rotation.y = Math.PI;
      preserveDumpHeading = true;
    } else if (t < truckTimings.loading + truckTimings.haul + truckTimings.dump + truckTimings.romTurnaround) {
      const start = truckTimings.loading + truckTimings.haul + truckTimings.dump;
      const p = THREE.MathUtils.smoothstep((t - start) / truckTimings.romTurnaround, 0, 1);
      position = truckPositionScratch.copy(loadedEnd).lerp(returnStart, p);
      tangent = truckTangentScratch.copy(returnStart).sub(loadedEnd).normalize();
      truck.setLoaded(false);
      truck.setDumpAngle(0);
      steeringAngle = 0.28;
    } else if (t < truckTimings.loading + truckTimings.haul + truckTimings.dump + truckTimings.romTurnaround + truckTimings.return) {
      const start = truckTimings.loading + truckTimings.haul + truckTimings.dump + truckTimings.romTurnaround;
      const p = (t - start) / truckTimings.return;
      position = returnLane.getPoint(p, truckPositionScratch);
      tangent = returnLane.getTangent(Math.min(0.999, p), truckTangentScratch);
      truck.setLoaded(false);
      truck.setDumpAngle(0);
      steeringAngle = steeringFromCurve(returnLane, p);
    } else {
      const start = truckTimings.loading + truckTimings.haul + truckTimings.dump + truckTimings.romTurnaround + truckTimings.return;
      const p = THREE.MathUtils.smoothstep((t - start) / truckTimings.pitTurnaround, 0, 1);
      position = truckPositionScratch.copy(returnEnd).lerp(loadedStart, p);
      tangent = truckTangentScratch.copy(loadedStart).sub(returnEnd).normalize();
      truck.setLoaded(false);
      truck.setDumpAngle(0);
      steeringAngle = -0.28;
    }
    const travelDistanceM = truck.root.position.distanceTo(position);
    truck.root.position.copy(position);
    if (!preserveDumpHeading) orientAlong(truck.root, tangent);
    truck.setSteering?.(preserveDumpHeading ? 0 : steeringAngle);
    if (travelDistanceM > 0) truck.advanceWheelTravel?.(travelDistanceM);
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
    loader.setMaterialLoadVisible?.(t >= 5 && t < 19.3);
  }

  function update(dt) {
    if (!enabled || !Number.isFinite(dt) || dt <= 0) return;
    const safeDt = Math.min(dt, 0.1);
    elapsed += safeDt;
    shovel.update(safeDt);
    const shovelTime = elapsed % 20;
    shovel.setVisualAnimationTime?.(shovelTime);
    const shovelCycle = shovelTime / 20;
    shovel.setMaterialLoadVisible?.(shovelCycle > 0.22 && shovelCycle < 0.7);
    updateTruck(safeDt);
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
