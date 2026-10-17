import * as THREE from 'three';
import { boxMesh, createAssetHandle } from '../common/assetUtils.js';
import { createEquipmentMaterial } from '../common/materialLibrary.js';
import { createHandrail } from '../common/components.js';

const DIMENSIONS = Object.freeze({ length: 10.8, width: 5.8, height: 3.8 });

export function createElectrowinningAsset() {
  const root = new THREE.Group();
  root.name = 'ASSET-ELECTROWINNING';
  const dark = createEquipmentMaterial('darkStructuralSteel');
  root.add(boxMesh('ew-floor-skid', [10.4, 0.18, 5.4], dark, [0, 0.12, 0], { role: 'structure' }));
  const cellGroups = [];
  for (let c = 0; c < 4; c += 1) {
    const x = -3.9 + c * 2.6;
    const cell = new THREE.Group();
    cell.name = `ew-cell-${c + 1}`;
    cell.position.set(x, 0, 0);
    const shell = boxMesh(`ew-cell-shell-${c + 1}`, [2.15, 1.35, 3.7], createEquipmentMaterial('paintedGreySteel'), [0, 0.9, 0], { role: 'shell' });
    cell.add(shell);
    const electrolyte = boxMesh(`ew-electrolyte-${c + 1}`, [1.9, 0.92, 3.45], createEquipmentMaterial('slurry', { color: 0x4a815f, opacity: 0.62 }), [0, 1.0, 0], { role: 'interior' });
    cell.add(electrolyte);
    for (let i = 0; i < 11; i += 1) {
      const z = -1.45 + i * 0.29;
      const cathode = boxMesh(`ew-cathode-${c + 1}-${i}`, [1.72, 1.05, 0.035], createEquipmentMaterial(i % 2 === 0 ? 'stainlessSteel' : 'copper'), [0, 1.35, z], { role: 'interior', lodTier: 1 });
      cell.add(cathode);
    }
    cellGroups.push(cell);
    root.add(cell);
  }
  const busPositive = boxMesh('ew-busbar-positive', [10.1, 0.13, 0.16], createEquipmentMaterial('copper'), [0, 2.12, -2.05], { role: 'structure' });
  const busNegative = boxMesh('ew-busbar-negative', [10.1, 0.13, 0.16], createEquipmentMaterial('copper'), [0, 2.12, 2.05], { role: 'structure' });
  root.add(busPositive, busNegative);
  const walkway = boxMesh('ew-service-walkway', [10.2, 0.12, 0.85], dark.clone(), [0, 1.68, 2.5], { role: 'structure' });
  root.add(walkway);
  const rail = createHandrail({ length: 9.8, name: 'ew-walkway-rail', posts: 6 });
  rail.position.set(0, 1.75, 2.9);
  root.add(rail);
  const frontWalkway = boxMesh('ew-front-service-walkway', [10.2, 0.12, 0.75], dark.clone(), [0, 1.68, -2.5], { role: 'structure' });
  root.add(frontWalkway);
  const frontRail = createHandrail({ length: 9.8, name: 'ew-front-walkway-rail', posts: 6 });
  frontRail.position.set(0, 1.75, -2.9);
  root.add(frontRail);
  root.add(boxMesh('ew-rectifier-cabinet', [1.7, 2.25, 1.05], createEquipmentMaterial('paintedBlueSteel'), [4.3, 1.25, -2.15], { role: 'shell' }));
  root.add(boxMesh('ew-electrical-cabinet-2', [1.3, 1.9, 0.9], createEquipmentMaterial('paintedGreySteel'), [2.45, 1.05, -2.2], { role: 'shell', lodTier: 1 }));

  return createAssetHandle({
    root,
    id: 'EW-CELLS-GENERIC',
    category: 'electrowinning',
    name: 'Módulo de electrodeposición',
    referenceClass: 'four-cell electrowinning module',
    dimensions: DIMENSIONS,
    ports: [
      { id: 'electrolyteIn', type: 'slurryIn', position: [-5.2, 0.85, -1.7], direction: [1, 0, 0], nominalDiameter: 0.1 },
      { id: 'electrolyteOut', type: 'slurryOut', position: [5.2, 0.85, 1.7], direction: [1, 0, 0], nominalDiameter: 0.1 },
      { id: 'cathodeOut', type: 'materialOut', position: [5.35, 2.15, 0], direction: [1, 0, 0] },
      { id: 'dcPower', type: 'electrical', position: [4.3, 2.4, -2.15], direction: [0, 1, 0] },
    ],
    capabilities: { visibleElectrodes: true, busBars: true, electrolyte: true, inspection: true, cutaway: true, lod: true },
    update: (_dt, elapsed) => {
      cellGroups.forEach((cell, index) => {
        const liquid = cell.getObjectByName(`ew-electrolyte-${index + 1}`);
        if (liquid) liquid.scale.y = 1 + Math.sin(elapsed * 1.4 + index) * 0.004;
      });
    },
    lodDistances: [22, 52],
  });
}
