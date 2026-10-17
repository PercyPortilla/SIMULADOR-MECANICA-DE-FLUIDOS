import * as THREE from 'three';
import { boxMesh, createAssetHandle, tubeBetween } from '../common/assetUtils.js';
import { createEquipmentMaterial } from '../common/materialLibrary.js';
import { createBucketGeometry } from '../common/geometry.js';
import { createHandrail, createMiningWheel } from '../common/components.js';

const DIMENSIONS = Object.freeze({ length: 12.0, width: 3.75, height: 4.25 });

export function createWheelLoaderAsset() {
  const root = new THREE.Group();
  root.name = 'ASSET-WHEEL-LOADER';
  const yellow = createEquipmentMaterial('paintedYellowSteel');
  const dark = createEquipmentMaterial('darkStructuralSteel');

  const rear = new THREE.Group();
  rear.name = 'loader-rear-frame';
  rear.position.set(-2.5, 0, 0);
  rear.add(boxMesh('loader-rear-body', [4.8, 2.15, 3.1], yellow, [-0.35, 2.0, 0], { role: 'shell' }));
  rear.add(boxMesh('loader-engine-grille', [1.5, 1.3, 3.18], dark, [-2.15, 2.05, 0], { role: 'structure', lodTier: 1 }));
  rear.add(boxMesh('loader-cab', [2.0, 2.1, 2.45], yellow.clone(), [1.35, 3.0, 0], { role: 'shell' }));
  rear.add(boxMesh('loader-cab-glass-front', [0.08, 1.35, 2.05], createEquipmentMaterial('safetyGlass'), [2.36, 3.14, 0], { role: 'shell', lodTier: 0 }));
  const rearRail = createHandrail({ length: 2.2, name: 'loader-rear-rail' });
  rearRail.position.set(-1.0, 3.15, -1.58);
  rear.add(rearRail);
  root.add(rear);

  const articulation = new THREE.Group();
  articulation.name = 'loader-articulation';
  articulation.position.set(0.0, 1.35, 0);
  root.add(articulation);
  articulation.add(boxMesh('loader-front-frame', [4.1, 0.82, 2.6], dark.clone(), [1.75, 0, 0], { role: 'structure' }));

  const wheels = [];
  const positions = [[-3.4, 1.3, -1.65], [-3.4, 1.3, 1.65], [1.9, 1.3, -1.65], [1.9, 1.3, 1.65]];
  positions.forEach((pos, index) => {
    const wheel = createMiningWheel({ radius: 1.25, width: 0.66, treadCount: 26, name: `loader-wheel-${index + 1}` });
    wheel.position.set(...pos);
    if (index < 2) root.add(wheel); else articulation.add(wheel);
    wheels.push(wheel);
  });

  const armPivot = new THREE.Group();
  armPivot.name = 'loader-arm-pivot';
  armPivot.position.set(1.15, 0.3, 0);
  articulation.add(armPivot);
  for (const z of [-1.05, 1.05]) {
    const arm = boxMesh(`loader-lift-arm-${z}`, [4.15, 0.36, 0.26], yellow.clone(), [2.05, 0.34, z], { role: 'shell' });
    arm.rotation.z = 0.08;
    armPivot.add(arm);
  }
  const bell = boxMesh('loader-bell-crank', [0.5, 1.2, 0.42], dark.clone(), [2.7, 0.68, 0], { role: 'structure', lodTier: 1 });
  armPivot.add(bell);
  const bucketPivot = new THREE.Group();
  bucketPivot.name = 'loader-bucket-pivot';
  bucketPivot.position.set(4.05, 0.05, 0);
  armPivot.add(bucketPivot);
  const bucket = createBucketGeometry({ width: 3.6, depth: 1.75, height: 1.45, material: createEquipmentMaterial('wearLiner'), name: 'loader-bucket' });
  bucket.position.set(0.72, -0.42, 0);
  bucketPivot.add(bucket);
  const ore = new THREE.Mesh(new THREE.IcosahedronGeometry(0.78, 2), createEquipmentMaterial('ore'));
  ore.name = 'loader-bucket-ore';
  ore.scale.set(1.25, 0.55, 1.7);
  ore.position.set(0.78, 0.12, 0);
  ore.castShadow = true;
  ore.userData.inspectionRole = 'interior';
  bucketPivot.add(ore);

  armPivot.add(tubeBetween('loader-lift-cylinder-l', [0.25, 0.0, -0.72], [2.3, 1.15, -0.72], 0.11, createEquipmentMaterial('paintedGreySteel'), 16, { role: 'structure', lodTier: 1 }));
  armPivot.add(tubeBetween('loader-lift-cylinder-r', [0.25, 0.0, 0.72], [2.3, 1.15, 0.72], 0.11, createEquipmentMaterial('paintedGreySteel'), 16, { role: 'structure', lodTier: 1 }));
  armPivot.add(tubeBetween('loader-tilt-cylinder', [1.8, 0.85, 0], [3.45, 0.95, 0], 0.1, createEquipmentMaterial('stainlessSteel'), 16, { role: 'interior', lodTier: 1 }));

  const handle = createAssetHandle({
    root,
    id: 'WHEEL-LOADER-GENERIC-LARGE',
    category: 'wheel-loader',
    name: 'Cargador frontal minero',
    referenceClass: 'large mining wheel loader class',
    dimensions: DIMENSIONS,
    capabilities: { articulation: true, wheelRotation: true, liftArms: true, bucket: true, oreLoad: true, inspection: true, lod: true },
    update: (dt, elapsed) => {
      const t = elapsed % 32;
      let liftDeg = 8;
      let bucketDeg = -8;
      let articulateDeg = 0;
      if (t < 7) {
        const p = THREE.MathUtils.smoothstep(t / 7, 0, 1);
        liftDeg = THREE.MathUtils.lerp(5, 13, p);
        bucketDeg = THREE.MathUtils.lerp(10, -18, p);
        articulateDeg = THREE.MathUtils.lerp(-4, 0, p);
      } else if (t < 16) {
        liftDeg = 13;
        bucketDeg = -18;
        articulateDeg = Math.sin((t - 7) / 9 * Math.PI) * 4;
      } else if (t < 21) {
        const p = THREE.MathUtils.smoothstep((t - 16) / 5, 0, 1);
        liftDeg = THREE.MathUtils.lerp(13, 32, p);
        bucketDeg = THREE.MathUtils.lerp(-18, 34, p);
        articulateDeg = THREE.MathUtils.lerp(2, -2, p);
      } else {
        const p = THREE.MathUtils.smoothstep((t - 21) / 11, 0, 1);
        liftDeg = THREE.MathUtils.lerp(24, 8, p);
        bucketDeg = THREE.MathUtils.lerp(12, -8, p);
        articulateDeg = Math.sin((t - 21) / 11 * Math.PI) * -4;
      }
      articulation.rotation.y = THREE.MathUtils.degToRad(articulateDeg);
      armPivot.rotation.z = THREE.MathUtils.degToRad(liftDeg);
      bucketPivot.rotation.z = THREE.MathUtils.degToRad(bucketDeg);
      if (!root.userData.integrationManagedAnimation) {
        wheels.forEach((wheel) => { wheel.rotation.z -= dt * 0.72; });
      }
      ore.visible = t >= 5 && t < 19.3;
    },
    lodDistances: [23, 58],
  });
  handle.advanceWheelTravel = (distanceM) => {
    if (!Number.isFinite(distanceM) || Math.abs(distanceM) < 1e-8) return;
    wheels.forEach((wheel) => { wheel.rotation.z -= distanceM / 1.25; });
  };
  return handle;
}
