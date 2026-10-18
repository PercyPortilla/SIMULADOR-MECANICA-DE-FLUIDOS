import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import {
  ROAD_DEFINITIONS,
  SERVICE_ROAD_VERTICAL_PROFILE,
} from '../../scene/config/siteDesign.js';
import { getTerrainHeight } from '../../scene/environment/terrainHeight.js';
import { createNumericCatmullRom } from '../../scene/math/numericCatmullRom.js';
import { BABYLON_ROAD_SURFACE_OFFSET_M } from './primaryHaulRoad.js';

export const BABYLON_SERVICE_ROAD_IDS = Object.freeze(['ROAD-02', 'ROAD-03', 'ROAD-04']);
export const BABYLON_SERVICE_CROSSFALL = 0.018;

const ROAD_ID_BY_DEFINITION = new Map(
  Object.entries(ROAD_DEFINITIONS).map(([roadId, definition]) => [definition, roadId]),
);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function isClosedRoad(points) {
  return points.length > 2
    && points[0][0] === points.at(-1)[0]
    && points[0][1] === points.at(-1)[1];
}

function roadNodeKey(x, z) {
  return `${x},${z}`;
}

const SHARED_ROAD_NODE_KEYS = (() => {
  const counts = new Map();
  Object.values(ROAD_DEFINITIONS).forEach((definition) => {
    definition.points.forEach(([x, z]) => {
      const key = roadNodeKey(x, z);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
  });
  return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
})();

function horizontalDistance(a, b) {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

function normalizeXZ(vector) {
  const length = Math.hypot(vector.x, vector.z);
  if (length <= 1e-12) return { x: 1, y: 0, z: 0 };
  return { x: vector.x / length, y: 0, z: vector.z / length };
}

function tangentXZAt(curve, t) {
  // The V30 curve tangent samples at +/- 0.0001. Preserve that
  // finite-difference interval so lateral road
  // details land on the same shoulder/ditch/berm coordinates.
  const delta = 0.0001;
  const a = curve.getPoint(clamp(t - delta, 0, 1));
  const b = curve.getPoint(clamp(t + delta, 0, 1));
  return normalizeXZ({ x: b.x - a.x, y: 0, z: b.z - a.z });
}

function requireServiceDefinition(roadId) {
  const definition = ROAD_DEFINITIONS[roadId];
  if (!definition) throw new RangeError(`Camino desconocido: ${roadId}.`);
  if (definition.role === 'primary-haul-road') {
    throw new RangeError(`${roadId} usa el perfil primario Babylon dedicado.`);
  }
  return definition;
}

function createGradeConstrainedServicePoints(planar, sourcePoints, definition) {
  const sampleCount = Math.max(180, sourcePoints.length * 30);
  const points = Array.from({ length: sampleCount + 1 }, (_, index) => {
    const point = planar.getPoint(index / sampleCount);
    return {
      x: point.x,
      y: getTerrainHeight(point.x, point.z) + BABYLON_ROAD_SURFACE_OFFSET_M,
      z: point.z,
    };
  });

  const anchors = sourcePoints
    .map(([x, z], controlIndex) => ({ x, z, controlIndex }))
    .filter(({ x, z, controlIndex }) => (
      controlIndex === 0
      || controlIndex === sourcePoints.length - 1
      || SHARED_ROAD_NODE_KEYS.has(roadNodeKey(x, z))
    ))
    .map(({ x, z, controlIndex }) => {
      let sampleIndex = 0;
      let nearestDistance = Infinity;
      points.forEach((point, index) => {
        const distance = Math.hypot(point.x - x, point.z - z);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          sampleIndex = index;
        }
      });
      return {
        controlIndex,
        sampleIndex,
        elevation: getTerrainHeight(x, z) + BABYLON_ROAD_SURFACE_OFFSET_M,
      };
    })
    .sort((a, b) => a.sampleIndex - b.sampleIndex)
    .filter((anchor, index, list) => index === 0 || anchor.sampleIndex !== list[index - 1].sampleIndex);

  const targetGrade = Math.min(
    definition.maximumGrade ?? 0.12,
    (definition.maximumGrade ?? 0.12) * SERVICE_ROAD_VERTICAL_PROFILE.targetGradeFactor,
  );

  for (let anchorIndex = 0; anchorIndex < anchors.length - 1; anchorIndex += 1) {
    const start = anchors[anchorIndex];
    const end = anchors[anchorIndex + 1];
    const elevations = points.map((point) => point.y);
    elevations[start.sampleIndex] = start.elevation;
    elevations[end.sampleIndex] = end.elevation;

    for (let iteration = 0; iteration < SERVICE_ROAD_VERTICAL_PROFILE.iterations; iteration += 1) {
      elevations[start.sampleIndex] = start.elevation;
      for (let index = start.sampleIndex + 1; index <= end.sampleIndex; index += 1) {
        if (index === end.sampleIndex) continue;
        const limit = targetGrade * horizontalDistance(points[index - 1], points[index]);
        elevations[index] = clamp(
          elevations[index],
          elevations[index - 1] - limit,
          elevations[index - 1] + limit,
        );
      }
      elevations[end.sampleIndex] = end.elevation;
      for (let index = end.sampleIndex - 1; index >= start.sampleIndex; index -= 1) {
        if (index === start.sampleIndex) continue;
        const limit = targetGrade * horizontalDistance(points[index], points[index + 1]);
        elevations[index] = clamp(
          elevations[index],
          elevations[index + 1] - limit,
          elevations[index + 1] + limit,
        );
      }
    }

    for (let index = start.sampleIndex; index <= end.sampleIndex; index += 1) {
      points[index].y = elevations[index];
    }
  }

  return points;
}

export function createBabylonServiceRoadAlignment(roadId) {
  const definition = requireServiceDefinition(roadId);
  const closed = isClosedRoad(definition.points);
  const sourcePoints = closed ? definition.points.slice(0, -1) : definition.points;
  const planar = createNumericCatmullRom(
    sourcePoints.map(([x, z]) => ({ x, y: 0, z })),
    { closed },
  );
  const engineeredPoints = createGradeConstrainedServicePoints(planar, sourcePoints, definition);
  const curve = createNumericCatmullRom(engineeredPoints, { closed });
  const verticalTargetGrade = Math.min(
    definition.maximumGrade ?? 0.12,
    (definition.maximumGrade ?? 0.12) * SERVICE_ROAD_VERTICAL_PROFILE.targetGradeFactor,
  );
  return Object.freeze({
    ...curve,
    roadId: ROAD_ID_BY_DEFINITION.get(definition) ?? roadId,
    engineeredVerticalProfile: true,
    verticalTargetGrade,
  });
}

function serviceRoadWidening(t) {
  const junctionInfluence = Math.max(0, 1 - Math.min(t, 1 - t) / 0.08);
  return junctionInfluence * 1.15;
}

export function getBabylonServiceRoadSurfaceOffset(roadId, lateralOffsetM = 0, wideningM = 0) {
  const definition = requireServiceDefinition(roadId);
  const halfRoad = definition.widthM / 2 + Math.max(0, wideningM);
  const crownRise = Math.min(0.22, halfRoad * BABYLON_SERVICE_CROSSFALL);
  const fraction = Math.min(1, Math.abs(lateralOffsetM) / Math.max(halfRoad, 0.001));
  return BABYLON_ROAD_SURFACE_OFFSET_M + crownRise * (1 - fraction);
}

export function createBabylonServiceLaneCurve(roadId, lateralOffsetM, { reverse = false } = {}) {
  const definition = requireServiceDefinition(roadId);
  const centerCurve = createBabylonServiceRoadAlignment(roadId);
  const sampleCount = Math.max(160, definition.points.length * 18);
  const lanePoints = [];
  for (let index = 0; index <= sampleCount; index += 1) {
    const t = index / sampleCount;
    const center = centerCurve.getPoint(t);
    const sideTangent = tangentXZAt(centerCurve, clamp(t, 0.001, 0.999));
    const side = { x: -sideTangent.z, y: 0, z: sideTangent.x };
    const widening = serviceRoadWidening(t);
    lanePoints.push({
      x: center.x + side.x * lateralOffsetM,
      y: center.y
        + getBabylonServiceRoadSurfaceOffset(roadId, lateralOffsetM, widening)
        - BABYLON_ROAD_SURFACE_OFFSET_M,
      z: center.z + side.z * lateralOffsetM,
    });
  }
  if (reverse) lanePoints.reverse();
  return createNumericCatmullRom(lanePoints);
}

export function sampleBabylonServiceRoadCrossSectionWithCurve(roadId, definition, centerCurve, t) {
  const center = centerCurve.getPoint(clamp(t, 0, 1));
  const tangent = tangentXZAt(centerCurve, clamp(t, 0, 1));
  const side = { x: -tangent.z, y: 0, z: tangent.x };
  const widening = serviceRoadWidening(clamp(t, 0, 1));
  const halfRoad = definition.widthM / 2 + widening;
  const crownRise = Math.min(0.22, halfRoad * BABYLON_SERVICE_CROSSFALL);
  const at = (offset, y) => ({
    x: center.x + side.x * offset,
    y,
    z: center.z + side.z * offset,
  });
  return Object.freeze({
    center,
    tangent,
    side,
    widening,
    halfRoad,
    crownRise,
    left: at(halfRoad, center.y),
    crown: at(0, center.y + crownRise),
    right: at(-halfRoad, center.y),
  });
}

export function sampleBabylonServiceRoadCrossSection(roadId, t) {
  const definition = requireServiceDefinition(roadId);
  const centerCurve = createBabylonServiceRoadAlignment(roadId);
  return sampleBabylonServiceRoadCrossSectionWithCurve(roadId, definition, centerCurve, t);
}

export function buildBabylonServiceRoadVertexData(roadId, { samples } = {}) {
  const definition = requireServiceDefinition(roadId);
  const sampleCount = samples ?? Math.max(96, definition.points.length * 24);
  if (!Number.isInteger(sampleCount) || sampleCount < 2) {
    throw new RangeError('Road samples must be an integer >= 2.');
  }
  const centerCurve = createBabylonServiceRoadAlignment(roadId);
  const positions = [];
  const indices = [];
  for (let index = 0; index <= sampleCount; index += 1) {
    const section = sampleBabylonServiceRoadCrossSectionWithCurve(
      roadId,
      definition,
      centerCurve,
      index / sampleCount,
    );
    [section.left, section.crown, section.right].forEach((point) => {
      positions.push(point.x, point.y, point.z);
    });
    if (index < sampleCount) {
      const base = index * 3;
      indices.push(
        base, base + 1, base + 3,
        base + 1, base + 4, base + 3,
        base + 1, base + 2, base + 4,
        base + 2, base + 5, base + 4,
      );
    }
  }
  const normals = [];
  VertexData.ComputeNormals(positions, indices, normals);
  return Object.freeze({
    roadId,
    positions,
    indices,
    normals,
    samples: sampleCount,
    vertexCount: positions.length / 3,
  });
}

function createServiceRoadMaterial(scene, roadId) {
  const material = new StandardMaterial(`${roadId}-material`, scene);
  material.diffuseColor = new Color3(0.33, 0.29, 0.23);
  material.specularColor = new Color3(0.04, 0.04, 0.035);
  material.specularPower = 8;
  return material;
}

export function createBabylonServiceRoad({ scene, roadId, samples, material = null } = {}) {
  if (!scene) throw new TypeError('Babylon service road requires a Scene.');
  if (scene.useRightHandedSystem !== true) {
    throw new Error('Babylon service roads require scene.useRightHandedSystem = true.');
  }
  const definition = requireServiceDefinition(roadId);
  const data = buildBabylonServiceRoadVertexData(roadId, { samples });
  const mesh = new Mesh(`${roadId}-surface`, scene);
  const vertexData = new VertexData();
  vertexData.positions = data.positions;
  vertexData.indices = data.indices;
  vertexData.normals = data.normals;
  vertexData.applyToMesh(mesh, false);
  mesh.material = material ?? createServiceRoadMaterial(scene, roadId);
  mesh.receiveShadows = true;
  mesh.isPickable = true;
  mesh.metadata = {
    roadId,
    role: definition.role,
    widthM: definition.widthM,
    shoulderM: definition.shoulderM,
    crossSlopeTarget: BABYLON_SERVICE_CROSSFALL,
    engineeredRoad: true,
    engineeredVerticalProfile: true,
    authoritativeAlignment: 'babylon-service-road-profile',
    terrainHeightSource: 'getTerrainHeight',
    coordinateSystem: 'right-handed',
    samples: data.samples,
  };
  return { mesh, material: mesh.material, data };
}

export function createBabylonServiceRoads({ scene, samplesByRoad = {} } = {}) {
  if (!scene) throw new TypeError('Babylon service roads require a Scene.');
  return Object.fromEntries(BABYLON_SERVICE_ROAD_IDS.map((roadId) => [
    roadId,
    createBabylonServiceRoad({ scene, roadId, samples: samplesByRoad[roadId] }),
  ]));
}
