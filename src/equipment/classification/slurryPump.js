import * as THREE from 'three';
import { boxMesh, createAssetHandle, cylinderMesh, tagObject, tubeBetween } from '../common/assetUtils.js';
import { createEquipmentMaterial } from '../common/materialLibrary.js';
import { createCouplingGuard, createElectricMotor } from '../common/components.js';
import { animateSuspendedSolids, createSuspendedSolidsCloud } from '../common/slurryVisuals.js';

const DIMENSIONS = Object.freeze({ length: 4.8, width: 2.65, height: 2.55 });

export function createSlurryPumpAsset() {
  const root = new THREE.Group();
  root.name = 'ASSET-SLURRY-PUMP';
  const blue = createEquipmentMaterial('paintedBlueSteel');
  const steel = createEquipmentMaterial('bareSteel');
  const pipe = createEquipmentMaterial('carbonSteelPipe');
  const skid = boxMesh('pump-skid', [4.5, 0.18, 1.8], createEquipmentMaterial('darkStructuralSteel'), [0, 0.12, 0], { role: 'structure' });
  root.add(skid);

  const volute = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.3, 28, 64, Math.PI * 1.82), blue);
  volute.name = 'pump-volute';
  volute.position.set(-1.15, 1.05, 0);
  volute.rotation.y = Math.PI / 2;
  volute.castShadow = true;
  tagObject(volute, { role: 'shell' });
  root.add(volute);
  const casingHub = cylinderMesh('pump-casing-hub', 0.72, 0.72, 0.56, blue.clone(), [-1.15, 1.05, 0], 48, { role: 'shell' });
  casingHub.rotation.x = Math.PI / 2;
  root.add(casingHub);
  const suction = cylinderMesh('pump-suction-flange', 0.38, 0.38, 0.65, pipe.clone(), [-1.15, 1.05, 0.52], 32, { role: 'structure' });
  suction.rotation.x = Math.PI / 2;
  root.add(suction);
  const discharge = cylinderMesh('pump-discharge', 0.3, 0.3, 1.15, pipe.clone(), [-0.58, 1.92, 0], 30, { role: 'structure' });
  discharge.rotation.z = -Math.PI / 2;
  root.add(discharge);

  const impeller = new THREE.Group();
  impeller.name = 'pump-impeller';
  impeller.position.set(-1.15, 1.05, 0);
  root.add(impeller);
  const hub = cylinderMesh('impeller-hub', 0.18, 0.18, 0.44, steel.clone(), [0, 0, 0], 24, { role: 'interior' });
  hub.rotation.x = Math.PI / 2;
  impeller.add(hub);
  for (let i = 0; i < 7; i += 1) {
    const blade = boxMesh(`impeller-blade-${i}`, [0.68, 0.12, 0.2], steel.clone(), [0.31, 0, 0], { role: 'interior', lodTier: 1 });
    blade.rotation.z = (i / 7) * Math.PI * 2;
    impeller.add(blade);
  }

  const shaft = cylinderMesh('pump-shaft', 0.09, 0.09, 2.1, steel.clone(), [0.1, 1.05, 0], 20, { role: 'interior' });
  shaft.rotation.z = Math.PI / 2;
  root.add(shaft);
  const bearing = boxMesh('pump-bearing-frame', [1.05, 0.62, 0.76], createEquipmentMaterial('paintedGreySteel'), [0.25, 0.8, 0], { role: 'shell' });
  root.add(bearing);
  const guard = createCouplingGuard({ length: 0.72, radius: 0.24, name: 'pump-coupling-guard' });
  guard.position.set(1.05, 0.8, 0);
  root.add(guard);
  const motor = createElectricMotor({ length: 1.65, radius: 0.5, name: 'pump-motor' });
  motor.position.set(2.05, 0.8, 0);
  root.add(motor);

  const slurry = new THREE.Group();
  slurry.name = 'pump-slurry-path';
  slurry.add(cylinderMesh('pump-slurry-suction-core', 0.22, 0.22, 0.7, createEquipmentMaterial('slurry'), [-1.15, 1.05, 0.5], 24, { role: 'interior' }));
  slurry.children[0].rotation.x = Math.PI / 2;
  slurry.add(tubeBetween('pump-slurry-discharge-core', [-1.0, 1.42, 0], [-0.35, 1.92, 0], 0.18, createEquipmentMaterial('slurry'), 20, { role: 'interior' }));
  root.add(slurry);
  const suspendedSolids = createSuspendedSolidsCloud({ name: 'pump-suspended-solids', radius: 0.44, height: 0.58, count: 34, size: 0.04, opacity: 0.58, seed: 7, y: 1.05 });
  suspendedSolids.rotation.x = Math.PI / 2;
  suspendedSolids.position.x = -1.15;
  root.add(suspendedSolids);

  return createAssetHandle({
    root,
    id: 'SLURRY-PUMP-GENERIC',
    category: 'slurry-pump',
    name: 'Bomba centrífuga de pulpa',
    referenceClass: 'horizontal centrifugal slurry pump',
    dimensions: DIMENSIONS,
    ports: [
      { id: 'suction', type: 'suction', position: [-1.15, 1.05, 0.95], direction: [0, 0, 1], nominalDiameter: 0.3 },
      { id: 'discharge', type: 'discharge', position: [0.0, 1.92, 0], direction: [1, 0, 0], nominalDiameter: 0.25 },
    ],
    capabilities: { impellerRotation: true, slurryPath: true, cutaway: true, inspection: true, lod: true },
    update: (dt, elapsed) => {
      impeller.rotation.z -= dt * 5.6;
      slurry.scale.setScalar(1 + Math.sin(elapsed * 5) * 0.015);
      animateSuspendedSolids(suspendedSolids, dt, elapsed, { speed: 0.42, phase: 0.7 });
    },
    lodDistances: [15, 36],
  });
}
