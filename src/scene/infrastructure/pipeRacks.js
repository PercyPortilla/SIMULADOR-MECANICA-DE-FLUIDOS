import * as THREE from 'three';
import { getTerrainHeight } from '../environment/terrainHeight.js';
import { createRoadAlignment } from '../environment/haulRoads.js';
import { ROAD_DEFINITIONS } from '../config/siteDesign.js';
import { createIndustrialMaterial } from '../materials/industrialMaterials.js';
import { attachBlenderModule, BLENDER_MODULE_URLS, quaternionFromLocalX } from '../integration/blenderModuleLibrary.js';

const POLICY_PRESETS = Object.freeze({
  rack: Object.freeze({ maxSpanM: 7.5, widthM: 3.8, minRunM: 5.5 }),
  trestle: Object.freeze({ maxSpanM: 6.5, widthM: 2.6, minRunM: 4.5 }),
  local: Object.freeze({ maxSpanM: 5.5, widthM: 1.8, minRunM: 3.5 }),
  none: Object.freeze({ maxSpanM: Infinity, widthM: 0, minRunM: Infinity }),
});

// PUMP-01 -> CIP runs parallel to ROAD-02 for one elevated segment. The pipe
// centerline is intentionally preserved, but a normal 3.8 m rack would put its
// columns inside the service road. A portal span keeps both columns beyond the
// road + shoulders while the pipe crosses the clear airspace above it.
export const RECOVERY_ROAD_SPAN_WIDTH_M = 18.0;
export const RECOVERY_ROAD_FOOTING_CLEARANCE_M = (
  ROAD_DEFINITIONS['ROAD-02'].widthM / 2
  + ROAD_DEFINITIONS['ROAD-02'].shoulderM
  + 0.45
);

let recoveryRoadSamples = null;

function getRecoveryRoadSamples() {
  if (recoveryRoadSamples) return recoveryRoadSamples;
  const curve = createRoadAlignment('ROAD-02');
  recoveryRoadSamples = Array.from({ length: 481 }, (_, index) => curve.getPoint(index / 480));
  return recoveryRoadSamples;
}

function nearestRecoveryRoadReference(point) {
  let minimum = Infinity;
  let nearestSide = null;
  let nearestPoint = null;
  const samples = getRecoveryRoadSamples();
  for (let index = 0; index < samples.length - 1; index += 1) {
    const a = samples[index];
    const b = samples[index + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const lengthSq = dx * dx + dz * dz;
    const t = lengthSq <= 1e-12
      ? 0
      : THREE.MathUtils.clamp(((point.x - a.x) * dx + (point.z - a.z) * dz) / lengthSq, 0, 1);
    const x = a.x + dx * t;
    const z = a.z + dz * t;
    const distance = Math.hypot(point.x - x, point.z - z);
    if (distance < minimum) {
      minimum = distance;
      nearestPoint = new THREE.Vector3(x, point.y, z);
      const roadTangent = new THREE.Vector3(dx, 0, dz);
      nearestSide = roadTangent.lengthSq() <= 1e-12
        ? null
        : new THREE.Vector3(-roadTangent.z, 0, roadTangent.x).normalize();
    }
  }
  return { distance: minimum, side: nearestSide, point: nearestPoint };
}

function planarDistanceToRecoveryRoad(point) {
  return nearestRecoveryRoadReference(point).distance;
}

function asVector3(value) {
  if (value instanceof THREE.Vector3) return value.clone();
  if (Array.isArray(value) && value.length >= 3 && value.slice(0, 3).every(Number.isFinite)) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }
  throw new TypeError('Pipe rack recibió un punto no finito.');
}

function disposeChildren(root) {
  while (root.children.length) {
    const child = root.children.pop();
    child.traverse((object) => object.geometry?.dispose?.());
  }
}

function createMember(name, start, end, thickness, material) {
  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  const direction = end.clone().sub(start);
  const length = Math.max(1e-5, direction.length());
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(thickness, length, thickness), material);
  mesh.name = name;
  mesh.position.copy(midpoint);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createRackFrame({
  id,
  point,
  pipeY,
  tangent,
  renderedDiameterM,
  widthM,
  material,
  connectionId,
  segmentIndex,
  stationM,
  policy,
}) {
  const terrainY = getTerrainHeight(point.x, point.z);
  const pipeRadius = Math.max(0.05, renderedDiameterM / 2);
  const beamThickness = policy === 'rack' ? 0.20 : 0.16;
  const beamY = pipeY - pipeRadius - 0.08 - beamThickness / 2;
  const horizontal = new THREE.Vector3(tangent.x, 0, tangent.z);
  if (horizontal.lengthSq() < 1e-8) return null;
  horizontal.normalize();
  const side = new THREE.Vector3(-horizontal.z, 0, horizontal.x);
  const supportCenter = point.clone();
  let effectiveWidthM = widthM;
  let spansRecoveryServiceRoad = false;
  let roadSupportMode = null;
  let roadFootingClearanceM = null;
  let roadCenterDistanceM = null;

  if (connectionId === 'P-PUMP-01-TO-CIP') {
    const roadReference = nearestRecoveryRoadReference(point);
    roadCenterDistanceM = roadReference.distance;
    const interactsWithRoad = roadReference.distance < (
      RECOVERY_ROAD_FOOTING_CLEARANCE_M + Math.max(widthM / 2, 4)
    );
    const distancesAtWidth = (candidateWidthM, center = supportCenter) => {
      const halfWidth = candidateWidthM / 2;
      const left = center.clone().addScaledVector(side, -halfWidth);
      const right = center.clone().addScaledVector(side, halfWidth);
      return [planarDistanceToRecoveryRoad(left), planarDistanceToRecoveryRoad(right)];
    };
    if (interactsWithRoad && roadReference.side && roadReference.point) {
      side.copy(roadReference.side);
      const portalHalfSpanM = RECOVERY_ROAD_SPAN_WIDTH_M / 2;
      if (roadReference.distance <= portalHalfSpanM - 0.5) {
        // When the pipe is genuinely over the road corridor, center the steel
        // portal on the road rather than on an offset pipe. The saddle remains
        // exactly at the pipe point, so the authoritative centerline does not
        // move, while the columns stay just beyond both shoulders.
        spansRecoveryServiceRoad = true;
        roadSupportMode = 'road-centered-portal';
        effectiveWidthM = Math.max(widthM, RECOVERY_ROAD_SPAN_WIDTH_M);
        supportCenter.x = roadReference.point.x;
        supportCenter.z = roadReference.point.z;
        roadFootingClearanceM = distancesAtWidth(effectiveWidthM, supportCenter);
        while (
          roadFootingClearanceM.some((distance) => distance < RECOVERY_ROAD_FOOTING_CLEARANCE_M)
          && effectiveWidthM < 22
        ) {
          effectiveWidthM += 0.5;
          roadFootingClearanceM = distancesAtWidth(effectiveWidthM, supportCenter);
        }
      } else {
        // If the pipe is already outside the traffic corridor, a giant portal
        // is unnecessary. Keep the normal frame width and shift only its
        // footings outward enough to clear the shoulder; the pipe saddle stays
        // at the original station as a short, realistic cantilevered offset.
        const delta = point.clone().sub(roadReference.point);
        const outwardSign = delta.dot(side) >= 0 ? 1 : -1;
        let nominalDistances = distancesAtWidth(widthM, supportCenter);
        if (nominalDistances.some((distance) => distance < RECOVERY_ROAD_FOOTING_CLEARANCE_M)) {
          roadSupportMode = 'road-offset-frame';
          const inwardNominal = Math.min(...nominalDistances);
          const shiftM = Math.max(0, RECOVERY_ROAD_FOOTING_CLEARANCE_M + 0.18 - inwardNominal);
          supportCenter.addScaledVector(side, outwardSign * shiftM);
          nominalDistances = distancesAtWidth(widthM, supportCenter);
          let guard = 0;
          while (
            nominalDistances.some((distance) => distance < RECOVERY_ROAD_FOOTING_CLEARANCE_M)
            && guard < 16
          ) {
            supportCenter.addScaledVector(side, outwardSign * 0.20);
            nominalDistances = distancesAtWidth(widthM, supportCenter);
            guard += 1;
          }
          roadFootingClearanceM = nominalDistances;
        }
      }
    }
  }
  const frame = new THREE.Group();
  frame.name = id;
  frame.userData = {
    pipeRackFrame: true,
    connectionId,
    segmentIndex,
    stationM,
    policy,
    terrainY,
    supportedPipeY: pipeY,
    renderedDiameterM,
    roadSpanPortal: spansRecoveryServiceRoad,
    clearRoadId: roadSupportMode ? 'ROAD-02' : null,
    roadSupportMode,
    roadCenterDistanceM,
    frameWidthM: effectiveWidthM,
    roadFootingClearanceM,
    requiredRoadFootingClearanceM: roadSupportMode ? RECOVERY_ROAD_FOOTING_CLEARANCE_M : null,
    supportCenterOffsetM: supportCenter.distanceTo(point),
  };

  const halfWidth = effectiveWidthM / 2;
  const leftBase = supportCenter.clone().addScaledVector(side, -halfWidth);
  const rightBase = supportCenter.clone().addScaledVector(side, halfWidth);
  const leftTerrainY = getTerrainHeight(leftBase.x, leftBase.z);
  const rightTerrainY = getTerrainHeight(rightBase.x, rightBase.z);
  leftBase.y = leftTerrainY;
  rightBase.y = rightTerrainY;
  const leftTop = leftBase.clone().setY(beamY);
  const rightTop = rightBase.clone().setY(beamY);
  const leftColumnHeight = beamY - leftTerrainY;
  const rightColumnHeight = beamY - rightTerrainY;
  const columnHeight = Math.max(leftColumnHeight, rightColumnHeight);
  frame.userData.leftTerrainY = leftTerrainY;
  frame.userData.rightTerrainY = rightTerrainY;

  if (columnHeight > 0.28) {
    [leftBase, rightBase].forEach((base, index) => {
      const localTerrainY = base.y;
      const footing = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.14, 0.58), material);
      footing.name = `${id}-footing-${index + 1}`;
      footing.position.set(base.x, localTerrainY + 0.07, base.z);
      footing.userData.terrainY = localTerrainY;
      footing.castShadow = true;
      footing.receiveShadow = true;
      frame.add(footing);
      const baseplate = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.055, 0.34), material.clone());
      baseplate.name = `${id}-baseplate-${index + 1}`;
      baseplate.position.set(base.x, localTerrainY + 0.145, base.z);
      baseplate.castShadow = true;
      baseplate.receiveShadow = true;
      frame.add(baseplate);
    });
    frame.add(createMember(`${id}-column-1`, leftBase.clone().setY(leftTerrainY + 0.12), leftTop, policy === 'rack' ? 0.18 : 0.14, material));
    frame.add(createMember(`${id}-column-2`, rightBase.clone().setY(rightTerrainY + 0.12), rightTop, policy === 'rack' ? 0.18 : 0.14, material));
  }

  const beam = createMember(`${id}-crossbeam`, leftTop, rightTop, beamThickness, material);
  frame.add(beam);

  const braceThresholdM = policy === 'rack' ? 1.7 : 3.2;
  if (columnHeight > braceThresholdM) {
    const leftBraceTopY = Math.min(beamY - 0.18, leftTerrainY + Math.min(leftColumnHeight * 0.58, 2.2));
    const rightBraceTopY = Math.min(beamY - 0.18, rightTerrainY + Math.min(rightColumnHeight * 0.58, 2.2));
    const braceThickness = policy === 'rack' ? 0.09 : 0.065;
    frame.add(createMember(`${id}-brace-1`, leftBase.clone().setY(leftTerrainY + 0.14), rightBase.clone().setY(rightBraceTopY), braceThickness, material));
    frame.add(createMember(`${id}-brace-2`, rightBase.clone().setY(rightTerrainY + 0.14), leftBase.clone().setY(leftBraceTopY), braceThickness, material));
    frame.userData.bracedFrame = true;
    frame.userData.braceThresholdM = braceThresholdM;
  }

  const moduleScale = THREE.MathUtils.clamp(renderedDiameterM / 0.40, 0.82, 1.85);
  attachBlenderModule({
    parent: frame,
    url: BLENDER_MODULE_URLS.pipeSaddle,
    name: `${id}-blender-pipe-saddle`,
    position: point,
    scale: [moduleScale, moduleScale, moduleScale],
    quaternion: quaternionFromLocalX(tangent),
    userData: {
      pipingHybridRole: 'rack-saddle',
      connectionId,
      segmentIndex,
      stationM,
      renderedDiameterM,
    },
  });
  frame.userData.blenderHybridRack = true;
  return frame;
}

function supportsForConnection(connectionGroup, policyName, material) {
  const root = new THREE.Group();
  const connectionId = connectionGroup.userData.connectionId ?? connectionGroup.name;
  root.name = `${connectionId}-supports`;
  root.userData.connectionId = connectionId;
  root.userData.supportPolicy = policyName;
  const preset = POLICY_PRESETS[policyName] ?? POLICY_PRESETS.local;
  if (policyName === 'none') return root;
  const points = (connectionGroup.userData.routePoints ?? []).map(asVector3);
  const renderedDiameterM = Number(connectionGroup.userData.renderedDiameterM || 0.4);
  let frameIndex = 0;

  for (let segmentIndex = 0; segmentIndex < points.length - 1; segmentIndex += 1) {
    const start = points[segmentIndex];
    const end = points[segmentIndex + 1];
    const horizontalLength = Math.hypot(end.x - start.x, end.z - start.z);
    if (horizontalLength < preset.minRunM) continue;
    const tangent = end.clone().sub(start);
    const supportCount = Math.max(1, Math.ceil(horizontalLength / preset.maxSpanM) - 1);
    for (let index = 1; index <= supportCount; index += 1) {
      const t = index / (supportCount + 1);
      if (t < 0.08 || t > 0.92) continue;
      const point = start.clone().lerp(end, t);
      const stationM = horizontalLength * t;
      const frame = createRackFrame({
        id: `${connectionId}-${policyName}-frame-${++frameIndex}`,
        point,
        pipeY: point.y,
        tangent,
        renderedDiameterM,
        widthM: preset.widthM,
        material,
        connectionId,
        segmentIndex,
        stationM,
        policy: policyName,
      });
      if (frame) root.add(frame);
    }
  }
  root.userData.supportCount = root.children.length;
  return root;
}

export function createProcessPipeRacks({ connections = [], policyByConnection = {} } = {}) {
  const root = new THREE.Group();
  root.name = 'process-pipe-racks';
  const material = createIndustrialMaterial('structuralSteel', { color: 0x637378, metalness: 0.68, roughness: 0.42 });

  function refresh(nextConnections = connections) {
    connections = nextConnections;
    disposeChildren(root);
    connections.forEach((connectionGroup) => {
      const connectionId = connectionGroup?.userData?.connectionId;
      if (!connectionId) return;
      const policy = policyByConnection[connectionId] ?? 'local';
      const supports = supportsForConnection(connectionGroup, policy, material);
      if (supports.children.length || policy === 'none') root.add(supports);
    });
    root.userData.totalFrames = 0;
    root.traverse((object) => {
      if (object.userData?.pipeRackFrame) root.userData.totalFrames += 1;
    });
    root.updateMatrixWorld(true);
    return root;
  }

  root.refresh = refresh;
  refresh(connections);
  return root;
}
