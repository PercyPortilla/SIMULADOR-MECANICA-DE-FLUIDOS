import * as THREE from 'three';
import { createIndustrialMaterial } from '../materials/industrialMaterials.js';
import { animateSuspendedSolids, createSuspendedSolidsCloud } from '../../equipment/common/slurryVisuals.js';
import { attachBlenderVisualReplacement } from './blenderVisualReplacement.js';

function port(id, type, localPosition, direction, nominalDiameterM = 0.25) {
  return Object.freeze({ id, type, localPosition: new THREE.Vector3(...localPosition), direction: new THREE.Vector3(...direction).normalize(), nominalDiameterM });
}

function mesh(geometry, material, name) {
  const item = new THREE.Mesh(geometry, material);
  item.name = name;
  item.castShadow = true;
  item.receiveShadow = true;
  return item;
}

export function createSumpEquipment({ id = 'SUMP-01', position = new THREE.Vector3() } = {}) {
  const root = new THREE.Group();
  root.name = id;
  root.position.copy(position);
  root.userData.inspectionKind = 'sump';
  const shell = mesh(new THREE.CylinderGeometry(2.2, 2.2, 3.1, 32), createIndustrialMaterial('processSteel', { color: 0x6f8086, roughness: 0.48 }), `${id}-shell`);
  shell.position.y = 1.65;
  shell.userData.inspectionShell = true;
  root.add(shell);
  const slurry = mesh(new THREE.CylinderGeometry(2.02, 2.02, 1.65, 32), new THREE.MeshStandardMaterial({ color: 0x7d654c, roughness: 0.72, transparent: true, opacity: 0.9 }), `${id}-slurry`);
  slurry.position.y = 1.15;
  slurry.userData.inspectionInterior = true;
  slurry.userData.slurrySurface = true;
  root.add(slurry);
  const base = mesh(new THREE.CylinderGeometry(2.55, 2.55, 0.24, 32), createIndustrialMaterial('concrete'), `${id}-base`);
  base.position.y = 0.12;
  root.add(base);
  const suspendedSolids = createSuspendedSolidsCloud({ name: `${id}-suspended-solids`, radius: 1.82, height: 1.35, count: 90, size: 0.055, opacity: 0.52, seed: 11, y: 1.2 });
  suspendedSolids.userData.inspectionInterior = true;
  root.add(suspendedSolids);
  root.userData.suspendedSolids = suspendedSolids;
  const ports = new Map([
    ['inlet', port('inlet', 'slurryIn', [-2.2, 2.3, 0], [1, 0, 0], 0.4)],
    ['outlet', port('outlet', 'slurryOut', [2.2, 0.85, 0], [1, 0, 0], 0.3)],
  ]);
  attachBlenderVisualReplacement({ hostRoot: root, instanceId: id });
  let elapsed = 0;
  return {
    id,
    type: 'sump',
    dimensions: Object.freeze({ length: 5.1, width: 5.1, height: 3.3 }),
    transform: root,
    group3D: root,
    ports,
    metadata: Object.freeze({ category: 'sump' }),
    update(dt) {
      if (!Number.isFinite(dt) || dt <= 0) return;
      const safeDt = Math.min(dt, 0.1);
      elapsed += safeDt;
      slurry.rotation.y += safeDt * 0.22;
      slurry.position.y = 1.15 + Math.sin(elapsed * 1.8) * 0.035;
      animateSuspendedSolids(suspendedSolids, safeDt, elapsed, { speed: 0.22, phase: 0.8 });
    },
  };
}

function createIrregularStockpileGeometry(radius, height, phase = 0, radialSegments = 64, heightSegments = 12) {
  const geometry = new THREE.ConeGeometry(radius, height, radialSegments, heightSegments, false);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const y = position.getY(i);
    const z = position.getZ(i);
    const radial = Math.hypot(x, z);
    if (radial < 1e-5) continue;
    const angle = Math.atan2(z, x);
    const normalizedHeight = THREE.MathUtils.clamp((y + height / 2) / height, 0, 1);
    const edgeWeight = 1 - normalizedHeight * 0.72;
    const variation = 1
      + Math.sin(angle * 3 + phase) * 0.055 * edgeWeight
      + Math.sin(angle * 7 - phase * 0.7) * 0.028 * edgeWeight
      + Math.cos(angle * 11 + normalizedHeight * 4.2) * 0.015;
    position.setX(i, x * variation);
    position.setZ(i, z * variation * (1.03 + 0.04 * Math.sin(angle + phase)));
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

export function createStockpileReclaimEquipment({ id = 'STOCKPILE-RECLAIM', position = new THREE.Vector3() } = {}) {
  const root = new THREE.Group();
  root.name = id;
  root.position.copy(position);
  root.userData.inspectionKind = 'stockpile';
  const oreMat = createIndustrialMaterial('terrain', { color: 0x806548, roughness: 1 });
  const steel = createIndustrialMaterial('structuralSteel', { color: 0x4f5e62, metalness: 0.6 });
  const compactedPad = createIndustrialMaterial('road', { color: 0x746854, roughness: 1 });

  const pileA = mesh(createIrregularStockpileGeometry(13.5, 8.8, 0.7), oreMat, `${id}-pile-main`);
  pileA.position.set(-2.0, 4.4, 0);
  pileA.scale.z = 1.16;
  root.add(pileA);
  const pileB = mesh(createIrregularStockpileGeometry(7.8, 5.0, 2.1, 52, 10), oreMat.clone(), `${id}-pile-secondary`);
  pileB.position.set(7.2, 2.5, -3.6);
  pileB.scale.set(1.08, 1, 1.28);
  root.add(pileB);

  // Compacted operational pad: rectangular and subdued instead of a bright circular ring.
  const pad = mesh(new THREE.BoxGeometry(44, 0.14, 35), compactedPad, `${id}-pad`);
  pad.position.set(2.0, 0.07, 0.0);
  root.add(pad);

  const hopper = mesh(new THREE.CylinderGeometry(1.7, 3.2, 3.0, 4), steel, `${id}-hopper`);
  hopper.position.set(21.5, 2.0, 12.0);
  hopper.rotation.y = Math.PI / 4;
  hopper.userData.inspectionShell = true;
  root.add(hopper);
  const feeder = mesh(new THREE.BoxGeometry(6.2, 0.45, 2.2), steel.clone(), `${id}-feeder`);
  feeder.position.set(24.0, 0.72, 10.2);
  feeder.rotation.y = -0.22;
  root.add(feeder);

  const reclaimMotion = new THREE.Group();
  reclaimMotion.name = `${id}-motion`;
  reclaimMotion.userData.blenderProceduralOverlay = true;
  reclaimMotion.userData.reclaimMotion = true;
  root.add(reclaimMotion);

  const feederBed = mesh(new THREE.BoxGeometry(5.8, 0.12, 1.86), steel.clone(), `${id}-reclaim-feeder-bed`);
  feederBed.position.set(24.0, 0.995, 10.2);
  feederBed.rotation.y = -0.22;
  feederBed.userData.reclaimFeeder = true;
  feederBed.userData.basePosition = feederBed.position.toArray();
  reclaimMotion.add(feederBed);

  const grizzly = new THREE.Group();
  grizzly.name = `${id}-reclaim-grizzly`;
  grizzly.userData.reclaimGrizzly = true;
  for (let index = -3; index <= 3; index += 1) {
    const bar = mesh(new THREE.BoxGeometry(0.10, 0.10, 3.15), steel.clone(), `${id}-reclaim-grizzly-bar-${index + 4}`);
    bar.position.set(21.5 + index * 0.68, 3.64, 12.0);
    grizzly.add(bar);
  }
  reclaimMotion.add(grizzly);

  const movingOre = [];
  for (let index = 0; index < 10; index += 1) {
    const radius = 0.14 + (index % 3) * 0.025;
    const ore = mesh(new THREE.DodecahedronGeometry(radius, 0), oreMat, `${id}-reclaim-ore-${index + 1}`);
    ore.position.set(21.2 + (index % 5) * 1.05, 1.15 + radius * 0.3, 9.75 + Math.floor(index / 5) * 0.72);
    ore.userData.reclaimOre = true;
    ore.userData.travelOffset = (index / 10) * 5.6;
    reclaimMotion.add(ore);
    movingOre.push(ore);
  }

  // V24 Block 2: material arriving from CV-02 visibly settles toward the main
  // pile while reclaim ore continues toward CV-03. This is a neutral visual cue,
  // not an inventory/capacity calculation.
  const feedLandingOre = [];
  const feedFlow = new THREE.Group();
  feedFlow.name = `${id}-v24-feed-flow`;
  feedFlow.userData.blenderProceduralOverlay = true;
  feedFlow.userData.visualOnly = true;
  root.add(feedFlow);
  const feedStart = new THREE.Vector3(-12.8, 9.25, 0);
  const feedEnd = new THREE.Vector3(-4.7, 7.55, 0);
  for (let index = 0; index < 10; index += 1) {
    const radius = 0.13 + (index % 3) * 0.022;
    const ore = mesh(new THREE.DodecahedronGeometry(radius, 0), oreMat, `${id}-feed-landing-ore-${index + 1}`);
    ore.userData.stockpileFeedOre = true;
    ore.userData.visualOnly = true;
    ore.userData.travelPhase = index / 10;
    feedFlow.add(ore);
    feedLandingOre.push(ore);
  }

  function updateFeedLandingOre(dt) {
    feedLandingOre.forEach((ore, index) => {
      ore.userData.travelPhase = (ore.userData.travelPhase + dt * 0.10) % 1;
      const phase = ore.userData.travelPhase;
      ore.position.copy(feedStart).lerp(feedEnd, phase);
      ore.position.y += Math.sin(phase * Math.PI) * 0.22;
      ore.position.z += Math.sin(index * 1.73 + phase * Math.PI * 2) * 0.34;
      ore.rotation.x += dt * 0.22;
      ore.rotation.z += dt * 0.18;
    });
  }
  updateFeedLandingOre(0);

  const ports = new Map([
    ['feedIn', port('feedIn', 'materialIn', [-13.0, 9.4, 0], [1, -0.3, 0], 0.6)],
    ['reclaimOut', port('reclaimOut', 'materialOut', [27.0, 1.15, 8.9], [1, 0, 0], 0.6)],
    ['loaderDump', port('loaderDump', 'materialIn', [21.5, 3.65, 12.0], [0, -1, 0], 0.6)],
  ]);
  attachBlenderVisualReplacement({ hostRoot: root, instanceId: id });
  let elapsed = 0;
  return {
    id,
    type: 'stockpile-reclaim',
    dimensions: Object.freeze({ length: 50, width: 40, height: 10 }),
    transform: root,
    group3D: root,
    ports,
    metadata: Object.freeze({ category: 'stockpile-reclaim' }),
    update(dt) {
      if (!Number.isFinite(dt) || dt <= 0) return;
      const safeDt = Math.min(dt, 0.1);
      elapsed += safeDt;
      const base = feederBed.userData.basePosition;
      feederBed.position.set(base[0] + Math.sin(elapsed * 16) * 0.022, base[1], base[2]);
      grizzly.position.y = Math.sin(elapsed * 19 + 0.7) * 0.03;
      grizzly.position.z = Math.cos(elapsed * 17) * 0.014;
      movingOre.forEach((ore, index) => {
        ore.userData.travelOffset = (ore.userData.travelOffset + safeDt * 0.48) % 5.6;
        ore.position.x = 21.2 + ore.userData.travelOffset;
        ore.rotation.y += safeDt * (0.25 + index * 0.012);
      });
      updateFeedLandingOre(safeDt);
    },
  };
}
