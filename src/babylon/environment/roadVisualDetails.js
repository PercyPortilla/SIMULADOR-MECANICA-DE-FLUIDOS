import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import {
  ROAD_CIVIL_DETAIL,
  ROAD_DEFINITIONS,
  SERVICE_ROAD_VERTICAL_PROFILE,
  TOPOGRAPHIC_ZONES,
} from '../../scene/config/siteDesign.js';
import { getTerrainHeight } from '../../scene/environment/terrainHeight.js';
import { sampleBabylonPrimaryRoadCrossSection } from './primaryHaulRoad.js';
import {
  createBabylonServiceRoadAlignment,
  sampleBabylonServiceRoadCrossSectionWithCurve,
} from './serviceRoads.js';

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(value, min, max) {
  if (value <= min) return 0;
  if (value >= max) return 1;
  const t = (value - min) / Math.max(1e-12, max - min);
  return t * t * (3 - 2 * t);
}

function addScaled(point, direction, scale) {
  return {
    x: point.x + direction.x * scale,
    y: point.y + direction.y * scale,
    z: point.z + direction.z * scale,
  };
}

function lerpPoint(a, b, t) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

function material(scene, name, hex, { alpha = 1 } = {}) {
  const result = new StandardMaterial(name, scene);
  result.diffuseColor = Color3.FromHexString(`#${hex.toString(16).padStart(6, '0')}`);
  result.specularColor = Color3.Black();
  result.specularPower = 2;
  result.alpha = alpha;
  result.metadata = { visualOnly: true, scenePaletteRole: 'road' };
  return result;
}

function createVisualMaterials(scene) {
  return Object.freeze({
    shoulder: material(scene, 'road-shoulder-material', 0x756858),
    cutFill: material(scene, 'road-cut-fill-material', 0x6a5b4a),
    berm: material(scene, 'road-berm-material', 0x665547),
    ditch: material(scene, 'road-ditch-material', 0x51514d),
    track: material(scene, 'primary-haul-wheel-track-material', 0x5f554b, { alpha: 0.72 }),
  });
}

export function getBabylonRoadCutFillTransitionWidth(roadId, progress = 0) {
  const definition = ROAD_DEFINITIONS[roadId];
  if (!definition) throw new RangeError(`Camino desconocido: ${roadId}.`);
  if (definition.role !== 'primary-haul-road') return SERVICE_ROAD_VERTICAL_PROFILE.minimumTransitionWidthM;
  const tieIn = smoothstep(clamp(progress, 0, 1), ROAD_CIVIL_DETAIL.primaryTieInStart, 1);
  return ROAD_CIVIL_DETAIL.primaryTransitionWidthM + ROAD_CIVIL_DETAIL.primaryTieInFlareM * tieIn;
}

export function getBabylonRoadSafetyBermHeight(roadId, progress = 0) {
  const definition = ROAD_DEFINITIONS[roadId];
  if (!definition) throw new RangeError(`Camino desconocido: ${roadId}.`);
  if (definition.role !== 'primary-haul-road') return 0.48;
  const taper = smoothstep(
    clamp(progress, 0, 1),
    ROAD_CIVIL_DETAIL.primaryBermTaperStart,
    ROAD_CIVIL_DETAIL.primaryBermTaperEnd,
  );
  return ROAD_CIVIL_DETAIL.primaryBermHeightM * (1 - taper);
}

function augmentCrossSection(roadId, progress, surface) {
  const definition = ROAD_DEFINITIONS[roadId];
  const isPrimary = definition.role === 'primary-haul-road';
  const shoulder = definition.shoulderM + (isPrimary ? surface.widening * 0.35 : 0);
  const shoulderDrop = Math.min(0.18, shoulder * 0.035);
  const transitionWidth = getBabylonRoadCutFillTransitionWidth(roadId, progress);
  const pointAt = (offset, y) => ({ ...addScaled(surface.center, surface.side, offset), y });
  const terrainPointAt = (offset) => {
    const point = addScaled(surface.center, surface.side, offset);
    point.y = getTerrainHeight(point.x, point.z) + 0.025;
    return point;
  };
  const ditchPointAt = (offset, sign) => {
    const point = addScaled(surface.center, surface.side, offset * sign);
    const terrainY = getTerrainHeight(point.x, point.z) + 0.02;
    point.y = Math.min(terrainY, surface.center.y - shoulderDrop - 0.16);
    return point;
  };
  const ditchInnerOffset = surface.halfRoad + shoulder + 0.55;
  const ditchOuterOffset = ditchInnerOffset + 0.85;
  return {
    ...surface,
    shoulder,
    transitionWidth,
    leftRoad: surface.left,
    rightRoad: surface.right,
    leftShoulder: pointAt(surface.halfRoad + shoulder, surface.center.y - shoulderDrop),
    rightShoulder: pointAt(-(surface.halfRoad + shoulder), surface.center.y - shoulderDrop),
    leftDitchInner: ditchPointAt(ditchInnerOffset, 1),
    leftDitchOuter: terrainPointAt(ditchOuterOffset),
    rightDitchInner: ditchPointAt(ditchInnerOffset, -1),
    rightDitchOuter: terrainPointAt(-ditchOuterOffset),
    leftTerrain: terrainPointAt(surface.halfRoad + shoulder + transitionWidth),
    rightTerrain: terrainPointAt(-(surface.halfRoad + shoulder + transitionWidth)),
  };
}

function createCrossSectionSampler(roadId) {
  if (roadId === 'ROAD-01') {
    return (progress) => augmentCrossSection(
      roadId,
      progress,
      sampleBabylonPrimaryRoadCrossSection(progress),
    );
  }
  const definition = ROAD_DEFINITIONS[roadId];
  const centerCurve = createBabylonServiceRoadAlignment(roadId);
  return (progress) => augmentCrossSection(
    roadId,
    progress,
    sampleBabylonServiceRoadCrossSectionWithCurve(roadId, definition, centerCurve, progress),
  );
}

function receptionSafeVisualPoint(point, clearanceM = 0.04) {
  const reception = TOPOGRAPHIC_ZONES.reception;
  const distance = Math.hypot(point.x - reception.center[0], point.z - reception.center[1]);
  if (distance > 82) return point;
  return {
    ...point,
    y: Math.max(point.y, getTerrainHeight(point.x, point.z) + clearanceM),
  };
}

function buildPairStripData(sampleCrossSection, samples, fieldA, fieldB, { terrainSafeAtReception = false } = {}) {
  const positions = [];
  const indices = [];
  const lateralSegments = terrainSafeAtReception ? 16 : 1;
  const rowWidth = lateralSegments + 1;
  const pushTriangle = (a, b, c) => {
    if (terrainSafeAtReception) {
      const vertices = [a, b, c];
      const x = vertices.reduce((sum, vertex) => sum + positions[vertex * 3], 0) / 3;
      const y = vertices.reduce((sum, vertex) => sum + positions[vertex * 3 + 1], 0) / 3;
      const z = vertices.reduce((sum, vertex) => sum + positions[vertex * 3 + 2], 0) / 3;
      const reception = TOPOGRAPHIC_ZONES.reception;
      if (Math.hypot(x - reception.center[0], z - reception.center[1]) <= 82) {
        const minimumVisualY = getTerrainHeight(x, z) + 0.025;
        if (y < minimumVisualY) {
          const lift = minimumVisualY - y;
          vertices.forEach((vertex) => { positions[vertex * 3 + 1] += lift; });
        }
      }
    }
    indices.push(a, c, b);
  };
  for (let index = 0; index <= samples; index += 1) {
    const section = sampleCrossSection(index / samples);
    const a = section[fieldA];
    const b = section[fieldB];
    for (let lateral = 0; lateral <= lateralSegments; lateral += 1) {
      let point = lerpPoint(a, b, lateral / lateralSegments);
      if (terrainSafeAtReception) point = receptionSafeVisualPoint(point);
      positions.push(point.x, point.y, point.z);
    }
  }
  for (let index = 0; index < samples; index += 1) {
    const row = index * rowWidth;
    const nextRow = row + rowWidth;
    for (let lateral = 0; lateral < lateralSegments; lateral += 1) {
      const base = row + lateral;
      const next = nextRow + lateral;
      pushTriangle(base, next, base + 1);
      pushTriangle(base + 1, next, next + 1);
    }
  }
  return { positions, indices };
}

function buildBermData(roadId, sampleCrossSection, samples, sign) {
  const definition = ROAD_DEFINITIONS[roadId];
  const positions = [];
  const indices = [];
  const isPrimary = definition.role === 'primary-haul-road';
  const innerInset = isPrimary ? 0.30 : 0.20;
  const bermWidth = isPrimary ? 1.75 : 0.90;
  for (let index = 0; index <= samples; index += 1) {
    const progress = index / samples;
    const section = sampleCrossSection(progress);
    const shoulderOuter = sign > 0 ? section.leftShoulder : section.rightShoulder;
    const outward = { x: section.side.x * sign, y: 0, z: section.side.z * sign };
    const innerToe = addScaled(shoulderOuter, outward, innerInset);
    const crest = addScaled(shoulderOuter, outward, innerInset + bermWidth * 0.48);
    crest.y += getBabylonRoadSafetyBermHeight(roadId, progress);
    const outerToe = addScaled(shoulderOuter, outward, innerInset + bermWidth);
    outerToe.y = shoulderOuter.y + (getTerrainHeight(outerToe.x, outerToe.z) + 0.05 - shoulderOuter.y) * 0.48;
    [innerToe, crest, outerToe].forEach((point) => positions.push(point.x, point.y, point.z));
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
  return { positions, indices };
}

function buildTrackData(sampleCrossSection, samples, lateralOffset, trackWidth = 0.48) {
  const positions = [];
  const indices = [];
  for (let index = 0; index <= samples; index += 1) {
    const section = sampleCrossSection(index / samples);
    const roadFraction = Math.min(1, Math.abs(lateralOffset) / Math.max(section.halfRoad, 0.001));
    const localRise = section.crownRise * (1 - roadFraction);
    const center = addScaled(section.center, section.side, lateralOffset);
    center.y = section.center.y + localRise + 0.018;
    const a = addScaled(center, section.side, trackWidth / 2);
    const b = addScaled(center, section.side, -trackWidth / 2);
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    if (index < samples) {
      const base = index * 2;
      indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
    }
  }
  return { positions, indices };
}

function createMesh(scene, parent, name, data, meshMaterial, metadata = {}) {
  const normals = [];
  VertexData.ComputeNormals(data.positions, data.indices, normals);
  const vertexData = new VertexData();
  vertexData.positions = data.positions;
  vertexData.indices = data.indices;
  vertexData.normals = normals;
  const mesh = new Mesh(name, scene);
  vertexData.applyToMesh(mesh, false);
  mesh.parent = parent;
  mesh.material = meshMaterial;
  mesh.receiveShadows = true;
  mesh.metadata = { visualOnly: true, ...metadata };
  return mesh;
}

export function createBabylonRoadVisualDetails({ scene, parent, roadId, materials = null, samples = null } = {}) {
  if (!scene) throw new TypeError('Babylon road visual details require a Scene.');
  if (scene.useRightHandedSystem !== true) throw new Error('Babylon road visual details require a right-handed Scene.');
  const definition = ROAD_DEFINITIONS[roadId];
  if (!definition) throw new RangeError(`Camino desconocido: ${roadId}.`);
  const sampleCount = samples ?? Math.max(96, definition.points.length * 24);
  const sampleCrossSection = createCrossSectionSampler(roadId);
  const visualMaterials = materials ?? createVisualMaterials(scene);
  const meshes = [];
  const addStrip = (name, fieldA, fieldB, meshMaterial, metadata = {}, options = {}) => {
    const mesh = createMesh(
      scene,
      parent,
      name,
      buildPairStripData(sampleCrossSection, sampleCount, fieldA, fieldB, options),
      meshMaterial,
      { roadId, ...metadata },
    );
    meshes.push(mesh);
    return mesh;
  };
  addStrip(`${roadId}-left-shoulder`, 'leftRoad', 'leftShoulder', visualMaterials.shoulder, { roadVisualRole: 'shoulder' }, { terrainSafeAtReception: true });
  addStrip(`${roadId}-right-shoulder`, 'rightShoulder', 'rightRoad', visualMaterials.shoulder, { roadVisualRole: 'shoulder' }, { terrainSafeAtReception: true });
  addStrip(`${roadId}-left-cut-fill-transition`, 'leftTerrain', 'leftShoulder', visualMaterials.cutFill, { roadVisualRole: 'cut-fill-transition' }, { terrainSafeAtReception: true });
  addStrip(`${roadId}-right-cut-fill-transition`, 'rightShoulder', 'rightTerrain', visualMaterials.cutFill, { roadVisualRole: 'cut-fill-transition' }, { terrainSafeAtReception: true });
  if (definition.role !== 'primary-haul-road') {
    addStrip(`${roadId}-left-drainage-swale`, 'leftDitchInner', 'leftDitchOuter', visualMaterials.ditch, { roadVisualRole: 'drainage-swale', roadDrainage: true });
    addStrip(`${roadId}-right-drainage-swale`, 'rightDitchOuter', 'rightDitchInner', visualMaterials.ditch, { roadVisualRole: 'drainage-swale', roadDrainage: true });
  }
  const bermSigns = definition.role === 'primary-haul-road' ? [-1, 1] : [1];
  bermSigns.forEach((sign, index) => {
    const mesh = createMesh(
      scene,
      parent,
      `${roadId}-continuous-safety-berm-${index + 1}`,
      buildBermData(roadId, sampleCrossSection, sampleCount, sign),
      visualMaterials.berm,
      { roadId, roadVisualRole: 'continuous-safety-berm', sideSign: sign, castsShadow: true },
    );
    meshes.push(mesh);
  });
  if (definition.role === 'primary-haul-road') {
    const trackSamples = Math.max(120, definition.points.length * 24);
    const trackOffset = Math.min(3.25, definition.widthM * 0.19);
    [-trackOffset, trackOffset].forEach((offset, index) => {
      meshes.push(createMesh(
        scene,
        parent,
        `primary-haul-wheel-track-${index + 1}`,
        buildTrackData(sampleCrossSection, trackSamples, offset),
        visualMaterials.track,
        { roadId, roadVisualRole: 'wheel-track', lateralOffsetM: offset, trackWidthM: 0.48 },
      ));
    });
  }
  return { roadId, meshes, materials: visualMaterials, samples: sampleCount };
}
