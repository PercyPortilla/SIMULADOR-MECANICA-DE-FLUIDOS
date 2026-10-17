import * as THREE from 'three';
import { boxMesh, createAssetHandle, cylinderMesh, tubeBetween } from '../common/assetUtils.js';
import { createEquipmentMaterial } from '../common/materialLibrary.js';
import { createElectricMotor, createHandrail, createLadder, createWorkLight } from '../common/components.js';

const DIMENSIONS = Object.freeze({ length: 5.4, width: 4.2, height: 4.7 });

export function createJawCrusherAsset() {
  const root = new THREE.Group();
  root.name = 'ASSET-JAW-CRUSHER';
  const frameMat = createEquipmentMaterial('paintedGreySteel');
  const linerMat = createEquipmentMaterial('wearLiner');
  const dark = createEquipmentMaterial('darkStructuralSteel');
  const base = boxMesh('crusher-base', [5.0, 0.45, 3.8], dark, [0, 0.28, 0], { role: 'structure' });
  root.add(base);
  for (const x of [-2.0, 2.0]) {
    for (const z of [-1.45, 1.45]) root.add(boxMesh(`crusher-support-${x}-${z}`, [0.42, 1.05, 0.42], dark.clone(), [x, 0.96, z], { role: 'structure' }));
  }

  const shell = new THREE.Group();
  shell.name = 'crusher-shell';
  shell.position.y = 1.55;
  root.add(shell);
  shell.add(boxMesh('crusher-side-l', [3.7, 2.75, 0.22], frameMat.clone(), [0, 1.15, -1.55], { role: 'shell' }));
  shell.add(boxMesh('crusher-side-r', [3.7, 2.75, 0.22], frameMat.clone(), [0, 1.15, 1.55], { role: 'shell' }));
  shell.add(boxMesh('crusher-back-frame', [0.3, 2.65, 3.2], frameMat.clone(), [-1.65, 1.1, 0], { role: 'shell' }));

  const fixedJaw = boxMesh('fixed-jaw', [0.34, 2.55, 2.5], linerMat, [-0.72, 1.05, 0], { role: 'interior' });
  fixedJaw.rotation.z = -0.24;
  shell.add(fixedJaw);
  const movingPivot = new THREE.Group();
  movingPivot.name = 'moving-jaw-pivot';
  movingPivot.position.set(1.0, 2.22, 0);
  shell.add(movingPivot);
  const movingJaw = boxMesh('moving-jaw', [0.38, 2.45, 2.5], linerMat.clone(), [-0.55, -1.0, 0], { role: 'interior' });
  movingJaw.rotation.z = 0.18;
  movingPivot.add(movingJaw);
  for (let i = 0; i < 8; i += 1) {
    const rib = boxMesh(`jaw-rib-${i}`, [0.12, 2.25, 0.08], createEquipmentMaterial('bareSteel'), [-0.54, -1.0, -1.03 + i * 0.3], { role: 'interior', lodTier: 1 });
    rib.rotation.z = 0.18;
    movingPivot.add(rib);
  }

  const eccentricRotor = new THREE.Group();
  eccentricRotor.name = 'eccentric-shaft-pivot';
  eccentricRotor.position.set(0.55, 3.62, 0);
  eccentricRotor.userData.rotationAxis = 'z';
  const eccentric = cylinderMesh('eccentric-shaft', 0.23, 0.23, 3.85, createEquipmentMaterial('bareSteel'), [0, 0, 0], 28, { role: 'interior' });
  eccentric.rotation.x = Math.PI / 2;
  eccentricRotor.add(eccentric);
  root.add(eccentricRotor);
  const flywheels = [];
  for (const z of [-1.96, 1.96]) {
    const wheel = new THREE.Group();
    wheel.name = `crusher-flywheel-${z}`;
    wheel.position.set(0.55, 3.62, z);
    wheel.userData.rotationAxis = 'z';
    const wheelMaterial = createEquipmentMaterial('paintedOrangeSteel');
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.16, 12, 36), wheelMaterial);
    rim.name = `${wheel.name}-rim`;
    rim.castShadow = true;
    wheel.add(rim);
    const hub = cylinderMesh(`${wheel.name}-hub`, 0.24, 0.24, 0.26, createEquipmentMaterial('bareSteel'), [0, 0, 0], 24, { role: 'structure' });
    hub.rotation.x = Math.PI / 2;
    wheel.add(hub);
    for (let index = 0; index < 6; index += 1) {
      const angle = index / 6 * Math.PI * 2;
      const spoke = boxMesh(`${wheel.name}-spoke-${index + 1}`, [0.92, 0.11, 0.11], wheelMaterial.clone(), [Math.cos(angle) * 0.34, Math.sin(angle) * 0.34, 0], { role: 'structure', lodTier: 1 });
      spoke.rotation.z = angle;
      wheel.add(spoke);
    }
    root.add(wheel);
    flywheels.push(wheel);
  }
  const motor = createElectricMotor({ length: 1.5, radius: 0.45, name: 'crusher-drive-motor', colorRole: 'paintedBlueSteel' });
  motor.position.set(-1.45, 1.0, -2.05);
  root.add(motor);
  root.add(tubeBetween('crusher-drive-shaft', [-0.7, 1.0, -2.05], [0.55, 3.62, -1.96], 0.08, createEquipmentMaterial('bareSteel'), 14, { role: 'interior', lodTier: 1 }));

  const feedChute = boxMesh('crusher-feed-chute', [2.3, 0.18, 3.3], frameMat.clone(), [-0.25, 4.15, 0], { role: 'shell' });
  feedChute.rotation.z = -0.18;
  root.add(feedChute);
  const feedGuardLeft = boxMesh('crusher-feed-guard-left', [2.5, 1.0, 0.16], frameMat.clone(), [-0.35, 4.45, -1.58], { role: 'shell' });
  feedGuardLeft.rotation.z = -0.14;
  root.add(feedGuardLeft);
  const feedGuardRight = feedGuardLeft.clone();
  feedGuardRight.name = 'crusher-feed-guard-right';
  feedGuardRight.position.z = 1.58;
  root.add(feedGuardRight);
  const discharge = boxMesh('crusher-discharge-chute', [1.8, 0.15, 2.55], frameMat.clone(), [0.25, 0.72, 0], { role: 'shell' });
  discharge.rotation.z = -0.22;
  root.add(discharge);
  const platform = boxMesh('crusher-service-platform', [4.6, 0.12, 0.95], dark.clone(), [0, 2.65, -2.0], { role: 'structure' });
  root.add(platform);
  const rail = createHandrail({ length: 4.3, name: 'crusher-service-rail' });
  rail.position.set(0, 2.7, -2.42);
  root.add(rail);

  // V23 keeps access/safety hardware as a procedural overlay so it stays
  // visible when the Blender crusher replaces the base geometry. It does not
  // touch ports, foundations or the jaw/flywheel animation pivots.
  const safetyOverlay = new THREE.Group();
  safetyOverlay.name = 'PRIMARY-CRUSHER-v23-safety-overlay';
  safetyOverlay.userData.v23MechanicalDetail = true;
  const ladder = createLadder({
    width: 0.62,
    height: 2.62,
    rungSpacing: 0.29,
    name: 'crusher-service-ladder',
  });
  ladder.position.set(-1.75, 0.08, -2.48);
  safetyOverlay.add(ladder);

  const flywheelGuard = new THREE.Group();
  flywheelGuard.name = 'crusher-service-flywheel-guard';
  const guardMat = createEquipmentMaterial('safetyYellow');
  const guardCenterX = 0.55;
  const guardCenterY = 3.62;
  const guardZ = -2.20;
  const guardHalf = 0.92;
  flywheelGuard.add(
    boxMesh('crusher-flywheel-guard-top', [1.90, 0.07, 0.07], guardMat.clone(), [guardCenterX, guardCenterY + guardHalf, guardZ], { role: 'structure', lodTier: 1 }),
    boxMesh('crusher-flywheel-guard-bottom', [1.90, 0.07, 0.07], guardMat.clone(), [guardCenterX, guardCenterY - guardHalf, guardZ], { role: 'structure', lodTier: 1 }),
    boxMesh('crusher-flywheel-guard-left', [0.07, 1.90, 0.07], guardMat.clone(), [guardCenterX - guardHalf, guardCenterY, guardZ], { role: 'structure', lodTier: 1 }),
    boxMesh('crusher-flywheel-guard-right', [0.07, 1.90, 0.07], guardMat.clone(), [guardCenterX + guardHalf, guardCenterY, guardZ], { role: 'structure', lodTier: 1 }),
  );
  safetyOverlay.add(flywheelGuard);
  safetyOverlay.add(boxMesh(
    'crusher-emergency-stop-box',
    [0.22, 0.34, 0.18],
    createEquipmentMaterial('warningRed'),
    [1.70, 2.96, -2.34],
    { role: 'structure', lodTier: 1 },
  ));
  const serviceLight = createWorkLight({ name: 'crusher-service-work-light' });
  serviceLight.position.set(-1.62, 3.30, -2.28);
  serviceLight.rotation.z = -0.35;
  safetyOverlay.add(serviceLight);
  root.add(safetyOverlay);
  root.userData.v23MechanicalDetail = true;
  root.userData.v23SafetyOverlayParts = safetyOverlay.children.length;

  const ore = [];
  for (let i = 0; i < 12; i += 1) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2 + (i % 4) * 0.05, 0), createEquipmentMaterial(i < 6 ? 'ore' : 'crushedOre'));
    rock.name = `crusher-ore-${i}`;
    rock.position.set(-0.15 + ((i % 3) - 1) * 0.32, 3.65 - (i % 6) * 0.48, ((i % 4) - 1.5) * 0.33);
    rock.castShadow = true;
    rock.userData.inspectionRole = 'interior';
    root.add(rock);
    ore.push(rock);
  }

  return createAssetHandle({
    root,
    id: 'PRIMARY-JAW-CRUSHER-GENERIC',
    category: 'primary-crusher',
    name: 'Chancadora primaria de mandíbulas',
    referenceClass: 'industrial jaw crusher ~1.2 m feed opening class',
    dimensions: DIMENSIONS,
    ports: [
      { id: 'feedIn', type: 'materialIn', position: [-0.4, 4.55, 0], direction: [0, -1, 0] },
      { id: 'dischargeOut', type: 'materialOut', position: [0.8, 0.55, 0], direction: [1, -0.3, 0] },
    ],
    capabilities: { jawOscillation: true, flywheelRotation: true, oreFlow: true, inspection: true, cutaway: true, lod: true },
    update: (dt, elapsed) => {
      movingPivot.rotation.z = Math.sin(elapsed * 4.4) * 0.028;
      flywheels.forEach((wheel) => { wheel.rotation.z -= dt * 3.3; });
      eccentricRotor.rotation.z -= dt * 3.3;
      ore.forEach((rock, index) => {
        const phase = (elapsed * (0.12 + (index % 3) * 0.012) + index / ore.length) % 1;
        rock.position.y = 4.05 - phase * 3.05;
        rock.position.x = -0.18 + ((index % 3) - 1) * 0.28 + Math.sin(elapsed * 1.6 + index) * 0.035;
        rock.rotation.x += dt * 0.18;
        rock.rotation.y += dt * 0.11;
      });
    },
    lodDistances: [18, 44],
  });
}
