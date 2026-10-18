import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import {
  getCrushingEarthworkBand,
  getReceptionEarthworkBand,
  getTerrainHeight,
  PIT_DESIGN,
  TERRAIN_EXTENT,
} from '../../scene/environment/terrainHeight.js';
import { MINE_AUXILIARY_AREAS } from '../../scene/config/siteDesign.js';

export const BABYLON_TERRAIN_SEGMENTS = Object.freeze({ x: 240, z: 156 });

const V30_TERRAIN_COLORS = Object.freeze({
  natural: 0xf1e2cb,
  bench: 0xe2c39c,
  highGround: 0xd4c6b2,
  rock: 0x9d9991,
  pitFloor: 0xc9ad87,
  dampGround: 0x756f65,
  activeFace: 0xa98462,
  finalWall: 0x858786,
  alteredRock: 0xb29d82,
  compactedFill: 0xb99a73,
  earthworkFace: 0x967454,
  catchBerm: 0xaa8861,
  cutFace: 0x8f765d,
  secondaryBerm: 0xb09a78,
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(value, min, max) {
  if (value <= min) return 0;
  if (value >= max) return 1;
  const t = (value - min) / (max - min);
  return t * t * (3 - 2 * t);
}

function srgbChannelToLinear(value) {
  return value <= 0.04045
    ? value * 0.0773993808
    : ((value * 0.9478672986) + 0.0521327014) ** 2.4;
}

function linearColorFromHex(hex) {
  return [
    srgbChannelToLinear(((hex >> 16) & 0xff) / 255),
    srgbChannelToLinear(((hex >> 8) & 0xff) / 255),
    srgbChannelToLinear((hex & 0xff) / 255),
  ];
}

function cloneColor(color) {
  return [color[0], color[1], color[2]];
}

function lerpColor(color, target, amount) {
  const t = clamp(amount, 0, 1);
  color[0] += (target[0] - color[0]) * t;
  color[1] += (target[1] - color[1]) * t;
  color[2] += (target[2] - color[2]) * t;
  return color;
}

function multiplyColor(color, scalar) {
  color[0] *= scalar;
  color[1] *= scalar;
  color[2] *= scalar;
  return color;
}

function angularDistance(a, b) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

function getPitVisualSector(x, z) {
  const dx = x - PIT_DESIGN.center.x;
  const dzScaled = (z - PIT_DESIGN.center.z) * (PIT_DESIGN.radiusX / PIT_DESIGN.radiusZ);
  const radius = Math.hypot(dx, dzScaled);
  const azimuth = Math.atan2(dzScaled, dx);
  const activeAzimuth = Math.atan2(
    (PIT_DESIGN.shovelPoint.z - PIT_DESIGN.center.z) * (PIT_DESIGN.radiusX / PIT_DESIGN.radiusZ),
    PIT_DESIGN.shovelPoint.x - PIT_DESIGN.center.x,
  );
  const finalWallAzimuth = 0.75;
  if (radius < PIT_DESIGN.floorRadiusM * 1.08) return 'pit-floor';
  if (angularDistance(azimuth, activeAzimuth) < 0.58) return 'active-face';
  if (angularDistance(azimuth, finalWallAzimuth) < 0.72 && radius > PIT_DESIGN.floorRadiusM + 18) return 'final-wall';
  return 'bench';
}

function hashGrid2D(x, z, seed = 0) {
  let value = Math.imul((x + 173 + seed * 17) | 0, 374761393)
    ^ Math.imul((z + 311 - seed * 29) | 0, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function smoothValueNoise2D(x, z, cellM, seed) {
  const gx = x / cellM;
  const gz = z / cellM;
  const ix = Math.floor(gx);
  const iz = Math.floor(gz);
  const tx = gx - ix;
  const tz = gz - iz;
  const sx = tx * tx * (3 - 2 * tx);
  const sz = tz * tz * (3 - 2 * tz);
  const n00 = hashGrid2D(ix, iz, seed);
  const n10 = hashGrid2D(ix + 1, iz, seed);
  const n01 = hashGrid2D(ix, iz + 1, seed);
  const n11 = hashGrid2D(ix + 1, iz + 1, seed);
  const nx0 = n00 + (n10 - n00) * sx;
  const nx1 = n01 + (n11 - n01) * sx;
  return (nx0 + (nx1 - nx0) * sz) * 2 - 1;
}

function terrainToneVariation(x, z) {
  const broad = smoothValueNoise2D(x + 113, z - 71, 54, 7);
  const medium = smoothValueNoise2D(x - 37, z + 149, 22, 19);
  const fine = smoothValueNoise2D(x + 251, z + 83, 9, 31);
  const patch = smoothValueNoise2D(x - 91, z - 163, 17, 43);
  return 0.985 + broad * 0.032 + medium * 0.020 + fine * 0.009 + patch * 0.012;
}

const COLORS = Object.freeze(Object.fromEntries(
  Object.entries(V30_TERRAIN_COLORS).map(([key, value]) => [key, Object.freeze(linearColorFromHex(value))]),
));

function terrainVertexColor(x, y, z) {
  const sample = 0.55;
  const dx = Math.abs(getTerrainHeight(x + sample, z) - getTerrainHeight(x - sample, z));
  const dz = Math.abs(getTerrainHeight(x, z + sample) - getTerrainHeight(x, z - sample));
  const slope = Math.min(1, Math.hypot(dx, dz) / (sample * 2));
  const altitude = clamp((y - PIT_DESIGN.floorElevation) / 52, 0, 1);
  const dxPit = x - PIT_DESIGN.center.x;
  const dzPit = (z - PIT_DESIGN.center.z) * (PIT_DESIGN.radiusX / PIT_DESIGN.radiusZ);
  const pitRadius = Math.hypot(dxPit, dzPit);
  const pitInfluence = 1 - smoothstep(pitRadius, PIT_DESIGN.radiusX * 0.78, PIT_DESIGN.radiusX * 1.08);
  const flatness = 1 - smoothstep(slope, 0.08, 0.36);
  const floorInfluence = pitInfluence * (1 - smoothstep(y, PIT_DESIGN.floorElevation + 2.0, PIT_DESIGN.floorElevation + 8.0));
  const color = cloneColor(COLORS.natural);
  lerpColor(color, COLORS.highGround, altitude * 0.34);
  lerpColor(color, COLORS.bench, pitInfluence * flatness * 0.50);
  lerpColor(color, COLORS.pitFloor, floorInfluence * 0.78);
  lerpColor(color, COLORS.rock, smoothstep(slope, 0.15, 0.62) * (0.60 + pitInfluence * 0.24));
  if (pitInfluence > 0.12) {
    const sector = getPitVisualSector(x, z);
    if (sector === 'active-face') lerpColor(color, COLORS.activeFace, pitInfluence * smoothstep(slope, 0.08, 0.42) * 0.30);
    if (sector === 'final-wall') lerpColor(color, COLORS.finalWall, pitInfluence * smoothstep(slope, 0.10, 0.38) * 0.38);
    if (sector === 'bench') {
      const alteration = (Math.sin(x * 0.052 - z * 0.036) + 1) * 0.5;
      lerpColor(color, COLORS.alteredRock, pitInfluence * flatness * alteration * 0.10);
    }
  }
  const sump = MINE_AUXILIARY_AREAS.pitSump;
  const sumpDistance = Math.hypot(x - sump.x, z - sump.z);
  const dampInfluence = 1 - smoothstep(sumpDistance, sump.radiusM * 1.2, sump.radiusM * 4.0);
  lerpColor(color, COLORS.dampGround, dampInfluence * 0.42);
  const receptionBand = getReceptionEarthworkBand(x, z);
  if (receptionBand === 'crest') lerpColor(color, COLORS.compactedFill, 0.38);
  if (receptionBand === 'upper-slope' || receptionBand === 'toe-slope') lerpColor(color, COLORS.earthworkFace, 0.48);
  if (receptionBand === 'berm') lerpColor(color, COLORS.catchBerm, 0.55);
  const crushingBand = getCrushingEarthworkBand(x, z);
  if (crushingBand === 'cut-face') lerpColor(color, COLORS.cutFace, 0.46);
  if (crushingBand === 'catch-berm') lerpColor(color, COLORS.secondaryBerm, 0.52);
  if (crushingBand === 'toe-transition') lerpColor(color, COLORS.cutFace, 0.24);
  multiplyColor(color, terrainToneVariation(x, z));
  return color;
}

export function terrainVertexIndex(ix, iz, segments = BABYLON_TERRAIN_SEGMENTS) {
  return iz * (segments.x + 1) + ix;
}

export function buildBabylonTerrainVertexData({
  width = TERRAIN_EXTENT.width,
  depth = TERRAIN_EXTENT.depth,
  segmentsX = BABYLON_TERRAIN_SEGMENTS.x,
  segmentsZ = BABYLON_TERRAIN_SEGMENTS.z,
} = {}) {
  if (!(width > 0) || !(depth > 0)) throw new RangeError('Terrain extent must be positive.');
  if (!Number.isInteger(segmentsX) || segmentsX < 1 || !Number.isInteger(segmentsZ) || segmentsZ < 1) {
    throw new RangeError('Terrain subdivisions must be positive integers.');
  }

  const vertexCount = (segmentsX + 1) * (segmentsZ + 1);
  const positions = new Array(vertexCount * 3);
  const colors = new Array(vertexCount * 4);
  const indices = new Array(segmentsX * segmentsZ * 6);
  const normals = new Array(vertexCount * 3).fill(0);
  const minX = -width / 2;
  const minZ = -depth / 2;
  const stepX = width / segmentsX;
  const stepZ = depth / segmentsZ;

  let vertexOffset = 0;
  let colorOffset = 0;
  for (let iz = 0; iz <= segmentsZ; iz += 1) {
    const z = minZ + iz * stepZ;
    for (let ix = 0; ix <= segmentsX; ix += 1) {
      const x = minX + ix * stepX;
      const y = getTerrainHeight(x, z);
      positions[vertexOffset] = x;
      positions[vertexOffset + 1] = y;
      positions[vertexOffset + 2] = z;
      vertexOffset += 3;

      const color = terrainVertexColor(x, y, z);
      colors[colorOffset] = color[0];
      colors[colorOffset + 1] = color[1];
      colors[colorOffset + 2] = color[2];
      colors[colorOffset + 3] = 1;
      colorOffset += 4;
    }
  }

  let indexOffset = 0;
  for (let iz = 0; iz < segmentsZ; iz += 1) {
    for (let ix = 0; ix < segmentsX; ix += 1) {
      const a = terrainVertexIndex(ix, iz, { x: segmentsX, z: segmentsZ });
      const b = a + 1;
      const c = a + segmentsX + 1;
      const d = c + 1;
      // Babylon's normal builder expects this winding for a +Y-facing ground
      // surface in the scene's right-handed coordinate system.
      indices[indexOffset] = a;
      indices[indexOffset + 1] = b;
      indices[indexOffset + 2] = c;
      indices[indexOffset + 3] = b;
      indices[indexOffset + 4] = d;
      indices[indexOffset + 5] = c;
      indexOffset += 6;
    }
  }

  VertexData.ComputeNormals(positions, indices, normals);
  return {
    positions,
    indices,
    normals,
    colors,
    width,
    depth,
    segmentsX,
    segmentsZ,
    vertexCount,
  };
}

export function createBabylonMineTerrain({
  scene,
  material = null,
  name = 'base-ground',
  width = TERRAIN_EXTENT.width,
  depth = TERRAIN_EXTENT.depth,
  segmentsX = BABYLON_TERRAIN_SEGMENTS.x,
  segmentsZ = BABYLON_TERRAIN_SEGMENTS.z,
} = {}) {
  if (!scene) throw new TypeError('createBabylonMineTerrain requires a Babylon Scene.');
  if (scene.useRightHandedSystem !== true) {
    throw new Error('Babylon terrain requires scene.useRightHandedSystem = true.');
  }

  const data = buildBabylonTerrainVertexData({ width, depth, segmentsX, segmentsZ });
  const terrain = new Mesh(name, scene);
  const vertexData = new VertexData();
  vertexData.positions = data.positions;
  vertexData.indices = data.indices;
  vertexData.normals = data.normals;
  vertexData.colors = data.colors;
  vertexData.applyToMesh(terrain, false);

  if (material) terrain.material = material;
  terrain.useVertexColors = true;
  terrain.hasVertexAlpha = false;
  terrain.receiveShadows = true;
  terrain.isPickable = true;
  terrain.metadata = {
    ...(terrain.metadata ?? {}),
    authoritativeTerrain: true,
    coordinateSystem: 'right-handed',
    terrainExtentM: [width, depth],
    terrainSegments: [segmentsX, segmentsZ],
    terrainHeightSource: 'getTerrainHeight',
  };
  terrain.refreshBoundingInfo(true);
  return terrain;
}
