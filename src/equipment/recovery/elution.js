import * as THREE from 'three';
import { boxMesh, createAssetHandle, cylinderMesh, tubeBetween } from '../common/assetUtils.js';
import { createEquipmentMaterial } from '../common/materialLibrary.js';
import { createElectricMotor, createHandrail } from '../common/components.js';

const DIMENSIONS = Object.freeze({ length: 9.4, width: 5.6, height: 6.4 });

function makePump(name, x, z) {
  const group = new THREE.Group();
  group.name = name;
  group.position.set(x, 0.45, z);
  const casing = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.15, 18, 40, Math.PI * 1.75), createEquipmentMaterial('paintedBlueSteel'));
  casing.rotation.y = Math.PI / 2;
  casing.userData.inspectionRole = 'shell';
  casing.castShadow = true;
  group.add(casing);
  const motor = createElectricMotor({ length: 0.8, radius: 0.26, name: `${name}-motor` });
  motor.position.x = 0.85;
  group.add(motor);
  return group;
}

export function createElutionAsset() {
  const root = new THREE.Group();
  root.name = 'ASSET-ELUTION';
  const dark = createEquipmentMaterial('darkStructuralSteel');
  root.add(boxMesh('elution-skid', [9.0, 0.2, 5.1], dark, [0, 0.14, 0], { role: 'structure' }));
  const column = cylinderMesh('elution-column', 0.95, 0.95, 4.9, createEquipmentMaterial('stainlessSteel'), [-2.8, 2.6, 0], 48, { role: 'shell' });
  root.add(column);
  const columnInternal = cylinderMesh('elution-column-solution', 0.86, 0.86, 4.1, createEquipmentMaterial('slurry', { color: 0x8a7249, opacity: 0.62 }), [-2.8, 2.28, 0], 48, { role: 'interior' });
  root.add(columnInternal);
  const solutionTank = cylinderMesh('elution-solution-tank', 1.35, 1.35, 2.6, createEquipmentMaterial('paintedGreySteel'), [0.1, 1.42, 1.15], 48, { role: 'shell' });
  root.add(solutionTank);
  const tankLiquid = cylinderMesh('elution-tank-liquid', 1.26, 1.26, 2.05, createEquipmentMaterial('slurry', { color: 0x6e835c, opacity: 0.6 }), [0.1, 1.2, 1.15], 48, { role: 'interior' });
  root.add(tankLiquid);
  const hx = cylinderMesh('elution-heat-exchanger-shell', 0.65, 0.65, 3.0, createEquipmentMaterial('paintedOrangeSteel'), [2.75, 2.0, -0.95], 36, { role: 'shell' });
  hx.rotation.z = Math.PI / 2;
  root.add(hx);
  for (let i = -4; i <= 4; i += 1) {
    const tube = cylinderMesh(`elution-hx-tube-${i}`, 0.035, 0.035, 2.7, createEquipmentMaterial('copper'), [2.75, 2.0 + i * 0.1, -0.95], 10, { role: 'interior', lodTier: 2 });
    tube.rotation.z = Math.PI / 2;
    root.add(tube);
  }
  const pumpA = makePump('elution-pump-a', 2.2, 1.25);
  const pumpB = makePump('elution-pump-b', 3.5, 1.25);
  root.add(pumpA, pumpB);
  root.add(tubeBetween('elution-process-line-a', [-2.8, 0.8, 0], [0.1, 0.8, 1.15], 0.09, createEquipmentMaterial('carbonSteelPipe'), 16, { role: 'structure' }));
  root.add(tubeBetween('elution-process-line-b', [0.1, 2.4, 1.15], [2.75, 2.0, -0.95], 0.09, createEquipmentMaterial('carbonSteelPipe'), 16, { role: 'structure' }));
  root.add(tubeBetween('elution-process-line-c', [4.25, 2.0, -0.95], [4.45, 1.0, 1.25], 0.09, createEquipmentMaterial('carbonSteelPipe'), 16, { role: 'structure' }));
  const platform = boxMesh('elution-upper-platform', [4.0, 0.12, 2.0], dark.clone(), [-2.0, 4.45, 0], { role: 'structure' });
  root.add(platform);
  const rail = createHandrail({ length: 3.8, name: 'elution-platform-rail', posts: 4 });
  rail.position.set(-2.0, 4.55, -1.0);
  root.add(rail);
  const railBack = createHandrail({ length: 3.8, name: 'elution-platform-rail-back', posts: 4 });
  railBack.position.set(-2.0, 4.55, 1.0);
  root.add(railBack);
  for (const x of [-3.65, -0.35]) root.add(boxMesh(`elution-platform-column-${x}`, [0.16, 4.45, 0.16], dark.clone(), [x, 2.22, 0.82], { role: 'structure', lodTier: 1 }));
  root.add(tubeBetween('elution-solution-header', [-4.15, 1.0, -2.15], [4.2, 1.0, -2.15], 0.075, createEquipmentMaterial('carbonSteelPipe'), 16, { role: 'structure', lodTier: 1 }));

  return createAssetHandle({
    root,
    id: 'ELUTION-SKID-GENERIC',
    category: 'elution',
    name: 'Skid de elución',
    referenceClass: 'heated elution circuit skid',
    dimensions: DIMENSIONS,
    ports: [
      { id: 'loadedCarbonIn', type: 'materialIn', position: [-2.8, 5.2, 0], direction: [0, -1, 0] },
      { id: 'pregnantSolutionOut', type: 'slurryOut', position: [4.45, 1.0, 1.25], direction: [1, 0, 0], nominalDiameter: 0.1 },
      { id: 'barrenCarbonOut', type: 'materialOut', position: [-2.8, 0.35, 0.7], direction: [-1, 0, 0] },
    ],
    capabilities: { pumps: true, heatExchanger: true, internalSolution: true, instrumentationReady: true, inspection: true, cutaway: true, lod: true },
    update: (dt, elapsed) => {
      pumpA.rotation.x += dt * 0.15;
      pumpB.rotation.x += dt * 0.15;
      tankLiquid.scale.y = 1 + Math.sin(elapsed * 1.5) * 0.005;
    },
    lodDistances: [20, 48],
  });
}
