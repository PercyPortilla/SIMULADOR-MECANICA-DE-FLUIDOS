function pointOf(value) {
  if (Array.isArray(value)) return { x: Number(value[0]), y: Number(value[1]), z: Number(value[2]) };
  return { x: Number(value.x), y: Number(value.y), z: Number(value.z) };
}

function distanceSquared(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

function distance(a, b) {
  return Math.sqrt(distanceSquared(a, b));
}

function normalize(vector) {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (length <= 1e-12) return { x: 0, y: 0, z: 0 };
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
}

function coefficients(x0, x1, x2, x3, dt0, dt1, dt2) {
  let tangent1 = (x1 - x0) / dt0 - (x2 - x0) / (dt0 + dt1) + (x2 - x1) / dt1;
  let tangent2 = (x2 - x1) / dt1 - (x3 - x1) / (dt1 + dt2) + (x3 - x2) / dt2;
  tangent1 *= dt1;
  tangent2 *= dt1;
  return [
    x1,
    tangent1,
    -3 * x1 + 3 * x2 - 2 * tangent1 - tangent2,
    2 * x1 - 2 * x2 + tangent1 + tangent2,
  ];
}

function evaluate(c, t) {
  const t2 = t * t;
  return c[0] + c[1] * t + c[2] * t2 + c[3] * t2 * t;
}

export function createNumericCatmullRom(inputPoints, {
  closed = false,
  arcLengthDivisions = 200,
} = {}) {
  const points = inputPoints.map(pointOf);
  if (points.length < 2) throw new RangeError('Catmull-Rom numérico requiere al menos dos puntos.');
  let cachedArcLengths = null;

  function getPoint(t) {
    const clamped = Math.max(0, Math.min(1, Number(t) || 0));
    const count = points.length;
    const p = (count - (closed ? 0 : 1)) * clamped;
    let intPoint = Math.floor(p);
    let weight = p - intPoint;
    if (closed) {
      intPoint += intPoint > 0 ? 0 : (Math.floor(Math.abs(intPoint) / count) + 1) * count;
    } else if (weight === 0 && intPoint === count - 1) {
      intPoint = count - 2;
      weight = 1;
    }

    const p1 = points[intPoint % count];
    const p2 = points[(intPoint + 1) % count];
    let p0;
    let p3;
    if (closed || intPoint > 0) {
      p0 = points[(intPoint - 1) % count];
    } else {
      p0 = {
        x: 2 * points[0].x - points[1].x,
        y: 2 * points[0].y - points[1].y,
        z: 2 * points[0].z - points[1].z,
      };
    }
    if (closed || intPoint + 2 < count) {
      p3 = points[(intPoint + 2) % count];
    } else {
      p3 = {
        x: 2 * points[count - 1].x - points[count - 2].x,
        y: 2 * points[count - 1].y - points[count - 2].y,
        z: 2 * points[count - 1].z - points[count - 2].z,
      };
    }

    let dt0 = Math.pow(distanceSquared(p0, p1), 0.25);
    let dt1 = Math.pow(distanceSquared(p1, p2), 0.25);
    let dt2 = Math.pow(distanceSquared(p2, p3), 0.25);
    if (dt1 < 1e-4) dt1 = 1;
    if (dt0 < 1e-4) dt0 = dt1;
    if (dt2 < 1e-4) dt2 = dt1;
    const cx = coefficients(p0.x, p1.x, p2.x, p3.x, dt0, dt1, dt2);
    const cy = coefficients(p0.y, p1.y, p2.y, p3.y, dt0, dt1, dt2);
    const cz = coefficients(p0.z, p1.z, p2.z, p3.z, dt0, dt1, dt2);
    return {
      x: evaluate(cx, weight),
      y: evaluate(cy, weight),
      z: evaluate(cz, weight),
    };
  }

  function getTangent(t) {
    const delta = 0.0001;
    const t1 = Math.max(0, Number(t) - delta);
    const t2 = Math.min(1, Number(t) + delta);
    const a = getPoint(t1);
    const b = getPoint(t2);
    return normalize({ x: b.x - a.x, y: b.y - a.y, z: b.z - a.z });
  }

  function getLengths() {
    if (cachedArcLengths) return cachedArcLengths;
    const lengths = [0];
    let previous = getPoint(0);
    let total = 0;
    for (let index = 1; index <= arcLengthDivisions; index += 1) {
      const current = getPoint(index / arcLengthDivisions);
      total += distance(current, previous);
      lengths.push(total);
      previous = current;
    }
    cachedArcLengths = lengths;
    return lengths;
  }

  function uniformToT(u) {
    const lengths = getLengths();
    const target = Math.max(0, Math.min(1, Number(u) || 0)) * lengths.at(-1);
    let low = 0;
    let high = lengths.length - 1;
    let index = 0;
    while (low <= high) {
      index = Math.floor(low + (high - low) / 2);
      const comparison = lengths[index] - target;
      if (comparison < 0) low = index + 1;
      else if (comparison > 0) high = index - 1;
      else {
        high = index;
        break;
      }
    }
    index = high;
    if (lengths[index] === target) return index / (lengths.length - 1);
    const before = lengths[index];
    const segmentLength = lengths[index + 1] - before;
    const fraction = segmentLength > 0 ? (target - before) / segmentLength : 0;
    return (index + fraction) / (lengths.length - 1);
  }

  return Object.freeze({
    points: Object.freeze(points.map((item) => Object.freeze({ ...item }))),
    closed,
    getPoint,
    getTangent,
    getPointAt(u) { return getPoint(uniformToT(u)); },
    getTangentAt(u) { return getTangent(uniformToT(u)); },
    getLength() { return getLengths().at(-1); },
  });
}
