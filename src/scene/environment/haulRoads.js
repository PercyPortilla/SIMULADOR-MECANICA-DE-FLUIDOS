import * as THREE from 'three';
import { getTerrainHeight } from './terrainHeight.js';
import { ROAD_CIVIL_DETAIL, ROAD_DEFINITIONS } from '../config/siteDesign.js';
import { createIndustrialMaterial } from '../materials/industrialMaterials.js';
import { createPrimaryRoadAlignment } from './roadEngineering.js';

export const HAUL_ROAD_WIDTH = ROAD_DEFINITIONS['ROAD-01'].widthM;

export const ROAD_SURFACE_OFFSET_M = 0.10;
const PRIMARY_CROSSFALL = 0.022;
const SERVICE_CROSSFALL = 0.018;
const ROAD_ID_BY_DEFINITION = new Map(Object.entries(ROAD_DEFINITIONS).map(([roadId, definition]) => [definition, roadId]));

export function getRoadCutFillTransitionWidth(roadId, progress = 0) {
  const definition = ROAD_DEFINITIONS[roadId];
  if (!definition) throw new RangeError(`Camino desconocido: ${roadId}.`);
  if (definition.role !== 'primary-haul-road') return 3.2;
  const tieIn = THREE.MathUtils.smoothstep(
    THREE.MathUtils.clamp(progress, 0, 1),
    ROAD_CIVIL_DETAIL.primaryTieInStart,
    1,
  );
  return ROAD_CIVIL_DETAIL.primaryTransitionWidthM + ROAD_CIVIL_DETAIL.primaryTieInFlareM * tieIn;
}

export function getRoadSafetyBermHeight(roadId, progress = 0) {
  const definition = ROAD_DEFINITIONS[roadId];
  if (!definition) throw new RangeError(`Camino desconocido: ${roadId}.`);
  if (definition.role !== 'primary-haul-road') return 0.48;
  const taper = THREE.MathUtils.smoothstep(
    THREE.MathUtils.clamp(progress, 0, 1),
    ROAD_CIVIL_DETAIL.primaryBermTaperStart,
    ROAD_CIVIL_DETAIL.primaryBermTaperEnd,
  );
  return ROAD_CIVIL_DETAIL.primaryBermHeightM * (1 - taper);
}

export function getRoadWidth(roadId) {
  const definition = ROAD_DEFINITIONS[roadId];
  if (!definition) throw new RangeError(`Camino desconocido: ${roadId}.`);
  return definition.widthM;
}

export function getRoadPath(roadId) {
  const definition = ROAD_DEFINITIONS[roadId];
  if (!definition) throw new RangeError(`Camino desconocido: ${roadId}.`);
  return definition.points.map(([x, z]) => ({ x, z, y: getTerrainHeight(x, z) + ROAD_SURFACE_OFFSET_M }));
}

export function getRoadSurfaceOffset(roadId, lateralOffsetM = 0, wideningM = 0) {
  const definition = ROAD_DEFINITIONS[roadId];
  if (!definition) throw new RangeError(`Camino desconocido: ${roadId}.`);
  const isPrimary = definition.role === 'primary-haul-road';
  const crossfall = isPrimary ? PRIMARY_CROSSFALL : SERVICE_CROSSFALL;
  const halfRoad = definition.widthM / 2 + Math.max(0, wideningM);
  const crownRise = Math.min(0.22, halfRoad * crossfall);
  const fraction = Math.min(1, Math.abs(lateralOffsetM) / Math.max(halfRoad, 0.001));
  return ROAD_SURFACE_OFFSET_M + crownRise * (1 - fraction);
}

function isClosedRoad(points) {
  return points.length > 2 && points[0][0] === points.at(-1)[0] && points[0][1] === points.at(-1)[1];
}

function createAlignment(definition) {
  if (definition === ROAD_DEFINITIONS['ROAD-01']) {
    return createPrimaryRoadAlignment({ surfaceOffsetM: ROAD_SURFACE_OFFSET_M });
  }
  const closed = isClosedRoad(definition.points);
  const sourcePoints = closed ? definition.points.slice(0, -1) : definition.points;
  const planar = new THREE.CatmullRomCurve3(
    sourcePoints.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    closed,
    'centripetal',
  );
  // Secondary roads follow the actual terrain continuously instead of only
  // matching elevation at sparse control points. This avoids floating/embedded
  // mid-segments when the ground changes between junctions.
  const sampleCount = Math.max(96, sourcePoints.length * 18);
  const groundedPoints = [];
  for (let index = 0; index <= sampleCount; index += 1) {
    const t = index / sampleCount;
    const point = planar.getPoint(t);
    point.y = getTerrainHeight(point.x, point.z) + ROAD_SURFACE_OFFSET_M;
    groundedPoints.push(point);
  }
  return new THREE.CatmullRomCurve3(groundedPoints, closed, 'centripetal');
}


export function getRoadDesignMetrics(roadId, { samples = 320 } = {}) {
  const definition = ROAD_DEFINITIONS[roadId];
  if (!definition) throw new RangeError(`Camino desconocido: ${roadId}.`);
  const curve = createAlignment(definition);
  let lengthM = 0;
  let maximumGrade = 0;
  let minimumRadiusM = Infinity;
  let previous = curve.getPointAt(0);
  const points = [previous];
  for (let index = 1; index <= samples; index += 1) {
    const current = curve.getPointAt(index / samples);
    const horizontal = Math.hypot(current.x - previous.x, current.z - previous.z);
    if (horizontal > 1e-6) maximumGrade = Math.max(maximumGrade, Math.abs(current.y - previous.y) / horizontal);
    lengthM += current.distanceTo(previous);
    points.push(current);
    previous = current;
  }
  for (let index = 1; index < points.length - 1; index += 1) {
    const a = points[index - 1];
    const b = points[index];
    const c = points[index + 1];
    const ab = Math.hypot(b.x - a.x, b.z - a.z);
    const bc = Math.hypot(c.x - b.x, c.z - b.z);
    const ca = Math.hypot(c.x - a.x, c.z - a.z);
    const twiceArea = Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x));
    if (twiceArea <= 1e-7) continue;
    minimumRadiusM = Math.min(minimumRadiusM, (ab * bc * ca) / (2 * twiceArea));
  }
  return Object.freeze({
    roadId,
    lengthM,
    maximumGrade,
    minimumRadiusM: Number.isFinite(minimumRadiusM) ? minimumRadiusM : Infinity,
    designMaximumGrade: definition.maximumGrade ?? null,
    designMinimumRadiusM: definition.minimumCurveRadiusM ?? null,
    designSpeedKph: definition.designSpeedKph ?? null,
  });
}

export function getRoadNetworkJunctions() {
  const nodeRoads = new Map();
  Object.entries(ROAD_DEFINITIONS).forEach(([roadId, definition]) => {
    definition.points.forEach(([x, z]) => {
      const key = `${x},${z}`;
      if (!nodeRoads.has(key)) nodeRoads.set(key, { x, z, roads: [] });
      nodeRoads.get(key).roads.push(roadId);
    });
  });
  return [...nodeRoads.values()]
    .filter((node) => node.roads.length > 1)
    .map((node) => Object.freeze({ ...node, roads: Object.freeze([...node.roads]) }));
}

export function createRoadAlignment(roadId) {
  const definition = ROAD_DEFINITIONS[roadId];
  if (!definition) throw new RangeError(`Camino desconocido: ${roadId}.`);
  return createAlignment(definition);
}

function curveWidening(curve, t, definition) {
  if (definition.role !== 'primary-haul-road') {
    const junctionInfluence = Math.max(0, 1 - Math.min(t, 1 - t) / 0.08);
    return junctionInfluence * 1.15;
  }
  const before = curve.getTangent(THREE.MathUtils.clamp(t - 0.012, 0, 1)).setY(0).normalize();
  const after = curve.getTangent(THREE.MathUtils.clamp(t + 0.012, 0, 1)).setY(0).normalize();
  const angle = Math.acos(THREE.MathUtils.clamp(before.dot(after), -1, 1));
  return Math.min(4.2, angle * 20);
}

export function createRoadLaneCurve(roadId, lateralOffsetM, { reverse = false } = {}) {
  const definition = ROAD_DEFINITIONS[roadId];
  if (!definition) throw new RangeError(`Camino desconocido: ${roadId}.`);
  const centerCurve = createAlignment(definition);
  const sampleCount = Math.max(160, definition.points.length * 18);
  const lanePoints = [];
  for (let index = 0; index <= sampleCount; index += 1) {
    const t = index / sampleCount;
    const center = centerCurve.getPoint(t);
    const tangent = centerCurve.getTangent(THREE.MathUtils.clamp(t, 0.001, 0.999)).setY(0).normalize();
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const widening = curveWidening(centerCurve, t, definition);
    const lane = center.clone().addScaledVector(side, lateralOffsetM);
    lane.y = center.y + getRoadSurfaceOffset(roadId, lateralOffsetM, widening) - ROAD_SURFACE_OFFSET_M;
    lanePoints.push(lane);
  }
  if (reverse) lanePoints.reverse();
  return new THREE.CatmullRomCurve3(lanePoints, false, 'centripetal');
}

function sampleCrossSection(curve, t, definition) {
  const center = curve.getPoint(t);
  const tangent = curve.getTangent(t).setY(0).normalize();
  const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
  const widening = curveWidening(curve, t, definition);
  const halfRoad = definition.widthM / 2 + widening;
  const shoulder = definition.shoulderM + (definition.role === 'primary-haul-road' ? widening * 0.35 : 0);
  const roadId = ROAD_ID_BY_DEFINITION.get(definition);
  const transitionWidth = roadId ? getRoadCutFillTransitionWidth(roadId, t) : 3.2;
  const crossfall = definition.role === 'primary-haul-road' ? PRIMARY_CROSSFALL : SERVICE_CROSSFALL;
  const crownRise = Math.min(0.22, halfRoad * crossfall);
  const shoulderDrop = Math.min(0.18, shoulder * 0.035);

  const pointAt = (offset, y) => center.clone().addScaledVector(side, offset).setY(y);
  const terrainPointAt = (offset) => {
    const point = center.clone().addScaledVector(side, offset);
    point.y = getTerrainHeight(point.x, point.z) + 0.025;
    return point;
  };
  const ditchPointAt = (offset, sign) => {
    const point = center.clone().addScaledVector(side, offset * sign);
    const terrainY = getTerrainHeight(point.x, point.z) + 0.02;
    point.y = Math.min(terrainY, center.y - shoulderDrop - 0.16);
    return point;
  };
  const ditchInnerOffset = halfRoad + shoulder + 0.55;
  const ditchOuterOffset = ditchInnerOffset + 0.85;

  return {
    center,
    tangent,
    side,
    halfRoad,
    shoulder,
    transitionWidth,
    crownRise,
    leftRoad: pointAt(halfRoad, center.y),
    crown: center.clone().setY(center.y + crownRise),
    rightRoad: pointAt(-halfRoad, center.y),
    leftShoulder: pointAt(halfRoad + shoulder, center.y - shoulderDrop),
    rightShoulder: pointAt(-(halfRoad + shoulder), center.y - shoulderDrop),
    leftDitchInner: ditchPointAt(ditchInnerOffset, 1),
    leftDitchOuter: terrainPointAt(ditchOuterOffset),
    rightDitchInner: ditchPointAt(ditchInnerOffset, -1),
    rightDitchOuter: terrainPointAt(-ditchOuterOffset),
    leftTerrain: terrainPointAt(halfRoad + shoulder + transitionWidth),
    rightTerrain: terrainPointAt(-(halfRoad + shoulder + transitionWidth)),
  };
}

function buildRoadSurfaceGeometry(curve, definition, samples) {
  const vertices = [];
  const indices = [];
  for (let index = 0; index <= samples; index += 1) {
    const section = sampleCrossSection(curve, index / samples, definition);
    [section.leftRoad, section.crown, section.rightRoad].forEach((p) => vertices.push(p.x, p.y, p.z));
    if (index < samples) {
      const base = index * 3;
      indices.push(
        base, base + 3, base + 1,
        base + 1, base + 3, base + 4,
        base + 1, base + 4, base + 2,
        base + 2, base + 4, base + 5,
      );
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function buildPairStripGeometry(curve, definition, samples, selectorA, selectorB) {
  const vertices = [];
  const indices = [];
  for (let index = 0; index <= samples; index += 1) {
    const section = sampleCrossSection(curve, index / samples, definition);
    const a = selectorA(section);
    const b = selectorB(section);
    vertices.push(a.x, a.y, a.z, b.x, b.y, b.z);
    if (index < samples) {
      const base = index * 2;
      indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function buildBermGeometry(curve, definition, samples, sign) {
  const vertices = [];
  const indices = [];
  const isPrimary = definition.role === 'primary-haul-road';
  const innerInset = isPrimary ? 0.30 : 0.20;
  const bermWidth = isPrimary ? 1.75 : 0.90;

  for (let index = 0; index <= samples; index += 1) {
    const progress = index / samples;
    const section = sampleCrossSection(curve, progress, definition);
    const roadId = ROAD_ID_BY_DEFINITION.get(definition);
    const bermHeight = roadId ? getRoadSafetyBermHeight(roadId, progress) : (isPrimary ? 1.20 : 0.48);
    const shoulderOuter = sign > 0 ? section.leftShoulder : section.rightShoulder;
    const outward = section.side.clone().multiplyScalar(sign);
    const innerToe = shoulderOuter.clone().addScaledVector(outward, innerInset);
    const crest = shoulderOuter.clone().addScaledVector(outward, innerInset + bermWidth * 0.48);
    crest.y += bermHeight;
    const outerToe = shoulderOuter.clone().addScaledVector(outward, innerInset + bermWidth);
    outerToe.y = THREE.MathUtils.lerp(shoulderOuter.y, getTerrainHeight(outerToe.x, outerToe.z) + 0.05, 0.48);
    [innerToe, crest, outerToe].forEach((p) => vertices.push(p.x, p.y, p.z));

    if (index < samples) {
      const base = index * 3;
      indices.push(
        base, base + 3, base + 1,
        base + 1, base + 3, base + 4,
        base + 1, base + 4, base + 2,
        base + 2, base + 4, base + 5,
      );
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function buildTrackRibbonGeometry(curve, definition, samples, lateralOffset, trackWidth = 0.48) {
  const vertices = [];
  const indices = [];
  for (let index = 0; index <= samples; index += 1) {
    const t = index / samples;
    const section = sampleCrossSection(curve, t, definition);
    const roadFraction = Math.min(1, Math.abs(lateralOffset) / Math.max(section.halfRoad, 0.001));
    const localRise = section.crownRise * (1 - roadFraction);
    const center = section.center.clone().addScaledVector(section.side, lateralOffset);
    center.y = section.center.y + localRise + 0.018;
    const a = center.clone().addScaledVector(section.side, trackWidth / 2);
    const b = center.clone().addScaledVector(section.side, -trackWidth / 2);
    vertices.push(a.x, a.y, a.z, b.x, b.y, b.z);
    if (index < samples) {
      const base = index * 2;
      indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createPrimaryRoadTracks(curve, definition, group) {
  if (definition.role !== 'primary-haul-road') return;
  const samples = Math.max(120, definition.points.length * 24);
  const trackOffset = Math.min(3.25, definition.widthM * 0.19);
  const trackMaterial = new THREE.MeshStandardMaterial({ color: 0x5f554b, roughness: 1, metalness: 0, transparent: true, opacity: 0.72 });
  [-trackOffset, trackOffset].forEach((offset, index) => {
    const track = new THREE.Mesh(buildTrackRibbonGeometry(curve, definition, samples, offset), trackMaterial);
    track.name = `primary-haul-wheel-track-${index + 1}`;
    track.receiveShadow = true;
    group.add(track);
  });
}

function createRoadAssembly(roadId, definition, roadMaterial, group, materials) {
  const curve = createAlignment(definition);
  const samples = Math.max(96, definition.points.length * 24);

  const road = new THREE.Mesh(buildRoadSurfaceGeometry(curve, definition, samples), roadMaterial);
  road.name = roadId;
  road.userData = {
    role: definition.role,
    widthM: definition.widthM,
    shoulderM: definition.shoulderM,
    crossSlopeTarget: definition.role === 'primary-haul-road' ? PRIMARY_CROSSFALL : SERVICE_CROSSFALL,
    engineeredRoad: true,
  };
  road.receiveShadow = true;
  group.add(road);

  const leftShoulder = new THREE.Mesh(
    buildPairStripGeometry(curve, definition, samples, (s) => s.leftRoad, (s) => s.leftShoulder),
    materials.shoulder,
  );
  leftShoulder.name = `${roadId}-left-shoulder`;
  leftShoulder.receiveShadow = true;
  group.add(leftShoulder);

  const rightShoulder = new THREE.Mesh(
    buildPairStripGeometry(curve, definition, samples, (s) => s.rightShoulder, (s) => s.rightRoad),
    materials.shoulder,
  );
  rightShoulder.name = `${roadId}-right-shoulder`;
  rightShoulder.receiveShadow = true;
  group.add(rightShoulder);

  const leftTransition = new THREE.Mesh(
    buildPairStripGeometry(curve, definition, samples, (s) => s.leftTerrain, (s) => s.leftShoulder),
    materials.cutFill,
  );
  leftTransition.name = `${roadId}-left-cut-fill-transition`;
  leftTransition.receiveShadow = true;
  group.add(leftTransition);

  const rightTransition = new THREE.Mesh(
    buildPairStripGeometry(curve, definition, samples, (s) => s.rightShoulder, (s) => s.rightTerrain),
    materials.cutFill,
  );
  rightTransition.name = `${roadId}-right-cut-fill-transition`;
  rightTransition.receiveShadow = true;
  group.add(rightTransition);

  if (definition.role !== 'primary-haul-road') {
    const leftDitch = new THREE.Mesh(
      buildPairStripGeometry(curve, definition, samples, (s) => s.leftDitchInner, (s) => s.leftDitchOuter),
      materials.ditch,
    );
    leftDitch.name = `${roadId}-left-drainage-swale`;
    leftDitch.receiveShadow = true;
    leftDitch.userData.roadDrainage = true;
    group.add(leftDitch);

    const rightDitch = new THREE.Mesh(
      buildPairStripGeometry(curve, definition, samples, (s) => s.rightDitchOuter, (s) => s.rightDitchInner),
      materials.ditch,
    );
    rightDitch.name = `${roadId}-right-drainage-swale`;
    rightDitch.receiveShadow = true;
    rightDitch.userData.roadDrainage = true;
    group.add(rightDitch);
  }

  // Continuous berms replace the previous repeated dodecahedron boulders. For the
  // primary haul road both sides are protected; service roads get a single outer
  // edge treatment to remain visually lighter.
  const bermSides = definition.role === 'primary-haul-road' ? [-1, 1] : [1];
  bermSides.forEach((sign, index) => {
    const berm = new THREE.Mesh(buildBermGeometry(curve, definition, samples, sign), materials.berm);
    berm.name = `${roadId}-continuous-safety-berm-${index + 1}`;
    berm.castShadow = true;
    berm.receiveShadow = true;
    group.add(berm);
  });

  createPrimaryRoadTracks(curve, definition, group);
}

export function createHaulRoads(material) {
  const group = new THREE.Group();
  group.name = 'haul-roads';
  const materials = {
    shoulder: createIndustrialMaterial('terrain', { color: 0x88745e, roughness: 1 }),
    cutFill: createIndustrialMaterial('terrain', { color: 0x7d6a57, roughness: 1 }),
    berm: createIndustrialMaterial('terrain', { color: 0x74614f, roughness: 1 }),
    ditch: createIndustrialMaterial('terrain', { color: 0x5f5b50, roughness: 1, metalness: 0 }),
  };

  Object.entries(ROAD_DEFINITIONS).forEach(([roadId, definition]) => {
    createRoadAssembly(roadId, definition, material, group, materials);
  });
  return group;
}
