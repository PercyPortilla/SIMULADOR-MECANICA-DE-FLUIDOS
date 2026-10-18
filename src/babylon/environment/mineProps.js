import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import '@babylonjs/core/Meshes/thinInstanceMesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { getTerrainHeight } from '../../scene/environment/terrainHeight.js';
import {
  MINE_AUXILIARY_AREAS,
  MINE_DRAINAGE_PATHS,
  MINE_DUMP_ACCESS_PATHS,
  PIT_DESIGN,
  ROAD_DEFINITIONS,
  SITE_EXTENT,
  TOPOGRAPHIC_ZONES,
} from '../../scene/config/siteDesign.js';

function seeded(index, salt = 0) {
  const value = Math.sin((index + 1) * 91.734 + salt * 37.11) * 43758.5453;
  return value - Math.floor(value);
}

function distanceToSegment2D(x, z, a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const lengthSq = dx * dx + dz * dz;
  if (lengthSq <= 1e-9) return Math.hypot(x - a[0], z - a[1]);
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / lengthSq));
  return Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t));
}

function conflictsWithOperationalArea(x, z, radius) {
  const inPlantZone = Object.values(TOPOGRAPHIC_ZONES).some((zone) => {
    const [cx, cz] = zone.center;
    const [width, depth] = zone.size;
    return Math.abs(x - cx) <= width / 2 + radius + 5
      && Math.abs(z - cz) <= depth / 2 + radius + 5;
  });
  if (inPlantZone) return true;
  return Object.values(ROAD_DEFINITIONS).some((road) => {
    const clearance = road.widthM / 2 + road.shoulderM + radius + 1.5;
    for (let index = 0; index < road.points.length - 1; index += 1) {
      if (distanceToSegment2D(x, z, road.points[index], road.points[index + 1]) < clearance) return true;
    }
    return false;
  });
}

function requireRightHandedScene(scene) {
  if (!scene) throw new TypeError('Babylon mine props require a Scene.');
  if (scene.useRightHandedSystem !== true) {
    throw new Error('Babylon mine props require scene.useRightHandedSystem = true.');
  }
}

function colorFromHex(hex) {
  return new Color3(
    ((hex >> 16) & 0xff) / 255,
    ((hex >> 8) & 0xff) / 255,
    (hex & 0xff) / 255,
  );
}

function createMaterial(scene, name, hex, { alpha = 1, emissive = null } = {}) {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = colorFromHex(hex);
  material.specularColor = new Color3(0.025, 0.025, 0.02);
  material.specularPower = 4;
  material.alpha = alpha;
  if (emissive != null) material.emissiveColor = colorFromHex(emissive);
  return material;
}

function eulerXYZQuaternion(x = 0, y = 0, z = 0) {
  const c1 = Math.cos(x / 2); const c2 = Math.cos(y / 2); const c3 = Math.cos(z / 2);
  const s1 = Math.sin(x / 2); const s2 = Math.sin(y / 2); const s3 = Math.sin(z / 2);
  return new Quaternion(
    s1 * c2 * c3 + c1 * s2 * s3,
    c1 * s2 * c3 - s1 * c2 * s3,
    c1 * c2 * s3 + s1 * s2 * c3,
    c1 * c2 * c3 - s1 * s2 * s3,
  );
}

function reverseTriangleWinding(indices) {
  const reversed = [];
  for (let index = 0; index < indices.length; index += 3) {
    reversed.push(indices[index], indices[index + 2], indices[index + 1]);
  }
  return reversed;
}

function transformRecord(position, rotation, scale) {
  const p = new Vector3(...position);
  const q = eulerXYZQuaternion(...rotation);
  const s = new Vector3(...scale);
  return Object.freeze({
    position: Object.freeze([...position]),
    rotation: Object.freeze([...rotation]),
    scale: Object.freeze([...scale]),
    matrix: Object.freeze(Array.from(Matrix.Compose(s, q, p).m)),
  });
}

function createInstancedSet({ scene, root, name, createMaster, material, transforms, metadata = {} }) {
  if (transforms.length === 0) return null;
  const master = createMaster(name);
  master.material = material;
  master.parent = root;
  master.thinInstanceSetBuffer(
    'matrix',
    Float32Array.from(transforms.flatMap((transform) => transform.matrix)),
    16,
    true,
  );
  master.metadata = {
    ...metadata,
    instanceCount: transforms.length,
    instanceTransforms: transforms,
    rendererPrimitive: 'babylon-thin-instances',
  };
  return master;
}

const DODECA_UNIT_VERTEX_DATA = (() => {
  const t = (1 + Math.sqrt(5)) / 2;
  const r = 1 / t;
  const vertices = [
    -1, -1, -1, -1, -1, 1, -1, 1, -1, -1, 1, 1,
    1, -1, -1, 1, -1, 1, 1, 1, -1, 1, 1, 1,
    0, -r, -t, 0, -r, t, 0, r, -t, 0, r, t,
    -r, -t, 0, -r, t, 0, r, -t, 0, r, t, 0,
    -t, 0, -r, t, 0, -r, -t, 0, r, t, 0, r,
  ];
  const sourceIndices = [
    3, 11, 7, 3, 7, 15, 3, 15, 13,
    7, 19, 17, 7, 17, 6, 7, 6, 15,
    17, 4, 8, 17, 8, 10, 17, 10, 6,
    8, 0, 16, 8, 16, 2, 8, 2, 10,
    0, 12, 1, 0, 1, 18, 0, 18, 16,
    6, 10, 2, 6, 2, 13, 6, 13, 15,
    2, 16, 18, 2, 18, 3, 2, 3, 13,
    18, 1, 9, 18, 9, 11, 18, 11, 3,
    4, 14, 12, 4, 12, 0, 4, 0, 8,
    11, 9, 5, 11, 5, 19, 11, 19, 7,
    19, 5, 14, 19, 14, 4, 19, 4, 17,
    1, 12, 14, 1, 14, 5, 1, 5, 9,
  ];
  const positions = [];
  const indices = [];
  const normalize = (index) => {
    const x = vertices[index * 3];
    const y = vertices[index * 3 + 1];
    const z = vertices[index * 3 + 2];
    const length = Math.hypot(x, y, z);
    return [x / length, y / length, z / length];
  };
  for (let index = 0; index < sourceIndices.length; index += 3) {
    const base = positions.length / 3;
    [sourceIndices[index], sourceIndices[index + 1], sourceIndices[index + 2]].forEach((vertexIndex) => {
      positions.push(...normalize(vertexIndex));
    });
    indices.push(base, base + 2, base + 1);
  }
  const normals = [];
  VertexData.ComputeNormals(positions, indices, normals);
  return Object.freeze({
    positions: Object.freeze(positions),
    indices: Object.freeze(indices),
    normals: Object.freeze(normals),
  });
})();

function createDodecahedron(name, scene) {
  const mesh = new Mesh(name, scene);
  const data = new VertexData();
  data.positions = [...DODECA_UNIT_VERTEX_DATA.positions];
  data.indices = [...DODECA_UNIT_VERTEX_DATA.indices];
  data.normals = [...DODECA_UNIT_VERTEX_DATA.normals];
  data.applyToMesh(mesh, false);
  mesh.metadata = { ...(mesh.metadata ?? {}), v30Primitive: 'DodecahedronGeometry(1,0)' };
  return mesh;
}

function createCustomMesh(name, scene, positions, indices, { fromThreeWinding = false } = {}) {
  const appliedIndices = fromThreeWinding ? reverseTriangleWinding(indices) : indices;
  const normals = [];
  VertexData.ComputeNormals(positions, appliedIndices, normals);
  const mesh = new Mesh(name, scene);
  const data = new VertexData();
  data.positions = positions;
  data.indices = appliedIndices;
  data.normals = normals;
  data.applyToMesh(mesh, false);
  return mesh;
}

function addBox(root, scene, name, size, position, material) {
  const mesh = CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, scene);
  mesh.position.set(...position);
  mesh.material = material;
  mesh.receiveShadows = true;
  mesh.metadata = { dimensionsM: [...size], coordinateSystem: 'right-handed' };
  mesh.parent = root;
  return mesh;
}

function createRockField(root, scene, materials) {
  const items = [];
  const halfWidth = SITE_EXTENT.width / 2 - 8;
  const halfDepth = SITE_EXTENT.depth / 2 - 8;
  for (let index = 0; index < 260 && items.length < 64; index += 1) {
    const angle = (index / 260) * Math.PI * 2 + seeded(index, 1) * 0.3;
    const radiusX = PIT_DESIGN.radiusX + 18 + seeded(index, 2) * 95;
    const radiusZ = PIT_DESIGN.radiusZ + 12 + seeded(index, 3) * 62;
    const x = PIT_DESIGN.center.x + Math.cos(angle) * radiusX;
    const z = PIT_DESIGN.center.z + Math.sin(angle) * radiusZ;
    const s = 0.45 + seeded(index, 4) * 1.65;
    if (Math.abs(x) > halfWidth || Math.abs(z) > halfDepth) continue;
    if (conflictsWithOperationalArea(x, z, s)) continue;
    items.push({ x, z, s, r: seeded(index, 5) * Math.PI });
  }
  const transforms = items.map((item, index) => transformRecord(
    [item.x, getTerrainHeight(item.x, item.z) + item.s * 0.62, item.z],
    [seeded(index, 6) * 0.35, item.r, seeded(index, 7) * 0.3],
    [item.s * 1.45, item.s * 0.76, item.s],
  ));
  return createInstancedSet({
    scene,
    root,
    name: 'pit-perimeter-rock-field',
    createMaster: (name) => createDodecahedron(name, scene),
    material: materials.rock,
    transforms,
    metadata: { v30InstanceSource: 'pit-perimeter-rock-field' },
  });
}

function createPitOreFace(root, scene, materials) {
  const faceRoot = new TransformNode('pit-working-ore-face', scene);
  faceRoot.metadata = { mineSector: 'active-face' };
  faceRoot.parent = root;
  const centerX = PIT_DESIGN.shovelPoint.x + 17;
  const centerZ = PIT_DESIGN.shovelPoint.z - 13;
  const baseY = getTerrainHeight(centerX, centerZ);
  for (let index = 0; index < 34; index += 1) {
    const x = centerX + (seeded(index, 21) - 0.5) * 24;
    const z = centerZ + (seeded(index, 22) - 0.5) * 12;
    const radius = 0.55 + seeded(index, 23) * 1.15;
    const rock = createDodecahedron(`pit-run-of-mine-rock-${index + 1}`, scene);
    rock.position.set(x, getTerrainHeight(x, z) + radius * 0.48, z);
    rock.scaling.set(
      radius * (1.35 + seeded(index, 24) * 0.5),
      radius * (0.72 + seeded(index, 25) * 0.35),
      radius,
    );
    rock.rotationQuaternion = eulerXYZQuaternion(
      seeded(index, 26) * 0.35,
      seeded(index, 27) * Math.PI,
      seeded(index, 28) * 0.28,
    );
    rock.material = index % 4 === 0 ? materials.darkOre : materials.ore;
    rock.receiveShadows = true;
    rock.metadata = {
      ...rock.metadata,
      threeGeometryRadiusM: radius,
      effectiveScaleM: rock.scaling.asArray(),
    };
    rock.parent = faceRoot;
  }

  const segments = 12;
  const positions = [];
  const indices = [];
  for (let index = 0; index <= segments; index += 1) {
    const ratio = index / segments;
    const lx = -11 + 22 * ratio;
    const topY = 2.15
      + (seeded(index, 129) - 0.5) * 0.65
      + Math.sin(ratio * Math.PI * 2.4) * 0.22;
    const bottomY = -2.25 + (seeded(index, 130) - 0.5) * 0.25;
    const frontZ = 1.45 + (seeded(index, 131) - 0.5) * 0.38;
    const backZ = -1.45 + (seeded(index, 132) - 0.5) * 0.32;
    positions.push(
      lx, bottomY, frontZ,
      lx, topY, frontZ,
      lx, bottomY, backZ,
      lx, topY * 0.92, backZ,
    );
  }
  for (let index = 0; index < segments; index += 1) {
    const a = index * 4;
    const b = (index + 1) * 4;
    indices.push(
      a, b, a + 1, a + 1, b, b + 1,
      a + 2, a + 3, b + 2, a + 3, b + 3, b + 2,
      a + 1, b + 1, a + 3, a + 3, b + 1, b + 3,
      a, a + 2, b, a + 2, b + 2, b,
    );
  }
  indices.push(
    0, 1, 2, 1, 3, 2,
    segments * 4, segments * 4 + 2, segments * 4 + 1,
    segments * 4 + 1, segments * 4 + 2, segments * 4 + 3,
  );
  const face = createCustomMesh('pit-exposed-ore-band', scene, positions, indices, { fromThreeWinding: true });
  face.position.set(centerX + 4, baseY + 2.1, centerZ - 5.0);
  face.rotation.x = -0.08;
  face.rotation.y = -0.20;
  face.material = materials.ore;
  face.receiveShadows = true;
  face.metadata = { irregularOreFace: true, coordinateSystem: 'right-handed' };
  face.parent = faceRoot;
  return faceRoot;
}

function createOperatingPad(scene, root, { name, center, size, material, rotationY = 0, mineRole }) {
  const y = getTerrainHeight(center.x, center.z);
  const pad = CreateGround(name, { width: size.x, height: size.z, subdivisions: 1 }, scene);
  pad.position.set(center.x, y + 0.018, center.z);
  pad.rotation.y = rotationY;
  pad.material = material;
  pad.receiveShadows = true;
  pad.metadata = {
    mineRole,
    operatingSurface: true,
    dimensionsM: [size.x, size.z],
    terrainHeightSource: 'getTerrainHeight',
  };
  pad.parent = root;
  return pad;
}

function createPitOperatingAreas(root, scene, materials) {
  const operatingRoot = new TransformNode('pit-operating-areas', scene);
  operatingRoot.metadata = { mineSector: 'active' };
  operatingRoot.parent = root;
  const loadingArea = MINE_AUXILIARY_AREAS.loadingPad;
  const loadingCenter = { x: loadingArea.x, z: loadingArea.z };
  const loadingPad = createOperatingPad(scene, operatingRoot, {
    name: 'pit-loading-platform', center: loadingCenter,
    size: { x: loadingArea.widthM, z: loadingArea.depthM }, material: materials.compacted,
    rotationY: loadingArea.rotationY, mineRole: 'loading-and-truck-manoeuvre',
  });
  [-5.0, 5.0].forEach((offset, index) => {
    const track = addBox(
      operatingRoot, scene, `pit-loading-wheel-track-${index + 1}`,
      [31, 0.025, 0.75],
      [loadingCenter.x, loadingPad.position.y + 0.055, loadingCenter.z + offset],
      materials.track,
    );
    track.rotation.y = loadingPad.rotation.y;
  });

  const drillingArea = MINE_AUXILIARY_AREAS.drillingPad;
  const drillCenter = { x: drillingArea.x, z: drillingArea.z };
  const drillPad = createOperatingPad(scene, operatingRoot, {
    name: 'pit-drilling-platform', center: drillCenter,
    size: { x: drillingArea.widthM, z: drillingArea.depthM }, material: materials.drillSurface,
    rotationY: drillingArea.rotationY, mineRole: 'drilling-bench',
  });
  const drillY = drillPad.position.y + 0.065;
  let holeIndex = 0;
  [-2.4, 0, 2.4].forEach((dx) => {
    [-9, -3, 3, 9].forEach((dz) => {
      const collar = CreateCylinder(`pit-drill-hole-collar-${++holeIndex}`, {
        diameter: 0.44, height: 0.045, tessellation: 12,
      }, scene);
      collar.position.set(drillCenter.x + dx, drillY, drillCenter.z + dz);
      collar.material = materials.collar;
      collar.metadata = { drillHoleMarker: true, radiusM: 0.22, heightM: 0.045 };
      collar.parent = operatingRoot;
    });
  });

  const finalWall = new TransformNode('pit-final-wall-rock-scarps', scene);
  finalWall.metadata = { mineSector: 'final-wall' };
  finalWall.parent = operatingRoot;
  const transforms = [];
  for (let index = 0; index < 18; index += 1) {
    const angle = 0.22 + index / 17 * 1.18;
    const radial = PIT_DESIGN.radiusX - 31 + seeded(index, 41) * 18;
    const x = PIT_DESIGN.center.x + Math.cos(angle) * radial;
    const z = PIT_DESIGN.center.z + Math.sin(angle) * radial * (PIT_DESIGN.radiusZ / PIT_DESIGN.radiusX);
    const s = 0.9 + seeded(index, 42) * 1.6;
    transforms.push(transformRecord(
      [x, getTerrainHeight(x, z) + s * 0.36, z],
      [seeded(index, 43) * 0.32, angle, seeded(index, 44) * 0.28],
      [s * 1.65, s * 0.72, s],
    ));
  }
  createInstancedSet({
    scene,
    root: finalWall,
    name: 'pit-final-wall-rock-instances',
    createMaster: (name) => createDodecahedron(name, scene),
    material: materials.wallRock,
    transforms,
    metadata: { v30InstanceSource: 'pit-final-wall-rock-instances' },
  });
  return operatingRoot;
}

export function buildBabylonTerracedDumpVertexData({ x, z, radiusX, radiusZ, levels, levelHeightM, salt = 0 }) {
  const segments = 36;
  const rings = [{ scale: 1, y: 0 }];
  for (let level = 0; level < levels; level += 1) {
    const topScale = Math.max(0.24, 1 - level * 0.26 - 0.16);
    const benchScale = Math.max(0.14, topScale - 0.13);
    const y = (level + 1) * levelHeightM;
    rings.push({ scale: topScale, y });
    rings.push({ scale: benchScale, y });
  }
  const positions = [];
  const indices = [];
  const centerTerrainY = getTerrainHeight(x, z);
  rings.forEach((ring, ringIndex) => {
    for (let index = 0; index < segments; index += 1) {
      const angle = index / segments * Math.PI * 2;
      const irregularity = 1
        + 0.055 * Math.sin(angle * 3 + salt * 0.71)
        + 0.028 * Math.sin(angle * 7 - salt * 0.37)
        + 0.015 * Math.cos(angle * 11 + ringIndex * 0.4);
      const localX = Math.cos(angle) * radiusX * ring.scale * irregularity;
      const localZ = Math.sin(angle) * radiusZ * ring.scale * irregularity;
      const terrainDelta = getTerrainHeight(x + localX, z + localZ) - centerTerrainY;
      positions.push(localX, ring.y + terrainDelta, localZ);
    }
  });
  for (let ringIndex = 0; ringIndex < rings.length - 1; ringIndex += 1) {
    const current = ringIndex * segments;
    const next = (ringIndex + 1) * segments;
    for (let index = 0; index < segments; index += 1) {
      const n = (index + 1) % segments;
      indices.push(current + index, next + index, current + n, current + n, next + index, next + n);
    }
  }
  const lastRingStart = (rings.length - 1) * segments;
  const centerIndex = positions.length / 3;
  positions.push(0, rings.at(-1).y + 0.05, 0);
  for (let index = 0; index < segments; index += 1) {
    const n = (index + 1) % segments;
    indices.push(lastRingStart + index, centerIndex, lastRingStart + n);
  }
  return { positions, indices };
}

function createWasteDump(root, scene, name, definition, salt, material) {
  const data = buildBabylonTerracedDumpVertexData({ ...definition, salt });
  const mesh = createCustomMesh(name, scene, data.positions, data.indices, { fromThreeWinding: true });
  mesh.position.set(definition.x, getTerrainHeight(definition.x, definition.z) - 0.08, definition.z);
  mesh.rotation.y = salt * 0.11;
  mesh.material = material;
  mesh.receiveShadows = true;
  mesh.metadata = { mineRole: 'waste-dump', terracedDump: true, salt };
  mesh.parent = root;
  return mesh;
}

function createOreStagingPiles(root, scene, material) {
  const stagingRoot = new TransformNode('temporary-ore-staging', scene);
  stagingRoot.metadata = { mineRole: 'ore-staging' };
  stagingRoot.parent = root;
  const centers = [
    [MINE_AUXILIARY_AREAS.oreStaging.x - 8, MINE_AUXILIARY_AREAS.oreStaging.z - 3],
    [MINE_AUXILIARY_AREAS.oreStaging.x + 9, MINE_AUXILIARY_AREAS.oreStaging.z + 4],
  ];
  let rockId = 0;
  centers.forEach(([cx, cz], pileIndex) => {
    for (let index = 0; index < 26; index += 1) {
      const angle = seeded(index, 60 + pileIndex) * Math.PI * 2;
      const radial = Math.sqrt(seeded(index, 70 + pileIndex)) * 8.5;
      const x = cx + Math.cos(angle) * radial;
      const z = cz + Math.sin(angle) * radial * 0.7;
      const size = 0.65 + seeded(index, 80 + pileIndex) * 1.65;
      const rock = createDodecahedron(`temporary-ore-rock-${++rockId}`, scene);
      rock.position.set(x, getTerrainHeight(x, z) + size * (0.36 + (1 - radial / 8.5) * 0.42), z);
      rock.scaling.set(size * 1.35, size * 0.78, size);
      rock.rotationQuaternion = eulerXYZQuaternion(seeded(index, 90) * 0.28, angle, seeded(index, 91) * 0.24);
      rock.material = material;
      rock.receiveShadows = true;
      rock.parent = stagingRoot;
    }
  });
  return stagingRoot;
}

export function buildBabylonGroundRibbonVertexData(points, width) {
  const positions = [];
  const indices = [];
  points.forEach(([x, z], index) => {
    const prev = points[Math.max(0, index - 1)];
    const next = points[Math.min(points.length - 1, index + 1)];
    const dx = next[0] - prev[0];
    const dz = next[1] - prev[1];
    const length = Math.max(1e-6, Math.hypot(dx, dz));
    const sx = -dz / length;
    const sz = dx / length;
    const y = getTerrainHeight(x, z) + 0.012;
    positions.push(x + sx * width / 2, y, z + sz * width / 2);
    positions.push(x - sx * width / 2, y, z - sz * width / 2);
    if (index < points.length - 1) {
      const base = index * 2;
      indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
    }
  });
  return { positions, indices };
}

function createGroundRibbon(root, scene, name, points, width, material, mineRole = 'drainage-channel') {
  const data = buildBabylonGroundRibbonVertexData(points, width);
  const mesh = createCustomMesh(name, scene, data.positions, data.indices, { fromThreeWinding: true });
  mesh.material = material;
  mesh.receiveShadows = true;
  mesh.metadata = { mineRole, widthM: width, terrainHeightSource: 'getTerrainHeight' };
  mesh.parent = root;
  return mesh;
}

function buildSumpBoundary() {
  const boundary = [];
  const { radiusM } = MINE_AUXILIARY_AREAS.pitSump;
  for (let index = 0; index < 18; index += 1) {
    const angle = index / 18 * Math.PI * 2;
    const radius = radiusM * 0.78 * (
      1 + 0.16 * Math.sin(angle * 3 + 0.45) + 0.09 * Math.cos(angle * 5 - 0.8) + 0.05 * Math.sin(angle * 8 + 1.1)
    );
    boundary.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
  }
  return boundary;
}

function createSumpSurface(name, scene, boundary) {
  const positions = [0, 0, 0];
  boundary.forEach(([x, y]) => positions.push(x, 0, -y));
  const indices = [];
  for (let index = 0; index < boundary.length; index += 1) {
    const a = index + 1;
    const b = ((index + 1) % boundary.length) + 1;
    indices.push(0, b, a);
  }
  return createCustomMesh(name, scene, positions, indices);
}

function createPitDrainage(root, scene, materials) {
  const drainageRoot = new TransformNode('pit-drainage-system', scene);
  drainageRoot.metadata = { mineRole: 'drainage' };
  drainageRoot.parent = root;
  createGroundRibbon(drainageRoot, scene, 'pit-drain-channel-west', MINE_DRAINAGE_PATHS.west, 0.72, materials.channel);
  createGroundRibbon(drainageRoot, scene, 'pit-drain-channel-east', MINE_DRAINAGE_PATHS.east, 0.66, materials.channel);
  const sumpRoot = new TransformNode('pit-drainage-sump', scene);
  sumpRoot.metadata = { mineRole: 'sump' };
  sumpRoot.parent = drainageRoot;
  const { x, z } = MINE_AUXILIARY_AREAS.pitSump;
  const y = getTerrainHeight(x, z);
  const boundary = buildSumpBoundary();
  const wetSoil = createSumpSurface('pit-sump-wet-soil', scene, boundary);
  wetSoil.position.set(x, y + 0.025, z);
  wetSoil.scaling.setAll(1.12);
  wetSoil.material = materials.wetSoil;
  wetSoil.receiveShadows = true;
  wetSoil.metadata = { sumpBoundaryPoints: boundary.length, v30ShapeRotationBaked: true };
  wetSoil.parent = sumpRoot;
  const water = createSumpSurface('pit-sump-water', scene, boundary);
  water.position.set(x, y + 0.045, z);
  water.scaling.setAll(0.84);
  water.material = materials.water;
  water.metadata = { sumpBoundaryPoints: boundary.length, v30ShapeRotationBaked: true };
  water.parent = sumpRoot;
  return drainageRoot;
}

function createMineAuxiliaryEarthworks(root, scene, materials) {
  const earthworks = new TransformNode('mine-auxiliary-earthworks', scene);
  earthworks.parent = root;
  createGroundRibbon(earthworks, scene, 'north-waste-dump-access', MINE_DUMP_ACCESS_PATHS.north, 5.6, materials.access, 'dump-access-road');
  createGroundRibbon(earthworks, scene, 'south-waste-dump-access', MINE_DUMP_ACCESS_PATHS.south, 5.4, materials.access, 'dump-access-road');
  createWasteDump(earthworks, scene, 'north-waste-dump', MINE_AUXILIARY_AREAS.northWasteDump, 1, materials.dump);
  createWasteDump(earthworks, scene, 'south-waste-dump', MINE_AUXILIARY_AREAS.southWasteDump, 2, materials.dump);
  createOreStagingPiles(earthworks, scene, materials.stagingOre);
  createPitDrainage(earthworks, scene, materials);
  return earthworks;
}

function createPitWeatheringTraces(root, scene, materials) {
  const weatherRoot = new TransformNode('pit-geological-weathering-traces', scene);
  weatherRoot.metadata = { mineRole: 'geological-visual-cue' };
  weatherRoot.parent = root;
  const buckets = [[], [], []];
  const azimuths = [0.34, 0.58, 0.84, 1.04, 1.24];
  azimuths.forEach((azimuth, bandIndex) => {
    for (let step = 0; step < 5; step += 1) {
      const radial = PIT_DESIGN.floorRadiusM + 25 + step * 17 + bandIndex * 1.7;
      const x = PIT_DESIGN.center.x + Math.cos(azimuth) * radial;
      const z = PIT_DESIGN.center.z + Math.sin(azimuth) * radial * (PIT_DESIGN.radiusZ / PIT_DESIGN.radiusX);
      buckets[(bandIndex + step) % 3].push(transformRecord(
        [x, getTerrainHeight(x, z) + 0.055, z],
        [-0.02, -azimuth + Math.PI / 2, 0],
        [0.85 + seeded(step, bandIndex + 120) * 0.65, 1, 1],
      ));
    }
  });
  buckets.forEach((transforms, materialIndex) => {
    createInstancedSet({
      scene,
      root: weatherRoot,
      name: `pit-weathering-trace-instances-${materialIndex + 1}`,
      createMaster: (name) => CreateBox(name, { width: 4.2, height: 0.12, depth: 0.72 }, scene),
      material: materials.weathering[materialIndex],
      transforms,
      metadata: { geologyCue: 'weathering-variation-not-ore-model', dimensionsM: [4.2, 0.12, 0.72] },
    });
  });
  return weatherRoot;
}

function createLampPosts(root, scene, materials) {
  const lightsRoot = new TransformNode('mine-lighting-poles', scene);
  lightsRoot.parent = root;
  const points = [
    [-102, -14], [-78, -34], [-44, -36], [-8, -38], [46, -34], [92, -30], [138, -28],
    [182, -18], [228, -4], [178, -102], [220, -110], [258, -96], [184, 45], [218, 47],
  ];
  points.forEach(([x, z], index) => {
    const y = getTerrainHeight(x, z);
    const pole = CreateCylinder(`lighting-pole-${index + 1}`, {
      diameterTop: 0.20, diameterBottom: 0.28, height: 7.2, tessellation: 10,
    }, scene);
    pole.position.set(x, y + 3.6, z);
    pole.material = materials.steel;
    pole.metadata = { heightM: 7.2, radiusTopM: 0.10, radiusBottomM: 0.14, terrainHeightSource: 'getTerrainHeight' };
    pole.parent = lightsRoot;
    const head = addBox(lightsRoot, scene, `lighting-head-${index + 1}`, [0.85, 0.2, 0.32], [x + 0.26, y + 7.08, z], materials.lamp);
    head.metadata.emissiveHex = 0xffcf70;
  });
  return lightsRoot;
}

function createIndustrialControlBuilding(root, scene, materials) {
  const utilityRoot = new TransformNode('plant-utility-area', scene);
  utilityRoot.parent = root;
  const x = 120; const z = -105; const baseY = getTerrainHeight(x, z);
  addBox(utilityRoot, scene, 'control-mcc-pad', [18, 0.22, 11], [x, baseY + 0.11, z], materials.concrete);
  addBox(utilityRoot, scene, 'control-mcc-building', [15, 4.4, 8.5], [x, baseY + 2.42, z], materials.wall);
  addBox(utilityRoot, scene, 'control-mcc-flat-roof', [15.8, 0.28, 9.3], [x, baseY + 4.74, z], materials.roof);
  addBox(utilityRoot, scene, 'control-mcc-double-door', [2.2, 2.8, 0.14], [x - 4.1, baseY + 1.52, z - 4.32], materials.dark);
  [-0.5, 2.4, 5.3].forEach((offset, index) => {
    const window = addBox(utilityRoot, scene, `control-room-window-${index + 1}`, [1.75, 1.15, 0.09], [x + offset, baseY + 2.55, z - 4.36], materials.glass);
    window.metadata.industrialWindow = true;
  });
  addBox(utilityRoot, scene, 'control-room-hvac-1', [2.2, 1.0, 1.5], [x - 3.8, baseY + 5.35, z + 0.8], materials.dark);
  addBox(utilityRoot, scene, 'control-room-hvac-2', [2.2, 1.0, 1.5], [x - 0.8, baseY + 5.35, z + 0.8], materials.dark);
  addBox(utilityRoot, scene, 'control-room-cable-tray', [9.0, 0.22, 0.55], [x + 1.0, baseY + 4.95, z + 3.7], materials.dark);
  addBox(utilityRoot, scene, 'control-room-safety-panel', [1.2, 1.8, 0.12], [x + 5.6, baseY + 1.2, z - 4.34], materials.safety);
  return utilityRoot;
}

function createSparseVegetation(root, scene, material) {
  const transforms = [];
  for (let index = 0; index < 34; index += 1) {
    const x = -30 + seeded(index, 11) * 350;
    const z = 70 + seeded(index, 12) * 95;
    const s = 0.32 + seeded(index, 13) * 0.72;
    transforms.push(transformRecord(
      [x, getTerrainHeight(x, z) + s * 0.18, z],
      [0, 0, 0],
      [s * 1.5, s * 0.55, s],
    ));
  }
  return createInstancedSet({
    scene,
    root,
    name: 'sparse-mine-shrubs',
    createMaster: (name) => CreateSphere(name, { diameter: 0.9, segments: 8 }, scene),
    material,
    transforms,
    metadata: { threePrimitive: 'SphereGeometry(0.45,8,6)', primitiveParity: 'extent-and-transform' },
  });
}

export function createBabylonMineProps({ scene } = {}) {
  requireRightHandedScene(scene);
  const root = new TransformNode('mine-context-props', scene);
  root.metadata = {
    coordinateSystem: 'right-handed',
    worldUnitsPerMeter: 1,
    terrainHeightSource: 'getTerrainHeight',
    v30Source: 'src/scene/environment/mineProps.js',
  };
  const materials = {
    rock: createMaterial(scene, 'mine-rock-material', 0x8d806f),
    ore: createMaterial(scene, 'mine-ore-material', 0x8f6b4e),
    darkOre: createMaterial(scene, 'mine-dark-ore-material', 0x755a45),
    compacted: createMaterial(scene, 'mine-compacted-pad-material', 0x988976),
    drillSurface: createMaterial(scene, 'mine-drill-pad-material', 0xa09178),
    track: createMaterial(scene, 'mine-track-material', 0x786d5f),
    collar: createMaterial(scene, 'mine-drill-collar-material', 0x4d4b46),
    wallRock: createMaterial(scene, 'mine-final-wall-rock-material', 0x9a958c),
    dump: createMaterial(scene, 'mine-waste-dump-material', 0xa28d70),
    stagingOre: createMaterial(scene, 'mine-staging-ore-material', 0x966f4d),
    access: createMaterial(scene, 'mine-dump-access-material', 0x8d7e69),
    channel: createMaterial(scene, 'mine-drain-channel-material', 0x74766b),
    wetSoil: createMaterial(scene, 'mine-sump-wet-soil-material', 0x756b5c),
    water: createMaterial(scene, 'mine-sump-water-material', 0x5f7a7c, { alpha: 0.72 }),
    weathering: [0x8c8174, 0xaa9276, 0x747879].map((hex, index) => createMaterial(scene, `mine-weathering-material-${index + 1}`, hex)),
    steel: createMaterial(scene, 'mine-light-pole-material', 0x495257),
    lamp: createMaterial(scene, 'mine-light-head-material', 0xf2b544, { emissive: 0xffcf70 }),
    concrete: createMaterial(scene, 'mine-control-concrete-material', 0x90948f),
    wall: createMaterial(scene, 'mine-control-wall-material', 0xaeb5b3),
    roof: createMaterial(scene, 'mine-control-roof-material', 0x697679),
    dark: createMaterial(scene, 'mine-control-dark-material', 0x495257),
    safety: createMaterial(scene, 'mine-control-safety-material', 0xf2b544),
    glass: createMaterial(scene, 'mine-control-glass-material', 0x9fb7bd, { alpha: 0.55 }),
    vegetation: createMaterial(scene, 'mine-sparse-vegetation-material', 0x667052),
  };

  createRockField(root, scene, materials);
  createPitOreFace(root, scene, materials);
  createPitOperatingAreas(root, scene, materials);
  createPitWeatheringTraces(root, scene, materials);
  createMineAuxiliaryEarthworks(root, scene, materials);
  createLampPosts(root, scene, materials);
  createIndustrialControlBuilding(root, scene, materials);
  createSparseVegetation(root, scene, materials.vegetation);
  return { root, materials };
}
