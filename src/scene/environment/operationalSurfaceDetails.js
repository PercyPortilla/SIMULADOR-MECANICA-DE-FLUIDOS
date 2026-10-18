import * as THREE from 'three';
import { getTerrainHeight } from './terrainHeight.js';
import { createIndustrialMaterial } from '../materials/industrialMaterials.js';

function createSurfacePatch(name, x, z, radiusX, radiusZ, color, opacity = 0.72, rotationY = 0) {
  const geometry = new THREE.CircleGeometry(1, 32);
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 1,
    metalness: 0,
    transparent: true,
    opacity,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.rotation.set(-Math.PI / 2, rotationY, 0);
  mesh.scale.set(radiusX, radiusZ, 1);
  mesh.position.set(x, getTerrainHeight(x, z) + 0.022, z);
  mesh.receiveShadow = true;
  mesh.userData.visualOnly = true;
  mesh.userData.surfaceOverlay = true;
  return mesh;
}

function createControlledSpill(name, x, z, count = 12, radius = 0.13) {
  const root = new THREE.Group();
  root.name = name;
  root.userData.visualOnly = true;
  root.userData.controlledMaterialSpill = true;
  const material = createIndustrialMaterial('terrain', { color: 0x72583f, roughness: 1, metalness: 0, preserveColor: true });
  const sharedGeometry = new THREE.DodecahedronGeometry(1, 0);
  for (let index = 0; index < count; index += 1) {
    const angle = index * 2.399963229728653;
    const radial = 0.35 + (index % 5) * 0.20;
    const px = x + Math.cos(angle) * radial;
    const pz = z + Math.sin(angle) * radial * 0.72;
    const size = radius * (0.72 + (index % 4) * 0.13);
    const rock = new THREE.Mesh(sharedGeometry, material);
    rock.name = `${name}-fragment-${index + 1}`;
    rock.position.set(px, getTerrainHeight(px, pz) + size * 0.44, pz);
    rock.scale.setScalar(size);
    rock.rotation.set(index * 0.23, index * 0.37, index * 0.18);
    rock.castShadow = false;
    rock.receiveShadow = true;
    root.add(rock);
  }
  return root;
}

function createRomStagingPile() {
  const root = new THREE.Group();
  root.name = 'ROM-STAGING-PILE';
  root.userData.visualOnly = true;
  root.userData.processCoupled = false;
  root.userData.romStagingPile = true;
  root.userData.nominalDiameterM = 8.8;
  root.userData.nominalHeightM = 2.7;

  const ore = createIndustrialMaterial('terrain', { color: 0x765f49, roughness: 1, metalness: 0, preserveColor: true });
  const lobes = [
    { x: -135.0, z: -13.0, radius: 4.35, height: 2.70, yaw: 0.18 },
    { x: -132.4, z: -12.2, radius: 2.65, height: 1.65, yaw: -0.28 },
    { x: -137.2, z: -14.0, radius: 2.35, height: 1.45, yaw: 0.42 },
  ];
  lobes.forEach((lobe, index) => {
    const mesh = new THREE.Mesh(
      new THREE.ConeGeometry(lobe.radius, lobe.height, 28, 4),
      index === 0 ? ore : ore.clone(),
    );
    mesh.name = `ROM-STAGING-PILE-lobe-${index + 1}`;
    mesh.position.set(lobe.x, getTerrainHeight(lobe.x, lobe.z) + lobe.height / 2, lobe.z);
    mesh.rotation.y = lobe.yaw;
    mesh.scale.z = index === 0 ? 0.92 : 0.84;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  });

  const fragments = createControlledSpill('ROM-STAGING-PILE-toe-rock', -131.0, -14.7, 18, 0.17);
  fragments.userData.romPileToeFragments = true;
  root.add(fragments);
  return root;
}

function createLoaderScuffs() {
  const root = new THREE.Group();
  root.name = 'v24-stockpile-loader-scuffs';
  root.userData.visualOnly = true;
  root.userData.operationalWear = 'wheel-loader-turning';
  const material = new THREE.MeshStandardMaterial({ color: 0x5e5447, roughness: 1, metalness: 0, transparent: true, opacity: 0.58, depthWrite: false });
  const points = [
    [10.2, -20.5, 0.35], [12.2, -18.0, 0.58], [15.0, -16.2, 0.92], [18.2, -15.2, 1.18],
    [21.5, -16.0, 1.42], [23.4, -18.6, 1.65], [22.0, -21.0, 1.95], [18.5, -22.1, 2.18],
    [14.8, -21.8, 2.45], [11.7, -20.9, 2.72],
  ];
  points.forEach(([x, z, yaw], index) => {
    const mark = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.015, 0.28), material);
    mark.name = `loader-scuff-${index + 1}`;
    mark.position.set(x, getTerrainHeight(x, z) + 0.024, z);
    mark.rotation.y = yaw;
    mark.receiveShadow = true;
    root.add(mark);
  });
  return root;
}

export function createOperationalSurfaceDetails() {
  const root = new THREE.Group();
  root.name = 'v24-operational-surface-details';
  root.userData.visualOnly = true;
  root.userData.authoritativeTerrain = false;
  root.userData.reusesExistingRoadTracks = true;
  root.userData.reusesExistingDrainage = true;
  root.userData.noFogRequired = true;

  const patches = [
    createSurfacePatch('rom-loader-working-wear', -125.0, -12.5, 8.0, 3.0, 0x655749, 0.32, -0.04),
    createSurfacePatch('crusher-fines-stain', -84, -30, 5.2, 2.2, 0x69584a, 0.60, 0.12),
    createSurfacePatch('stockpile-traffic-wear', 16, -21, 10.5, 5.0, 0x62574b, 0.38, -0.18),
    createSurfacePatch('mill-feed-fines-stain', 73, -7, 4.0, 1.9, 0x68574a, 0.48, 0.08),
    createSurfacePatch('recovery-service-wear', 206, -78, 10.0, 2.2, 0x655d52, 0.34, 0),
  ];
  patches.forEach((patch) => root.add(patch));

  root.add(createControlledSpill('crusher-controlled-spill', -82.2, -31.8, 11, 0.15));
  root.add(createControlledSpill('stockpile-controlled-spill', 27.0, -25.2, 14, 0.16));
  root.add(createControlledSpill('mill-feed-controlled-spill', 73.8, -8.0, 9, 0.12));
  root.add(createRomStagingPile());
  root.add(createLoaderScuffs());

  root.userData.surfacePatchCount = patches.length;
  root.userData.controlledSpillCount = 3;
  root.userData.romStagingPileCount = 1;
  return root;
}
