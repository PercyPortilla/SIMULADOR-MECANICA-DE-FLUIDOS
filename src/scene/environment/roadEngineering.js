import * as THREE from 'three';
import { PIT_DESIGN, ROAD_DEFINITIONS, TOPOGRAPHIC_ZONES } from '../config/siteDesign.js';

const PRIMARY_ROAD_ID = 'ROAD-01';
const alignmentCache = new Map();
let nearestSegmentsCache = null;

function clamp01(value) { return Math.max(0, Math.min(1, value)); }
function lerp(a, b, t) { return a + (b - a) * t; }

function controlPointFractions(points) {
  const cumulative = [0];
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += Math.hypot(points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1]);
    cumulative.push(total);
  }
  return cumulative.map((distance) => total > 0 ? distance / total : 0);
}

export function createPrimaryRoadAlignment({ surfaceOffsetM = 0 } = {}) {
  const cacheKey = Number(surfaceOffsetM).toFixed(4);
  if (alignmentCache.has(cacheKey)) return alignmentCache.get(cacheKey);
  const definition = ROAD_DEFINITIONS[PRIMARY_ROAD_ID];
  const fractions = controlPointFractions(definition.points);
  const startElevation = PIT_DESIGN.floorElevation + 1.0;
  const endElevation = TOPOGRAPHIC_ZONES.reception.elevation;
  const controlPoints = definition.points.map(([x, z], index) => new THREE.Vector3(
    x,
    lerp(startElevation, endElevation, fractions[index]) + surfaceOffsetM,
    z,
  ));
  const curve = new THREE.CatmullRomCurve3(controlPoints, false, 'centripetal');
  alignmentCache.set(cacheKey, curve);
  return curve;
}

function getNearestSegments() {
  if (nearestSegmentsCache) return nearestSegmentsCache;
  const curve = createPrimaryRoadAlignment();
  const samples = 180;
  const segments = [];
  let previous = curve.getPointAt(0);
  for (let index = 1; index <= samples; index += 1) {
    const fraction = index / samples;
    const current = curve.getPointAt(fraction);
    segments.push({
      ax: previous.x,
      ay: previous.y,
      az: previous.z,
      bx: current.x,
      by: current.y,
      bz: current.z,
      startFraction: (index - 1) / samples,
      endFraction: fraction,
    });
    previous = current;
  }
  nearestSegmentsCache = segments;
  return segments;
}

export function nearestOnPrimaryRoad(x, z) {
  let best = { distance: Infinity, fraction: 0, elevation: PIT_DESIGN.floorElevation + 1, x, z };
  for (const segment of getNearestSegments()) {
    const abx = segment.bx - segment.ax;
    const abz = segment.bz - segment.az;
    const lengthSq = abx * abx + abz * abz;
    const t = lengthSq > 1e-10
      ? clamp01(((x - segment.ax) * abx + (z - segment.az) * abz) / lengthSq)
      : 0;
    const px = segment.ax + abx * t;
    const pz = segment.az + abz * t;
    const distance = Math.hypot(x - px, z - pz);
    if (distance < best.distance) {
      best = {
        distance,
        fraction: lerp(segment.startFraction, segment.endFraction, t),
        elevation: lerp(segment.ay, segment.by, t),
        x: px,
        z: pz,
      };
    }
  }
  return best;
}

export const PRIMARY_HAUL_ROAD_ID = PRIMARY_ROAD_ID;
