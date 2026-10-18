import * as THREE from 'three';
import { getTerrainHeight } from './terrainHeight.js';
import {
  ROAD_CIVIL_DETAIL,
  ROAD_DEFINITIONS,
  SERVICE_ROAD_VERTICAL_PROFILE,
  TOPOGRAPHIC_ZONES,
} from '../config/siteDesign.js';
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
  if (definition.role !== 'primary-haul-road') return SERVICE_ROAD_VERTICAL_PROFILE.minimumTransitionWidthM;
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
  if (definition.role !== 'primary-haul-road') {
    const curve = createAlignment(definition);
    const samples = Math.max(360, definition.points.length * 48);
    const sampled = Array.from({ length: samples + 1 }, (_, index) => curve.getPoint(index / samples));
    return definition.points.map(([x, z]) => {
      let nearest = sampled[0];
      let nearestDistance = Infinity;
      sampled.forEach((point) => {
        const distance = Math.hypot(point.x - x, point.z - z);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = point;
        }
      });
      return { x, z, y: nearest.y };
    });
  }
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

function createGradeConstrainedServicePoints(planar, sourcePoints, definition) {
  const sampleCount = Math.max(180, sourcePoints.length * 30);
  const points = Array.from({ length: sampleCount + 1 }, (_, index) => {
    const point = planar.getPoint(index / sampleCount);
    point.y = getTerrainHeight(point.x, point.z) + ROAD_SURFACE_OFFSET_M;
    return point;
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
        elevation: getTerrainHeight(x, z) + ROAD_SURFACE_OFFSET_M,
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
        elevations[index] = THREE.MathUtils.clamp(
          elevations[index],
          elevations[index - 1] - limit,
          elevations[index - 1] + limit,
        );
      }
      elevations[end.sampleIndex] = end.elevation;
      for (let index = end.sampleIndex - 1; index >= start.sampleIndex; index -= 1) {
        if (index === start.sampleIndex) continue;
        const limit = targetGrade * horizontalDistance(points[index], points[index + 1]);
        elevations[index] = THREE.MathUtils.clamp(
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

function createAlignment(definition) {
  if (definition === ROAD_DEFINITIONS['ROAD-01']) {
    return createPrimaryRoadAlignment({ surfaceOffsetM: ROAD_SURFACE_OFFSET_M });
  }
  const roadId = ROAD_ID_BY_DEFINITION.get(definition);
  const closed = isClosedRoad(definition.points);
  const sourcePoints = closed ? definition.points.slice(0, -1) : definition.points;
  const planar = new THREE.CatmullRomCurve3(
    sourcePoints.map(([x, z]) => new THREE.Vector3(x, 0, z)),
    closed,
    'centripetal',
  );
  const engineeredPoints = createGradeConstrainedServicePoints(planar, sourcePoints, definition);
  const curve = new THREE.CatmullRomCurve3(engineeredPoints, closed, 'centripetal');
  curve.userData = {
    roadId,
    engineeredVerticalProfile: true,
    verticalTargetGrade: Math.min(
      definition.maximumGrade ?? 0.12,
      (definition.maximumGrade ?? 0.12) * SERVICE_ROAD_VERTICAL_PROFILE.targetGradeFactor,
    ),
  };
  return curve;
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

function receptionSafeVisualPoint(point, clearanceM = 0.04) {
  const reception = TOPOGRAPHIC_ZONES.reception;
  const distance = Math.hypot(point.x - reception.center[0], point.z - reception.center[1]);
  // Scope the visual drape to the ROM/tie-in neighborhood. The pit ramp contains
  // intentional deep cut conditions and must not be flattened by this visual fix.
  if (distance > 82) return point;
  const safe = point.clone();
  safe.y = Math.max(safe.y, getTerrainHeight(safe.x, safe.z) + clearanceM);
  return safe;
}

function buildPairStripGeometry(
  curve,
  definition,
  samples,
  selectorA,
  selectorB,
  { terrainSafeAtReception = false } = {},
) {
  const vertices = [];
  const indices = [];
  // The ROM tie-in crosses intentionally sharp terrain cuts. A denser lateral
  // tessellation lets the visual shoulder/cut-fill skin follow getTerrainHeight()
  // without cutting through convex terrain between sparse edge vertices.
  const lateralSegments = terrainSafeAtReception ? 16 : 1;
  const rowWidth = lateralSegments + 1;
  const pushTriangle = (a, b, c) => {
    if (terrainSafeAtReception) {
      const indicesToLift = [a, b, c];
      const x = indicesToLift.reduce((sum, vertex) => sum + vertices[vertex * 3], 0) / 3;
      const y = indicesToLift.reduce((sum, vertex) => sum + vertices[vertex * 3 + 1], 0) / 3;
      const z = indicesToLift.reduce((sum, vertex) => sum + vertices[vertex * 3 + 2], 0) / 3;
      const reception = TOPOGRAPHIC_ZONES.reception;
      if (Math.hypot(x - reception.center[0], z - reception.center[1]) <= 82) {
        const minimumVisualY = getTerrainHeight(x, z) + 0.025;
        if (y < minimumVisualY) {
          const lift = minimumVisualY - y;
          indicesToLift.forEach((vertex) => {
            vertices[vertex * 3 + 1] += lift;
          });
        }
      }
    }
    indices.push(a, b, c);
  };
  for (let index = 0; index <= samples; index += 1) {
    const section = sampleCrossSection(curve, index / samples, definition);
    const a = selectorA(section);
    const b = selectorB(section);
    for (let lateral = 0; lateral <= lateralSegments; lateral += 1) {
      const fraction = lateral / lateralSegments;
      let point = a.clone().lerp(b, fraction);
      if (terrainSafeAtReception) point = receptionSafeVisualPoint(point);
      vertices.push(point.x, point.y, point.z);
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
    buildPairStripGeometry(
      curve,
      definition,
      samples,
      (s) => s.leftRoad,
      (s) => s.leftShoulder,
      { terrainSafeAtReception: true },
    ),
    materials.shoulder,
  );
  leftShoulder.name = `${roadId}-left-shoulder`;
  leftShoulder.receiveShadow = true;
  group.add(leftShoulder);

  const rightShoulder = new THREE.Mesh(
    buildPairStripGeometry(
      curve,
      definition,
      samples,
      (s) => s.rightShoulder,
      (s) => s.rightRoad,
      { terrainSafeAtReception: true },
    ),
    materials.shoulder,
  );
  rightShoulder.name = `${roadId}-right-shoulder`;
  rightShoulder.receiveShadow = true;
  group.add(rightShoulder);

  const leftTransition = new THREE.Mesh(
    buildPairStripGeometry(
      curve,
      definition,
      samples,
      (s) => s.leftTerrain,
      (s) => s.leftShoulder,
      { terrainSafeAtReception: true },
    ),
    materials.cutFill,
  );
  leftTransition.name = `${roadId}-left-cut-fill-transition`;
  leftTransition.receiveShadow = true;
  group.add(leftTransition);

  const rightTransition = new THREE.Mesh(
    buildPairStripGeometry(
      curve,
      definition,
      samples,
      (s) => s.rightShoulder,
      (s) => s.rightTerrain,
      { terrainSafeAtReception: true },
    ),
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
  const roadOverlay = {
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  };
  const materials = {
    shoulder: createIndustrialMaterial('terrain', { color: 0x756858, roughness: 1, preserveColor: true, ...roadOverlay }),
    cutFill: createIndustrialMaterial('terrain', { color: 0x6a5b4a, roughness: 1, preserveColor: true, ...roadOverlay }),
    berm: createIndustrialMaterial('terrain', { color: 0x665547, roughness: 1, preserveColor: true }),
    ditch: createIndustrialMaterial('terrain', { color: 0x51514d, roughness: 1, metalness: 0, preserveColor: true, ...roadOverlay }),
  };

  Object.entries(ROAD_DEFINITIONS).forEach(([roadId, definition]) => {
    createRoadAssembly(roadId, definition, material, group, materials);
  });
  return group;
}
