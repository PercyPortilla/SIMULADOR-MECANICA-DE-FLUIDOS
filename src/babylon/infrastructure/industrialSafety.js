import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { getTerrainHeight } from '../../scene/environment/terrainHeight.js';

function requireRightHandedScene(scene) {
  if (!scene) throw new TypeError('Babylon industrial safety requires a Scene.');
  if (scene.useRightHandedSystem !== true) {
    throw new Error('Babylon industrial safety requires scene.useRightHandedSystem = true.');
  }
}

function colorFromHex(hex) {
  return new Color3(
    ((hex >> 16) & 0xff) / 255,
    ((hex >> 8) & 0xff) / 255,
    (hex & 0xff) / 255,
  );
}

function material(scene, name, hex) {
  const result = new StandardMaterial(name, scene);
  result.diffuseColor = colorFromHex(hex);
  result.specularColor = new Color3(0.03, 0.03, 0.025);
  result.specularPower = 4;
  return result;
}

function addBox(root, scene, name, size, position, useMaterial) {
  const mesh = CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, scene);
  mesh.position.set(...position);
  mesh.material = useMaterial;
  mesh.receiveShadows = true;
  mesh.metadata = { dimensionsM: [...size] };
  mesh.parent = root;
  return mesh;
}

function createSign(scene, materials, name, x, z, rotationY = 0) {
  const group = new TransformNode(name, scene);
  group.position.set(x, getTerrainHeight(x, z), z);
  group.rotation.y = rotationY;
  group.metadata = {
    safetyRole: 'warning-sign',
    visualOnly: true,
    centerXZ: [x, z],
    terrainHeightSource: 'getTerrainHeight',
  };
  addBox(group, scene, `${name}-post`, [0.08, 1.8, 0.08], [0, 0.9, 0], materials.structuralSteel);
  addBox(group, scene, `${name}-warning-plate`, [0.82, 0.58, 0.045], [0, 1.62, 0], materials.signYellow);
  addBox(group, scene, `${name}-warning-stripe`, [0.62, 0.08, 0.052], [0, 1.62, 0.025], materials.dark);
  return group;
}

function createExtinguisher(scene, materials, name, x, z) {
  const group = new TransformNode(name, scene);
  group.position.set(x, getTerrainHeight(x, z), z);
  group.metadata = {
    safetyRole: 'fire-extinguisher',
    visualOnly: true,
    centerXZ: [x, z],
    terrainHeightSource: 'getTerrainHeight',
  };
  addBox(group, scene, `${name}-backing`, [0.38, 0.72, 0.05], [0, 0.42, -0.12], materials.backing);
  const bottle = CreateCylinder(`${name}-bottle`, {
    diameterTop: 0.24,
    diameterBottom: 0.28,
    height: 0.55,
    tessellation: 18,
  }, scene);
  bottle.position.y = 0.36;
  bottle.material = materials.extinguisher;
  bottle.metadata = { radiusTopM: 0.12, radiusBottomM: 0.14, heightM: 0.55, tessellation: 18 };
  bottle.parent = group;
  addBox(group, scene, `${name}-handle`, [0.14, 0.07, 0.07], [0, 0.69, 0], materials.structuralSteel);
  return group;
}

function createEyewash(scene, materials, name, x, z) {
  const group = new TransformNode(name, scene);
  group.position.set(x, getTerrainHeight(x, z), z);
  group.metadata = {
    safetyRole: 'eyewash-shower',
    visualOnly: true,
    centerXZ: [x, z],
    terrainHeightSource: 'getTerrainHeight',
  };
  const post = CreateCylinder(`${name}-post`, { diameter: 0.10, height: 2.25, tessellation: 14 }, scene);
  post.position.y = 1.125;
  post.material = materials.yellow;
  post.metadata = { radiusM: 0.05, heightM: 2.25, tessellation: 14 };
  post.parent = group;
  const basin = CreateCylinder(`${name}-basin`, { diameterTop: 0.56, diameterBottom: 0.44, height: 0.12, tessellation: 24 }, scene);
  basin.position.set(0.24, 0.92, 0);
  basin.material = materials.processSteel;
  basin.metadata = { radiusTopM: 0.28, radiusBottomM: 0.22, heightM: 0.12, tessellation: 24 };
  basin.parent = group;
  addBox(group, scene, `${name}-shower-arm`, [0.48, 0.05, 0.05], [0.20, 2.18, 0], materials.yellow);
  const shower = CreateCylinder(`${name}-shower`, { diameterTop: 0.36, diameterBottom: 0.22, height: 0.10, tessellation: 20 }, scene);
  shower.position.set(0.42, 2.08, 0);
  shower.material = materials.processSteel;
  shower.metadata = { radiusTopM: 0.18, radiusBottomM: 0.11, heightM: 0.10, tessellation: 20 };
  shower.parent = group;
  return group;
}

function createFenceSegment(scene, materials, name, x0, x1, z, yLift = 0) {
  const group = new TransformNode(name, scene);
  const span = Math.abs(x1 - x0);
  const centerX = (x0 + x1) / 2;
  const groundY = getTerrainHeight(centerX, z) + yLift;
  group.metadata = {
    safetyRole: 'restricted-area-fence',
    visualOnly: true,
    centerXZ: [centerX, z],
    spanM: span,
    terrainHeightSource: 'getTerrainHeight',
  };
  addBox(group, scene, `${name}-rail-top`, [span, 0.055, 0.055], [centerX, groundY + 1.6, z], materials.structuralSteel);
  addBox(group, scene, `${name}-rail-mid`, [span, 0.055, 0.055], [centerX, groundY + 0.82, z], materials.structuralSteel);
  const postCount = Math.max(2, Math.ceil(span / 3.0));
  for (let index = 0; index <= postCount; index += 1) {
    const x = x0 + (x1 - x0) * (index / postCount);
    const y = getTerrainHeight(x, z);
    addBox(group, scene, `${name}-post-${index + 1}`, [0.06, 1.65, 0.06], [x, y + 0.825, z], materials.structuralSteel);
  }
  group.metadata.postCount = postCount + 1;
  return group;
}

function createPedestrianMarkers(scene, materials) {
  const group = new TransformNode('v24-recovery-pedestrian-markers', scene);
  group.metadata = {
    safetyRole: 'pedestrian-path',
    visualOnly: true,
    markerCount: 18,
  };
  for (let index = 0; index < 18; index += 1) {
    const x = 160 + index * 5.0;
    const z = -78.0;
    const marker = addBox(
      group,
      scene,
      `recovery-walkway-stripe-${index + 1}`,
      [2.6, 0.018, 0.22],
      [x, getTerrainHeight(x, z) + 0.025, z],
      materials.pedestrian,
    );
    marker.metadata.terrainHeightSource = 'getTerrainHeight';
  }
  return group;
}

export function createBabylonIndustrialSafety({ scene } = {}) {
  requireRightHandedScene(scene);
  const root = new TransformNode('v24-industrial-safety', scene);
  root.metadata = {
    visualOnly: true,
    v24IndustrialSafety: true,
    coordinateSystem: 'right-handed',
    worldUnitsPerMeter: 1,
    terrainHeightSource: 'getTerrainHeight',
  };
  const materials = {
    structuralSteel: material(scene, 'safety-structural-steel', 0x697679),
    processSteel: material(scene, 'safety-process-steel', 0xaeb5b3),
    signYellow: material(scene, 'safety-sign-yellow', 0xd6a126),
    dark: material(scene, 'safety-sign-dark', 0x3c4142),
    extinguisher: material(scene, 'safety-extinguisher-red', 0xb83b31),
    backing: material(scene, 'safety-backing', 0xe7e0cb),
    yellow: material(scene, 'safety-yellow', 0xd3b32d),
    pedestrian: material(scene, 'safety-pedestrian', 0xd3ae2f),
  };

  const signs = [
    ['safety-sign-reception', -113, -18, 0],
    ['safety-sign-crushing', -83, -21, 0],
    ['safety-sign-grinding', 72, 4, Math.PI],
    ['safety-sign-pumps', 112, 3, Math.PI],
    ['safety-sign-leaching', 157, 39, Math.PI],
    ['safety-sign-cip', 166, -78, 0],
    ['safety-sign-elution', 194, -78, 0],
    ['safety-sign-ew', 220, -78, 0],
  ].map(([name, x, z, rotationY]) => createSign(scene, materials, name, x, z, rotationY));
  signs.forEach((sign) => { sign.parent = root; });

  const extinguishers = [
    ['extinguisher-crushing', -82, -24],
    ['extinguisher-grinding', 74, 1],
    ['extinguisher-pump', 111, -1],
    ['extinguisher-cip', 174, -80],
    ['extinguisher-elution', 198, -80],
    ['extinguisher-ew', 222, -80],
  ].map(([name, x, z]) => createExtinguisher(scene, materials, name, x, z));
  extinguishers.forEach((extinguisher) => { extinguisher.parent = root; });

  const eyewash = createEyewash(scene, materials, 'recovery-eyewash-shower', 207, -78.2);
  eyewash.parent = root;
  const fenceWest = createFenceSegment(scene, materials, 'recovery-fence-west', 160, 204, -106);
  fenceWest.parent = root;
  const fenceEast = createFenceSegment(scene, materials, 'recovery-fence-east', 212, 254, -106);
  fenceEast.parent = root;
  const gate = createSign(scene, materials, 'recovery-restricted-gate', 208, -106, 0);
  gate.metadata.safetyRole = 'restricted-area-gate';
  gate.parent = root;
  const pedestrianMarkers = createPedestrianMarkers(scene, materials);
  pedestrianMarkers.parent = root;

  root.metadata.signCount = signs.length;
  root.metadata.extinguisherCount = extinguishers.length;
  root.metadata.hasEyewash = true;
  root.metadata.hasRestrictedFence = true;
  root.metadata.hasPedestrianPath = true;
  root.metadata.pedestrianMarkerCount = 18;
  return { root, signs, extinguishers, eyewash, fenceWest, fenceEast, gate, pedestrianMarkers, materials };
}
