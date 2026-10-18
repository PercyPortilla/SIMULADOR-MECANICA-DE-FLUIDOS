import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import {
  ROAD_DEFINITIONS,
} from '../../scene/config/siteDesign.js';
import { getTerrainHeight } from '../../scene/environment/terrainHeight.js';
import {
  samplePrimaryRoadParametric,
} from '../../scene/environment/primaryRoadProfile.js';
import { createNumericCatmullRom } from '../../scene/math/numericCatmullRom.js';

export const BABYLON_ROAD_SURFACE_OFFSET_M = 0.10;
const PRIMARY_CROSSFALL = 0.022;

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function smoothstep(value, min, max) {
  const t = clamp((value - min) / Math.max(1e-12, max - min), 0, 1);
  return t * t * (3 - 2 * t);
}
function normalizeXZ(vector) {
  const length = Math.hypot(vector.x, vector.z);
  return length > 1e-12 ? { x: vector.x / length, y: 0, z: vector.z / length } : { x: 1, y: 0, z: 0 };
}
function tangentAt(t) {
  const delta = 0.0001;
  const a = samplePrimaryRoadParametric(clamp(t - delta, 0, 1), { surfaceOffsetM: BABYLON_ROAD_SURFACE_OFFSET_M });
  const b = samplePrimaryRoadParametric(clamp(t + delta, 0, 1), { surfaceOffsetM: BABYLON_ROAD_SURFACE_OFFSET_M });
  const length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  return length > 1e-12
    ? { x: (b.x - a.x) / length, y: (b.y - a.y) / length, z: (b.z - a.z) / length }
    : { x: 1, y: 0, z: 0 };
}
function wideningAt(t) {
  const before = normalizeXZ(tangentAt(clamp(t - 0.012, 0, 1)));
  const after = normalizeXZ(tangentAt(clamp(t + 0.012, 0, 1)));
  const dot = clamp(before.x * after.x + before.z * after.z, -1, 1);
  return Math.min(4.2, Math.acos(dot) * 20);
}

export function getBabylonRoadSurfaceOffset(lateralOffsetM = 0, wideningM = 0) {
  const definition = ROAD_DEFINITIONS['ROAD-01'];
  const halfRoad = definition.widthM / 2 + Math.max(0, wideningM);
  const crownRise = Math.min(0.22, halfRoad * PRIMARY_CROSSFALL);
  const fraction = Math.min(1, Math.abs(lateralOffsetM) / Math.max(halfRoad, 0.001));
  return BABYLON_ROAD_SURFACE_OFFSET_M + crownRise * (1 - fraction);
}

export function sampleBabylonPrimaryRoadCrossSection(t) {
  const definition = ROAD_DEFINITIONS['ROAD-01'];
  const center = samplePrimaryRoadParametric(t, { surfaceOffsetM: BABYLON_ROAD_SURFACE_OFFSET_M });
  const tangent = normalizeXZ(tangentAt(t));
  const side = { x: -tangent.z, y: 0, z: tangent.x };
  const widening = wideningAt(t);
  const halfRoad = definition.widthM / 2 + widening;
  const crownRise = Math.min(0.22, halfRoad * PRIMARY_CROSSFALL);
  const at = (offset, y) => ({
    x: center.x + side.x * offset,
    y,
    z: center.z + side.z * offset,
  });
  return {
    center,
    tangent,
    side,
    widening,
    halfRoad,
    crownRise,
    left: at(halfRoad, center.y),
    crown: at(0, center.y + crownRise),
    right: at(-halfRoad, center.y),
  };
}

export function createBabylonPrimaryHaulRoad({ scene, samples = 420 } = {}) {
  if (!scene) throw new TypeError('Babylon haul road requires a Scene.');
  const positions = [];
  const indices = [];
  for (let index = 0; index <= samples; index += 1) {
    const section = sampleBabylonPrimaryRoadCrossSection(index / samples);
    [section.left, section.crown, section.right].forEach((p) => positions.push(p.x, p.y, p.z));
    if (index < samples) {
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
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.normals = normals;
  const mesh = new Mesh('ROAD-01-surface', scene);
  data.applyToMesh(mesh, false);
  const material = new StandardMaterial('ROAD-01-material', scene);
  material.diffuseColor = new Color3(0.33, 0.29, 0.23);
  material.specularColor = new Color3(0.04, 0.04, 0.035);
  material.specularPower = 8;
  mesh.material = material;
  mesh.receiveShadows = true;
  mesh.metadata = {
    roadId: 'ROAD-01',
    authoritativeAlignment: 'primaryRoadProfile',
    widthM: ROAD_DEFINITIONS['ROAD-01'].widthM,
    samples,
  };
  return { mesh, material };
}

export function createBabylonPrimaryLaneCurve(lateralOffsetM, { reverse = false } = {}) {
  const definition = ROAD_DEFINITIONS['ROAD-01'];
  const sampleCount = Math.max(160, definition.points.length * 18);
  const lanePoints = [];
  for (let index = 0; index <= sampleCount; index += 1) {
    const t = index / sampleCount;
    const center = samplePrimaryRoadParametric(t, { surfaceOffsetM: BABYLON_ROAD_SURFACE_OFFSET_M });
    const tangent = normalizeXZ(tangentAt(clamp(t, 0.001, 0.999)));
    const side = { x: -tangent.z, y: 0, z: tangent.x };
    const widening = wideningAt(t);
    lanePoints.push({
      x: center.x + side.x * lateralOffsetM,
      y: center.y + getBabylonRoadSurfaceOffset(lateralOffsetM, widening) - BABYLON_ROAD_SURFACE_OFFSET_M,
      z: center.z + side.z * lateralOffsetM,
    });
  }
  if (reverse) lanePoints.reverse();
  return createNumericCatmullRom(lanePoints);
}

export function groundBabylonRoadLaneTransition(position, lateralOffsetM) {
  return {
    x: position.x,
    y: getTerrainHeight(position.x, position.z) + getBabylonRoadSurfaceOffset(lateralOffsetM),
    z: position.z,
  };
}
