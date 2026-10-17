import * as THREE from 'three';
import { boxMesh, createAssetHandle, tubeBetween } from '../common/assetUtils.js';
import { createEquipmentMaterial } from '../common/materialLibrary.js';
import { createHandrail, createLadder } from '../common/components.js';

const DIMENSIONS = Object.freeze({ length: 11.5, width: 9.2, height: 7.6 });

export function createRomHopperAsset() {
  const root = new THREE.Group();
  root.name = 'ASSET-ROM-HOPPER';
  const shellMat = createEquipmentMaterial('paintedGreySteel');
  const linerMat = createEquipmentMaterial('wearLiner');
  const frameMat = createEquipmentMaterial('darkStructuralSteel');

  const hopper = new THREE.Group();
  hopper.name = 'rom-hopper-body';
  hopper.position.y = 4.55;
  root.add(hopper);

  const wallSpecs = [
    { name: 'front', size: [6.2, 0.2, 8.6], pos: [2.0, 0.3, 0], rz: -0.56 },
    { name: 'rear', size: [6.2, 0.2, 8.6], pos: [-2.0, 0.3, 0], rz: 0.56 },
    { name: 'left', size: [7.8, 0.2, 6.2], pos: [0, 0.3, -3.25], rx: -0.56, ry: Math.PI / 2 },
    { name: 'right', size: [7.8, 0.2, 6.2], pos: [0, 0.3, 3.25], rx: 0.56, ry: Math.PI / 2 },
  ];
  wallSpecs.forEach((spec) => {
    const wall = boxMesh(`hopper-${spec.name}-wall`, spec.size, shellMat.clone(), spec.pos, { role: 'shell' });
    if (spec.rz) wall.rotation.z = spec.rz;
    if (spec.rx) wall.rotation.x = spec.rx;
    if (spec.ry) wall.rotation.y = spec.ry;
    hopper.add(wall);
    const liner = wall.clone();
    liner.name = `hopper-${spec.name}-liner`;
    liner.material = linerMat.clone();
    liner.scale.set(0.96, 0.65, 0.96);
    liner.userData.inspectionRole = 'interior';
    hopper.add(liner);
  });

  for (let i = -5; i <= 5; i += 1) {
    const z = i * 0.72;
    const bar = tubeBetween(`rom-grizzly-${i}`, [-4.5, 7.15, z], [4.5, 7.15, z], 0.085, frameMat.clone(), 12, { role: 'structure', lodTier: 1 });
    root.add(bar);
  }

  const ore = new THREE.Mesh(new THREE.ConeGeometry(3.5, 4.2, 36, 1, true), createEquipmentMaterial('ore'));
  ore.name = 'rom-hopper-ore';
  ore.position.set(0, 4.85, 0);
  ore.rotation.x = Math.PI;
  ore.scale.set(1.15, 1, 1.0);
  ore.castShadow = true;
  ore.userData.inspectionRole = 'interior';
  root.add(ore);

  for (const x of [-4.3, 4.3]) {
    for (const z of [-3.6, 3.6]) {
      root.add(boxMesh(`hopper-leg-${x}-${z}`, [0.32, 4.1, 0.32], frameMat.clone(), [x, 2.05, z], { role: 'structure' }));
      root.add(boxMesh(`hopper-foot-${x}-${z}`, [0.85, 0.18, 0.85], createEquipmentMaterial('bareSteel'), [x, 0.09, z], { role: 'structure' }));
    }
  }
  const deck = boxMesh('hopper-service-deck', [10.2, 0.14, 1.2], frameMat.clone(), [0, 5.65, -4.05], { role: 'structure' });
  root.add(deck);
  const rail = createHandrail({ length: 9.6, name: 'hopper-service-rail' });
  rail.position.set(0, 5.73, -4.55);
  root.add(rail);
  const ladder = createLadder({ height: 5.55, name: 'hopper-access-ladder' });
  ladder.position.set(-4.85, 0, -4.05);
  root.add(ladder);

  return createAssetHandle({
    root,
    id: 'ROM-HOPPER-GENERIC',
    category: 'rom-hopper',
    name: 'Tolva ROM minera',
    referenceClass: 'truck dump ROM hopper with grizzly',
    dimensions: DIMENSIONS,
    ports: [
      { id: 'feedIn', type: 'materialIn', position: [0, 7.3, 0], direction: [0, -1, 0] },
      { id: 'dischargeOut', type: 'materialOut', position: [0, 1.95, 0], direction: [0, -1, 0] },
    ],
    capabilities: { materialFlow: true, inspection: true, cutaway: true, lod: false },
    update: () => {
      ore.position.y = 4.82;
    },
  });
}
