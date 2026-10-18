import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { CreatePolyhedron } from '@babylonjs/core/Meshes/Builders/polyhedronBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { getTerrainHeight, getTerrainZone, getZoneElevation } from '../../scene/environment/terrainHeight.js';

function requireRightHandedScene(scene) {
  if (!scene) throw new TypeError('Babylon civil infrastructure requires a Scene.');
  if (scene.useRightHandedSystem !== true) {
    throw new Error('Babylon civil infrastructure requires scene.useRightHandedSystem = true.');
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
  result.specularColor = new Color3(0.03, 0.03, 0.03);
  result.specularPower = 4;
  return result;
}

function addBox(root, scene, name, size, position, meshMaterial, rotationY = 0, metadata = {}) {
  const mesh = CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, scene);
  mesh.position.set(position[0], position[1], position[2]);
  mesh.rotation.y = rotationY;
  mesh.material = meshMaterial;
  mesh.receiveShadows = true;
  mesh.metadata = {
    dimensionsM: [...size],
    rotationY,
    coordinateSystem: 'right-handed',
    ...metadata,
  };
  mesh.parent = root;
  return mesh;
}

function addDisk(root, scene, name, x, z, radius, meshMaterial, elevation = null) {
  const mesh = CreateCylinder(name, {
    diameter: radius * 2,
    height: 0.14,
    tessellation: 64,
  }, scene);
  mesh.position.set(x, (elevation ?? getTerrainHeight(x, z)) + 0.07, z);
  mesh.material = meshMaterial;
  mesh.receiveShadows = true;
  mesh.metadata = {
    radiusM: radius,
    heightM: 0.14,
    terrainHeightSource: elevation == null ? 'getTerrainHeight' : 'explicit-elevation',
    coordinateSystem: 'right-handed',
  };
  mesh.parent = root;
  return mesh;
}

function addLinedDrain(root, scene, name, { x, z, length, width = 0.56, rotationY = 0, material: drainMaterial }) {
  const drainRoot = new TransformNode(name, scene);
  drainRoot.parent = root;
  drainRoot.metadata = {
    receptionDrainage: true,
    visualOnly: true,
    lengthM: length,
    widthM: width,
    terrainHeightSource: 'getTerrainHeight',
    coordinateSystem: 'right-handed',
  };
  const groundY = getTerrainHeight(x, z);
  const bed = CreateBox(`${name}-bed`, { width: length, height: 0.08, depth: width }, scene);
  bed.position.set(x, groundY + 0.02, z);
  bed.rotation.y = rotationY;
  bed.material = drainMaterial;
  bed.receiveShadows = true;
  bed.metadata = { dimensionsM: [length, 0.08, width], rotationY };
  bed.parent = drainRoot;
  [-1, 1].forEach((sign, index) => {
    const edge = CreateBox(`${name}-edge-${index + 1}`, {
      width: length,
      height: 0.14,
      depth: 0.10,
    }, scene);
    edge.position.set(0, 0.08, sign * width * 0.58);
    edge.material = drainMaterial;
    edge.receiveShadows = true;
    edge.metadata = { dimensionsM: [length, 0.14, 0.10], localToBed: true };
    edge.parent = bed;
  });
  return drainRoot;
}

function addRiprapOutlet(root, scene, name, x, z, riprapMaterial) {
  const outlet = new TransformNode(name, scene);
  outlet.parent = root;
  outlet.metadata = { visualOnly: true, riprapOutlet: true, coordinateSystem: 'right-handed' };
  for (let index = 0; index < 18; index += 1) {
    const angle = index * 2.399963229728653;
    const radial = 0.35 + (index % 6) * 0.24;
    const px = x + Math.cos(angle) * radial;
    const pz = z + Math.sin(angle) * radial * 0.72;
    const size = 0.18 + (index % 4) * 0.055;
    const rock = CreatePolyhedron(`${name}-rock-${index + 1}`, { type: 2, size: 1 }, scene);
    rock.position.set(px, getTerrainHeight(px, pz) + size * 0.42, pz);
    rock.scaling.set(size * 1.25, size * 0.82, size);
    rock.rotation.set(index * 0.27, index * 0.41, index * 0.19);
    rock.material = riprapMaterial;
    rock.receiveShadows = true;
    rock.isPickable = false;
    rock.parent = outlet;
  }
  return outlet;
}

function addRoadSign(root, scene, name, { x, z, rotationY = 0, code, label, accent = 0xf2b544 }, materials) {
  const sign = new TransformNode(name, scene);
  sign.position.set(x, getTerrainHeight(x, z), z);
  sign.rotation.y = rotationY;
  sign.metadata = { roadSign: true, code, label, terrainHeightSource: 'getTerrainHeight' };
  sign.parent = root;

  const pole = CreateCylinder(`${name}-pole`, {
    diameterTop: 0.14,
    diameterBottom: 0.18,
    height: 2.8,
    tessellation: 10,
  }, scene);
  pole.position.y = 1.4;
  pole.material = materials.pole;
  pole.parent = sign;

  const face = CreateBox(`${name}-face`, { width: 1.45, height: 0.82, depth: 0.09 }, scene);
  face.position.set(0, 2.62, 0);
  face.material = materials.face;
  face.parent = sign;

  const stripeMaterial = material(scene, `${name}-accent-material`, accent);
  const stripe = CreateBox(`${name}-accent`, { width: 1.12, height: 0.17, depth: 0.04 }, scene);
  stripe.position.set(0, 2.62, -0.067);
  stripe.material = stripeMaterial;
  stripe.parent = sign;
  return sign;
}

function addMineRoadSafety(root, scene) {
  const safety = new TransformNode('mine-road-safety-signage', scene);
  safety.parent = root;
  const materials = {
    pole: material(scene, 'civil-sign-pole-material', 0x4b5354),
    face: material(scene, 'civil-sign-face-material', 0xe2e4df),
  };
  const signs = [
    ['haul-road-priority-sign', { x: -142, z: -52, rotationY: -0.20, code: 'HAUL-PRIORITY', label: 'Prioridad acarreo' }],
    ['rom-speed-sign', { x: -126, z: -40, rotationY: -0.08, code: 'SPEED-15', label: '15 km/h · ROM' }],
    ['plant-access-sign', { x: -96, z: -61, rotationY: 0.03, code: 'PLANT-ACCESS', label: 'Acceso planta' }],
    ['recovery-access-sign', { x: 157, z: -72, rotationY: 0.10, code: 'RECOVERY-ACCESS', label: 'Acceso recuperación' }],
    ['heavy-equipment-warning', { x: -323, z: -55, rotationY: -0.48, code: 'HEAVY-EQUIPMENT', label: 'Equipos pesados' }],
  ];
  signs.forEach(([name, config]) => addRoadSign(safety, scene, name, config, materials));
  return safety;
}

export function createBabylonCivilInfrastructure({ scene } = {}) {
  requireRightHandedScene(scene);
  const root = new TransformNode('civil-infrastructure', scene);
  root.metadata = {
    receptionEarthworkSource: 'terrainHeight',
    coordinateSystem: 'right-handed',
    worldUnitsPerMeter: 1,
  };

  const materials = {
    road: material(scene, 'civil-road-material', 0x625a4d),
    concrete: material(scene, 'civil-concrete-material', 0x8e918c),
    retaining: material(scene, 'civil-retaining-material', 0x737875),
    ditch: material(scene, 'civil-ditch-material', 0x575b58),
    earth: material(scene, 'civil-earth-material', 0x6c5b46),
    riprap: material(scene, 'civil-riprap-material', 0x5f5b55),
  };

  const reception = getTerrainZone('reception');
  const receptionElevation = getZoneElevation('reception');
  addBox(root, scene, 'reception-turning-apron', [32, 0.14, 26], [
    reception.center[0] - 13,
    receptionElevation + 0.07,
    reception.center[1] + 1.0,
  ], materials.road, -0.04, { civilRole: 'heavy-vehicle-turning-apron' });

  [
    [reception.center[0] - 15, reception.center[1] - 12.0, 20, 0],
    [reception.center[0] - 15, reception.center[1] + 14.0, 20, 0],
    [reception.center[0] - 28.0, reception.center[1] + 1.0, 24, Math.PI / 2],
  ].forEach(([x, z, length, rotationY], index) => {
    const berm = CreateCylinder(`reception-safety-berm-${index + 1}`, {
      diameterTop: 0.76,
      diameterBottom: 1.50,
      height: length,
      tessellation: 4,
    }, scene);
    berm.rotation.z = Math.PI / 2;
    berm.rotation.y = rotationY;
    berm.position.set(x, receptionElevation + 0.72, z);
    berm.material = materials.earth;
    berm.metadata = {
      designHeightM: 1.4,
      lengthM: length,
      rotationY,
      coordinateSystem: 'right-handed',
    };
    berm.parent = root;
  });

  addBox(root, scene, 'reception-retaining-wall', [12.8, 2.0, 0.46], [-99.4, 9.25, -34.2], materials.retaining);
  addBox(root, scene, 'reception-retaining-wall-north', [12.8, 2.0, 0.46], [-99.4, 9.25, -25.8], materials.retaining);
  addBox(root, scene, 'apron-feeder-maintenance-slab', [13.0, 0.14, 7.2], [
    -99.4,
    getTerrainHeight(-99.4, -30) + 0.07,
    -30,
  ], materials.concrete, 0, { terrainHeightSource: 'getTerrainHeight' });

  addLinedDrain(root, scene, 'reception-lined-drain-south-east', {
    x: -94.0, z: -50.0, length: 20.0, width: 0.56, rotationY: 0.02, material: materials.ditch,
  });
  addLinedDrain(root, scene, 'reception-lined-drain-north', {
    x: -111.5, z: -9.0, length: 31.0, width: 0.50, rotationY: -0.01, material: materials.ditch,
  });
  addRiprapOutlet(root, scene, 'reception-riprap-outlet', -83.6, -50.2, materials.riprap);

  const process = getTerrainZone('process');
  const processY = getZoneElevation('process') + 0.07;
  addBox(root, scene, 'process-drain-north', [process.size[0] - 10, 0.12, 0.42], [
    process.center[0], processY, process.center[1] - process.size[1] / 2 + 1.2,
  ], materials.ditch);
  addBox(root, scene, 'process-drain-south', [process.size[0] - 10, 0.12, 0.42], [
    process.center[0], processY, process.center[1] + process.size[1] / 2 - 1.2,
  ], materials.ditch);

  const leaching = getTerrainZone('leaching');
  addBox(root, scene, 'leaching-drain', [leaching.size[0] - 8, 0.12, 0.40], [
    leaching.center[0],
    getZoneElevation('leaching') + 0.07,
    leaching.center[1] + leaching.size[1] / 2 - 1.1,
  ], materials.ditch);

  const recovery = getTerrainZone('recovery');
  addDisk(
    root,
    scene,
    'recovery-service-apron',
    recovery.center[0] + recovery.size[0] * 0.37,
    recovery.center[1] + recovery.size[1] * 0.32,
    8.5,
    materials.road,
  );
  addBox(root, scene, 'recovery-drain', [recovery.size[0] - 8, 0.10, 0.36], [
    recovery.center[0],
    getZoneElevation('recovery') + 0.07,
    recovery.center[1] - recovery.size[1] / 2 + 1.1,
  ], materials.ditch);

  addBox(root, scene, 'process-pedestrian-strip', [92, 0.12, 1.5], [110, processY + 0.03, 18], materials.concrete);
  addBox(root, scene, 'leaching-pedestrian-strip', [58, 0.12, 1.5], [
    207, getZoneElevation('leaching') + 0.12, 43,
  ], materials.concrete);
  addMineRoadSafety(root, scene);

  return { root, materials };
}
