import * as THREE from 'three';
import { boxMesh, cylinderMesh, tubeBetween, tagObject } from './assetUtils.js';
import { createEquipmentMaterial } from './materialLibrary.js';

export function createMiningWheel({ radius = 1.45, width = 0.78, treadCount = 28, name = 'mining-wheel' } = {}) {
  const group = new THREE.Group();
  group.name = name;
  const tireMat = createEquipmentMaterial('tireRubber');
  const steelMat = createEquipmentMaterial('darkStructuralSteel');
  const hubMat = createEquipmentMaterial('bareSteel');
  const tire = cylinderMesh(`${name}-tire`, radius, radius, width, tireMat, [0, 0, 0], 48, { role: 'shell' });
  tire.rotation.x = Math.PI / 2;
  group.add(tire);
  const hub = cylinderMesh(`${name}-hub`, radius * 0.34, radius * 0.34, width * 1.06, hubMat, [0, 0, 0], 32, { role: 'structure' });
  hub.rotation.x = Math.PI / 2;
  group.add(hub);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.48, radius * 0.055, 12, 32), steelMat);
  rim.name = `${name}-rim`;
  rim.castShadow = true;
  tagObject(rim, { role: 'structure', lodTier: 1 });
  group.add(rim);
  for (let i = 0; i < treadCount; i += 1) {
    const a = (i / treadCount) * Math.PI * 2;
    const tread = boxMesh(`${name}-tread-${i}`, [0.12, 0.3, width * 1.05], tireMat.clone(), [Math.cos(a) * radius * 1.01, Math.sin(a) * radius * 1.01, 0], { role: 'shell', lodTier: 2 });
    tread.rotation.z = a;
    group.add(tread);
  }
  return group;
}

export function createHydraulicCylinder({ length = 2, barrelRadius = 0.12, rodRadius = 0.07, name = 'hydraulic-cylinder' } = {}) {
  const group = new THREE.Group();
  group.name = name;
  const barrel = cylinderMesh(`${name}-barrel`, barrelRadius, barrelRadius, length * 0.62, createEquipmentMaterial('paintedGreySteel'), [0, -length * 0.19, 0], 20, { role: 'structure' });
  const rod = cylinderMesh(`${name}-rod`, rodRadius, rodRadius, length * 0.52, createEquipmentMaterial('stainlessSteel'), [0, length * 0.26, 0], 20, { role: 'interior' });
  group.add(barrel, rod);
  return group;
}

export function createElectricMotor({ length = 1.4, radius = 0.46, name = 'electric-motor', colorRole = 'paintedBlueSteel' } = {}) {
  const group = new THREE.Group();
  group.name = name;
  const body = cylinderMesh(`${name}-body`, radius, radius, length, createEquipmentMaterial(colorRole), [0, 0, 0], 32, { role: 'shell' });
  body.rotation.z = Math.PI / 2;
  group.add(body);
  for (let i = -4; i <= 4; i += 1) {
    const fin = boxMesh(`${name}-fin-${i}`, [length * 0.76, 0.035, radius * 2.12], createEquipmentMaterial('darkStructuralSteel'), [0, i * radius * 0.16, 0], { role: 'structure', lodTier: 2 });
    group.add(fin);
  }
  const shaft = cylinderMesh(`${name}-shaft`, radius * 0.16, radius * 0.16, length * 0.3, createEquipmentMaterial('bareSteel'), [length * 0.62, 0, 0], 20, { role: 'interior' });
  shaft.rotation.z = Math.PI / 2;
  group.add(shaft);
  return group;
}

export function createGearbox({ size = [1.1, 1, 0.9], name = 'gearbox' } = {}) {
  const group = new THREE.Group();
  group.name = name;
  group.add(boxMesh(`${name}-case`, size, createEquipmentMaterial('paintedGreySteel'), [0, 0, 0], { role: 'shell' }));
  const shaft = cylinderMesh(`${name}-shaft`, Math.min(size[1], size[2]) * 0.13, Math.min(size[1], size[2]) * 0.13, size[0] * 1.3, createEquipmentMaterial('bareSteel'), [0, 0, 0], 20, { role: 'interior' });
  shaft.rotation.z = Math.PI / 2;
  group.add(shaft);
  return group;
}

export function createCouplingGuard({ length = 0.8, radius = 0.24, name = 'coupling-guard' } = {}) {
  const guard = cylinderMesh(name, radius, radius, length, createEquipmentMaterial('safetyYellow', { transparent: true, opacity: 0.78 }), [0, 0, 0], 24, { role: 'shell', lodTier: 1 });
  guard.rotation.z = Math.PI / 2;
  return guard;
}

export function createHandrail({ length = 2, height = 1.1, name = 'handrail', posts = 3 } = {}) {
  const group = new THREE.Group();
  group.name = name;
  const mat = createEquipmentMaterial('safetyYellow');
  group.add(tubeBetween(`${name}-top`, [-length / 2, height, 0], [length / 2, height, 0], 0.025, mat.clone(), 10, { role: 'structure', lodTier: 1 }));
  group.add(tubeBetween(`${name}-mid`, [-length / 2, height * 0.52, 0], [length / 2, height * 0.52, 0], 0.02, mat.clone(), 10, { role: 'structure', lodTier: 1 }));
  for (let i = 0; i < posts; i += 1) {
    const x = -length / 2 + (length * i) / Math.max(1, posts - 1);
    group.add(tubeBetween(`${name}-post-${i}`, [x, 0, 0], [x, height, 0], 0.024, mat.clone(), 10, { role: 'structure', lodTier: 1 }));
  }
  return group;
}

export function createLadder({ width = 0.6, height = 2.4, rungSpacing = 0.28, name = 'ladder' } = {}) {
  const group = new THREE.Group();
  group.name = name;
  const mat = createEquipmentMaterial('bareSteel');
  group.add(tubeBetween(`${name}-rail-l`, [-width / 2, 0, 0], [-width / 2, height, 0], 0.025, mat.clone(), 10, { role: 'structure', lodTier: 1 }));
  group.add(tubeBetween(`${name}-rail-r`, [width / 2, 0, 0], [width / 2, height, 0], 0.025, mat.clone(), 10, { role: 'structure', lodTier: 1 }));
  const rungs = Math.floor(height / rungSpacing);
  for (let i = 0; i <= rungs; i += 1) {
    const y = Math.min(height, i * rungSpacing);
    group.add(tubeBetween(`${name}-rung-${i}`, [-width / 2, y, 0], [width / 2, y, 0], 0.018, mat.clone(), 9, { role: 'structure', lodTier: 2 }));
  }
  return group;
}

export function createPlatform({ size = [2.4, 0.12, 1.1], name = 'platform' } = {}) {
  const group = new THREE.Group();
  group.name = name;
  const deck = boxMesh(`${name}-deck`, size, createEquipmentMaterial('darkStructuralSteel'), [0, 0, 0], { role: 'structure' });
  group.add(deck);
  return group;
}

export function createPipeSegment({ a, b, radius = 0.08, name = 'pipe', role = 'carbonSteelPipe', lodTier = 0 } = {}) {
  return tubeBetween(name, a, b, radius, createEquipmentMaterial(role), 18, { role: 'structure', lodTier });
}

export function createWorkLight({ name = 'work-light' } = {}) {
  const group = new THREE.Group();
  group.name = name;
  const casing = boxMesh(`${name}-case`, [0.24, 0.14, 0.16], createEquipmentMaterial('darkStructuralSteel'), [0, 0, 0], { role: 'structure', lodTier: 2 });
  const lens = boxMesh(`${name}-lens`, [0.018, 0.11, 0.13], createEquipmentMaterial('glass', { emissive: 0xfff0c2, emissiveIntensity: 0.3 }), [0.13, 0, 0], { role: 'shell', lodTier: 2 });
  group.add(casing, lens);
  return group;
}
