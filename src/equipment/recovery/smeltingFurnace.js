import * as THREE from 'three';
import { boxMesh, createAssetHandle, cylinderMesh, tubeBetween } from '../common/assetUtils.js';
import { createEquipmentMaterial } from '../common/materialLibrary.js';
import { createHandrail } from '../common/components.js';

const DIMENSIONS = Object.freeze({ length: 7.4, width: 5.8, height: 8.9 });

export function createSmeltingFurnaceAsset() {
  const root = new THREE.Group();
  root.name = 'ASSET-SMELTING-FURNACE';
  const dark = createEquipmentMaterial('darkStructuralSteel');
  root.add(boxMesh('smelting-base', [7.1, 0.24, 5.4], createEquipmentMaterial('concrete'), [0, 0.12, 0], { role: 'structure' }));
  const furnacePivot = new THREE.Group();
  furnacePivot.name = 'furnace-tilt-pivot';
  furnacePivot.position.set(-0.6, 2.25, 0);
  root.add(furnacePivot);
  const shell = cylinderMesh('furnace-shell', 1.55, 1.25, 3.6, createEquipmentMaterial('paintedGreySteel'), [0, 0, 0], 48, { role: 'shell' });
  shell.rotation.z = Math.PI / 2;
  furnacePivot.add(shell);
  const refractory = cylinderMesh('furnace-refractory', 1.32, 1.06, 3.05, createEquipmentMaterial('refractory'), [0, 0, 0], 48, { role: 'interior' });
  refractory.rotation.z = Math.PI / 2;
  furnacePivot.add(refractory);
  const melt = cylinderMesh('furnace-molten-zone', 0.86, 0.86, 2.2, createEquipmentMaterial('slurry', { color: 0xff7b22, emissive: 0xff4b10, emissiveIntensity: 2.2, opacity: 0.92 }), [0, -0.38, 0], 36, { role: 'interior' });
  melt.rotation.z = Math.PI / 2;
  furnacePivot.add(melt);
  const mouth = cylinderMesh('furnace-mouth', 0.72, 0.72, 0.38, createEquipmentMaterial('bareSteel'), [1.92, 0, 0], 36, { role: 'structure' });
  mouth.rotation.z = Math.PI / 2;
  furnacePivot.add(mouth);

  root.add(boxMesh('furnace-support-left', [0.45, 3.5, 0.72], dark.clone(), [-0.6, 1.95, -2.0], { role: 'structure' }));
  root.add(boxMesh('furnace-support-right', [0.45, 3.5, 0.72], dark.clone(), [-0.6, 1.95, 2.0], { role: 'structure' }));
  const hood = boxMesh('smelting-extraction-hood', [3.8, 0.35, 3.2], createEquipmentMaterial('paintedGreySteel'), [0.2, 4.65, 0], { role: 'shell' });
  root.add(hood);
  root.add(tubeBetween('smelting-exhaust-duct', [1.65, 4.65, 0], [3.0, 6.2, 0], 0.38, createEquipmentMaterial('carbonSteelPipe'), 28, { role: 'structure' }));
  root.add(tubeBetween('smelting-exhaust-stack', [3.0, 6.2, 0], [3.0, 8.6, 0], 0.42, createEquipmentMaterial('carbonSteelPipe'), 28, { role: 'structure' }));
  const stackCap = cylinderMesh('smelting-stack-cap', 0.58, 0.48, 0.20, createEquipmentMaterial('darkStructuralSteel'), [3.0, 8.72, 0], 28, { role: 'structure', lodTier: 1 });
  root.add(stackCap);
  const crucible = cylinderMesh('smelting-crucible', 0.72, 0.58, 1.1, createEquipmentMaterial('refractory'), [2.25, 0.7, 0], 36, { role: 'shell' });
  root.add(crucible);
  const crucibleGlow = cylinderMesh('smelting-crucible-melt', 0.6, 0.52, 0.72, createEquipmentMaterial('slurry', { color: 0xff8a32, emissive: 0xff4d12, emissiveIntensity: 2.0 }), [2.25, 0.92, 0], 36, { role: 'interior' });
  root.add(crucibleGlow);
  const platform = boxMesh('smelting-platform', [6.6, 0.12, 0.9], dark.clone(), [0, 2.5, -2.35], { role: 'structure' });
  root.add(platform);
  const rail = createHandrail({ length: 6.2, name: 'smelting-platform-rail', posts: 5 });
  rail.position.set(0, 2.58, -2.76);
  root.add(rail);
  const rearRail = createHandrail({ length: 6.2, name: 'smelting-platform-rail-rear', posts: 5 });
  rearRail.position.set(0, 2.58, -1.94);
  root.add(rearRail);

  return createAssetHandle({
    root,
    id: 'SMELTING-FURNACE-GENERIC',
    category: 'smelting',
    name: 'Horno de fundición inclinable',
    referenceClass: 'small industrial tilting smelting furnace',
    dimensions: DIMENSIONS,
    ports: [
      { id: 'feed', type: 'materialIn', position: [-2.35, 2.25, 0], direction: [1, 0, 0] },
      { id: 'exhaust', type: 'service', position: [3.0, 6.2, 0], direction: [1, 1, 0], nominalDiameter: 0.75 },
      { id: 'productOut', type: 'materialOut', position: [2.25, 1.45, 0], direction: [0, -1, 0] },
    ],
    capabilities: { tilt: true, internalGlow: true, crucible: true, extractionHood: true, inspection: true, cutaway: true, lod: true },
    update: (_dt, elapsed) => {
      const phase = (elapsed % 16) / 16;
      const tilt = phase > 0.55 && phase < 0.82 ? Math.sin(((phase - 0.55) / 0.27) * Math.PI) : 0;
      furnacePivot.rotation.z = -tilt * THREE.MathUtils.degToRad(32);
      melt.material.emissiveIntensity = 1.8 + Math.sin(elapsed * 3.2) * 0.25;
      crucibleGlow.material.emissiveIntensity = 1.65 + Math.sin(elapsed * 2.7 + 1.1) * 0.2;
    },
    lodDistances: [18, 44],
  });
}
