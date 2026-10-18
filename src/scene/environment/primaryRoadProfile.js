import {
  PIT_DESIGN,
  PRIMARY_HAUL_VERTICAL_PROFILE,
  ROAD_DEFINITIONS,
  TOPOGRAPHIC_ZONES,
} from '../config/siteDesign.js';

export const PRIMARY_HAUL_ROAD_ID = 'ROAD-01';

const ARC_LENGTH_DIVISIONS = 200;
const NEAREST_SAMPLES = 180;
const controlCache = new Map();
const arcCache = new Map();
let nearestSegmentsCache = null;

function clamp01(value) { return Math.max(0, Math.min(1, value)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function point(x, y, z) { return { x, y, z }; }
function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}
function distance(a, b) { return Math.sqrt(distanceSquared(a, b)); }

function controlPointFractions(points) {
  const cumulative = [0];
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += Math.hypot(points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1]);
    cumulative.push(total);
  }
  return cumulative.map((value) => total > 0 ? value / total : 0);
}

export function getPrimaryRoadControlPoints({ surfaceOffsetM = 0 } = {}) {
  const cacheKey = Number(surfaceOffsetM).toFixed(4);
  if (controlCache.has(cacheKey)) return controlCache.get(cacheKey);
  const definition = ROAD_DEFINITIONS[PRIMARY_HAUL_ROAD_ID];
  const fractions = controlPointFractions(definition.points);
  const startElevation = PIT_DESIGN.floorElevation + 1.0;
  const endElevation = TOPOGRAPHIC_ZONES.reception.elevation;
  const tieInIndex = Math.min(
    definition.points.length - 2,
    Math.max(1, PRIMARY_HAUL_VERTICAL_PROFILE.tieInStartControlIndex),
  );
  const tieInFraction = fractions[tieInIndex];
  const tieInElevation = lerp(
    startElevation,
    PRIMARY_HAUL_VERTICAL_PROFILE.baselineReceptionElevationM,
    tieInFraction,
  );
  const controls = definition.points.map(([x, z], index) => point(
    x,
    (
      index <= tieInIndex
        ? lerp(startElevation, PRIMARY_HAUL_VERTICAL_PROFILE.baselineReceptionElevationM, fractions[index])
        : lerp(
          tieInElevation,
          endElevation,
          (fractions[index] - tieInFraction) / Math.max(1e-9, 1 - tieInFraction),
        )
    ) + surfaceOffsetM,
    z,
  ));
  controlCache.set(cacheKey, controls);
  return controls;
}

function cubicCoefficients(x0, x1, t0, t1) {
  return [
    x0,
    t0,
    -3 * x0 + 3 * x1 - 2 * t0 - t1,
    2 * x0 - 2 * x1 + t0 + t1,
  ];
}

function nonUniformCoefficients(x0, x1, x2, x3, dt0, dt1, dt2) {
  let t1 = (x1 - x0) / dt0 - (x2 - x0) / (dt0 + dt1) + (x2 - x1) / dt1;
  let t2 = (x2 - x1) / dt1 - (x3 - x1) / (dt1 + dt2) + (x3 - x2) / dt2;
  t1 *= dt1;
  t2 *= dt1;
  return cubicCoefficients(x1, x2, t1, t2);
}

function evaluateCubic(coefficients, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  return coefficients[0] + coefficients[1] * t + coefficients[2] * t2 + coefficients[3] * t3;
}

export function samplePrimaryRoadParametric(t, { surfaceOffsetM = 0 } = {}) {
  const points = getPrimaryRoadControlPoints({ surfaceOffsetM });
  const length = points.length;
  const clamped = clamp01(t);
  const p = (length - 1) * clamped;
  let intPoint = Math.floor(p);
  let weight = p - intPoint;
  if (weight === 0 && intPoint === length - 1) {
    intPoint = length - 2;
    weight = 1;
  }

  const p1 = points[intPoint];
  const p2 = points[intPoint + 1];
  const p0 = intPoint > 0
    ? points[intPoint - 1]
    : point(2 * points[0].x - points[1].x, 2 * points[0].y - points[1].y, 2 * points[0].z - points[1].z);
  const p3 = intPoint + 2 < length
    ? points[intPoint + 2]
    : point(
      2 * points[length - 1].x - points[length - 2].x,
      2 * points[length - 1].y - points[length - 2].y,
      2 * points[length - 1].z - points[length - 2].z,
    );

  const exponent = 0.25;
  let dt0 = Math.pow(distanceSquared(p0, p1), exponent);
  let dt1 = Math.pow(distanceSquared(p1, p2), exponent);
  let dt2 = Math.pow(distanceSquared(p2, p3), exponent);
  if (dt1 < 1e-4) dt1 = 1;
  if (dt0 < 1e-4) dt0 = dt1;
  if (dt2 < 1e-4) dt2 = dt1;

  const cx = nonUniformCoefficients(p0.x, p1.x, p2.x, p3.x, dt0, dt1, dt2);
  const cy = nonUniformCoefficients(p0.y, p1.y, p2.y, p3.y, dt0, dt1, dt2);
  const cz = nonUniformCoefficients(p0.z, p1.z, p2.z, p3.z, dt0, dt1, dt2);
  return point(
    evaluateCubic(cx, weight),
    evaluateCubic(cy, weight),
    evaluateCubic(cz, weight),
  );
}

function getArcLengths({ surfaceOffsetM = 0, divisions = ARC_LENGTH_DIVISIONS } = {}) {
  const cacheKey = `${Number(surfaceOffsetM).toFixed(4)}:${divisions}`;
  if (arcCache.has(cacheKey)) return arcCache.get(cacheKey);
  const lengths = [0];
  let previous = samplePrimaryRoadParametric(0, { surfaceOffsetM });
  let sum = 0;
  for (let index = 1; index <= divisions; index += 1) {
    const current = samplePrimaryRoadParametric(index / divisions, { surfaceOffsetM });
    sum += distance(current, previous);
    lengths.push(sum);
    previous = current;
  }
  arcCache.set(cacheKey, lengths);
  return lengths;
}

function mapUniformToParametric(u, { surfaceOffsetM = 0 } = {}) {
  const arcLengths = getArcLengths({ surfaceOffsetM });
  const targetArcLength = clamp01(u) * arcLengths[arcLengths.length - 1];
  let low = 0;
  let high = arcLengths.length - 1;
  let index = 0;
  while (low <= high) {
    index = Math.floor(low + (high - low) / 2);
    const comparison = arcLengths[index] - targetArcLength;
    if (comparison < 0) low = index + 1;
    else if (comparison > 0) high = index - 1;
    else {
      high = index;
      break;
    }
  }
  index = high;
  if (arcLengths[index] === targetArcLength) return index / (arcLengths.length - 1);
  const before = arcLengths[index];
  const after = arcLengths[index + 1];
  const segmentLength = after - before;
  const segmentFraction = segmentLength > 0 ? (targetArcLength - before) / segmentLength : 0;
  return (index + segmentFraction) / (arcLengths.length - 1);
}

export function samplePrimaryRoadAt(fraction, { surfaceOffsetM = 0 } = {}) {
  return samplePrimaryRoadParametric(
    mapUniformToParametric(fraction, { surfaceOffsetM }),
    { surfaceOffsetM },
  );
}

function getNearestSegments() {
  if (nearestSegmentsCache) return nearestSegmentsCache;
  const segments = [];
  let previous = samplePrimaryRoadAt(0);
  for (let index = 1; index <= NEAREST_SAMPLES; index += 1) {
    const fraction = index / NEAREST_SAMPLES;
    const current = samplePrimaryRoadAt(fraction);
    segments.push({
      ax: previous.x,
      ay: previous.y,
      az: previous.z,
      bx: current.x,
      by: current.y,
      bz: current.z,
      startFraction: (index - 1) / NEAREST_SAMPLES,
      endFraction: fraction,
    });
    previous = current;
  }
  nearestSegmentsCache = segments;
  return segments;
}

export function nearestOnPrimaryRoadProfile(x, z) {
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
    const candidateDistance = Math.hypot(x - px, z - pz);
    if (candidateDistance < best.distance) {
      best = {
        distance: candidateDistance,
        fraction: lerp(segment.startFraction, segment.endFraction, t),
        elevation: lerp(segment.ay, segment.by, t),
        x: px,
        z: pz,
      };
    }
  }
  return best;
}
