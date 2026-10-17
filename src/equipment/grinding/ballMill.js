import * as THREE from 'three';
import { addBoltCircle, boxMesh, createAssetHandle, cylinderMesh, sphereMesh, tagObject, tubeBetween } from '../common/assetUtils.js';
import { createEquipmentMaterial } from '../common/materialLibrary.js';
import { createCouplingGuard, createElectricMotor, createGearbox, createHandrail } from '../common/components.js';

const DIMENSIONS = Object.freeze({ length: 10.6, width: 6.1, height: 5.65 });
const SHELL_DIAMETER = 4.5;
const SHELL_LENGTH = 7.0;
const AXIS_Y = 3.05;

function makeRingGear() {
  const gear = new THREE.Group();
  gear.name = 'mill-girth-gear';
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.43, 0.18, 18, 64), createEquipmentMaterial('bareSteel'));
  ring.rotation.y = Math.PI / 2;
  ring.name = 'girth-gear-ring';
  ring.castShadow = true;
  tagObject(ring, { role: 'structure' });
  gear.add(ring);
  for (let i = 0; i < 48; i += 1) {
    const a = (i / 48) * Math.PI * 2;
    const tooth = boxMesh(`girth-tooth-${i}`, [0.22, 0.19, 0.18], createEquipmentMaterial('bareSteel'), [0, Math.sin(a) * 2.59, Math.cos(a) * 2.59], { role: 'structure', lodTier: 2 });
    tooth.rotation.x = a;
    gear.add(tooth);
  }
  return gear;
}

export function createBallMillAsset() {
  const root = new THREE.Group();
  root.name = 'ASSET-BALL-MILL';
  const staticGroup = new THREE.Group();
  staticGroup.name = 'mill-static-group';
  const rotatingGroup = new THREE.Group();
  rotatingGroup.name = 'mill-rotating-group';
  rotatingGroup.position.y = AXIS_Y;
  root.add(staticGroup, rotatingGroup);

  const shellMat = createEquipmentMaterial('paintedGreySteel');
  const steel = createEquipmentMaterial('bareSteel');
  const dark = createEquipmentMaterial('darkStructuralSteel');

  const shell = cylinderMesh('mill-shell', SHELL_DIAMETER / 2, SHELL_DIAMETER / 2, SHELL_LENGTH, shellMat, [0, 0, 0], 64, { role: 'shell' });
  shell.rotation.z = Math.PI / 2;
  rotatingGroup.add(shell);
  const headL = cylinderMesh('mill-head-left', 2.3, 1.38, 0.42, shellMat.clone(), [-SHELL_LENGTH / 2 - 0.18, 0, 0], 48, { role: 'shell' });
  headL.rotation.z = Math.PI / 2;
  const headR = cylinderMesh('mill-head-right', 1.38, 2.3, 0.42, shellMat.clone(), [SHELL_LENGTH / 2 + 0.18, 0, 0], 48, { role: 'shell' });
  headR.rotation.z = Math.PI / 2;
  rotatingGroup.add(headL, headR);
  const trunnionL = cylinderMesh('mill-feed-trunnion-rotating', 0.68, 0.68, 1.12, steel.clone(), [-4.0, 0, 0], 36, { role: 'structure' });
  trunnionL.rotation.z = Math.PI / 2;
  const trunnionR = trunnionL.clone();
  trunnionR.name = 'mill-discharge-trunnion-rotating';
  trunnionR.position.x = 4.0;
  rotatingGroup.add(trunnionL, trunnionR);
  const gear = makeRingGear();
  gear.position.x = 2.65;
  rotatingGroup.add(gear);

  const liners = new THREE.Group();
  liners.name = 'mill-liners';
  for (let i = 0; i < 24; i += 1) {
    const a = (i / 24) * Math.PI * 2;
    const liner = boxMesh(`mill-liner-${i}`, [SHELL_LENGTH * 0.9, 0.1, 0.22], createEquipmentMaterial('wearLiner'), [0, Math.sin(a) * 2.05, Math.cos(a) * 2.05], { role: 'interior', lodTier: 1 });
    liner.rotation.x = a;
    liners.add(liner);
  }
  rotatingGroup.add(liners);
  const charge = new THREE.Group();
  charge.name = 'mill-charge';
  for (let i = 0; i < 46; i += 1) {
    const ball = sphereMesh(`grinding-ball-${i}`, 0.10 + (i % 5) * 0.012, createEquipmentMaterial('bareSteel'), [-2.8 + (i % 12) * 0.5, -1.25 + ((i * 7) % 6) * 0.16, -1.4 + ((i * 11) % 10) * 0.28], { role: 'interior', lodTier: 2 });
    charge.add(ball);
  }
  const oreBed = boxMesh('mill-ore-charge', [5.8, 0.7, 2.9], createEquipmentMaterial('slurry'), [0, -1.45, 0], { role: 'interior', lodTier: 1 });
  charge.add(oreBed);
  rotatingGroup.add(charge);

  for (const x of [-3.9, 3.9]) {
    staticGroup.add(boxMesh(`mill-concrete-foundation-${x}`, [1.45, 1.15, 4.5], createEquipmentMaterial('concrete'), [x, 0.575, 0], { role: 'structure' }));
    const bearing = cylinderMesh(`mill-bearing-${x}`, 1.05, 1.05, 1.0, dark.clone(), [x, AXIS_Y, 0], 36, { role: 'structure' });
    bearing.rotation.z = Math.PI / 2;
    staticGroup.add(bearing);
    const cap = boxMesh(`mill-bearing-cap-${x}`, [1.15, 0.55, 2.3], shellMat.clone(), [x, AXIS_Y + 0.65, 0], { role: 'shell' });
    staticGroup.add(cap);
  }

  const motor = createElectricMotor({ length: 1.8, radius: 0.55, name: 'mill-drive-motor', colorRole: 'paintedBlueSteel' });
  motor.position.set(1.4, 1.2, -3.15);
  staticGroup.add(motor);
  const gearbox = createGearbox({ size: [1.4, 1.1, 1.1], name: 'mill-main-gearbox' });
  gearbox.position.set(0.0, 1.2, -3.15);
  staticGroup.add(gearbox);
  const guard = createCouplingGuard({ length: 0.75, radius: 0.28, name: 'mill-coupling-guard' });
  guard.position.set(0.72, 1.2, -3.15);
  staticGroup.add(guard);
  const pinion = cylinderMesh('mill-pinion', 0.43, 0.43, 0.42, steel.clone(), [2.65, 1.25, -2.55], 28, { role: 'interior' });
  pinion.rotation.x = Math.PI / 2;
  staticGroup.add(pinion);
  staticGroup.add(tubeBetween('mill-pinion-shaft', [0.65, 1.2, -3.15], [2.65, 1.25, -2.55], 0.12, steel.clone(), 18, { role: 'interior', lodTier: 1 }));

  const feedChute = boxMesh('mill-feed-chute', [2.0, 0.32, 1.25], shellMat.clone(), [-4.75, 3.35, 0], { role: 'shell' });
  feedChute.rotation.z = -0.3;
  staticGroup.add(feedChute);
  const trommel = cylinderMesh('mill-trommel', 0.85, 0.85, 1.7, createEquipmentMaterial('paintedGreySteel', { wireframe: false }), [4.85, AXIS_Y, 0], 36, { role: 'shell' });
  trommel.rotation.z = Math.PI / 2;
  rotatingGroup.add(trommel);
  for (let i = 0; i < 8; i += 1) {
    const bar = tubeBetween(`trommel-bar-${i}`, [4.05, -0.68 + i * 0.19, -0.55], [5.65, -0.68 + i * 0.19, -0.55], 0.025, steel.clone(), 10, { role: 'interior', lodTier: 2 });
    rotatingGroup.add(bar);
  }

  const serviceDeck = boxMesh('mill-service-deck', [7.4, 0.12, 1.1], dark.clone(), [0, 1.2, 3.0], { role: 'structure' });
  staticGroup.add(serviceDeck);
  const rail = createHandrail({ length: 7.0, name: 'mill-service-rail', posts: 5 });
  rail.position.set(0, 1.25, 3.5);
  staticGroup.add(rail);
  addBoltCircle(staticGroup, { radius: 0.76, count: 12, boltRadius: 0.045, y: 0, material: steel.clone(), axis: 'x', lodTier: 2 });

  const handle = createAssetHandle({
    root,
    id: 'BALL-MILL-GENERIC-4P5X7',
    category: 'ball-mill',
    name: 'Molino de bolas Ø4.5 × 7 m',
    referenceClass: 'medium industrial ball mill',
    dimensions: DIMENSIONS,
    ports: [
      { id: 'feedIn', type: 'materialIn', position: [-5.2, AXIS_Y + 0.2, 0], direction: [1, 0, 0] },
      { id: 'slurryOut', type: 'slurryOut', position: [5.45, AXIS_Y, 0], direction: [1, 0, 0], nominalDiameter: 0.45 },
    ],
    capabilities: { shellRotation: true, internals: true, cutaway: true, transparent: true, trommel: true, lod: true },
    update: (dt) => {
      // CRITICAL: only the rotating assembly turns around the mill's local X axis.
      rotatingGroup.rotation.x -= dt * 0.34;
      pinion.rotation.z += dt * 1.72;
    },
    lodDistances: [24, 58],
  });
  handle.staticGroup = staticGroup;
  handle.rotatingGroup = rotatingGroup;
  handle.axisY = AXIS_Y;
  return handle;
}
