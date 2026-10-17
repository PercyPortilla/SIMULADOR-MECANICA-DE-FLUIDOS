import * as THREE from 'three';
import { createEquipment } from './equipmentRegistry.js';
import { createIndustrialMaterial } from '../materials/industrialMaterials.js';

export const DEFAULT_PUMP_DIMENSIONS = Object.freeze({
  skidWidth: 5.8,
  skidDepth: 3.4,
  skidHeight: 0.28,
  casingDiameter: 1.9,
  casingWidth: 0.76,
  motorLength: 2.15,
  motorHeight: 1.10,
  shaftHeight: 1.28,
});

function material(color, { roughness = 0.54, metalness = 0.4, transparent = false, opacity = 1 } = {}) {
  const mat = createIndustrialMaterial('processSteel', { color, roughness, metalness });
  mat.transparent = transparent;
  mat.opacity = opacity;
  return mat;
}

function boltRing(group, center, radius, count, mat, axis = 'x') {
  const geometry = new THREE.CylinderGeometry(0.045, 0.045, 0.11, 10);
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2;
    const bolt = new THREE.Mesh(geometry, mat);
    bolt.name = `pump-casing-bolt-${i + 1}`;
    if (axis === 'x') {
      bolt.rotation.z = Math.PI / 2;
      bolt.position.set(center.x + 0.42, center.y + Math.cos(angle) * radius, center.z + Math.sin(angle) * radius);
    }
    bolt.castShadow = true;
    group.add(bolt);
  }
}

export function createSlurryPump({
  id = 'PUMP-01',
  position,
  rotationY = 0,
  dimensions = DEFAULT_PUMP_DIMENSIONS,
} = {}) {
  const dims = { ...DEFAULT_PUMP_DIMENSIONS, ...dimensions };
  const group = new THREE.Group();
  group.name = id;
  group.userData.inspectableEquipment = true;

  const concrete = material(0x858987, { roughness: 0.92, metalness: 0 });
  const steel = material(0x718086, { roughness: 0.5, metalness: 0.48 });
  const casingMaterial = material(0x84969a, { roughness: 0.44, metalness: 0.48 });
  const dark = material(0x414d51, { roughness: 0.48, metalness: 0.62 });
  const safety = material(0xd5aa2d, { roughness: 0.58, metalness: 0.18 });
  const slurry = new THREE.MeshStandardMaterial({
    color: 0x85694d,
    roughness: 0.82,
    transparent: true,
    opacity: 0.82,
  });

  const skid = new THREE.Mesh(new THREE.BoxGeometry(dims.skidWidth, dims.skidHeight, dims.skidDepth), concrete);
  skid.name = `${id}-pad`;
  skid.position.y = dims.skidHeight / 2;
  skid.castShadow = true;
  skid.receiveShadow = true;
  group.add(skid);

  // I-beam-like skid rails.
  [-1.25, 1.25].forEach((z, index) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(dims.skidWidth - 0.35, 0.22, 0.18), dark);
    rail.name = `${id}-skid-rail-${index + 1}`;
    rail.position.set(0, dims.skidHeight + 0.08, z);
    group.add(rail);
  });

  const casingCenter = new THREE.Vector3(-1.35, dims.skidHeight + dims.shaftHeight, 0);
  const casing = new THREE.Mesh(
    new THREE.TorusGeometry(dims.casingDiameter * 0.42, dims.casingDiameter * 0.20, 20, 52),
    casingMaterial,
  );
  casing.name = `${id}-volute-casing`;
  casing.position.copy(casingCenter);
  casing.rotation.y = Math.PI / 2;
  casing.castShadow = true;
  casing.userData.inspectionShell = true;
  group.add(casing);

  const cover = new THREE.Mesh(
    new THREE.CylinderGeometry(dims.casingDiameter * 0.38, dims.casingDiameter * 0.38, dims.casingWidth, 36),
    casingMaterial,
  );
  cover.name = `${id}-casing-hub`;
  cover.position.copy(casingCenter);
  cover.rotation.z = Math.PI / 2;
  cover.castShadow = true;
  cover.userData.inspectionShell = true;
  group.add(cover);
  boltRing(group, casingCenter, dims.casingDiameter * 0.34, 10, dark);

  // Internal impeller assembly exists at all times but is shown by inspection modes.
  const impeller = new THREE.Group();
  impeller.name = `${id}-impeller`;
  impeller.position.copy(casingCenter);
  impeller.userData.pumpImpeller = true;
  impeller.userData.inspectionInterior = true;
  impeller.visible = false;
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.28, 20), dark);
  hub.rotation.z = Math.PI / 2;
  impeller.add(hub);
  for (let i = 0; i < 7; i += 1) {
    const angle = (i / 7) * Math.PI * 2;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.58, 0.22), safety);
    blade.position.set(0, Math.cos(angle) * 0.30, Math.sin(angle) * 0.30);
    blade.rotation.x = angle;
    blade.rotation.z = 0.32;
    impeller.add(blade);
  }
  group.add(impeller);

  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, dims.motorLength, 28), steel);
  motor.name = `${id}-motor`;
  motor.rotation.z = Math.PI / 2;
  motor.position.set(1.35, dims.skidHeight + dims.motorHeight / 2 + 0.38, 0);
  motor.castShadow = true;
  group.add(motor);
  for (let i = -4; i <= 4; i += 1) {
    const fin = new THREE.Mesh(new THREE.TorusGeometry(0.65, 0.025, 6, 24), dark);
    fin.name = `${id}-motor-fin-${i + 5}`;
    fin.rotation.y = Math.PI / 2;
    fin.position.set(1.35 + i * 0.19, motor.position.y, 0);
    group.add(fin);
  }

  const motorFan = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.24, 22), steel);
  motorFan.name = `${id}-motor-fan`;
  motorFan.rotation.z = Math.PI / 2;
  motorFan.position.set(2.48, motor.position.y, 0);
  motorFan.castShadow = true;
  group.add(motorFan);

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.4, 16), steel);
  shaft.name = `${id}-shaft`;
  shaft.rotation.z = Math.PI / 2;
  shaft.position.set(-0.12, casingCenter.y, 0);
  group.add(shaft);

  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.66, 0.78), safety);
  guard.name = `${id}-coupling-guard`;
  guard.position.set(0.48, casingCenter.y, 0);
  group.add(guard);

  const suctionPosition = [-2.55, casingCenter.y, 0];
  const dischargePosition = [-1.35, casingCenter.y + 1.40, 0];
  const nozzleMaterial = material(0x78909a, { roughness: 0.46, metalness: 0.52 });

  const suctionNozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 1.0, 24), nozzleMaterial);
  suctionNozzle.name = `${id}-suction-nozzle`;
  suctionNozzle.rotation.z = Math.PI / 2;
  suctionNozzle.position.set(...suctionPosition);
  suctionNozzle.castShadow = true;
  group.add(suctionNozzle);

  const dischargeNozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.95, 24), nozzleMaterial);
  dischargeNozzle.name = `${id}-discharge-nozzle`;
  dischargeNozzle.position.set(...dischargePosition);
  dischargeNozzle.castShadow = true;
  group.add(dischargeNozzle);

  const internalFlow = new THREE.Group();
  internalFlow.name = `${id}-internal-slurry-flow`;
  internalFlow.userData.inspectionInterior = true;
  internalFlow.userData.pumpInternalFlow = true;
  internalFlow.visible = false;
  const suctionFluid = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.2, 18), slurry);
  suctionFluid.rotation.z = Math.PI / 2;
  suctionFluid.position.set(-2.05, casingCenter.y, 0);
  internalFlow.add(suctionFluid);
  const dischargeFluid = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.5, 18), slurry);
  dischargeFluid.position.set(-1.35, casingCenter.y + 0.75, 0);
  internalFlow.add(dischargeFluid);
  group.add(internalFlow);

  [-2.70, -1.35, 1.25].forEach((x, index) => {
    const support = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.85 + index * 0.14, 0.85), steel);
    support.name = `${id}-support-${index + 1}`;
    support.position.set(x, dims.skidHeight + 0.42 + index * 0.07, 0);
    support.castShadow = true;
    group.add(support);
  });

  return createEquipment({
    id,
    type: 'slurry-pump',
    dimensions: dims,
    transform: { position, rotationY },
    ports: [
      { id: 'suction', type: 'suction', localPosition: suctionPosition, direction: [-1, 0, 0], nominalDiameterM: 0.05 },
      { id: 'discharge', type: 'discharge', localPosition: dischargePosition, direction: [0, 1, 0], nominalDiameterM: 0.05 },
    ],
    metadata: { label: id, zoneId: 'Z7', service: 'slurry-transfer', futureTargetZoneId: 'Z8' },
    group3D: group,
  });
}
