import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Quaternion } from '@babylonjs/core/Maths/math.vector.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { getTerrainHeight } from '../../scene/environment/terrainHeight.js';

function requireRightHandedScene(scene) {
  if (!scene) throw new TypeError('Babylon operational surface details require a Scene.');
  if (scene.useRightHandedSystem !== true) {
    throw new Error('Babylon operational surface details require scene.useRightHandedSystem = true.');
  }
}

function colorFromHex(hex) {
  return new Color3(
    ((hex >> 16) & 0xff) / 255,
    ((hex >> 8) & 0xff) / 255,
    (hex & 0xff) / 255,
  );
}

function material(scene, name, hex, alpha = 1) {
  const result = new StandardMaterial(name, scene);
  result.diffuseColor = colorFromHex(hex);
  result.specularColor = new Color3(0.02, 0.02, 0.018);
  result.specularPower = 4;
  result.alpha = alpha;
  if (alpha < 1) result.disableDepthWrite = true;
  return result;
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

const DODECA_UNIT_DATA = (() => {
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
  const vertex = (index) => {
    const x = vertices[index * 3];
    const y = vertices[index * 3 + 1];
    const z = vertices[index * 3 + 2];
    const length = Math.hypot(x, y, z);
    return [x / length, y / length, z / length];
  };
  for (let index = 0; index < sourceIndices.length; index += 3) {
    const base = positions.length / 3;
    positions.push(...vertex(sourceIndices[index]), ...vertex(sourceIndices[index + 1]), ...vertex(sourceIndices[index + 2]));
    indices.push(base, base + 2, base + 1);
  }
  const normals = [];
  VertexData.ComputeNormals(positions, indices, normals);
  return { positions, indices, normals };
})();

function createDodecahedron(name, scene) {
  const mesh = new Mesh(name, scene);
  const data = new VertexData();
  data.positions = [...DODECA_UNIT_DATA.positions];
  data.indices = [...DODECA_UNIT_DATA.indices];
  data.normals = [...DODECA_UNIT_DATA.normals];
  data.applyToMesh(mesh, false);
  mesh.metadata = { v30Primitive: 'DodecahedronGeometry(1,0)' };
  return mesh;
}

function createSurfacePatch(scene, root, name, x, z, radiusX, radiusZ, color, opacity = 0.72, rotationY = 0) {
  const segments = 32;
  const positions = [0, 0, 0];
  const indices = [];
  for (let index = 0; index <= segments; index += 1) {
    const angle = index / segments * Math.PI * 2;
    positions.push(Math.cos(angle), 0, -Math.sin(angle));
  }
  for (let index = 0; index < segments; index += 1) indices.push(0, index + 2, index + 1);
  const normals = [];
  VertexData.ComputeNormals(positions, indices, normals);
  const mesh = new Mesh(name, scene);
  const data = new VertexData();
  data.positions = positions;
  data.indices = indices;
  data.normals = normals;
  data.applyToMesh(mesh, false);
  mesh.position.set(x, getTerrainHeight(x, z) + 0.022, z);
  mesh.scaling.set(radiusX, 1, radiusZ);
  mesh.rotation.y = rotationY;
  mesh.material = material(scene, `${name}-material`, color, opacity);
  mesh.receiveShadows = true;
  mesh.metadata = {
    visualOnly: true,
    surfaceOverlay: true,
    radiusX,
    radiusZ,
    opacity,
    rotationY,
    terrainHeightSource: 'getTerrainHeight',
  };
  mesh.parent = root;
  return mesh;
}

function createControlledSpill(scene, root, name, x, z, count = 12, radius = 0.13, spillMaterial = null) {
  const spillRoot = new TransformNode(name, scene);
  spillRoot.metadata = { visualOnly: true, controlledMaterialSpill: true };
  spillRoot.parent = root;
  const useMaterial = spillMaterial ?? material(scene, `${name}-material`, 0x72583f);
  for (let index = 0; index < count; index += 1) {
    const angle = index * 2.399963229728653;
    const radial = 0.35 + (index % 5) * 0.20;
    const px = x + Math.cos(angle) * radial;
    const pz = z + Math.sin(angle) * radial * 0.72;
    const size = radius * (0.72 + (index % 4) * 0.13);
    const rock = createDodecahedron(`${name}-fragment-${index + 1}`, scene);
    rock.position.set(px, getTerrainHeight(px, pz) + size * 0.44, pz);
    rock.scaling.setAll(size);
    rock.rotationQuaternion = eulerXYZQuaternion(index * 0.23, index * 0.37, index * 0.18);
    rock.material = useMaterial;
    rock.receiveShadows = true;
    rock.metadata = { ...rock.metadata, fragmentSizeM: size, terrainHeightSource: 'getTerrainHeight' };
    rock.parent = spillRoot;
  }
  return spillRoot;
}

function createRomStagingPile(scene, root, oreMaterial, spillMaterial) {
  const pileRoot = new TransformNode('ROM-STAGING-PILE', scene);
  pileRoot.metadata = {
    visualOnly: true,
    processCoupled: false,
    romStagingPile: true,
    nominalDiameterM: 8.8,
    nominalHeightM: 2.7,
  };
  pileRoot.parent = root;
  const lobes = [
    { x: -135.0, z: -13.0, radius: 4.35, height: 2.70, yaw: 0.18 },
    { x: -132.4, z: -12.2, radius: 2.65, height: 1.65, yaw: -0.28 },
    { x: -137.2, z: -14.0, radius: 2.35, height: 1.45, yaw: 0.42 },
  ];
  lobes.forEach((lobe, index) => {
    const mesh = CreateCylinder(`ROM-STAGING-PILE-lobe-${index + 1}`, {
      diameterTop: 0,
      diameterBottom: lobe.radius * 2,
      height: lobe.height,
      tessellation: 28,
      subdivisions: 4,
    }, scene);
    mesh.position.set(lobe.x, getTerrainHeight(lobe.x, lobe.z) + lobe.height / 2, lobe.z);
    mesh.rotation.y = lobe.yaw;
    mesh.scaling.z = index === 0 ? 0.92 : 0.84;
    mesh.material = oreMaterial;
    mesh.receiveShadows = true;
    mesh.metadata = {
      radiusM: lobe.radius,
      heightM: lobe.height,
      yaw: lobe.yaw,
      terrainHeightSource: 'getTerrainHeight',
    };
    mesh.parent = pileRoot;
  });
  const toe = createControlledSpill(scene, pileRoot, 'ROM-STAGING-PILE-toe-rock', -131.0, -14.7, 18, 0.17, spillMaterial);
  toe.metadata.romPileToeFragments = true;
  return pileRoot;
}

function createLoaderScuffs(scene, root, scuffMaterial) {
  const scuffRoot = new TransformNode('v24-stockpile-loader-scuffs', scene);
  scuffRoot.metadata = { visualOnly: true, operationalWear: 'wheel-loader-turning' };
  scuffRoot.parent = root;
  const points = [
    [10.2, -20.5, 0.35], [12.2, -18.0, 0.58], [15.0, -16.2, 0.92], [18.2, -15.2, 1.18],
    [21.5, -16.0, 1.42], [23.4, -18.6, 1.65], [22.0, -21.0, 1.95], [18.5, -22.1, 2.18],
    [14.8, -21.8, 2.45], [11.7, -20.9, 2.72],
  ];
  points.forEach(([x, z, yaw], index) => {
    const mark = CreateBox(`loader-scuff-${index + 1}`, { width: 2.15, height: 0.015, depth: 0.28 }, scene);
    mark.position.set(x, getTerrainHeight(x, z) + 0.024, z);
    mark.rotation.y = yaw;
    mark.material = scuffMaterial;
    mark.receiveShadows = true;
    mark.metadata = { dimensionsM: [2.15, 0.015, 0.28], yaw, terrainHeightSource: 'getTerrainHeight' };
    mark.parent = scuffRoot;
  });
  return scuffRoot;
}

export function createBabylonOperationalSurfaceDetails({ scene } = {}) {
  requireRightHandedScene(scene);
  const root = new TransformNode('v24-operational-surface-details', scene);
  root.metadata = {
    visualOnly: true,
    authoritativeTerrain: false,
    reusesExistingRoadTracks: true,
    reusesExistingDrainage: true,
    noFogRequired: true,
    coordinateSystem: 'right-handed',
    worldUnitsPerMeter: 1,
    terrainHeightSource: 'getTerrainHeight',
    v30Source: 'src/scene/environment/operationalSurfaceDetails.js',
  };

  const patches = [
    createSurfacePatch(scene, root, 'rom-loader-working-wear', -125.0, -12.5, 8.0, 3.0, 0x655749, 0.32, -0.04),
    createSurfacePatch(scene, root, 'crusher-fines-stain', -84, -30, 5.2, 2.2, 0x69584a, 0.60, 0.12),
    createSurfacePatch(scene, root, 'stockpile-traffic-wear', 16, -21, 10.5, 5.0, 0x62574b, 0.38, -0.18),
    createSurfacePatch(scene, root, 'mill-feed-fines-stain', 73, -7, 4.0, 1.9, 0x68574a, 0.48, 0.08),
    createSurfacePatch(scene, root, 'recovery-service-wear', 206, -78, 10.0, 2.2, 0x655d52, 0.34, 0),
  ];
  const spillMaterial = material(scene, 'operational-spill-material', 0x72583f);
  createControlledSpill(scene, root, 'crusher-controlled-spill', -82.2, -31.8, 11, 0.15, spillMaterial);
  createControlledSpill(scene, root, 'stockpile-controlled-spill', 27.0, -25.2, 14, 0.16, spillMaterial);
  createControlledSpill(scene, root, 'mill-feed-controlled-spill', 73.8, -8.0, 9, 0.12, spillMaterial);
  const oreMaterial = material(scene, 'rom-staging-ore-material', 0x765f49);
  createRomStagingPile(scene, root, oreMaterial, spillMaterial);
  createLoaderScuffs(scene, root, material(scene, 'loader-scuff-material', 0x5e5447, 0.58));
  root.metadata.surfacePatchCount = patches.length;
  root.metadata.controlledSpillCount = 3;
  root.metadata.romStagingPileCount = 1;
  return { root, patches };
}
