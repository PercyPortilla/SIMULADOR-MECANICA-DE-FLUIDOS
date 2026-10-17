import * as THREE from 'three';
import { boxMesh, createAssetHandle, cylinderMesh } from '../common/assetUtils.js';
import { createEquipmentMaterial } from '../common/materialLibrary.js';
import { createElectricMotor, createGearbox, createHandrail } from '../common/components.js';
import { attachBlenderModule, BLENDER_MODULE_URLS } from '../../scene/integration/blenderModuleLibrary.js';

function createMovingBeltTexture(slopeLength) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 40;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#a7a7a2';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#858681';
  for (let x = 0; x < canvas.width; x += 20) ctx.fillRect(x, 0, 4, canvas.height);
  ctx.fillStyle = '#b7b7b2';
  for (let x = 10; x < canvas.width; x += 40) ctx.fillRect(x, 0, 2, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(Math.max(2, slopeLength / 3.2), 1);
  texture.name = 'conveyor-moving-belt-texture';
  return texture;
}

function addMemberBetween(root, name, start, end, thickness, material) {
  const a = start instanceof THREE.Vector3 ? start.clone() : new THREE.Vector3(...start);
  const b = end instanceof THREE.Vector3 ? end.clone() : new THREE.Vector3(...end);
  const direction = b.clone().sub(a);
  const length = Math.max(1e-5, direction.length());
  const mesh = boxMesh(name, [thickness, length, thickness], material.clone(), [0, 0, 0], { role: 'structure', lodTier: 1 });
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  root.add(mesh);
  return mesh;
}

function addSupportFrame(root, {
  name,
  x,
  deckY,
  width,
  material,
  baseY = 0,
  baseYLeft = baseY,
  baseYRight = baseY,
}) {
  const topY = Math.max(0.55, deckY - 0.10);
  const lateral = width * 0.78;
  const leftBaseY = Math.min(baseYLeft, topY - 0.22);
  const rightBaseY = Math.min(baseYRight, topY - 0.22);
  for (const [suffix, z, localBaseY] of [['l', -lateral, leftBaseY], ['r', lateral, rightBaseY]]) {
    const columnHeight = Math.max(0.22, topY - localBaseY);
    root.add(boxMesh(`${name}-column-${suffix}`, [0.18, columnHeight, 0.18], material.clone(), [x, localBaseY + columnHeight / 2, z], { role: 'structure', lodTier: 1 }));
    root.add(boxMesh(`${name}-footing-${suffix}`, [0.62, 0.12, 0.62], material.clone(), [x, localBaseY + 0.06, z], { role: 'structure', lodTier: 1 }));
    root.add(boxMesh(`${name}-baseplate-${suffix}`, [0.36, 0.055, 0.36], material.clone(), [x, localBaseY + 0.145, z], { role: 'structure', lodTier: 1 }));
  }
  root.add(boxMesh(`${name}-crossbeam`, [0.22, 0.18, lateral * 2 + 0.35], material.clone(), [x, topY, 0], { role: 'structure', lodTier: 1 }));

  // Real HSS-style X bracing instead of screen-space lines. The frame remains
  // parametric so each footing can still be grounded independently.
  addMemberBetween(
    root,
    `${name}-diagonal-a`,
    [x, leftBaseY + 0.16, -lateral],
    [x, Math.max(rightBaseY + 0.25, topY - 0.24), lateral],
    0.075,
    material,
  );
  addMemberBetween(
    root,
    `${name}-diagonal-b`,
    [x, rightBaseY + 0.16, lateral],
    [x, Math.max(leftBaseY + 0.25, topY - 0.24), -lateral],
    0.075,
    material,
  );
  root.add(boxMesh(`${name}-top-saddle`, [0.42, 0.10, lateral * 2 + 0.52], material.clone(), [x, topY + 0.13, 0], { role: 'structure', lodTier: 1 }));
}

export function createConveyorAsset({ length = 16, width = 1.4, incline = 0, supportSpacing = 4, walkway = true } = {}) {
  const root = new THREE.Group();
  root.name = 'ASSET-CONVEYOR-MODULAR';
  const beltMat = createEquipmentMaterial('rubber');
  const frameMat = createEquipmentMaterial('darkStructuralSteel');
  const steel = createEquipmentMaterial('bareSteel');
  const oreMat = createEquipmentMaterial('crushedOre');

  // `length` is the horizontal run. Geometry uses the true sloped length while
  // metadata ports remain on the exact source/target horizontal coordinates.
  const horizontalRun = Math.max(0.5, length);
  const angle = incline;
  const rise = Math.tan(angle) * horizontalRun;
  const slopeLength = Math.hypot(horizontalRun, rise);
  const deckCenterY = 2.03;
  const beltSpeedMps = 0.90;

  const conveyor = new THREE.Group();
  conveyor.name = 'conveyor-local-frame';
  conveyor.rotation.z = angle;
  conveyor.position.y = deckCenterY;
  root.add(conveyor);

  const belt = boxMesh('conveyor-belt', [slopeLength, 0.10, width], beltMat, [0, 0.36, 0], { role: 'shell' });
  const beltTexture = createMovingBeltTexture(slopeLength);
  if (beltTexture) {
    belt.material.map = beltTexture;
    belt.material.needsUpdate = true;
  }
  belt.userData.beltSpeedMps = beltSpeedMps;
  belt.userData.beltTravelM = 0;
  conveyor.add(belt);
  // Shallow trough wings improve the mining-conveyor silhouette while the
  // center belt remains the authoritative moving surface.
  const wingWidth = width * 0.28;
  for (const side of [-1, 1]) {
    const wingMaterial = beltMat.clone();
    if (beltTexture) wingMaterial.map = beltTexture;
    const wing = boxMesh(
      `conveyor-belt-wing-${side < 0 ? 'left' : 'right'}`,
      [slopeLength, 0.065, wingWidth],
      wingMaterial,
      [0, 0.405, side * width * 0.36],
      { role: 'shell', lodTier: 1 },
    );
    wing.rotation.x = side * THREE.MathUtils.degToRad(12);
    conveyor.add(wing);
  }
  conveyor.add(boxMesh('conveyor-stringer-l', [slopeLength, 0.18, 0.12], frameMat.clone(), [0, 0.04, -width * 0.72], { role: 'structure' }));
  conveyor.add(boxMesh('conveyor-stringer-r', [slopeLength, 0.18, 0.12], frameMat.clone(), [0, 0.04, width * 0.72], { role: 'structure' }));

  const pulleys = [];
  const pulleyByEnd = new Map();
  for (const [index, x] of [[0, -slopeLength / 2 + 0.30], [1, slopeLength / 2 - 0.30]]) {
    const end = index === 0 ? 'tail' : 'head';
    const rotor = new THREE.Group();
    rotor.name = `conveyor-${end}-pulley-pivot`;
    rotor.position.set(x, 0.30, 0);
    rotor.userData.rotationAxis = 'z';
    const pulley = cylinderMesh(`conveyor-${end}-pulley`, 0.34, 0.34, width * 1.20, steel.clone(), [0, 0, 0], 28, { role: 'structure' });
    pulley.rotation.x = Math.PI / 2;
    rotor.add(pulley);
    const marker = boxMesh(`conveyor-${end}-pulley-marker`, [0.48, 0.055, width * 1.23], frameMat.clone(), [0, 0, 0], { role: 'structure', lodTier: 1 });
    rotor.add(marker);
    conveyor.add(rotor);
    pulleys.push(rotor);
    pulleyByEnd.set(end, rotor);
  }

  function preserveVisiblePulleyMotion(rotor, end) {
    if (!rotor) return;
    const proceduralPulley = rotor.getObjectByName(`conveyor-${end}-pulley`);
    if (proceduralPulley) proceduralPulley.visible = false;
    // Keep the slim procedural marker rotating over the rotationally symmetric
    // Blender pulley. This avoids duplicate pulley geometry/z-fighting while
    // retaining an unambiguous visual speed cue in the hybrid station.
    const marker = rotor.getObjectByName(`conveyor-${end}-pulley-marker`);
    if (marker) {
      marker.visible = true;
      marker.userData.hybridRotationCue = true;
    }
  }

  const idlerCount = Math.max(6, Math.floor(slopeLength / 1.15));
  for (let i = 0; i <= idlerCount; i += 1) {
    const x = -slopeLength / 2 + 0.55 + (i * (slopeLength - 1.1)) / idlerCount;
    const carrying = cylinderMesh(`conveyor-carrying-idler-${i}`, 0.075, 0.075, width * 1.05, steel.clone(), [x, 0.27, 0], 14, { role: 'structure', lodTier: 1 });
    carrying.rotation.x = Math.PI / 2;
    conveyor.add(carrying);
    if (i % 2 === 0) {
      const returning = cylinderMesh(`conveyor-return-idler-${i}`, 0.06, 0.06, width * 0.92, steel.clone(), [x, -0.20, 0], 12, { role: 'structure', lodTier: 2 });
      returning.rotation.x = Math.PI / 2;
      conveyor.add(returning);
    }
  }

  const supportRoot = new THREE.Group();
  supportRoot.name = 'conveyor-support-system';
  root.add(supportRoot);
  const supportSpecs = [];
  const supportCount = Math.max(2, Math.ceil(horizontalRun / supportSpacing));
  // Keep the source/target zones free for equipment foundations, chutes and maintenance.
  // The first and last trestles sit inside the span instead of directly on the ports.
  for (let i = 1; i < supportCount; i += 1) {
    const horizontalX = -horizontalRun / 2 + (i * horizontalRun) / supportCount;
    const deckY = deckCenterY + Math.tan(angle) * horizontalX;
    const spec = {
      name: `conveyor-support-${i}`,
      x: horizontalX,
      deckY,
      width,
      material: frameMat,
      baseY: 0,
    };
    supportSpecs.push(spec);
    addSupportFrame(supportRoot, spec);
  }

  if (walkway) {
    const walkwayZ = -width * 1.03;
    const walk = boxMesh('conveyor-walkway', [slopeLength, 0.09, 0.72], frameMat.clone(), [0, -0.08, walkwayZ], { role: 'structure' });
    conveyor.add(walk);
    const rail = createHandrail({ length: Math.max(1.2, slopeLength - 0.6), name: 'conveyor-handrail', posts: Math.max(4, Math.floor(slopeLength / 2.4)) });
    rail.position.set(0, -0.03, walkwayZ - 0.37);
    conveyor.add(rail);
  }

  // Drive assembly is attached to the same sloped local frame, so it cannot
  // lag behind after the conveyor is reoriented or inclined.
  const drive = new THREE.Group();
  drive.name = 'conveyor-drive-assembly';
  drive.position.set(slopeLength / 2 - 1.05, -0.05, -width * 1.55);
  const motor = createElectricMotor({ length: 1.0, radius: 0.32, name: 'conveyor-motor' });
  const gearbox = createGearbox({ size: [0.72, 0.62, 0.62], name: 'conveyor-gearbox' });
  gearbox.position.x = -0.9;
  drive.add(motor, gearbox);
  conveyor.add(drive);

  // V15 hybrid visual modules. The authoritative belt, ports, supports and
  // animation stay procedural/parametric; Blender replaces the visually weak
  // terminal stations and enriches idler/transfer hardware.
  const widthScale = THREE.MathUtils.clamp(width / 1.4, 0.75, 1.45);
  attachBlenderModule({
    parent: conveyor,
    url: BLENDER_MODULE_URLS.conveyorTail,
    name: 'blender-conveyor-tail-station',
    position: [-slopeLength / 2 + 0.30, 0.28, 0],
    scale: [1, 1, widthScale],
    userData: { conveyorHybridRole: 'tail-station' },
    onReady: () => {
      const tailRotor = pulleyByEnd.get('tail');
      preserveVisiblePulleyMotion(tailRotor, 'tail');
    },
  });
  attachBlenderModule({
    parent: conveyor,
    url: BLENDER_MODULE_URLS.conveyorHead,
    name: 'blender-conveyor-head-station',
    position: [slopeLength / 2 - 0.30, 0.28, 0],
    scale: [1, 1, widthScale],
    userData: { conveyorHybridRole: 'head-station' },
    onReady: () => {
      const headRotor = pulleyByEnd.get('head');
      preserveVisiblePulleyMotion(headRotor, 'head');
      drive.visible = false;
    },
  });
  attachBlenderModule({
    parent: conveyor,
    url: BLENDER_MODULE_URLS.conveyorTransferHood,
    name: 'blender-conveyor-discharge-hood',
    position: [slopeLength / 2 - 0.72, 0.46, 0],
    scale: [1, 1, widthScale],
    userData: { conveyorHybridRole: 'transfer-hood' },
  });
  const blenderIdlerSpacing = 4.2;
  const blenderIdlerCount = Math.max(1, Math.floor((slopeLength - 2.4) / blenderIdlerSpacing));
  for (let i = 1; i <= blenderIdlerCount; i += 1) {
    const x = -slopeLength / 2 + 1.2 + (i * Math.max(0.1, slopeLength - 2.4)) / (blenderIdlerCount + 1);
    attachBlenderModule({
      parent: conveyor,
      url: BLENDER_MODULE_URLS.conveyorIdler,
      name: `blender-conveyor-idler-frame-${i}`,
      position: [x, 0.27, 0],
      scale: [1, 1, widthScale],
      userData: { conveyorHybridRole: 'idler-frame', stationIndex: i },
    });
  }
  root.userData.blenderHybridConveyor = true;
  root.userData.blenderHybridIdlerCount = blenderIdlerCount;

  // A continuous shallow ore bed plus discrete fragments reads as material on
  // the carrying surface instead of isolated floating dots.
  const oreBed = boxMesh('conveyor-ore-bed', [Math.max(0.8, slopeLength - 1.25), 0.055, width * 0.72], oreMat, [0, 0.455, 0], { role: 'interior', lodTier: 1 });
  oreBed.castShadow = false;
  conveyor.add(oreBed);

  const orePieces = [];
  const cleats = [];
  if (Math.abs(angle) >= THREE.MathUtils.degToRad(10)) {
    const cleatCount = Math.max(5, Math.min(42, Math.floor(slopeLength / 1.35)));
    for (let i = 0; i < cleatCount; i += 1) {
      const x = -slopeLength / 2 + 0.55 + (i / cleatCount) * (slopeLength - 1.1);
      const cleat = boxMesh(
        `conveyor-belt-cleat-${i}`,
        [0.10, 0.11, width * 0.76],
        beltMat.clone(),
        [x, 0.49, 0],
        { role: 'shell', lodTier: 1 },
      );
      cleat.userData.travelPhase = (i / cleatCount) % 1;
      conveyor.add(cleat);
      cleats.push(cleat);
    }
    root.userData.inclineCleatCount = cleatCount;
  }
  const oreCount = Math.max(28, Math.min(72, Math.floor(slopeLength * 2.4)));
  for (let i = 0; i < oreCount; i += 1) {
    const size = 0.085 + (i % 5) * 0.016;
    const ore = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), oreMat);
    ore.name = `conveyor-ore-${i}`;
    ore.position.set(
      -slopeLength / 2 + 0.55 + (i / oreCount) * (slopeLength - 1.1),
      0.51 + (i % 3) * 0.025,
      ((i % 9) - 4) * width * 0.065,
    );
    ore.castShadow = true;
    ore.userData.inspectionRole = 'interior';
    conveyor.add(ore);
    orePieces.push(ore);
  }

  const feedLocal = [-horizontalRun / 2, deckCenterY - rise / 2, 0];
  const dischargeLocal = [horizontalRun / 2, deckCenterY + rise / 2, 0];
  const dimensions = {
    length: horizontalRun,
    slopeLength,
    width: width * (walkway ? 2.55 : 1.65),
    height: deckCenterY + Math.abs(rise) / 2 + 1.25,
  };

  const handle = createAssetHandle({
    root,
    id: `CONVEYOR-MODULAR-${horizontalRun.toFixed(1)}M`,
    category: 'conveyor',
    name: 'Conveyor modular industrial',
    referenceClass: 'troughed belt conveyor',
    dimensions,
    ports: [
      { id: 'feedIn', type: 'materialIn', position: feedLocal, direction: [1, Math.sin(angle), 0] },
      { id: 'dischargeOut', type: 'materialOut', position: dischargeLocal, direction: [1, Math.sin(angle), 0] },
    ],
    capabilities: { beltMotion: true, pulleyRotation: true, oreTransport: true, parametric: true, inspection: true, lod: true },
    update: (dt) => {
      const safeDt = Math.min(Math.max(Number(dt) || 0, 0), 0.1);
      const pulleyAngularSpeed = beltSpeedMps / 0.34;
      pulleys.forEach((rotor) => { rotor.rotation.z -= safeDt * pulleyAngularSpeed; });
      orePieces.forEach((ore, index) => {
        ore.position.x += safeDt * beltSpeedMps;
        ore.rotation.y += safeDt * 0.36;
        if (ore.position.x > slopeLength / 2 - 0.34) ore.position.x = -slopeLength / 2 + 0.42;
      });
      cleats.forEach((cleat) => {
        cleat.position.x += safeDt * beltSpeedMps;
        if (cleat.position.x > slopeLength / 2 - 0.34) cleat.position.x = -slopeLength / 2 + 0.42;
      });
      belt.userData.beltTravelM += safeDt * beltSpeedMps;
      if (belt.material.map) {
        belt.material.map.offset.x = -(belt.userData.beltTravelM / 3.2) % 1;
      }
    },
    lodDistances: [30, 78],
  });
  handle.groundSupports = (terrainHeightFn) => {
    if (typeof terrainHeightFn !== 'function') return;
    while (supportRoot.children.length) {
      const child = supportRoot.children.pop();
      child.geometry?.dispose?.();
      child.material?.dispose?.();
    }
    root.updateMatrixWorld(true);
    supportSpecs.forEach((spec) => {
      const lateral = spec.width * 0.78;
      const worldLeft = new THREE.Vector3(spec.x, 0, -lateral).applyMatrix4(root.matrixWorld);
      const worldRight = new THREE.Vector3(spec.x, 0, lateral).applyMatrix4(root.matrixWorld);
      const baseYLeft = terrainHeightFn(worldLeft.x, worldLeft.z) - root.position.y;
      const baseYRight = terrainHeightFn(worldRight.x, worldRight.z) - root.position.y;
      addSupportFrame(supportRoot, { ...spec, baseYLeft, baseYRight });
    });
    supportRoot.updateMatrixWorld(true);
  };
  return handle;
}
