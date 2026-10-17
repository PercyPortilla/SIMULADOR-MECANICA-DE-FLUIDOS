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
  const earth = createIndustrialMaterial('terrain', { color: 0x6c5b46, roughness: 1 });

  const reception = getTerrainZone('reception');
  const receptionElevation = getZoneElevation('reception');

  // Compact ROM earthwork: enough for the truck dump approach without turning
  // the complete reception zone into one oversized geometric platform.
  const fillHeight = 4.2;
  const fillCenterX = reception.center[0] - 8;
  const fillWidth = 34;
  const fillDepth = 28;
  const fill = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.28, fillHeight, 8, 1, false), earth);
  fill.name = 'reception-engineered-embankment';
  fill.rotation.y = Math.PI / 8;
  fill.scale.set(fillWidth / 2, 1, fillDepth / 2);
  fill.position.set(fillCenterX, receptionElevation - fillHeight / 2 + 0.05, reception.center[1]);
  fill.castShadow = true;
  fill.receiveShadow = true;
  root.add(fill);

  root.add(box(
    'reception-turning-apron',
    [23, 0.14, 18],
    [reception.center[0] - 14, receptionElevation + 0.07, reception.center[1] + 1.5],
    road,
    -0.06,
  ));

  // Edge protection / wheel restraint. The dumping edge remains open toward the receiving hopper.
  [
    [reception.center[0] - 15, reception.center[1] - 9.0, 14, 0],
    [reception.center[0] - 15, reception.center[1] + 9.0, 14, 0],
    [reception.center[0] - 21.5, reception.center[1], 17, Math.PI / 2],
  ].forEach(([x, z, length, rotationY], index) => {
    const berm = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 1.35, length, 4), earth);
    berm.name = `reception-safety-berm-${index + 1}`;
    berm.rotation.z = Math.PI / 2;
    berm.rotation.y = rotationY;
    berm.position.set(x, receptionElevation + 0.65, z);
    berm.castShadow = true;
    root.add(berm);
  });

  root.add(box(
    'reception-retaining-wall',
    [24, 2.4, 0.55],
    [reception.center[0] - 2, receptionElevation - 1.0, reception.center[1] + 11],
    retaining,
  ));

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
