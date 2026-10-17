import * as THREE from 'three';
import { getTerrainHeight } from '../environment/terrainHeight.js';
import { createIndustrialMaterial } from '../materials/industrialMaterials.js';

function addBox(group, name, size, position, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function createTransformerYard() {
  const root = new THREE.Group();
  root.name = 'v24-transformer-yard';
  root.userData.infrastructureRole = 'electrical-substation';
  root.userData.visualOnly = true;
  const x = 118; const z = -84; const y = getTerrainHeight(x, z);
  root.userData.centerXZ = [x, z];
  const concrete = createIndustrialMaterial('concrete');
  const steel = createIndustrialMaterial('structuralSteel');
  const process = createIndustrialMaterial('processSteel');
  const safety = createIndustrialMaterial('safetyYellow');
  addBox(root, 'transformer-yard-pad', [13.5, 0.18, 8.8], [x, y + 0.09, z], concrete);

  [-3.1, 3.1].forEach((offset, index) => {
    const body = addBox(root, `transformer-${index + 1}-body`, [3.4, 2.45, 2.4], [x + offset, y + 1.45, z], process.clone());
    body.userData.electricalEquipment = true;
    for (let fin = -3; fin <= 3; fin += 1) {
      addBox(root, `transformer-${index + 1}-fin-${fin + 4}`, [0.08, 1.72, 2.65], [x + offset + fin * 0.38, y + 1.45, z], steel.clone());
    }
    for (const dz of [-0.65, 0, 0.65]) {
      const insulator = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.10, 0.65, 12), safety.clone());
      insulator.name = `transformer-${index + 1}-insulator-${dz}`;
      insulator.position.set(x + offset, y + 3.02, z + dz);
      root.add(insulator);
    }
  });
  addBox(root, 'transformer-switchgear-kiosk', [3.6, 2.5, 2.2], [x, y + 1.34, z + 3.0], steel.clone());
  return root;
}

function createWorkshop() {
  const root = new THREE.Group();
  root.name = 'v24-maintenance-workshop';
  root.userData.infrastructureRole = 'maintenance-workshop';
  root.userData.visualOnly = true;
  const x = 50; const z = -84; const y = getTerrainHeight(x, z);
  root.userData.centerXZ = [x, z];
  const concrete = createIndustrialMaterial('concrete');
  const wall = createIndustrialMaterial('processSteel', { color: 0x9ca6a4, roughness: 0.68, metalness: 0.18 });
  const roof = createIndustrialMaterial('structuralSteel');
  const dark = createIndustrialMaterial('darkSteel');
  addBox(root, 'workshop-pad', [17, 0.20, 11], [x, y + 0.10, z], concrete);
  addBox(root, 'workshop-shell', [14.5, 4.8, 8.6], [x, y + 2.5, z], wall);
  addBox(root, 'workshop-roof', [15.2, 0.24, 9.2], [x, y + 4.96, z], roof);
  addBox(root, 'workshop-bay-door', [4.6, 3.5, 0.12], [x - 3.3, y + 1.85, z - 4.34], dark);
  addBox(root, 'workshop-personnel-door', [1.2, 2.35, 0.12], [x + 4.7, y + 1.25, z - 4.34], dark.clone());
  addBox(root, 'workshop-service-bench', [3.6, 0.9, 0.8], [x + 3.5, y + 0.55, z + 3.5], dark.clone());
  return root;
}

function createCableTray() {
  const root = new THREE.Group();
  root.name = 'v24-electrical-cable-tray';
  root.userData.infrastructureRole = 'cable-tray';
  root.userData.visualOnly = true;
  const steel = createIndustrialMaterial('darkSteel');
  const z = -84;
  const startX = 82;
  const endX = 110;
  for (const side of [-1, 1]) {
    const mesh = addBox(root, `cable-tray-rail-${side < 0 ? 'a' : 'b'}`, [endX - startX, 0.12, 0.08], [(startX + endX) / 2, getTerrainHeight((startX + endX) / 2, z) + 3.0, z + side * 0.42], steel.clone());
    mesh.castShadow = false;
  }
  for (let index = 0; index <= 14; index += 1) {
    const x = THREE.MathUtils.lerp(startX, endX, index / 14);
    const rung = addBox(root, `cable-tray-rung-${index + 1}`, [0.07, 0.08, 0.92], [x, getTerrainHeight(x, z) + 3.0, z], steel.clone());
    rung.castShadow = false;
  }
  for (const x of [84, 94, 104, 110]) {
    addBox(root, `cable-tray-support-${x}`, [0.10, 3.0, 0.10], [x, getTerrainHeight(x, z) + 1.5, z], steel.clone());
  }
  root.userData.centerXZ = [(startX + endX) / 2, z];
  return root;
}

function createPickup() {
  const root = new THREE.Group();
  root.name = 'v24-supervision-pickup';
  root.userData.infrastructureRole = 'supervision-vehicle';
  root.userData.visualOnly = true;
  const x = 56; const z = -78; const y = getTerrainHeight(x, z);
  root.position.set(x, y, z);
  root.rotation.y = -0.28;
  root.userData.centerXZ = [x, z];
  const body = createIndustrialMaterial('processSteel');
  const dark = createIndustrialMaterial('darkSteel');
  addBox(root, 'pickup-chassis', [4.6, 0.45, 1.85], [0, 0.72, 0], dark);
  addBox(root, 'pickup-cab', [2.1, 1.35, 1.75], [0.75, 1.38, 0], body);
  addBox(root, 'pickup-bed', [1.9, 0.72, 1.72], [-1.45, 1.0, 0], body.clone());
  const tire = createIndustrialMaterial('tire');
  for (const [px, pz] of [[1.35, -0.95], [1.35, 0.95], [-1.45, -0.95], [-1.45, 0.95]]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.26, 20), tire.clone());
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(px, 0.44, pz);
    wheel.castShadow = true;
    root.add(wheel);
  }
  return root;
}

function createHuman(name, x, z, rotationY = 0) {
  const root = new THREE.Group();
  root.name = name;
  root.userData.infrastructureRole = 'human-scale-reference';
  root.userData.visualOnly = true;
  const y = getTerrainHeight(x, z);
  root.position.set(x, y, z);
  root.rotation.y = rotationY;
  root.userData.referenceHeightM = 1.75;
  root.userData.centerXZ = [x, z];
  const vest = createIndustrialMaterial('safetyYellow');
  const trouser = createIndustrialMaterial('darkSteel');
  const skin = new THREE.MeshStandardMaterial({ color: 0xb88362, roughness: 0.85 });
  const legs = addBox(root, `${name}-legs`, [0.36, 0.72, 0.28], [0, 0.36, 0], trouser);
  legs.castShadow = true;
  const torso = addBox(root, `${name}-vest`, [0.48, 0.68, 0.30], [0, 1.05, 0], vest);
  torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), skin);
  head.name = `${name}-head`;
  head.position.y = 1.58;
  head.castShadow = true;
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), vest.clone());
  helmet.name = `${name}-helmet`;
  helmet.position.y = 1.69;
  root.add(head, helmet);
  return root;
}

export function createIndustrialInfrastructure() {
  const root = new THREE.Group();
  root.name = 'v24-industrial-infrastructure';
  root.userData.visualOnly = true;
  root.userData.v24IndustrialInfrastructure = true;
  const assets = [
    createTransformerYard(),
    createWorkshop(),
    createCableTray(),
    createPickup(),
    createHuman('v24-human-scale-workshop', 62, -80, 0.4),
  ];
  assets.forEach((asset) => root.add(asset));
  root.userData.assetCount = assets.length;
  root.userData.reusesExistingControlBuilding = true;
  root.userData.reusesExistingLightingPoles = true;
  return root;
}
