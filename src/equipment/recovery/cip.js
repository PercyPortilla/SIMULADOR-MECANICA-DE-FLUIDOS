import * as THREE from 'three';
import { boxMesh, createAssetHandle, cylinderMesh, tubeBetween } from '../common/assetUtils.js';
import { createEquipmentMaterial } from '../common/materialLibrary.js';
import { createElectricMotor, createHandrail, createLadder } from '../common/components.js';

const DIMENSIONS = Object.freeze({ length: 13.8, width: 7.4, height: 6.9 });

function makeCipTank(index, x) {
  const group = new THREE.Group();
  group.name = `cip-tank-${index + 1}`;
  group.position.x = x;
  const shell = cylinderMesh(`cip-shell-${index + 1}`, 1.55, 1.55, 4.9, createEquipmentMaterial('paintedGreySteel'), [0, 2.5, 0], 48, { role: 'shell' });
  group.add(shell);
  const slurry = cylinderMesh(`cip-slurry-${index + 1}`, 1.46, 1.46, 4.1, createEquipmentMaterial('slurry'), [0, 2.1, 0], 48, { role: 'interior' });
  group.add(slurry);
  const shaft = cylinderMesh(`cip-shaft-${index + 1}`, 0.055, 0.055, 4.7, createEquipmentMaterial('stainlessSteel'), [0, 3.1, 0], 16, { role: 'interior' });
  group.add(shaft);
  const impeller = new THREE.Group();
  impeller.name = `cip-impeller-${index + 1}`;
  impeller.position.y = 1.25;
  for (let i = 0; i < 4; i += 1) {
    const blade = boxMesh(`cip-blade-${index}-${i}`, [1.55, 0.08, 0.22], createEquipmentMaterial('stainlessSteel'), [0.72, 0, 0], { role: 'interior', lodTier: 1 });
    blade.rotation.y = i * Math.PI / 2;
    impeller.add(blade);
  }
  group.add(impeller);
  const motor = createElectricMotor({ length: 0.85, radius: 0.32, name: `cip-motor-${index + 1}`, colorRole: 'paintedBlueSteel' });
  motor.position.set(0, 5.48, 0);
  motor.rotation.z = Math.PI / 2;
  group.add(motor);
  const screen = cylinderMesh(`cip-interstage-screen-${index + 1}`, 0.32, 0.32, 1.2, createEquipmentMaterial('stainlessSteel', { wireframe: true }), [1.08, 4.2, 0], 22, { role: 'interior', lodTier: 1 });
  group.add(screen);
  group.userData.impeller = impeller;
  group.userData.slurry = slurry;
  return group;
}

export function createCipAsset() {
  const root = new THREE.Group();
  root.name = 'ASSET-CIP';
  const dark = createEquipmentMaterial('darkStructuralSteel');
  root.add(boxMesh('cip-common-platform', [13.2, 0.16, 6.0], dark, [0, 4.85, 0], { role: 'structure' }));
  for (const x of [-5.8, -1.95, 1.95, 5.8]) {
    for (const z of [-2.55, 2.55]) root.add(boxMesh(`cip-platform-leg-${x}-${z}`, [0.18, 4.85, 0.18], dark.clone(), [x, 2.42, z], { role: 'structure', lodTier: 1 }));
  }
  const tanks = [-5.0, -1.68, 1.68, 5.0].map((x, index) => {
    const tank = makeCipTank(index, x);
    root.add(tank);
    return tank;
  });
  const railA = createHandrail({ length: 12.5, name: 'cip-front-rail', posts: 7 });
  railA.position.set(0, 4.96, -2.95);
  root.add(railA);
  const railB = createHandrail({ length: 12.5, name: 'cip-back-rail', posts: 7 });
  railB.position.set(0, 4.96, 2.95);
  root.add(railB);
  const accessLadder = createLadder({ height: 4.85, width: 0.7, name: 'cip-access-ladder' });
  accessLadder.position.set(-6.25, 0.08, -2.72);
  root.add(accessLadder);
  const serviceDeck = boxMesh('cip-service-deck', [2.0, 0.14, 1.15], dark.clone(), [-5.55, 4.86, -2.35], { role: 'structure' });
  root.add(serviceDeck);

  for (const [name, x] of [['cip-pump-a', -3.6], ['cip-pump-b', 3.6]]) {
    const skid = boxMesh(`${name}-skid`, [2.1, 0.14, 1.25], dark.clone(), [x, 0.12, -3.0], { role: 'structure', lodTier: 1 });
    root.add(skid);
    const pump = createElectricMotor({ length: 0.95, radius: 0.30, name: `${name}-motor`, colorRole: 'paintedBlueSteel' });
    pump.position.set(x, 0.62, -3.0);
    root.add(pump);
  }
  root.userData.v24MechanicalDetail = true;
  root.userData.v24MechanicalDetailParts = Object.freeze([
    'cip-access-ladder',
    'cip-service-deck',
    'cip-pump-a-skid',
    'cip-pump-a-motor',
    'cip-pump-b-skid',
    'cip-pump-b-motor',
  ]);

  for (let i = 0; i < 3; i += 1) {
    const x0 = tanks[i].position.x + 1.55;
    const x1 = tanks[i + 1].position.x - 1.55;
    root.add(tubeBetween(`cip-transfer-pipe-${i}`, [x0, 4.0, -1.0], [x1, 4.0, -1.0], 0.12, createEquipmentMaterial('carbonSteelPipe'), 18, { role: 'structure' }));
  }
  const carbonLine = tubeBetween('cip-carbon-transfer-header', [-5.6, 5.55, 2.25], [5.6, 5.55, 2.25], 0.08, createEquipmentMaterial('carbonSteelPipe'), 16, { role: 'structure', lodTier: 1 });
  root.add(carbonLine);

  return createAssetHandle({
    root,
    id: 'CIP-ADSORPTION-GENERIC',
    category: 'cip',
    name: 'Módulo CIP de adsorción',
    referenceClass: 'four-stage carbon-in-pulp adsorption module',
    dimensions: DIMENSIONS,
    ports: [
      { id: 'feed', type: 'slurryIn', position: [-6.7, 4.0, -1.0], direction: [1, 0, 0], nominalDiameter: 0.22 },
      { id: 'slurryOut', type: 'slurryOut', position: [6.7, 4.0, -1.0], direction: [1, 0, 0], nominalDiameter: 0.22 },
      { id: 'loadedCarbonOut', type: 'materialOut', position: [-5.6, 5.55, 2.25], direction: [-1, 0, 0], nominalDiameter: 0.08 },
      { id: 'barrenCarbonIn', type: 'materialIn', position: [5.6, 5.55, 2.25], direction: [-1, 0, 0], nominalDiameter: 0.08 },
    ],
    capabilities: { agitation: true, interstageScreens: true, localPiping: true, inspection: true, cutaway: true, lod: true },
    update: (dt, elapsed) => {
      tanks.forEach((tank, index) => {
        tank.userData.impeller.rotation.y += dt * (0.82 + index * 0.05);
        tank.userData.slurry.rotation.y += dt * 0.018;
        tank.userData.slurry.scale.y = 1 + Math.sin(elapsed * 1.4 + index) * 0.006;
      });
    },
    lodDistances: [24, 58],
  });
}
