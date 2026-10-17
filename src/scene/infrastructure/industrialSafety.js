import * as THREE from 'three';
import { getTerrainHeight } from '../environment/terrainHeight.js';
import { createIndustrialMaterial } from '../materials/industrialMaterials.js';

function grounded(x, z, lift = 0) {
  return new THREE.Vector3(x, getTerrainHeight(x, z) + lift, z);
}

function createSign(name, x, z, rotationY = 0) {
  const group = new THREE.Group();
  group.name = name;
  group.position.copy(grounded(x, z));
  group.rotation.y = rotationY;
  group.userData.safetyRole = 'warning-sign';
  group.userData.visualOnly = true;
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.8, 0.08), createIndustrialMaterial('structuralSteel'));
  post.position.y = 0.9;
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.58, 0.045), new THREE.MeshStandardMaterial({ color: 0xd6a126, roughness: 0.52, metalness: 0.08 }));
  plate.name = `${name}-warning-plate`;
  plate.position.y = 1.62;
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.08, 0.052), new THREE.MeshStandardMaterial({ color: 0x3c4142, roughness: 0.65 }));
  stripe.position.set(0, 1.62, 0.025);
  group.add(post, plate, stripe);
  return group;
}

function createExtinguisher(name, x, z) {
  const group = new THREE.Group();
  group.name = name;
  group.position.copy(grounded(x, z));
  group.userData.safetyRole = 'fire-extinguisher';
  group.userData.visualOnly = true;
  const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.55, 18), new THREE.MeshStandardMaterial({ color: 0xb83b31, roughness: 0.48, metalness: 0.15 }));
  bottle.position.y = 0.36;
  bottle.castShadow = true;
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.07, 0.07), createIndustrialMaterial('structuralSteel'));
  handle.position.y = 0.69;
  const backing = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.72, 0.05), new THREE.MeshStandardMaterial({ color: 0xe7e0cb, roughness: 0.8 }));
  backing.position.set(0, 0.42, -0.12);
  group.add(backing, bottle, handle);
  return group;
}

function createEyewash(name, x, z) {
  const group = new THREE.Group();
  group.name = name;
  group.position.copy(grounded(x, z));
  group.userData.safetyRole = 'eyewash-shower';
  group.userData.visualOnly = true;
  const yellow = new THREE.MeshStandardMaterial({ color: 0xd3b32d, roughness: 0.5, metalness: 0.18 });
  const steel = createIndustrialMaterial('processSteel');
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.25, 14), yellow);
  post.position.y = 1.125;
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.12, 24), steel);
  basin.position.set(0.24, 0.92, 0);
  const showerArm = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.05, 0.05), yellow.clone());
  showerArm.position.set(0.20, 2.18, 0);
  const shower = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.11, 0.10, 20), steel.clone());
  shower.position.set(0.42, 2.08, 0);
  group.add(post, basin, showerArm, shower);
  return group;
}

function createFenceSegment(name, x0, x1, z, yLift = 0) {
  const group = new THREE.Group();
  group.name = name;
  group.userData.safetyRole = 'restricted-area-fence';
  group.userData.visualOnly = true;
  const steel = createIndustrialMaterial('structuralSteel');
  const span = Math.abs(x1 - x0);
  const centerX = (x0 + x1) / 2;
  group.userData.centerXZ = [centerX, z];
  const groundY = getTerrainHeight(centerX, z) + yLift;
  const railTop = new THREE.Mesh(new THREE.BoxGeometry(span, 0.055, 0.055), steel.clone());
  railTop.position.set(centerX, groundY + 1.6, z);
  const railMid = railTop.clone();
  railMid.position.y = groundY + 0.82;
  group.add(railTop, railMid);
  const postCount = Math.max(2, Math.ceil(span / 3.0));
  for (let index = 0; index <= postCount; index += 1) {
    const x = THREE.MathUtils.lerp(x0, x1, index / postCount);
    const y = getTerrainHeight(x, z);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.65, 0.06), steel.clone());
    post.position.set(x, y + 0.825, z);
    group.add(post);
  }
  return group;
}

function createPedestrianMarkers() {
  const group = new THREE.Group();
  group.name = 'v24-recovery-pedestrian-markers';
  group.userData.safetyRole = 'pedestrian-path';
  group.userData.visualOnly = true;
  const material = new THREE.MeshStandardMaterial({ color: 0xd3ae2f, roughness: 0.9, metalness: 0 });
  for (let index = 0; index < 18; index += 1) {
    const x = 160 + index * 5.0;
    const z = -78.0;
    const marker = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.018, 0.22), material);
    marker.name = `recovery-walkway-stripe-${index + 1}`;
    marker.position.set(x, getTerrainHeight(x, z) + 0.025, z);
    marker.receiveShadow = true;
    group.add(marker);
  }
  return group;
}

export function createIndustrialSafety() {
  const root = new THREE.Group();
  root.name = 'v24-industrial-safety';
  root.userData.visualOnly = true;
  root.userData.v24IndustrialSafety = true;

  const signs = [
    ['safety-sign-reception', -113, -18, 0],
    ['safety-sign-crushing', -83, -21, 0],
    ['safety-sign-grinding', 72, 4, Math.PI],
    ['safety-sign-pumps', 112, 3, Math.PI],
    ['safety-sign-leaching', 157, 39, Math.PI],
    ['safety-sign-cip', 166, -78, 0],
    ['safety-sign-elution', 194, -78, 0],
    ['safety-sign-ew', 220, -78, 0],
  ];
  signs.forEach(([name, x, z, rotationY]) => root.add(createSign(name, x, z, rotationY)));

  const extinguishers = [
    ['extinguisher-crushing', -82, -24],
    ['extinguisher-grinding', 74, 1],
    ['extinguisher-pump', 111, -1],
    ['extinguisher-cip', 174, -80],
    ['extinguisher-elution', 198, -80],
    ['extinguisher-ew', 222, -80],
  ];
  extinguishers.forEach(([name, x, z]) => root.add(createExtinguisher(name, x, z)));

  root.add(createEyewash('recovery-eyewash-shower', 207, -78.2));

  // South-side recovery boundary. The intentional 8 m opening is the access gate.
  root.add(createFenceSegment('recovery-fence-west', 160, 204, -106));
  root.add(createFenceSegment('recovery-fence-east', 212, 254, -106));
  const gate = createSign('recovery-restricted-gate', 208, -106, 0);
  gate.userData.safetyRole = 'restricted-area-gate';
  root.add(gate);
  root.add(createPedestrianMarkers());

  root.userData.signCount = signs.length;
  root.userData.extinguisherCount = extinguishers.length;
  root.userData.hasEyewash = true;
  root.userData.hasRestrictedFence = true;
  root.userData.hasPedestrianPath = true;
  return root;
}
