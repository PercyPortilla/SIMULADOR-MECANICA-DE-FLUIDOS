import * as THREE from 'three';
import { boxMesh, cylinderMesh, createAssetHandle, tagObject, tubeBetween } from '../common/assetUtils.js';
import { createEquipmentMaterial } from '../common/materialLibrary.js';
import { createHandrail, createHydraulicCylinder, createMiningWheel, createWorkLight } from '../common/components.js';
import { createWedgeBody } from '../common/geometry.js';

const DIMENSIONS = Object.freeze({ length: 10.0, width: 5.25, height: 5.05 });

function createDumpBody() {
  const pivot = new THREE.Group();
  pivot.name = 'haul-truck-dump-pivot';
  pivot.position.set(-2.7, 2.48, 0);
  pivot.userData.dumpHinge = 'rear';
  pivot.userData.dumpAxis = 'local-z';
  pivot.userData.dumpDirection = 'rearward';
  const body = new THREE.Group();
  body.position.set(1.55, 0.22, 0);
  const yellow = createEquipmentMaterial('paintedYellowSteel');
  const dark = createEquipmentMaterial('darkStructuralSteel');
  const floor = createWedgeBody({ name: 'dump-body-shell', length: 5.85, width: 5.0, bottomY: 0, frontHeight: 1.5, rearHeight: 0.95, material: yellow, role: 'shell' });
  body.add(floor);
  for (let i = 0; i < 6; i += 1) {
    const x = -2.35 + i * 0.94;
    const ribL = boxMesh(`dump-body-rib-l-${i}`, [0.1, 1.22, 0.11], dark.clone(), [x, 0.73, -2.55], { role: 'structure', lodTier: 1 });
    const ribR = ribL.clone();
    ribR.name = `dump-body-rib-r-${i}`;
    ribR.position.z = 2.55;
    body.add(ribL, ribR);
  }
  const canopy = boxMesh('dump-canopy', [1.2, 0.16, 5.16], yellow.clone(), [2.55, 1.65, 0], { role: 'shell' });
  canopy.rotation.z = -0.16;
  body.add(canopy);
  const ore = createWedgeBody({ name: 'dump-load-ore', length: 4.65, width: 4.5, bottomY: 0.42, frontHeight: 1.05, rearHeight: 0.68, material: createEquipmentMaterial('ore'), role: 'interior' });
  ore.position.set(0.1, 0.2, 0);
  body.add(ore);
  pivot.add(body);
  pivot.userData.ore = ore;
  return pivot;
}

export function createHaulTruckAsset() {
  const root = new THREE.Group();
  root.name = 'ASSET-HAUL-TRUCK';
  const yellow = createEquipmentMaterial('paintedYellowSteel');
  const dark = createEquipmentMaterial('darkStructuralSteel');
  const steel = createEquipmentMaterial('bareSteel');
  const glass = createEquipmentMaterial('safetyGlass');

  const chassis = boxMesh('truck-main-chassis', [7.8, 0.56, 2.65], dark, [-0.35, 1.42, 0], { role: 'structure' });
  root.add(chassis);
  const engineDeck = boxMesh('engine-deck', [2.8, 1.25, 3.4], yellow.clone(), [3.0, 2.04, 0], { role: 'shell' });
  root.add(engineDeck);
  const grille = boxMesh('front-radiator-grille', [0.12, 1.18, 2.45], createEquipmentMaterial('darkStructuralSteel'), [4.42, 2.08, 0], { role: 'structure', lodTier: 1 });
  root.add(grille);

  const cab = new THREE.Group();
  cab.name = 'truck-cab';
  cab.position.set(2.45, 3.18, -1.42);
  cab.add(boxMesh('cab-shell', [1.45, 1.72, 1.32], yellow.clone(), [0, 0, 0], { role: 'shell' }));
  const windshield = boxMesh('cab-windshield', [0.08, 1.05, 1.08], glass, [0.755, 0.18, 0], { role: 'shell', lodTier: 0 });
  windshield.rotation.z = -0.08;
  cab.add(windshield);
  const sideGlass = boxMesh('cab-side-glass', [0.85, 0.92, 0.055], glass.clone(), [0.18, 0.18, -0.687], { role: 'shell', lodTier: 1 });
  cab.add(sideGlass);
  root.add(cab);

  const frontDeck = boxMesh('front-service-deck', [2.2, 0.12, 4.6], steel.clone(), [3.55, 3.08, 0], { role: 'structure' });
  root.add(frontDeck);
  const railL = createHandrail({ length: 2.05, name: 'truck-front-rail-l' });
  railL.position.set(3.55, 3.12, -2.25);
  root.add(railL);
  const railR = createHandrail({ length: 2.05, name: 'truck-front-rail-r' });
  railR.position.set(3.55, 3.12, 2.25);
  root.add(railR);

  // Wheel hierarchy separates yaw steering from rolling rotation. The wheel mesh
  // itself is never used as both pivots, preventing the nested/double rotation
  // that previously made the tyres tumble around the wrong axes.
  const wheelAssemblies = [];
  const wheelPositions = [
    [2.85, 1.42, -2.26], [2.85, 1.42, 2.26],
    [-2.35, 1.42, -2.08], [-2.35, 1.42, -2.57],
    [-2.35, 1.42, 2.08], [-2.35, 1.42, 2.57],
  ];
  wheelPositions.forEach((pos, index) => {
    const steerPivot = new THREE.Group();
    steerPivot.name = `truck-wheel-steer-pivot-${index + 1}`;
    steerPivot.position.set(...pos);
    steerPivot.userData.wheelSteerPivot = true;
    steerPivot.userData.frontSteer = index < 2;

    const spinPivot = new THREE.Group();
    spinPivot.name = `truck-wheel-spin-pivot-${index + 1}`;
    spinPivot.userData.wheelSpinPivot = true;
    spinPivot.userData.wheelRadiusM = 1.42;

    const wheel = createMiningWheel({ radius: 1.42, width: index < 2 ? 0.78 : 0.56, treadCount: 30, name: `truck-wheel-${index + 1}` });
    spinPivot.add(wheel);
    steerPivot.add(spinPivot);
    root.add(steerPivot);
    wheelAssemblies.push({ steerPivot, spinPivot, wheel, frontSteer: index < 2 });
  });

  const bodyPivot = createDumpBody();
  root.add(bodyPivot);
  const hoistL = createHydraulicCylinder({ length: 2.65, barrelRadius: 0.15, rodRadius: 0.09, name: 'truck-hoist-left' });
  hoistL.position.set(-0.2, 2.2, -1.05);
  hoistL.rotation.z = -0.66;
  root.add(hoistL);
  const hoistR = hoistL.clone(true);
  hoistR.name = 'truck-hoist-right';
  hoistR.position.z = 1.05;
  root.add(hoistR);

  const tank = cylinderMesh('truck-fuel-tank', 0.52, 0.52, 1.65, createEquipmentMaterial('paintedGreySteel'), [0.35, 1.92, 1.52], 28, { role: 'structure', lodTier: 1 });
  tank.rotation.x = Math.PI / 2;
  root.add(tank);
  const exhaust = tubeBetween('truck-exhaust', [1.35, 2.65, 1.55], [1.35, 4.36, 1.55], 0.1, createEquipmentMaterial('darkStructuralSteel'), 16, { role: 'structure', lodTier: 1 });
  root.add(exhaust);
  const lightL = createWorkLight({ name: 'truck-light-l' });
  lightL.position.set(4.47, 2.64, -1.35);
  root.add(lightL);
  const lightR = createWorkLight({ name: 'truck-light-r' });
  lightR.position.set(4.47, 2.64, 1.35);
  root.add(lightR);

  const loadedState = { loaded: true, dumpAngle: 0, steer: 0, wheelPhase: 0 };
  const handle = createAssetHandle({
    root,
    id: 'HAUL-TRUCK-GENERIC-100T',
    category: 'haul-truck',
    name: 'Camión minero 90–100 t',
    referenceClass: 'generic 90–100 t rigid mining haul truck',
    dimensions: DIMENSIONS,
    ports: [],
    capabilities: { wheelRotation: true, steering: true, bodyHoist: true, loadedState: true, inspection: true, lod: true },
    update: (dt, elapsed) => {
      loadedState.wheelPhase += dt * 0.7;
      loadedState.steer = Math.sin(elapsed * 0.32) * 0.16;
      const cycle = (elapsed % 18) / 18;
      const lift = cycle < 0.45 ? 0 : cycle < 0.62 ? (cycle - 0.45) / 0.17 : cycle < 0.78 ? 1 : cycle < 0.95 ? 1 - (cycle - 0.78) / 0.17 : 0;
      loadedState.dumpAngle = THREE.MathUtils.degToRad(48) * THREE.MathUtils.smoothstep(lift, 0, 1);
      // Rear hinge is at negative local X and the truck front is +X. Positive
      // local-Z rotation raises the front of the body and unloads rearward.
      bodyPivot.rotation.z = loadedState.dumpAngle;
      bodyPivot.userData.ore.visible = cycle < 0.72 || cycle > 0.95;
      wheelAssemblies.forEach(({ steerPivot, spinPivot, frontSteer }) => {
        spinPivot.rotation.z -= dt * 0.55;
        steerPivot.rotation.y = frontSteer ? loadedState.steer : 0;
      });
    },
    lodDistances: [22, 55],
  });
  handle.setLoaded = (loaded) => { loadedState.loaded = Boolean(loaded); bodyPivot.userData.ore.visible = loadedState.loaded; };
  handle.setDumpAngle = (radians) => { bodyPivot.rotation.z = THREE.MathUtils.clamp(radians, 0, THREE.MathUtils.degToRad(52)); };
  handle.setSteering = (radians) => {
    const steer = THREE.MathUtils.clamp(radians, -THREE.MathUtils.degToRad(28), THREE.MathUtils.degToRad(28));
    loadedState.steer = steer;
    wheelAssemblies.forEach(({ steerPivot, frontSteer }) => { steerPivot.rotation.y = frontSteer ? steer : 0; });
  };
  handle.advanceWheelTravel = (distanceM) => {
    if (!Number.isFinite(distanceM) || Math.abs(distanceM) < 1e-8) return;
    wheelAssemblies.forEach(({ spinPivot }) => {
      const radius = Number(spinPivot.userData.wheelRadiusM || 1.42);
      spinPivot.rotation.z -= distanceM / radius;
    });
  };
  handle.getWheelAssemblies = () => [...wheelAssemblies];
  return handle;
}
