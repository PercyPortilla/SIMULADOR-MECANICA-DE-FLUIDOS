import * as THREE from 'three';
import { getTerrainHeight, getTerrainZone, getZoneElevation } from './terrainHeight.js';
import { createIndustrialMaterial } from '../materials/industrialMaterials.js';

function box(name, size, position, material, rotationY = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.y = rotationY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function disk(name, x, z, radius, material, elevation = null) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.14, 64), material);
  mesh.name = name;
  mesh.position.set(x, (elevation ?? getTerrainHeight(x, z)) + 0.07, z);
  mesh.receiveShadow = true;
  return mesh;
}

function linedDrainSegment(name, { x, z, length, width = 0.56, rotationY = 0, material }) {
  const root = new THREE.Group();
  root.name = name;
  root.userData.receptionDrainage = true;
  root.userData.visualOnly = true;
  const groundY = getTerrainHeight(x, z);
  const bed = new THREE.Mesh(new THREE.BoxGeometry(length, 0.08, width), material);
  bed.name = `${name}-bed`;
  bed.position.set(x, groundY + 0.02, z);
  bed.rotation.y = rotationY;
  bed.receiveShadow = true;
  root.add(bed);
  [-1, 1].forEach((sign, index) => {
    const edge = new THREE.Mesh(new THREE.BoxGeometry(length, 0.14, 0.10), material.clone());
    edge.name = `${name}-edge-${index + 1}`;
    edge.position.set(0, 0.08, sign * width * 0.58);
    edge.castShadow = true;
    edge.receiveShadow = true;
    bed.add(edge);
  });
  return root;
}

function createRiprapOutlet(name, x, z, material) {
  const root = new THREE.Group();
  root.name = name;
  root.userData.visualOnly = true;
  root.userData.riprapOutlet = true;
  const geometry = new THREE.DodecahedronGeometry(1, 0);
  for (let index = 0; index < 18; index += 1) {
    const angle = index * 2.399963229728653;
    const radial = 0.35 + (index % 6) * 0.24;
    const px = x + Math.cos(angle) * radial;
    const pz = z + Math.sin(angle) * radial * 0.72;
    const size = 0.18 + (index % 4) * 0.055;
    const rock = new THREE.Mesh(geometry, material);
    rock.name = `${name}-rock-${index + 1}`;
    rock.position.set(px, getTerrainHeight(px, pz) + size * 0.42, pz);
    rock.scale.set(size * 1.25, size * 0.82, size);
    rock.rotation.set(index * 0.27, index * 0.41, index * 0.19);
    rock.castShadow = false;
    rock.receiveShadow = true;
    root.add(rock);
  }
  return root;
}


function createRoadSign(name, { x, z, rotationY = 0, code, label, accent = 0xf2b544 }) {
  const root = new THREE.Group();
  root.name = name;
  root.userData.roadSign = true;
  root.userData.code = code;
  root.userData.label = label;
  const groundY = getTerrainHeight(x, z);
  const poleMaterial = createIndustrialMaterial('darkSteel', { color: 0x4b5354, roughness: 0.72, metalness: 0.42 });
  const faceMaterial = createIndustrialMaterial('processSteel', { color: 0xe2e4df, roughness: 0.68, metalness: 0.12 });
  const accentMaterial = createIndustrialMaterial('safetyYellow', { color: accent, roughness: 0.58, metalness: 0.12 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.8, 10), poleMaterial);
  pole.position.y = 1.4;
  pole.castShadow = true;
  root.add(pole);
  const face = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.82, 0.09), faceMaterial);
  face.name = `${name}-face`;
  face.position.set(0, 2.62, 0);
  face.castShadow = true;
  root.add(face);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.17, 0.04), accentMaterial);
  stripe.name = `${name}-accent`;
  stripe.position.set(0, 2.62, -0.067);
  root.add(stripe);
  root.position.set(x, groundY, z);
  root.rotation.y = rotationY;
  return root;
}

function createMineRoadSafety() {
  const root = new THREE.Group();
  root.name = 'mine-road-safety-signage';
  const signs = [
    ['haul-road-priority-sign', { x: -142, z: -52, rotationY: -0.20, code: 'HAUL-PRIORITY', label: 'Prioridad acarreo' }],
    ['rom-speed-sign', { x: -126, z: -40, rotationY: -0.08, code: 'SPEED-15', label: '15 km/h · ROM' }],
    ['plant-access-sign', { x: -96, z: -61, rotationY: 0.03, code: 'PLANT-ACCESS', label: 'Acceso planta' }],
    ['recovery-access-sign', { x: 157, z: -72, rotationY: 0.10, code: 'RECOVERY-ACCESS', label: 'Acceso recuperación' }],
    ['heavy-equipment-warning', { x: -323, z: -55, rotationY: -0.48, code: 'HEAVY-EQUIPMENT', label: 'Equipos pesados' }],
  ];
  signs.forEach(([name, config]) => root.add(createRoadSign(name, config)));
  return root;
}

export function createCivilInfrastructure() {
  const root = new THREE.Group();
  root.name = 'civil-infrastructure';
  const road = createIndustrialMaterial('road', { color: 0x625a4d, roughness: 1 });
  const concrete = createIndustrialMaterial('concrete', { color: 0x8e918c, roughness: 0.96 });
  const retaining = createIndustrialMaterial('concrete', { color: 0x737875, roughness: 0.94 });
  const ditch = createIndustrialMaterial('darkSteel', { color: 0x575b58, metalness: 0.02, roughness: 0.95 });
  const earth = createIndustrialMaterial('terrain', { color: 0x6c5b46, roughness: 1, preserveColor: true });
  const riprap = createIndustrialMaterial('terrain', { color: 0x5f5b55, roughness: 1, metalness: 0, preserveColor: true });

  const reception = getTerrainZone('reception');
  const receptionElevation = getZoneElevation('reception');

  // V22: the authoritative terrain already contains the ROM embankment, face,
  // catch berm and toe. Do not stack a second decorative fill solid on top of
  // it; that V21-era cylinder produced visible intersections at the road tie-in.
  root.userData.receptionEarthworkSource = 'terrainHeight';

  root.add(box(
    'reception-turning-apron',
    [32, 0.14, 26],
    [reception.center[0] - 13, receptionElevation + 0.07, reception.center[1] + 1.0],
    road,
    -0.04,
  ));

  // Edge protection / wheel restraint. The dumping edge remains open toward the receiving hopper.
  [
    [reception.center[0] - 15, reception.center[1] - 12.0, 20, 0],
    [reception.center[0] - 15, reception.center[1] + 14.0, 20, 0],
    [reception.center[0] - 28.0, reception.center[1] + 1.0, 24, Math.PI / 2],
  ].forEach(([x, z, length, rotationY], index) => {
    const berm = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.75, length, 4), earth);
    berm.name = `reception-safety-berm-${index + 1}`;
    berm.rotation.z = Math.PI / 2;
    berm.rotation.y = rotationY;
    berm.position.set(x, receptionElevation + 0.72, z);
    berm.castShadow = true;
    berm.userData.designHeightM = 1.4;
    root.add(berm);
  });

  root.add(box(
    'reception-retaining-wall',
    [12.8, 2.0, 0.46],
    [-99.4, 9.25, -34.2],
    retaining,
  ));
  root.add(box('reception-retaining-wall-north', [12.8, 2.0, 0.46], [-99.4, 9.25, -25.8], retaining));
  root.add(box(
    'apron-feeder-maintenance-slab',
    [13.0, 0.14, 7.2],
    [-99.4, getTerrainHeight(-99.4, -30) + 0.07, -30],
    concrete,
  ));

  // Dedicated ROM drainage is deliberately outside the heavy-truck wheel paths.
  // These visible lined channels complement, rather than replace, the terrain
  // authority used by ROAD-01 and the equipment foundations.
  root.add(linedDrainSegment('reception-lined-drain-south-east', {
    x: -94.0, z: -50.0, length: 20.0, width: 0.56, rotationY: 0.02, material: ditch,
  }));
  root.add(linedDrainSegment('reception-lined-drain-north', {
    x: -111.5, z: -9.0, length: 31.0, width: 0.50, rotationY: -0.01, material: ditch,
  }));
  root.add(createRiprapOutlet('reception-riprap-outlet', -83.6, -50.2, riprap));

  const process = getTerrainZone('process');
  const processY = getZoneElevation('process') + 0.07;
  root.add(box('process-drain-north', [process.size[0] - 10, 0.12, 0.42], [process.center[0], processY, process.center[1] - process.size[1] / 2 + 1.2], ditch));
  root.add(box('process-drain-south', [process.size[0] - 10, 0.12, 0.42], [process.center[0], processY, process.center[1] + process.size[1] / 2 - 1.2], ditch));

  const leaching = getTerrainZone('leaching');
  root.add(box('leaching-drain', [leaching.size[0] - 8, 0.12, 0.40], [leaching.center[0], getZoneElevation('leaching') + 0.07, leaching.center[1] + leaching.size[1] / 2 - 1.1], ditch));

  const recovery = getTerrainZone('recovery');
  root.add(disk('recovery-service-apron', recovery.center[0] + recovery.size[0] * 0.37, recovery.center[1] + recovery.size[1] * 0.32, 8.5, road));
  root.add(box('recovery-drain', [recovery.size[0] - 8, 0.10, 0.36], [recovery.center[0], getZoneElevation('recovery') + 0.07, recovery.center[1] - recovery.size[1] / 2 + 1.1], ditch));

  // Two compact pedestrian concrete strips, separate from heavy-vehicle routes.
  root.add(box('process-pedestrian-strip', [92, 0.12, 1.5], [110, processY + 0.03, 18], concrete));
  root.add(box('leaching-pedestrian-strip', [58, 0.12, 1.5], [207, getZoneElevation('leaching') + 0.12, 43], concrete));

  root.add(createMineRoadSafety());

  return root;
}
