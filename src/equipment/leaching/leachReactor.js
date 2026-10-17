import * as THREE from 'three';
import { boxMesh, createAssetHandle, cylinderMesh, tubeBetween } from '../common/assetUtils.js';
import { createEquipmentMaterial } from '../common/materialLibrary.js';
import { createElectricMotor, createGearbox, createHandrail, createLadder } from '../common/components.js';
import { animateSuspendedSolids, createSuspendedSolidsCloud } from '../common/slurryVisuals.js';

const DIMENSIONS = Object.freeze({ length: 7.6, width: 7.6, height: 8.8 });

export function createLeachReactorAsset() {
  const root = new THREE.Group();
  root.name = 'ASSET-LEACH-REACTOR';
  const shellMat = createEquipmentMaterial('paintedGreySteel');
  const frame = createEquipmentMaterial('darkStructuralSteel');
  const shell = cylinderMesh('leach-tank-shell', 3.5, 3.5, 7.2, shellMat, [0, 3.65, 0], 64, { role: 'shell' });
  root.add(shell);
  const bottom = cylinderMesh('leach-tank-bottom', 3.5, 3.2, 0.25, createEquipmentMaterial('wearLiner'), [0, 0.18, 0], 64, { role: 'interior' });
  root.add(bottom);
  const slurry = cylinderMesh('leach-slurry', 3.34, 3.34, 5.9, createEquipmentMaterial('slurry'), [0, 3.02, 0], 64, { role: 'interior' });
  root.add(slurry);
  const suspendedSolids = createSuspendedSolidsCloud({ name: 'leach-slurry-suspended-solids', radius: 3.02, height: 5.45, count: 150, size: 0.05, opacity: 0.46, seed: 23, y: 3.02 });
  root.add(suspendedSolids);

  const bridge = boxMesh('reactor-top-bridge', [7.3, 0.28, 1.2], frame, [0, 7.55, 0], { role: 'structure' });
  root.add(bridge);
  const motor = createElectricMotor({ length: 1.25, radius: 0.43, name: 'reactor-agitator-motor' });
  motor.position.set(0, 8.1, 0);
  motor.rotation.z = Math.PI / 2;
  root.add(motor);
  const gearbox = createGearbox({ size: [0.9, 0.72, 0.72], name: 'reactor-gearbox' });
  gearbox.position.set(0, 7.75, 0);
  gearbox.rotation.z = Math.PI / 2;
  root.add(gearbox);

  const agitator = new THREE.Group();
  agitator.name = 'reactor-agitator';
  root.add(agitator);
  const shaft = cylinderMesh('reactor-agitator-shaft', 0.09, 0.09, 6.4, createEquipmentMaterial('stainlessSteel'), [0, 4.25, 0], 20, { role: 'interior' });
  agitator.add(shaft);
  for (const y of [1.65, 3.05]) {
    const hub = cylinderMesh(`reactor-impeller-hub-${y}`, 0.22, 0.22, 0.28, createEquipmentMaterial('stainlessSteel'), [0, y, 0], 20, { role: 'interior' });
    agitator.add(hub);
    for (let i = 0; i < 4; i += 1) {
      const blade = boxMesh(`reactor-impeller-${y}-${i}`, [2.2, 0.14, 0.34], createEquipmentMaterial('stainlessSteel'), [1.02, y, 0], { role: 'interior', lodTier: 1 });
      blade.rotation.y = (i / 4) * Math.PI * 2;
      agitator.add(blade);
    }
  }
  for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    const baffle = boxMesh(`reactor-baffle-${a}`, [0.12, 5.5, 0.5], createEquipmentMaterial('stainlessSteel'), [Math.cos(a) * 3.05, 3.2, Math.sin(a) * 3.05], { role: 'interior' });
    baffle.rotation.y = -a;
    root.add(baffle);
  }
  const topWalkway = boxMesh('reactor-top-walkway', [6.4, 0.14, 1.05], frame.clone(), [0, 7.54, -3.18], { role: 'structure' });
  root.add(topWalkway);
  const topRail = createHandrail({ length: 6.2, name: 'reactor-top-rail', posts: 5 });
  topRail.position.set(0, 7.62, -3.70);
  root.add(topRail);
  const ladder = createLadder({ height: 7.2, name: 'reactor-access-ladder' });
  ladder.position.set(-3.58, 0.2, 0);
  ladder.rotation.y = Math.PI / 2;
  root.add(ladder);
  const inlet = tubeBetween('reactor-inlet-nozzle', [-4.0, 6.2, 0], [-3.25, 6.2, 0], 0.14, createEquipmentMaterial('carbonSteelPipe'), 18, { role: 'structure' });
  root.add(inlet);
  const outlet = tubeBetween('reactor-overflow-nozzle', [3.25, 5.7, 0], [4.0, 5.7, 0], 0.14, createEquipmentMaterial('carbonSteelPipe'), 18, { role: 'structure' });
  root.add(outlet);

  return createAssetHandle({
    root,
    id: 'LEACH-REACTOR-GENERIC-7M',
    category: 'leach-reactor',
    name: 'Reactor agitado de lixiviación',
    referenceClass: '7 m diameter mechanically agitated leach reactor',
    dimensions: DIMENSIONS,
    ports: [
      { id: 'feedIn', type: 'slurryIn', position: [-4.0, 6.2, 0], direction: [1, 0, 0], nominalDiameter: 0.25 },
      { id: 'overflowOut', type: 'slurryOut', position: [4.0, 5.7, 0], direction: [1, 0, 0], nominalDiameter: 0.25 },
      { id: 'drain', type: 'slurryOut', position: [0, 0.15, 3.7], direction: [0, 0, 1], nominalDiameter: 0.15 },
      { id: 'reagentIn', type: 'reagentIn', position: [-1.2, 7.45, 0], direction: [0, -1, 0], nominalDiameter: 0.08 },
    ],
    capabilities: { agitation: true, slurrySurface: true, baffles: true, transparent: true, cutaway: true, inspection: true, lod: true },
    update: (dt, elapsed, handle) => {
      const phase = Number(handle.root.userData.animationPhaseOffset || 0);
      agitator.rotation.y -= dt * (0.88 + phase * 0.035);
      slurry.scale.y = 1 + Math.sin(elapsed * 1.8 + phase) * 0.008;
      slurry.rotation.y += dt * 0.035;
      animateSuspendedSolids(suspendedSolids, dt, elapsed, { speed: 0.08 + phase * 0.004, phase });
    },
    lodDistances: [22, 52],
  });
}
