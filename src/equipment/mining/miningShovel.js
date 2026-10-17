import * as THREE from 'three';
import { boxMesh, createAssetHandle, cylinderMesh, sphereMesh, tubeBetween } from '../common/assetUtils.js';
import { createEquipmentMaterial } from '../common/materialLibrary.js';
import { createBucketGeometry } from '../common/geometry.js';
import { createHandrail, createLadder } from '../common/components.js';

const DIMENSIONS = Object.freeze({ length: 9.9, width: 8.0, height: 8.1 });

function makeTrack(name, z) {
  const group = new THREE.Group();
  group.name = name;
  group.position.z = z;
  const dark = createEquipmentMaterial('darkStructuralSteel');
  group.add(boxMesh(`${name}-frame`, [6.9, 1.1, 1.35], dark, [0, 0.76, 0], { role: 'structure' }));
  for (let i = 0; i < 14; i += 1) {
    const x = -3.15 + i * 0.485;
    group.add(boxMesh(`${name}-shoe-${i}`, [0.42, 0.14, 1.46], createEquipmentMaterial('bareSteel'), [x, 0.15, 0], { role: 'structure', lodTier: 1 }));
  }
  for (let i = 0; i < 7; i += 1) {
    const roller = cylinderMesh(`${name}-roller-${i}`, 0.26, 0.26, 1.42, createEquipmentMaterial('bareSteel'), [-2.65 + i * 0.88, 0.62, 0], 20, { role: 'structure', lodTier: 2 });
    roller.rotation.x = Math.PI / 2;
    group.add(roller);
  }
  return group;
}

export function createMiningShovelAsset() {
  const root = new THREE.Group();
  root.name = 'ASSET-MINING-SHOVEL';
  root.add(makeTrack('left-track', -3.15), makeTrack('right-track', 3.15));
  const carbody = boxMesh('shovel-carbody', [5.6, 0.8, 5.8], createEquipmentMaterial('darkStructuralSteel'), [-0.25, 1.6, 0], { role: 'structure' });
  root.add(carbody);
  const slewRing = cylinderMesh('shovel-slew-ring', 1.75, 1.75, 0.5, createEquipmentMaterial('bareSteel'), [-0.35, 2.15, 0], 36, { role: 'interior' });
  root.add(slewRing);

  const upper = new THREE.Group();
  upper.name = 'shovel-upper-structure';
  upper.position.set(-0.35, 2.35, 0);
  root.add(upper);
  upper.add(boxMesh('machinery-house', [4.8, 2.55, 4.8], createEquipmentMaterial('paintedYellowSteel'), [-1.05, 1.45, 0], { role: 'shell' }));
  upper.add(boxMesh('counterweight', [2.2, 2.2, 4.95], createEquipmentMaterial('paintedYellowSteel'), [-2.95, 1.4, 0], { role: 'shell' }));
  const cab = boxMesh('shovel-cab', [1.55, 2.0, 1.65], createEquipmentMaterial('paintedYellowSteel'), [1.0, 2.35, -2.4], { role: 'shell' });
  upper.add(cab);
  upper.add(boxMesh('shovel-windshield', [0.06, 1.2, 1.3], createEquipmentMaterial('safetyGlass'), [1.8, 2.45, -2.4], { role: 'shell', lodTier: 0 }));
  const upperRail = createHandrail({ length: 4.3, name: 'shovel-upper-rail' });
  upperRail.position.set(-0.6, 2.82, -2.5);
  upper.add(upperRail);
  const ladder = createLadder({ height: 2.6, name: 'shovel-access-ladder' });
  ladder.position.set(-2.3, -0.15, -2.53);
  upper.add(ladder);

  const boomPivot = new THREE.Group();
  boomPivot.name = 'boom-pivot';
  boomPivot.position.set(1.45, 1.4, 0);
  upper.add(boomPivot);
  const boom = boxMesh('shovel-boom', [5.4, 0.7, 1.05], createEquipmentMaterial('paintedYellowSteel'), [2.55, 0, 0], { role: 'shell' });
  boomPivot.add(boom);
  for (const z of [-0.52, 0.52]) boomPivot.add(tubeBetween(`boom-web-${z}`, [0.1, -0.28, z], [5.0, 0.28, z], 0.07, createEquipmentMaterial('darkStructuralSteel'), 14, { role: 'structure', lodTier: 1 }));

  const stickPivot = new THREE.Group();
  stickPivot.name = 'stick-pivot';
  stickPivot.position.set(5.1, 0, 0);
  boomPivot.add(stickPivot);
  const stick = boxMesh('shovel-stick', [3.9, 0.58, 0.86], createEquipmentMaterial('paintedYellowSteel'), [1.83, 0, 0], { role: 'shell' });
  stickPivot.add(stick);

  const bucketPivot = new THREE.Group();
  bucketPivot.name = 'bucket-pivot';
  bucketPivot.position.set(3.65, 0, 0);
  stickPivot.add(bucketPivot);
  const bucket = createBucketGeometry({ width: 4.25, depth: 2.25, height: 1.85, material: createEquipmentMaterial('wearLiner'), name: 'shovel-bucket' });
  bucket.position.set(0.9, -0.65, 0);
  bucketPivot.add(bucket);
  const ore = sphereMesh('shovel-bucket-ore', 0.85, createEquipmentMaterial('ore'), [0.95, 0.12, 0], { role: 'interior' });
  ore.scale.set(1.25, 0.72, 1.75);
  bucketPivot.add(ore);

  const boomCyl = tubeBetween('boom-hydraulic-cylinder', [0.2, 0.5, -0.7], [2.65, 1.3, -0.7], 0.16, createEquipmentMaterial('paintedGreySteel'), 18, { role: 'structure', lodTier: 1 });
  boomPivot.add(boomCyl);
  const stickCyl = tubeBetween('stick-hydraulic-cylinder', [2.6, 0.48, 0.58], [5.8, 0.28, 0.58], 0.13, createEquipmentMaterial('paintedGreySteel'), 18, { role: 'structure', lodTier: 1 });
  boomPivot.add(stickCyl);
  const bucketCyl = tubeBetween('bucket-hydraulic-cylinder', [0.35, 0.42, -0.48], [2.75, 0.42, -0.48], 0.11, createEquipmentMaterial('stainlessSteel'), 16, { role: 'interior', lodTier: 1 });
  stickPivot.add(bucketCyl);

  return createAssetHandle({
    root,
    id: 'MINING-SHOVEL-GENERIC-300T',
    category: 'mining-shovel',
    name: 'Shovel hidráulica minera',
    referenceClass: 'large hydraulic mining shovel class',
    dimensions: DIMENSIONS,
    capabilities: { slew: true, boom: true, stick: true, bucket: true, oreLoad: true, inspection: true, lod: true },
    update: (dt, elapsed) => {
      const cycle = (elapsed % 20) / 20;
      const dig = Math.sin(cycle * Math.PI * 2);
      const swing = Math.sin((cycle - 0.22) * Math.PI * 2) * 0.5 + 0.5;
      upper.rotation.y = THREE.MathUtils.lerp(-0.46, 0.62, THREE.MathUtils.smoothstep(swing, 0.12, 0.88));
      boomPivot.rotation.z = THREE.MathUtils.degToRad(22 + 16 * (0.5 + 0.5 * Math.sin((cycle + 0.08) * Math.PI * 2)));
      stickPivot.rotation.z = THREE.MathUtils.degToRad(-48 + 27 * (0.5 + 0.5 * Math.sin((cycle + 0.22) * Math.PI * 2)));
      bucketPivot.rotation.z = THREE.MathUtils.degToRad(-22 + 58 * (0.5 + 0.5 * Math.sin((cycle + 0.37) * Math.PI * 2)));
      ore.visible = cycle > 0.22 && cycle < 0.7;
      root.userData.motionSignal = dig;
    },
    lodDistances: [26, 62],
  });
}
