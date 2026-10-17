import * as THREE from 'three';
import { boxMesh, createAssetHandle, cylinderMesh, tubeBetween } from '../common/assetUtils.js';
import { createEquipmentMaterial } from '../common/materialLibrary.js';
import { createHandrail } from '../common/components.js';
import { animateSuspendedSolids, createSuspendedSolidsCloud } from '../common/slurryVisuals.js';

const DIMENSIONS = Object.freeze({ length: 5.4, width: 5.4, height: 5.4 });

function createCyclone(index, angle) {
  const group = new THREE.Group();
  group.name = `cyclone-${index + 1}`;
  const radius = 1.75;
  group.position.set(Math.cos(angle) * radius, 3.2, Math.sin(angle) * radius);
  group.rotation.y = -angle;
  const shell = createEquipmentMaterial('paintedOrangeSteel');
  const upper = cylinderMesh(`cyclone-${index + 1}-barrel`, 0.25, 0.25, 0.7, shell, [0, 0.3, 0], 32, { role: 'shell' });
  group.add(upper);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.25, 1.75, 32, 1, false), shell.clone());
  cone.name = `cyclone-${index + 1}-cone`;
  cone.position.y = -0.92;
  cone.castShadow = true;
  cone.userData.inspectionRole = 'shell';
  group.add(cone);
  const vortex = cylinderMesh(`cyclone-${index + 1}-vortex-finder`, 0.09, 0.09, 0.72, createEquipmentMaterial('carbonSteelPipe'), [0, 0.72, 0], 20, { role: 'interior' });
  group.add(vortex);
  const underflow = cylinderMesh(`cyclone-${index + 1}-apex`, 0.055, 0.055, 0.35, createEquipmentMaterial('wearLiner'), [0, -1.9, 0], 18, { role: 'structure' });
  group.add(underflow);
  const swirl = new THREE.Mesh(new THREE.TorusKnotGeometry(0.13, 0.018, 50, 8, 2, 3), createEquipmentMaterial('slurry', { opacity: 0.65 }));
  swirl.name = `cyclone-${index + 1}-swirl`;
  swirl.scale.set(1, 1.8, 1);
  swirl.position.y = -0.15;
  swirl.userData.inspectionRole = 'interior';
  group.add(swirl);
  group.userData.swirl = swirl;
  return group;
}

export function createCycloneClusterAsset() {
  const root = new THREE.Group();
  root.name = 'ASSET-CYCLONE-CLUSTER';
  const frame = createEquipmentMaterial('darkStructuralSteel');
  root.add(boxMesh('cyclone-platform', [5.0, 0.16, 5.0], frame, [0, 2.6, 0], { role: 'structure' }));
  for (const x of [-2.1, 2.1]) for (const z of [-2.1, 2.1]) root.add(boxMesh(`cyclone-leg-${x}-${z}`, [0.18, 2.6, 0.18], frame.clone(), [x, 1.3, z], { role: 'structure' }));
  const rail = createHandrail({ length: 4.5, name: 'cyclone-platform-rail', posts: 4 });
  rail.position.set(0, 2.7, -2.45);
  root.add(rail);

  const feedManifold = cylinderMesh('cyclone-feed-manifold', 0.28, 0.28, 3.2, createEquipmentMaterial('carbonSteelPipe'), [0, 3.68, 0], 28, { role: 'structure' });
  root.add(feedManifold);
  const overflowHeader = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.12, 14, 48), createEquipmentMaterial('carbonSteelPipe'));
  overflowHeader.name = 'cyclone-overflow-header';
  overflowHeader.rotation.x = Math.PI / 2;
  overflowHeader.position.y = 4.25;
  overflowHeader.userData.inspectionRole = 'structure';
  root.add(overflowHeader);

  const cyclones = [];
  const count = 6;
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const cyclone = createCyclone(i, angle);
    root.add(cyclone);
    cyclones.push(cyclone);
    const p = cyclone.position;
    root.add(tubeBetween(`cyclone-feed-branch-${i}`, [0, 3.68, 0], [p.x, 3.5, p.z], 0.08, createEquipmentMaterial('carbonSteelPipe'), 14, { role: 'structure', lodTier: 1 }));
    root.add(tubeBetween(`cyclone-overflow-branch-${i}`, [p.x, 4.0, p.z], [Math.cos(angle) * 1.8, 4.25, Math.sin(angle) * 1.8], 0.06, createEquipmentMaterial('carbonSteelPipe'), 14, { role: 'structure', lodTier: 1 }));
  }
  const underflowTrough = boxMesh('cyclone-underflow-trough', [4.1, 0.45, 4.1], createEquipmentMaterial('paintedGreySteel'), [0, 0.75, 0], { role: 'shell' });
  root.add(underflowTrough);
  const suspendedSolids = createSuspendedSolidsCloud({ name: 'cyclone-manifold-suspended-solids', radius: 0.22, height: 2.5, count: 42, size: 0.035, opacity: 0.55, seed: 17, y: 3.68 });
  root.add(suspendedSolids);

  return createAssetHandle({
    root,
    id: 'CYCLONE-CLUSTER-500MM-X6',
    category: 'cyclone-cluster',
    name: 'Cluster de 6 hidrociclones',
    referenceClass: 'six-position 500 mm hydrocyclone cluster',
    dimensions: DIMENSIONS,
    ports: [
      { id: 'feed', type: 'slurryIn', position: [0, 5.15, 0], direction: [0, -1, 0], nominalDiameter: 0.3 },
      { id: 'overflow', type: 'overflow', position: [2.1, 4.25, 0], direction: [1, 0, 0], nominalDiameter: 0.22 },
      { id: 'underflow', type: 'underflow', position: [0, 0.55, 0], direction: [0, -1, 0], nominalDiameter: 0.26 },
    ],
    capabilities: { internalSwirl: true, overflowUnderflow: true, inspection: true, cutaway: true, lod: true },
    update: (dt, elapsed) => {
      cyclones.forEach((cyclone, index) => {
        cyclone.userData.swirl.rotation.y += dt * (2.6 + index * 0.08);
        cyclone.userData.swirl.scale.y = 1.7 + Math.sin(elapsed * 2.4 + index) * 0.08;
      });
      animateSuspendedSolids(suspendedSolids, dt, elapsed, { speed: 0.32, phase: 1.4 });
    },
    lodDistances: [18, 42],
  });
}
