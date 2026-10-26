import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { ROAD_DEFINITIONS } from '../../scene/config/siteDesign.js';
import { getTerrainHeight } from '../../scene/environment/terrainHeight.js';
import { createBabylonServiceRoadAlignment } from '../environment/serviceRoads.js';
import { attachBabylonBlenderModule, BLENDER_MODULE_URLS, quaternionFromLocalX } from '../assets/moduleLibrary.js';

export const BABYLON_PIPE_SUPPORT_POLICIES = Object.freeze({
  rack: Object.freeze({ maxSpanM: 7.5, widthM: 3.8, minRunM: 5.5 }),
  trestle: Object.freeze({ maxSpanM: 6.5, widthM: 2.6, minRunM: 4.5 }),
  local: Object.freeze({ maxSpanM: 5.5, widthM: 1.8, minRunM: 3.5 }),
  none: Object.freeze({ maxSpanM: Infinity, widthM: 0, minRunM: Infinity }),
});

export const BABYLON_RECOVERY_ROAD_SPAN_WIDTH_M = 18.0;
export const BABYLON_RECOVERY_ROAD_FOOTING_CLEARANCE_M = (
  ROAD_DEFINITIONS['ROAD-02'].widthM / 2
  + ROAD_DEFINITIONS['ROAD-02'].shoulderM
  + 0.45
);

let recoveryRoadSamples = null;

function getRecoveryRoadSamples() {
  if (recoveryRoadSamples) return recoveryRoadSamples;
  const curve = createBabylonServiceRoadAlignment('ROAD-02');
  recoveryRoadSamples = Array.from({ length: 481 }, (_, index) => curve.getPoint(index / 480));
  return recoveryRoadSamples;
}

function nearestRoadReference(point) {
  let best = { distance: Infinity, point: null, side: null };
  const samples = getRecoveryRoadSamples();
  for (let index = 0; index < samples.length - 1; index += 1) {
    const a = samples[index];
    const b = samples[index + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const lengthSq = dx * dx + dz * dz;
    const t = lengthSq > 1e-12
      ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / lengthSq))
      : 0;
    const x = a.x + dx * t;
    const z = a.z + dz * t;
    const distance = Math.hypot(point.x - x, point.z - z);
    if (distance >= best.distance) continue;
    const side = new Vector3(-dz, 0, dx);
    if (side.lengthSquared() > 1e-12) side.normalize();
    best = { distance, point: new Vector3(x, point.y, z), side };
  }
  return best;
}

function distanceToRecoveryRoad(point) {
  return nearestRoadReference(point).distance;
}

function createMember(scene, parent, name, start, end, thickness, material) {
  const direction = end.subtract(start);
  const length = direction.length();
  if (length <= 1e-6) return null;
  const mesh = CreateBox(name, { width: thickness, height: length, depth: thickness }, scene);
  mesh.parent = parent;
  mesh.position = Vector3.Lerp(start, end, 0.5);
  const rotation = Quaternion.Identity();
  Quaternion.FromUnitVectorsToRef(Vector3.Up(), direction.normalize(), rotation);
  mesh.rotationQuaternion = rotation;
  mesh.material = material;
  mesh.receiveShadows = true;
  return mesh;
}

function createRackFrame({ scene, id, point, tangent, renderedDiameterM, widthM, material, connectionId, segmentIndex, stationM, policy }) {
  const terrainY = getTerrainHeight(point.x, point.z);
  const pipeRadius = Math.max(0.05, renderedDiameterM / 2);
  const beamThickness = policy === 'rack' ? 0.20 : 0.16;
  const beamY = point.y - pipeRadius - 0.08 - beamThickness / 2;
  const horizontal = new Vector3(tangent.x, 0, tangent.z);
  if (horizontal.lengthSquared() < 1e-8) return null;
  horizontal.normalize();
  const side = new Vector3(-horizontal.z, 0, horizontal.x);
  const supportCenter = point.clone();
  let effectiveWidthM = widthM;
  let roadSupportMode = null;
  let roadFootingClearanceM = null;
  let roadCenterDistanceM = null;

  if (connectionId === 'P-PUMP-01-TO-CIP') {
    const road = nearestRoadReference(point);
    roadCenterDistanceM = road.distance;
    const interacts = road.distance < BABYLON_RECOVERY_ROAD_FOOTING_CLEARANCE_M + Math.max(widthM / 2, 4);
    const distancesAtWidth = (candidateWidthM, center = supportCenter) => {
      const halfWidth = candidateWidthM / 2;
      return [
        distanceToRecoveryRoad(center.add(side.scale(-halfWidth))),
        distanceToRecoveryRoad(center.add(side.scale(halfWidth))),
      ];
    };
    if (interacts && road.point && road.side?.lengthSquared() > 0) {
      side.copyFrom(road.side);
      if (road.distance <= BABYLON_RECOVERY_ROAD_SPAN_WIDTH_M / 2 - 0.5) {
        roadSupportMode = 'road-centered-portal';
        effectiveWidthM = Math.max(widthM, BABYLON_RECOVERY_ROAD_SPAN_WIDTH_M);
        supportCenter.x = road.point.x;
        supportCenter.z = road.point.z;
        roadFootingClearanceM = distancesAtWidth(effectiveWidthM, supportCenter);
        while (roadFootingClearanceM.some((value) => value < BABYLON_RECOVERY_ROAD_FOOTING_CLEARANCE_M) && effectiveWidthM < 22) {
          effectiveWidthM += 0.5;
          roadFootingClearanceM = distancesAtWidth(effectiveWidthM, supportCenter);
        }
      } else {
        let distances = distancesAtWidth(widthM, supportCenter);
        if (distances.some((value) => value < BABYLON_RECOVERY_ROAD_FOOTING_CLEARANCE_M)) {
          roadSupportMode = 'road-offset-frame';
          const outwardSign = point.subtract(road.point).dot(side) >= 0 ? 1 : -1;
          let guard = 0;
          while (distances.some((value) => value < BABYLON_RECOVERY_ROAD_FOOTING_CLEARANCE_M) && guard < 24) {
            supportCenter.addInPlace(side.scale(outwardSign * 0.20));
            distances = distancesAtWidth(widthM, supportCenter);
            guard += 1;
          }
          roadFootingClearanceM = distances;
        }
      }
    }
  }

  const frame = new TransformNode(id, scene);
  frame.metadata = {
    pipeRackFrame: true,
    connectionId,
    segmentIndex,
    stationM,
    policy,
    terrainY,
    supportedPipeY: point.y,
    renderedDiameterM,
    roadSpanPortal: roadSupportMode === 'road-centered-portal',
    clearRoadId: roadSupportMode ? 'ROAD-02' : null,
    roadSupportMode,
    roadCenterDistanceM,
    frameWidthM: effectiveWidthM,
    roadFootingClearanceM,
    requiredRoadFootingClearanceM: roadSupportMode ? BABYLON_RECOVERY_ROAD_FOOTING_CLEARANCE_M : null,
    supportCenterOffsetM: Vector3.Distance(supportCenter, point),
  };

  const halfWidth = effectiveWidthM / 2;
  const leftBase = supportCenter.add(side.scale(-halfWidth));
  const rightBase = supportCenter.add(side.scale(halfWidth));
  const leftTerrainY = getTerrainHeight(leftBase.x, leftBase.z);
  const rightTerrainY = getTerrainHeight(rightBase.x, rightBase.z);
  leftBase.y = leftTerrainY;
  rightBase.y = rightTerrainY;
  const leftTop = new Vector3(leftBase.x, beamY, leftBase.z);
  const rightTop = new Vector3(rightBase.x, beamY, rightBase.z);
  const maxColumnHeight = Math.max(beamY - leftTerrainY, beamY - rightTerrainY);

  if (maxColumnHeight > 0.28) {
    [leftBase, rightBase].forEach((base, index) => {
      const footing = CreateBox(`${id}-footing-${index + 1}`, { width: 0.58, height: 0.14, depth: 0.58 }, scene);
      footing.parent = frame;
      footing.position.set(base.x, base.y + 0.07, base.z);
      footing.material = material;
      footing.metadata = { terrainY: base.y, groundedBy: 'getTerrainHeight' };
    });
    createMember(scene, frame, `${id}-column-1`, new Vector3(leftBase.x, leftTerrainY + 0.12, leftBase.z), leftTop, policy === 'rack' ? 0.18 : 0.14, material);
    createMember(scene, frame, `${id}-column-2`, new Vector3(rightBase.x, rightTerrainY + 0.12, rightBase.z), rightTop, policy === 'rack' ? 0.18 : 0.14, material);
  }
  createMember(scene, frame, `${id}-crossbeam`, leftTop, rightTop, beamThickness, material);
  const moduleScale = Math.max(0.82, Math.min(1.85, renderedDiameterM / 0.40));
  const saddleModule = attachBabylonBlenderModule({
    scene,
    parent: frame,
    url: BLENDER_MODULE_URLS.pipeSaddle,
    name: `${id}-blender-pipe-saddle`,
    position: point,
    scale: [moduleScale, moduleScale, moduleScale],
    rotationQuaternion: quaternionFromLocalX(tangent),
    metadata: {
      pipingHybridRole: 'rack-saddle',
      connectionId,
      segmentIndex,
      stationM,
      renderedDiameterM,
    },
  });
  frame._babylonModuleHandles = [saddleModule];
  frame.metadata.blenderHybridRack = true;
  return frame;
}

function handlesOf(connections) {
  if (connections instanceof Map) return [...connections.values()];
  return Array.isArray(connections) ? connections : [];
}

export function createBabylonProcessPipeRacks({ scene, connections = new Map(), policyByConnection = {} } = {}) {
  if (!scene) throw new TypeError('Babylon pipe racks require a Scene.');
  if (scene.useRightHandedSystem !== true) throw new Error('Babylon pipe racks require a right-handed Scene.');
  const root = new TransformNode('process-pipe-racks', scene);
  const material = new StandardMaterial('babylon-pipe-rack-structural-steel', scene);
  material.diffuseColor = new Color3(0x63 / 255, 0x73 / 255, 0x78 / 255);
  material.specularColor = new Color3(0.32, 0.34, 0.35);
  material.specularPower = 32;

  function clearFrames() {
    [...root.getChildren()].forEach((child) => {
      (child._babylonModuleHandles ?? []).forEach((handle) => handle.dispose?.());
      child.dispose(false, false);
    });
  }

  function refresh(nextConnections = connections) {
    connections = nextConnections;
    clearFrames();
    if (scene.metadata?.visualAuthority === 'V57/B63') {
      root.metadata = { totalFrames: 0, visualAuthority: 'V57/B63' };
      return root;
    }
    let totalFrames = 0;
    handlesOf(connections).forEach((handle) => {
      const metadata = handle?.root?.metadata ?? {};
      const connectionId = metadata.connectionId;
      if (!connectionId) return;
      const policy = policyByConnection[connectionId] ?? metadata.supportPolicy ?? 'local';
      const preset = BABYLON_PIPE_SUPPORT_POLICIES[policy] ?? BABYLON_PIPE_SUPPORT_POLICIES.local;
      const points = (metadata.routePoints ?? []).map((point) => Vector3.FromArray(point));
      if (policy === 'none' || points.length < 2) return;
      let frameIndex = 0;
      for (let segmentIndex = 0; segmentIndex < points.length - 1; segmentIndex += 1) {
        const start = points[segmentIndex];
        const end = points[segmentIndex + 1];
        const horizontalLength = Math.hypot(end.x - start.x, end.z - start.z);
        if (horizontalLength < preset.minRunM) continue;
        const tangent = end.subtract(start);
        const supportCount = Math.max(1, Math.ceil(horizontalLength / preset.maxSpanM) - 1);
        for (let index = 1; index <= supportCount; index += 1) {
          const t = index / (supportCount + 1);
          const point = Vector3.Lerp(start, end, t);
          const frame = createRackFrame({
            scene,
            id: `${connectionId}-${policy}-frame-${++frameIndex}`,
            point,
            tangent,
            renderedDiameterM: Number(metadata.renderedDiameterM || 0.4),
            widthM: preset.widthM,
            material,
            connectionId,
            segmentIndex,
            stationM: horizontalLength * t,
            policy,
          });
          if (!frame) continue;
          frame.parent = root;
          totalFrames += 1;
        }
      }
    });
    root.metadata = {
      totalFrames,
      coordinateSystem: 'right-handed',
      terrainHeightSource: 'getTerrainHeight',
      roadClearanceProtected: true,
    };
    return root;
  }

  refresh(connections);
  return {
    root,
    material,
    refresh,
    get totalFrames() { return root.metadata.totalFrames; },
    dispose() {
      clearFrames();
      root.dispose(false, false);
      material.dispose();
    },
  };
}
