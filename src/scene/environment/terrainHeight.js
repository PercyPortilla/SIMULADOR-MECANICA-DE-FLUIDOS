import {
  CRUSHING_CUT,
  MINE_AUXILIARY_AREAS,
  MINE_DRAINAGE_PATHS,
  PIT_DESIGN,
  RECEPTION_EARTHWORK,
  SITE_EXTENT,
  TOPOGRAPHIC_ZONES,
} from '../config/siteDesign.js';
import { nearestOnPrimaryRoad } from './roadEngineering.js';

const ZONES = TOPOGRAPHIC_ZONES;

function clamp01(value) { return Math.max(0, Math.min(1, value)); }
function smoothstep(edge0, edge1, value) {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
function lerp(a, b, t) { return a + (b - a) * t; }

export function getTerrainMicrorelief(x, z) {
  // Low-amplitude, multi-scale relief prevents large natural surfaces from
  // reading as mathematically smooth without turning engineered pads or roads
  // into corrugated geometry. Engineered features are applied later and remain
  // authoritative over this natural base.
  const broad = Math.sin(x * 0.071 + z * 0.049 + 0.4) * 0.055;
  const cross = Math.cos(x * 0.119 - z * 0.083 - 0.9) * 0.040;
  const fine = Math.sin((x + z) * 0.173 + Math.cos(z * 0.031)) * 0.025;
  return broad + cross + fine;
}

function roundedRectInfluence(x, z, zone, feather = 10) {
  const [cx, cz] = zone.center;
  const [width, depth] = zone.size;
  const dx = Math.max(Math.abs(x - cx) - width / 2, 0);
  const dz = Math.max(Math.abs(z - cz) - depth / 2, 0);
  return 1 - smoothstep(0, feather, Math.hypot(dx, dz));
}

function rotatedRectInfluence(x, z, area, feather = 2.5) {
  const cos = Math.cos(-area.rotationY);
  const sin = Math.sin(-area.rotationY);
  const dx = x - area.x;
  const dz = z - area.z;
  const localX = dx * cos - dz * sin;
  const localZ = dx * sin + dz * cos;
  const outsideX = Math.max(Math.abs(localX) - area.widthM / 2, 0);
  const outsideZ = Math.max(Math.abs(localZ) - area.depthM / 2, 0);
  return 1 - smoothstep(0, feather, Math.hypot(outsideX, outsideZ));
}

function rectangleOutsideDistance(x, z, center, size) {
  const dx = Math.max(Math.abs(x - center[0]) - size[0] / 2, 0);
  const dz = Math.max(Math.abs(z - center[1]) - size[1] / 2, 0);
  return Math.hypot(dx, dz);
}

function receptionEarthworkDistance(x, z) {
  const definition = RECEPTION_EARTHWORK;
  const westEdge = definition.center[0] - definition.crestSizeM[0] / 2;
  const eastEdge = definition.center[0] + definition.crestSizeM[0] / 2;
  const southEdge = definition.center[1] - definition.crestSizeM[1] / 2;
  const northEdge = definition.center[1] + definition.crestSizeM[1] / 2;
  const insideCrest = x >= westEdge && x <= eastEdge && z >= southEdge && z <= northEdge;
  if (insideCrest) return 0;
  if (definition.openEast && x > eastEdge) return Infinity;
  if (definition.embankmentSide === 'south' && z >= southEdge) return Infinity;
  return rectangleOutsideDistance(x, z, definition.center, definition.crestSizeM);
}

export function getReceptionEarthworkBand(x, z) {
  const definition = RECEPTION_EARTHWORK;
  const distance = receptionEarthworkDistance(x, z);
  if (!Number.isFinite(distance)) return null;
  if (distance <= 1e-9) return 'crest';
  if (distance <= definition.upperSlopeRunM) return 'upper-slope';
  if (distance <= definition.upperSlopeRunM + definition.bermWidthM) return 'berm';
  if (distance <= definition.upperSlopeRunM + definition.bermWidthM + definition.toeSlopeRunM) return 'toe-slope';
  return null;
}

function applyReceptionEarthwork(x, z, baseHeight) {
  const definition = RECEPTION_EARTHWORK;
  const distance = receptionEarthworkDistance(x, z);
  if (!Number.isFinite(distance)) return baseHeight;

  const upperEnd = definition.upperSlopeRunM;
  const bermEnd = upperEnd + definition.bermWidthM;
  const toeEnd = bermEnd + definition.toeSlopeRunM;
  if (distance > toeEnd) return baseHeight;

  const crest = definition.crestElevationM;
  const bermElevation = crest - definition.bermDropM;
  let target;
  if (distance <= 1e-9) {
    target = crest;
  } else if (distance <= upperEnd) {
    target = lerp(crest, bermElevation, smoothstep(0, upperEnd, distance));
  } else if (distance <= bermEnd) {
    target = bermElevation;
  } else {
    target = lerp(bermElevation, baseHeight, smoothstep(bermEnd, toeEnd, distance));
  }
  // Fade the south earthwork before it reaches the primary-crushing terrace.
  // This removes the V21 east-side shoulder hump while retaining the full ROM
  // platform and the existing authoritative reception/crushing elevations.
  const eastEdge = definition.center[0] + definition.crestSizeM[0] / 2;
  const eastBlendStart = eastEdge - definition.eastBlendWidthM;
  const eastWeight = 1 - smoothstep(eastBlendStart, eastEdge, x);
  if (distance > 1e-9) target = lerp(baseHeight, target, eastWeight);
  // This is an embankment/cut platform contract, not a second terrain source.
  // Outside the crest we never cut below the pre-earthwork terrain surface.
  return distance <= 1e-9 ? target : Math.max(baseHeight, target);
}

export function getCrushingEarthworkBand(x, z) {
  const cut = CRUSHING_CUT;
  if (x < cut.activeXRangeM[0] || x > cut.activeXRangeM[1]) return null;
  const southEdge = cut.center[1] - cut.terraceSizeM[1] / 2;
  const northEdge = cut.center[1] + cut.terraceSizeM[1] / 2;
  if (z > northEdge) return null;
  if (z >= southEdge) return 'terrace';
  const distance = southEdge - z;
  if (distance <= cut.faceRunM) return 'cut-face';
  if (distance <= cut.faceRunM + cut.bermWidthM) return 'catch-berm';
  if (distance <= cut.faceRunM + cut.bermWidthM + cut.toeRunM) return 'toe-transition';
  return null;
}

function applyCrushingSouthCut(x, z, baseHeight) {
  const band = getCrushingEarthworkBand(x, z);
  if (!band || band === 'terrace') return baseHeight;
  const cut = CRUSHING_CUT;
  const southEdge = cut.center[1] - cut.terraceSizeM[1] / 2;
  const distance = southEdge - z;
  const faceEnd = cut.faceRunM;
  const bermEnd = faceEnd + cut.bermWidthM;
  const toeEnd = bermEnd + cut.toeRunM;
  const bermElevation = cut.terraceElevationM + cut.bermRiseM;
  let target;
  if (distance <= faceEnd) {
    target = lerp(cut.terraceElevationM, bermElevation, smoothstep(0, faceEnd, distance));
  } else if (distance <= bermEnd) {
    target = bermElevation;
  } else {
    target = lerp(bermElevation, baseHeight, smoothstep(bermEnd, toeEnd, distance));
  }
  const edgeFade = Math.min(
    smoothstep(cut.activeXRangeM[0], cut.activeXRangeM[0] + 4, x),
    1 - smoothstep(cut.activeXRangeM[1] - 4, cut.activeXRangeM[1], x),
  );
  return lerp(baseHeight, Math.min(baseHeight, target), edgeFade);
}

function distanceToSegment(x, z, ax, az, bx, bz) {
  const abx = bx - ax;
  const abz = bz - az;
  const lengthSq = abx * abx + abz * abz;
  if (lengthSq <= 1e-6) return { distance: Math.hypot(x - ax, z - az), t: 0, length: 0 };
  const t = clamp01(((x - ax) * abx + (z - az) * abz) / lengthSq);
  const px = ax + abx * t;
  const pz = az + abz * t;
  return { distance: Math.hypot(x - px, z - pz), t, length: Math.sqrt(lengthSq) };
}

function nearestOnPolyline(x, z, points) {
  let total = 0;
  const segments = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const [ax, az] = points[i];
    const [bx, bz] = points[i + 1];
    const length = Math.hypot(bx - ax, bz - az);
    segments.push({ ax, az, bx, bz, length, start: total });
    total += length;
  }
  let best = { distance: Infinity, fraction: 0 };
  segments.forEach((segment) => {
    const hit = distanceToSegment(x, z, segment.ax, segment.az, segment.bx, segment.bz);
    if (hit.distance >= best.distance) return;
    best = {
      distance: hit.distance,
      fraction: total > 0 ? (segment.start + hit.t * segment.length) / total : 0,
    };
  });
  return best;
}

function naturalTerrainHeight(x, z) {
  // Broad geological forms dominate; high-frequency procedural waviness is intentionally subdued.
  const regionalUndulation = 0.62 * Math.sin(x * 0.0105) + 0.48 * Math.cos(z * 0.0135);
  const structuralGrain = 0.22 * Math.sin((x + z) * 0.023) + 0.16 * Math.cos((x - z) * 0.029);
  const northRise = 5.2 * smoothstep(92, 235, z);
  const southShoulder = 2.9 * smoothstep(100, 225, -z);
  const westMassif = 8.6 * (1 - smoothstep(145, 410, Math.hypot(x - PIT_DESIGN.center.x, z - PIT_DESIGN.center.z)));
  const eastRise = 2.4 * smoothstep(175, 350, x);
  const ridge = 1.4 * (1 - smoothstep(0, 85, Math.abs(z - (0.17 * x + 52))));
  return regionalUndulation + structuralGrain + northRise + southShoulder + westMassif + eastRise + ridge
    + getTerrainMicrorelief(x, z);
}

function pitContourOffset(azimuth, radius) {
  const { floorRadiusM, radiusX } = PIT_DESIGN;
  const weight = smoothstep(floorRadiusM * 0.9, radiusX - 8, radius);
  return weight * (
    2.1 * Math.sin(azimuth * 3 + 0.45)
    + 1.15 * Math.sin(azimuth * 7 - 0.9)
    + 0.55 * Math.cos(azimuth * 11 + 0.3)
  );
}

function pitFaceRoughness(x, z, azimuth, faceProgress) {
  const interiorWeight = Math.sin(Math.PI * clamp01(faceProgress));
  const activeDirection = Math.atan2(
    (PIT_DESIGN.shovelPoint.z - PIT_DESIGN.center.z) * (PIT_DESIGN.radiusX / PIT_DESIGN.radiusZ),
    PIT_DESIGN.shovelPoint.x - PIT_DESIGN.center.x,
  );
  const angularDelta = Math.atan2(Math.sin(azimuth - activeDirection), Math.cos(azimuth - activeDirection));
  const activeSector = 1 - smoothstep(0.28, 0.95, Math.abs(angularDelta));
  const geological = (
    0.58 * Math.sin(x * 0.115 + z * 0.071)
    + 0.31 * Math.sin(x * 0.247 - z * 0.163)
    + 0.18 * Math.cos((x + z) * 0.39)
  );
  return geological * PIT_DESIGN.faceRoughnessM * interiorWeight * (0.72 + activeSector * 0.48);
}

function engineeredPitProfile(x, z, shapedRadius, azimuth) {
  const floor = PIT_DESIGN.floorElevation;
  const floorRadius = PIT_DESIGN.floorRadiusM;
  const faceRun = PIT_DESIGN.faceRunM;
  const benchWidth = PIT_DESIGN.benchWidthM;
  const benchHeight = PIT_DESIGN.benchHeightM;
  const benchCount = PIT_DESIGN.benchCount;

  if (shapedRadius <= floorRadius) {
    const floorTexture = 0.12 * Math.sin(x * 0.047) * Math.cos(z * 0.041);
    return floor + floorTexture;
  }

  let cursor = floorRadius;
  for (let level = 0; level < benchCount; level += 1) {
    const levelOffset = (
      Math.sin(azimuth * (2 + level) + level * 0.73) * (1.25 + level * 0.18)
      + Math.cos(azimuth * (5 + level) - 0.4 * level) * 0.55
    );
    const levelRadius = shapedRadius + levelOffset;
    const lowerElevation = floor + level * benchHeight;
    const faceEnd = cursor + faceRun;
    if (levelRadius <= faceEnd) {
      const faceProgress = (levelRadius - cursor) / faceRun;
      const nominal = lerp(
        lowerElevation,
        lowerElevation + benchHeight,
        smoothstep(0, 1, faceProgress),
      );
      return nominal + pitFaceRoughness(x, z, azimuth, faceProgress);
    }

    const benchEnd = faceEnd + benchWidth;
    if (levelRadius <= benchEnd) {
      return lowerElevation + benchHeight;
    }
    cursor = benchEnd;
  }

  return floor + benchCount * benchHeight;
}

function applyPitOperatingPads(x, z, height) {
  let result = height;
  for (const area of [MINE_AUXILIARY_AREAS.loadingPad, MINE_AUXILIARY_AREAS.drillingPad]) {
    const influence = rotatedRectInfluence(x, z, area, 3.0);
    if (influence > 0) result = lerp(result, area.elevation, influence);
  }
  return result;
}

function applyPitSumpDepression(x, z, height) {
  const sump = MINE_AUXILIARY_AREAS.pitSump;
  const dx = x - sump.x;
  const dz = z - sump.z;
  const angle = Math.atan2(dz, dx);
  const irregularRadius = sump.radiusM * (
    1
    + 0.16 * Math.sin(angle * 3 + 0.45)
    + 0.09 * Math.cos(angle * 5 - 0.8)
    + 0.05 * Math.sin(angle * 8 + 1.1)
  );
  const normalized = Math.hypot(dx, dz) / Math.max(irregularRadius, 0.1);
  if (normalized >= 1.35) return height;
  const influence = 1 - smoothstep(0.62, 1.32, normalized);
  const target = PIT_DESIGN.floorElevation - 0.55 + 0.16 * normalized;
  return lerp(height, Math.min(height, target), influence);
}

function applyDrainageChannels(x, z, height) {
  let result = height;
  for (const path of Object.values(MINE_DRAINAGE_PATHS)) {
    const nearest = nearestOnPolyline(x, z, path);
    if (nearest.distance > 2.4) continue;
    const influence = 1 - smoothstep(0.45, 2.25, nearest.distance);
    const depth = 0.18 + 0.16 * influence;
    result -= depth * influence;
  }
  return result;
}

function pitHeight(x, z, naturalHeight) {
  const dx = x - PIT_DESIGN.center.x;
  const dzScaled = (z - PIT_DESIGN.center.z) * (PIT_DESIGN.radiusX / PIT_DESIGN.radiusZ);
  const radius = Math.hypot(dx, dzScaled);
  const rim = PIT_DESIGN.radiusX;
  const rimBlend = PIT_DESIGN.rimBlendM;
  if (radius >= rim + rimBlend) return naturalHeight;

  const azimuth = Math.atan2(dzScaled, dx);
  const shapedRadius = radius + pitContourOffset(azimuth, radius);
  const engineered = engineeredPitProfile(x, z, shapedRadius, azimuth);
  const blend = 1 - smoothstep(rim - 1, rim + rimBlend, radius);
  return lerp(naturalHeight, engineered, blend);
}

function applyHaulRamp(x, z, height) {
  const definition = { widthM: 18.5, shoulderM: 2.2 };
  const nearest = nearestOnPrimaryRoad(x, z);
  const halfCorridor = definition.widthM / 2 + definition.shoulderM + 2.4;
  const influence = 1 - smoothstep(halfCorridor - 3.0, halfCorridor + 2.5, nearest.distance);
  if (influence <= 0) return height;
  const target = nearest.elevation;
  return lerp(height, target, influence);
}

export function getZoneElevation(zoneId) {
  const zone = ZONES[zoneId];
  if (!zone) throw new RangeError(`Zona topográfica desconocida: ${zoneId}.`);
  return zone.elevation;
}

export function getTerrainZone(zoneId) {
  const zone = ZONES[zoneId];
  if (!zone) throw new RangeError(`Zona topográfica desconocida: ${zoneId}.`);
  return zone;
}

export function getTerrainHeight(x, z) {
  let height = pitHeight(x, z, naturalTerrainHeight(x, z));
  height = applyPitOperatingPads(x, z, height);
  height = applyPitSumpDepression(x, z, height);
  height = applyDrainageChannels(x, z, height);

  // Keep the ROM coordinates/elevation authoritative but make its civil setting
  // legible as a real terraplén with face + catch berm + toe instead of the old
  // 16 m feathered plateau. Crushing is applied afterwards so the east-side
  // process transition remains unchanged.
  height = applyReceptionEarthwork(x, z, height);

  Object.entries(ZONES).forEach(([zoneId, zone]) => {
    if (zoneId === 'reception') return;
    const feather = zoneId === 'process' ? 12 : 10;
    const influence = roundedRectInfluence(x, z, zone, feather);
    height = lerp(height, zone.elevation, influence);
  });

  // A shallow cut bench south of primary crushing removes the visual hump that
  // previously separated the 6 m crusher terrace from the service-road ground.
  // It is terrain shaping only: equipment, road X/Z and process coordinates stay fixed.
  height = applyCrushingSouthCut(x, z, height);

  // Controlled transition between elevated ROM and primary crushing terrace.
  const reception = ZONES.reception;
  const crushing = ZONES.crushing;
  const ramp = distanceToSegment(x, z, reception.center[0], reception.center[1], crushing.center[0], crushing.center[1]);
  const rampInfluence = (1 - smoothstep(8.0, 16.0, ramp.distance)) * smoothstep(0.05, 0.18, ramp.t) * (1 - smoothstep(0.82, 0.97, ramp.t));
  height = lerp(height, lerp(reception.elevation, crushing.elevation, ramp.t), rampInfluence * 0.72);

  // The engineered haul ramp is applied last so plant-zone flattening cannot create
  // an abrupt grade break at the ROM approach. This keeps the road profile within
  // the design grade envelope while its shoulders blend back into the pads.
  height = applyHaulRamp(x, z, height);

  return height;
}

export const TERRAIN_EXTENT = SITE_EXTENT;
export { PIT_DESIGN };
