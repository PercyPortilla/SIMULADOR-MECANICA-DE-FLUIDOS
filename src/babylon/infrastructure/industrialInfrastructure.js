import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { getTerrainHeight } from '../../scene/environment/terrainHeight.js';

function requireRightHandedScene(scene) {
  if (!scene) throw new TypeError('Babylon industrial infrastructure requires a Scene.');
  if (scene.useRightHandedSystem !== true) {
    throw new Error('Babylon industrial infrastructure requires scene.useRightHandedSystem = true.');
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
  const result = new StandardMaterial(name, scene);
  result.diffuseColor = colorFromHex(hex);
  result.specularColor = new Color3(0.035, 0.035, 0.03);
  result.specularPower = 5;
  result.alpha = alpha;
  if (alpha < 1) result.disableDepthWrite = true;
  if (emissive != null) result.emissiveColor = colorFromHex(emissive);
  return result;
}

function addBox(root, scene, name, size, position, material) {
  const mesh = CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, scene);
  mesh.position.set(...position);
  mesh.material = material;
  mesh.receiveShadows = true;
  mesh.metadata = {
    dimensionsM: [...size],
    coordinateSystem: 'right-handed',
  };
  mesh.parent = root;
  return mesh;
}

function addCylinder(root, scene, name, {
  radiusTop,
  radiusBottom,
  height,
  tessellation,
  position,
  rotation = [0, 0, 0],
  material,
  metadata = {},
}) {
  const mesh = CreateCylinder(name, {
    diameterTop: radiusTop * 2,
    diameterBottom: radiusBottom * 2,
    height,
    tessellation,
  }, scene);
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.material = material;
  mesh.receiveShadows = true;
  mesh.metadata = {
    radiusTopM: radiusTop,
    radiusBottomM: radiusBottom,
    heightM: height,
    tessellation,
    coordinateSystem: 'right-handed',
    ...metadata,
  };
  mesh.parent = root;
  return mesh;
}

function createTransformerYard(scene, materials) {
  const root = new TransformNode('v24-transformer-yard', scene);
  root.metadata = {
    infrastructureRole: 'electrical-substation',
    visualOnly: true,
    centerXZ: [118, -84],
    v28SubstationDetail: true,
  };
  const x = 118;
  const z = -84;
  const y = getTerrainHeight(x, z);

  addBox(root, scene, 'transformer-yard-pad', [13.5, 0.18, 8.8], [x, y + 0.09, z], materials.concrete);
  const stain = CreateDisc('transformer-yard-oil-weathering', { radius: 2.6, tessellation: 24 }, scene);
  stain.rotation.x = -Math.PI / 2;
  stain.scaling.set(1.65, 0.72, 1);
  stain.position.set(x - 0.6, y + 0.195, z - 0.35);
  stain.material = materials.stain;
  stain.receiveShadows = true;
  stain.metadata = {
    radiusM: 2.6,
    tessellation: 24,
    scale: [1.65, 0.72, 1],
    visualOnly: true,
  };
  stain.parent = root;

  [-3.1, 3.1].forEach((offset, index) => {
    const body = addBox(
      root,
      scene,
      `transformer-${index + 1}-body`,
      [3.4, 2.45, 2.4],
      [x + offset, y + 1.45, z],
      materials.process,
    );
    body.metadata.electricalEquipment = true;
    for (let fin = -3; fin <= 3; fin += 1) {
      addBox(
        root,
        scene,
        `transformer-${index + 1}-fin-${fin + 4}`,
        [0.08, 1.72, 2.65],
        [x + offset + fin * 0.38, y + 1.45, z],
        materials.steel,
      );
    }
    for (const dz of [-0.65, 0, 0.65]) {
      addCylinder(root, scene, `transformer-${index + 1}-insulator-${dz}`, {
        radiusTop: 0.08,
        radiusBottom: 0.10,
        height: 0.65,
        tessellation: 12,
        position: [x + offset, y + 3.02, z + dz],
        material: materials.safety,
      });
    }
  });
  addBox(root, scene, 'transformer-switchgear-kiosk', [3.6, 2.5, 2.2], [x, y + 1.34, z + 3.0], materials.steel);

  for (const side of [-1, 1]) {
    addBox(root, scene, `transformer-bund-x-${side}`, [12.6, 0.28, 0.20], [x, y + 0.24, z + side * 3.75], materials.concrete);
    addBox(root, scene, `transformer-bund-z-${side}`, [0.20, 0.28, 7.3], [x + side * 5.85, y + 0.24, z], materials.concrete);
  }

  const fencePosts = [];
  for (let px = -5.8; px <= 5.8; px += 1.95) {
    fencePosts.push([x + px, z - 4.05], [x + px, z + 4.05]);
  }
  for (let pz = -2.2; pz <= 2.2; pz += 1.45) {
    fencePosts.push([x - 6.2, z + pz], [x + 6.2, z + pz]);
  }
  fencePosts.forEach(([px, pz], index) => {
    addBox(
      root,
      scene,
      `transformer-fence-post-${index + 1}`,
      [0.07, 1.75, 0.07],
      [px, y + 0.96, pz],
      materials.fence,
    );
  });
  for (const dz of [-4.05, 4.05]) {
    addBox(
      root,
      scene,
      `transformer-fence-rail-x-${dz > 0 ? 'n' : 's'}`,
      [12.4, 0.07, 0.07],
      [x, y + 1.48, z + dz],
      materials.fence,
    );
  }
  for (const dx of [-6.2, 6.2]) {
    addBox(
      root,
      scene,
      `transformer-fence-rail-z-${dx > 0 ? 'e' : 'w'}`,
      [0.07, 0.07, 8.1],
      [x + dx, y + 1.48, z],
      materials.fence,
    );
  }
  return root;
}

function createWorkshop(scene, materials) {
  const root = new TransformNode('v24-maintenance-workshop', scene);
  root.metadata = {
    infrastructureRole: 'maintenance-workshop',
    visualOnly: true,
    centerXZ: [50, -84],
    v28Weathered: true,
  };
  const x = 50;
  const z = -84;
  const y = getTerrainHeight(x, z);
  addBox(root, scene, 'workshop-pad', [17, 0.20, 11], [x, y + 0.10, z], materials.concrete);
  addBox(root, scene, 'workshop-shell', [14.5, 4.8, 8.6], [x, y + 2.5, z], materials.workshopWall);
  addBox(root, scene, 'workshop-roof', [15.2, 0.24, 9.2], [x, y + 4.96, z], materials.steel);
  addBox(root, scene, 'workshop-bay-door', [4.6, 3.5, 0.12], [x - 3.3, y + 1.85, z - 4.34], materials.dark);
  addBox(root, scene, 'workshop-personnel-door', [1.2, 2.35, 0.12], [x + 4.7, y + 1.25, z - 4.34], materials.dark);
  addBox(root, scene, 'workshop-service-bench', [3.6, 0.9, 0.8], [x + 3.5, y + 0.55, z + 3.5], materials.dark);
  addBox(root, scene, 'workshop-dust-skirt', [14.72, 0.34, 8.82], [x, y + 0.27, z], materials.grime);
  return root;
}

function createCableTray(scene, materials) {
  const root = new TransformNode('v24-electrical-cable-tray', scene);
  root.metadata = {
    infrastructureRole: 'cable-tray',
    visualOnly: true,
    centerXZ: [96, -84],
  };
  const z = -84;
  const startX = 82;
  const endX = 110;
  for (const side of [-1, 1]) {
    addBox(
      root,
      scene,
      `cable-tray-rail-${side < 0 ? 'a' : 'b'}`,
      [endX - startX, 0.12, 0.08],
      [(startX + endX) / 2, getTerrainHeight((startX + endX) / 2, z) + 3.0, z + side * 0.42],
      materials.dark,
    );
  }
  for (let index = 0; index <= 14; index += 1) {
    const x = startX + (endX - startX) * (index / 14);
    addBox(
      root,
      scene,
      `cable-tray-rung-${index + 1}`,
      [0.07, 0.08, 0.92],
      [x, getTerrainHeight(x, z) + 3.0, z],
      materials.dark,
    );
  }
  for (const x of [84, 94, 104, 110]) {
    addBox(
      root,
      scene,
      `cable-tray-support-${x}`,
      [0.10, 3.0, 0.10],
      [x, getTerrainHeight(x, z) + 1.5, z],
      materials.dark,
    );
  }
  return root;
}

function createPickup(scene, materials, name = 'v24-supervision-pickup', x = 56, z = -78, rotationY = -0.28) {
  const root = new TransformNode(name, scene);
  const y = getTerrainHeight(x, z);
  root.position.set(x, y, z);
  root.rotation.y = rotationY;
  root.metadata = {
    infrastructureRole: 'supervision-vehicle',
    visualOnly: true,
    centerXZ: [x, z],
    terrainHeightSource: 'getTerrainHeight',
  };
  addBox(root, scene, 'pickup-chassis', [4.6, 0.45, 1.85], [0, 0.72, 0], materials.dark);
  addBox(root, scene, 'pickup-cab', [2.1, 1.35, 1.75], [0.75, 1.38, 0], materials.process);
  addBox(root, scene, 'pickup-bed', [1.9, 0.72, 1.72], [-1.45, 1.0, 0], materials.process);
  for (const [px, pz] of [[1.35, -0.95], [1.35, 0.95], [-1.45, -0.95], [-1.45, 0.95]]) {
    const wheel = addCylinder(root, scene, '', {
      radiusTop: 0.42,
      radiusBottom: 0.42,
      height: 0.26,
      tessellation: 20,
      position: [px, 0.44, pz],
      rotation: [Math.PI / 2, 0, 0],
      material: materials.tire,
    });
    wheel.metadata.pickupWheel = true;
  }
  return root;
}

function createHuman(scene, materials, name, x, z, rotationY = 0) {
  const root = new TransformNode(name, scene);
  const y = getTerrainHeight(x, z);
  root.position.set(x, y, z);
  root.rotation.y = rotationY;
  root.metadata = {
    infrastructureRole: 'human-scale-reference',
    visualOnly: true,
    referenceHeightM: 1.75,
    centerXZ: [x, z],
    terrainHeightSource: 'getTerrainHeight',
  };
  addBox(root, scene, `${name}-legs`, [0.36, 0.72, 0.28], [0, 0.36, 0], materials.dark);
  addBox(root, scene, `${name}-vest`, [0.48, 0.68, 0.30], [0, 1.05, 0], materials.safety);
  const head = CreateSphere(`${name}-head`, { diameter: 0.28, segments: 14 }, scene);
  head.position.y = 1.58;
  head.material = materials.skin;
  head.metadata = { radiusM: 0.14, widthSegments: 14, heightSegments: 10 };
  head.parent = root;
  const helmet = CreateSphere(`${name}-helmet`, { diameter: 0.32, segments: 14, slice: 0.5 }, scene);
  helmet.position.y = 1.69;
  helmet.material = materials.safety;
  helmet.metadata = {
    radiusM: 0.16,
    widthSegments: 14,
    heightSegments: 8,
    hemisphere: true,
  };
  helmet.parent = root;
  return root;
}

export function createBabylonIndustrialInfrastructure({ scene } = {}) {
  requireRightHandedScene(scene);
  const root = new TransformNode('v24-industrial-infrastructure', scene);
  root.metadata = {
    visualOnly: true,
    v24IndustrialInfrastructure: true,
    reusesExistingControlBuilding: true,
    reusesExistingLightingPoles: true,
    v28RealismInfrastructure: true,
    coordinateSystem: 'right-handed',
    worldUnitsPerMeter: 1,
    terrainHeightSource: 'getTerrainHeight',
    v30Source: 'industrial infrastructure V30',
  };

  const materials = {
    concrete: createMaterial(scene, 'industrial-infra-concrete', 0x929691),
    steel: createMaterial(scene, 'industrial-infra-structural-steel', 0x697679),
    process: createMaterial(scene, 'industrial-infra-process-steel', 0xaeb5b3),
    safety: createMaterial(scene, 'industrial-infra-safety-yellow', 0xf2b544),
    fence: createMaterial(scene, 'industrial-infra-fence', 0x50595a),
    stain: createMaterial(scene, 'industrial-infra-stain', 0x574a3f, { alpha: 0.32 }),
    workshopWall: createMaterial(scene, 'industrial-infra-workshop-wall', 0x9ca6a4),
    dark: createMaterial(scene, 'industrial-infra-dark-steel', 0x495257),
    grime: createMaterial(scene, 'industrial-infra-grime', 0x695a4a, { alpha: 0.24 }),
    tire: createMaterial(scene, 'industrial-infra-tire', 0x1c1e1f),
    skin: createMaterial(scene, 'industrial-infra-skin', 0xb88362),
  };

  const assets = [
    createTransformerYard(scene, materials),
    createWorkshop(scene, materials),
    createCableTray(scene, materials),
    createPickup(scene, materials),
    createPickup(scene, materials, 'v28-utility-pickup', 105, -111, 0.18),
    createHuman(scene, materials, 'v24-human-scale-workshop', 62, -80, 0.4),
    createHuman(scene, materials, 'v28-human-scale-transformer', 109, -79, -0.35),
    createHuman(scene, materials, 'v28-human-scale-mcc', 113, -110, 0.25),
    createHuman(scene, materials, 'v28-human-scale-workshop-2', 42, -80, -0.2),
  ];
  assets.forEach((asset) => { asset.parent = root; });
  root.metadata.assetCount = assets.length;
  root.metadata.humanScaleCount = assets.filter((asset) => asset.metadata.infrastructureRole === 'human-scale-reference').length;
  root.metadata.lightVehicleCount = assets.filter((asset) => asset.metadata.infrastructureRole === 'supervision-vehicle').length;
  return { root, assets, materials };
}
