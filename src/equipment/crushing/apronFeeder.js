import * as THREE from 'three';
import { boxMesh, createAssetHandle, cylinderMesh } from '../common/assetUtils.js';
import { createEquipmentMaterial } from '../common/materialLibrary.js';
import { createElectricMotor, createGearbox } from '../common/components.js';

const DIMENSIONS = Object.freeze({ length: 8.4, width: 2.8, height: 1.85 });

export function createApronFeederAsset() {
  const root = new THREE.Group();
  root.name = 'ASSET-APRON-FEEDER';
  const frame = createEquipmentMaterial('darkStructuralSteel');
  const panMat = createEquipmentMaterial('wearLiner');
  const guardMat = createEquipmentMaterial('paintedGreySteel');
  root.add(boxMesh('feeder-left-frame', [8.4, 0.32, 0.26], frame.clone(), [0, 0.58, -1.23], { role: 'structure' }));
  root.add(boxMesh('feeder-right-frame', [8.4, 0.32, 0.26], frame.clone(), [0, 0.58, 1.23], { role: 'structure' }));
  root.add(boxMesh('feeder-left-skirt', [7.5, 0.72, 0.12], guardMat.clone(), [-0.2, 1.28, -1.14], { role: 'shell' }));
  root.add(boxMesh('feeder-right-skirt', [7.5, 0.72, 0.12], guardMat.clone(), [-0.2, 1.28, 1.14], { role: 'shell' }));

  const pans = [];
  const panCount = 26;
  const feederSpeedMps = 0.45;
  const sprocketCenterY = 0.78;
  const sprocketRadius = 0.38;
  const topY = sprocketCenterY + sprocketRadius;
  const bottomY = sprocketCenterY - sprocketRadius;
  const runStart = -3.82;
  const runEnd = 3.82;
  const straightRun = runEnd - runStart;
  const arcLength = Math.PI * sprocketRadius;
  const loopLength = straightRun * 2 + arcLength * 2;

  function placePanOnLoop(pan, phase) {
    let distance = ((phase % 1) + 1) % 1 * loopLength;
    if (distance <= straightRun) {
      pan.position.set(runStart + distance, topY, 0);
      pan.rotation.z = 0;
      return;
    }
    distance -= straightRun;
    if (distance <= arcLength) {
      const p = distance / arcLength;
      const angle = Math.PI / 2 - p * Math.PI;
      pan.position.set(runEnd + Math.cos(angle) * sprocketRadius, sprocketCenterY + Math.sin(angle) * sprocketRadius, 0);
      pan.rotation.z = angle - Math.PI / 2;
      return;
    }
    distance -= arcLength;
    if (distance <= straightRun) {
      pan.position.set(runEnd - distance, bottomY, 0);
      pan.rotation.z = Math.PI;
      return;
    }
    distance -= straightRun;
    const p = Math.min(1, distance / arcLength);
    const angle = -Math.PI / 2 - p * Math.PI;
    pan.position.set(runStart + Math.cos(angle) * sprocketRadius, sprocketCenterY + Math.sin(angle) * sprocketRadius, 0);
    pan.rotation.z = angle - Math.PI / 2;
  }

  for (let i = 0; i < panCount; i += 1) {
    const pan = boxMesh(`apron-pan-${i}`, [0.38, 0.11, 2.42], panMat.clone(), [0, 0, 0], { role: 'shell', lodTier: i % 2 ? 1 : 0 });
    pan.userData.loopPhase = i / panCount;
    placePanOnLoop(pan, pan.userData.loopPhase);
    root.add(pan);
    pans.push(pan);
  }
  const sprockets = [];
  for (const x of [-3.82, 3.82]) {
    const rotor = new THREE.Group();
    rotor.name = `feeder-shaft-pivot-${x}`;
    rotor.position.set(x, sprocketCenterY, 0);
    rotor.userData.rotationAxis = 'z';
    const shaft = cylinderMesh(`feeder-shaft-${x}`, 0.26, 0.26, 2.65, createEquipmentMaterial('bareSteel'), [0, 0, 0], 28, { role: 'interior' });
    shaft.rotation.x = Math.PI / 2;
    rotor.add(shaft);
    for (const z of [-1.05, 1.05]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(sprocketRadius, 0.085, 10, 24), createEquipmentMaterial('wearLiner'));
      ring.name = `feeder-sprocket-${x}-${z}`;
      ring.position.z = z;
      ring.castShadow = true;
      rotor.add(ring);
      for (let toothIndex = 0; toothIndex < 8; toothIndex += 1) {
        const angle = toothIndex / 8 * Math.PI * 2;
        const tooth = boxMesh(`feeder-sprocket-tooth-${x}-${z}-${toothIndex}`, [0.11, 0.10, 0.16], createEquipmentMaterial('wearLiner'), [Math.cos(angle) * 0.45, Math.sin(angle) * 0.45, z], { role: 'structure', lodTier: 1 });
        tooth.rotation.z = angle;
        rotor.add(tooth);
      }
    }
    root.add(rotor);
    sprockets.push(rotor);
  }

  const motor = createElectricMotor({ length: 1.05, radius: 0.34, name: 'feeder-motor' });
  motor.position.set(3.35, 0.48, -1.9);
  root.add(motor);
  const gearbox = createGearbox({ size: [0.85, 0.72, 0.7], name: 'feeder-gearbox' });
  gearbox.position.set(2.25, 0.5, -1.9);
  root.add(gearbox);

  const orePieces = [];
  for (let i = 0; i < 18; i += 1) {
    const radius = 0.18 + (i % 4) * 0.035;
    const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(radius, 0), createEquipmentMaterial('ore'));
    mesh.name = `feeder-ore-${i}`;
    mesh.position.set(-3.6 + (i % 9) * 0.82, topY + 0.08 + radius * 0.66, -0.7 + (i % 4) * 0.45);
    mesh.rotation.set(i * 0.21, i * 0.31, i * 0.17);
    mesh.castShadow = true;
    mesh.userData.inspectionRole = 'interior';
    root.add(mesh);
    orePieces.push(mesh);
  }

  return createAssetHandle({
    root,
    id: 'APRON-FEEDER-GENERIC',
    category: 'feeder',
    name: 'Apron feeder de mineral grueso',
    referenceClass: 'heavy duty apron feeder',
    dimensions: DIMENSIONS,
    ports: [
      { id: 'feedIn', type: 'materialIn', position: [-3.8, 1.25, 0], direction: [1, 0, 0] },
      { id: 'dischargeOut', type: 'materialOut', position: [4.2, 1.0, 0], direction: [1, 0, 0] },
    ],
    capabilities: { movingPans: true, oreTransport: true, drive: true, inspection: true, lod: true },
    update: (dt) => {
      const safeDt = Math.min(Math.max(Number(dt) || 0, 0), 0.1);
      pans.forEach((pan) => {
        pan.userData.loopPhase = (pan.userData.loopPhase + safeDt * feederSpeedMps / loopLength) % 1;
        placePanOnLoop(pan, pan.userData.loopPhase);
      });
      sprockets.forEach((rotor) => { rotor.rotation.z -= safeDt * feederSpeedMps / sprocketRadius; });
      orePieces.forEach((ore, index) => {
        ore.position.x += safeDt * feederSpeedMps;
        ore.rotation.y += safeDt * 0.12;
        ore.position.y = topY + 0.08 + ore.geometry.parameters.radius * 0.66;
        if (ore.position.x > runEnd + 0.15) ore.position.x = runStart + 0.18;
      });
    },
    lodDistances: [16, 38],
  });
}
