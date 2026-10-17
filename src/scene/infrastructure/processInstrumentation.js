import * as THREE from 'three';
import { createIndustrialMaterial } from '../materials/industrialMaterials.js';

const INSTRUMENT_SPECS = Object.freeze([
  Object.freeze({ tag: 'PT-101', type: 'PT', equipmentId: 'SLURRY-PUMP-01', portId: 'discharge', offset: [0.55, 0.62, 0.42] }),
  Object.freeze({ tag: 'PI-101', type: 'PI', equipmentId: 'SLURRY-PUMP-01', portId: 'discharge', offset: [0.24, 0.38, -0.48] }),
  Object.freeze({ tag: 'PT-201', type: 'PT', equipmentId: 'PUMP-01', portId: 'discharge', offset: [0.55, 0.62, 0.42] }),
  Object.freeze({ tag: 'PI-201', type: 'PI', equipmentId: 'PUMP-01', portId: 'discharge', offset: [0.24, 0.38, -0.48] }),
  Object.freeze({ tag: 'FT-301', type: 'FT', equipmentId: 'CLASS-01', portId: 'feed', offset: [0.58, 0.48, 0.44] }),
  Object.freeze({ tag: 'LT-401', type: 'LT', equipmentId: 'R-01', portId: 'overflowOut', offset: [0.42, 0.65, 0.46] }),
  Object.freeze({ tag: 'LT-402', type: 'LT', equipmentId: 'R-02', portId: 'overflowOut', offset: [0.42, 0.65, 0.46] }),
  Object.freeze({ tag: 'LT-403', type: 'LT', equipmentId: 'R-03', portId: 'overflowOut', offset: [0.42, 0.65, 0.46] }),
  Object.freeze({ tag: 'LT-404', type: 'LT', equipmentId: 'R-04', portId: 'overflowOut', offset: [0.42, 0.65, 0.46] }),
  Object.freeze({ tag: 'FT-501', type: 'FT', equipmentId: 'CIP-ADSORPTION', portId: 'feed', offset: [0.55, 0.46, 0.38] }),
  Object.freeze({ tag: 'PT-601', type: 'PT', equipmentId: 'ELUTION-SKID', portId: 'pregnantSolutionOut', offset: [0.48, 0.52, 0.38] }),
  Object.freeze({ tag: 'LT-701', type: 'LT', equipmentId: 'EW-CELLS', portId: 'electrolyteOut', offset: [0.42, 0.58, 0.44] }),
]);

function cylinderBetween(name, start, end, radius, material, radialSegments = 12) {
  const direction = end.clone().sub(start);
  const length = Math.max(1e-5, direction.length());
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, radialSegments), material);
  mesh.name = name;
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}

function createDial(tag, type) {
  const group = new THREE.Group();
  group.name = `${tag}-dial`;
  const steel = createIndustrialMaterial('processSteel');
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.085, 24), steel);
  body.name = `${tag}-body`;
  body.rotation.x = Math.PI / 2;
  group.add(body);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.145, 28), new THREE.MeshStandardMaterial({ color: 0xe8ece8, roughness: 0.5, metalness: 0 }));
  face.name = `${tag}-face`;
  face.position.z = 0.046;
  group.add(face);
  const needle = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.105, 0.008), new THREE.MeshStandardMaterial({ color: 0x9f2923, roughness: 0.6 }));
  needle.name = `${tag}-needle`;
  needle.position.set(0.025, 0.015, 0.052);
  needle.rotation.z = type === 'FT' ? -0.42 : 0.28;
  group.add(needle);
  return group;
}

function createLevelIndicator(tag) {
  const group = new THREE.Group();
  group.name = `${tag}-level-indicator`;
  const frame = createIndustrialMaterial('structuralSteel');
  const glass = new THREE.MeshStandardMaterial({ color: 0xa9d6dc, transparent: true, opacity: 0.52, roughness: 0.18, metalness: 0 });
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.62, 14), glass);
  tube.name = `${tag}-sight-glass`;
  group.add(tube);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.07, 0.16), frame.clone());
  top.position.y = 0.34;
  const bottom = top.clone();
  bottom.position.y = -0.34;
  group.add(top, bottom);
  const float = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.035, 0.09), new THREE.MeshStandardMaterial({ color: 0xd5a52d, roughness: 0.5 }));
  float.name = `${tag}-level-marker`;
  float.position.y = 0.08;
  group.add(float);
  return group;
}

function createInstrument(spec, equipmentSystem) {
  const anchor = equipmentSystem.getPortWorldPosition(spec.equipmentId, spec.portId);
  const offset = new THREE.Vector3(...spec.offset);
  const center = anchor.clone().add(offset);
  const group = new THREE.Group();
  group.name = spec.tag;
  group.userData.instrumentTag = spec.tag;
  group.userData.instrumentType = spec.type;
  group.userData.equipmentId = spec.equipmentId;
  group.userData.portId = spec.portId;
  group.userData.visualOnly = true;
  group.userData.educationalInstrumentation = true;
  group.userData.solverCoupled = false;
  group.userData.sourceVariable = null;
  group.userData.anchorPoint = anchor.toArray();

  const branchMaterial = createIndustrialMaterial('processSteel');
  const branchEnd = center.clone().add(new THREE.Vector3(0, -0.20, 0));
  const branch = cylinderBetween(`${spec.tag}-visual-branch`, anchor, branchEnd, 0.027, branchMaterial, 10);
  branch.userData.visualOnly = true;
  group.add(branch);

  const indicator = spec.type === 'LT' ? createLevelIndicator(spec.tag) : createDial(spec.tag, spec.type);
  indicator.position.copy(center);
  group.add(indicator);

  const tagPlate = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 0.035), new THREE.MeshStandardMaterial({ color: 0xd3a12c, roughness: 0.52, metalness: 0.12 }));
  tagPlate.name = `${spec.tag}-tag-plate`;
  tagPlate.position.copy(center).add(new THREE.Vector3(0, -0.27, 0));
  group.add(tagPlate);
  return group;
}

export function createProcessInstrumentation({ equipmentSystem } = {}) {
  if (!equipmentSystem?.getPortWorldPosition) throw new TypeError('process instrumentation requiere equipmentSystem integrado.');
  const root = new THREE.Group();
  root.name = 'v24-process-instrumentation';
  root.userData.visualOnly = true;
  root.userData.educationalInstrumentation = true;
  root.userData.solverCoupled = false;
  const instruments = [];
  INSTRUMENT_SPECS.forEach((spec) => {
    const instrument = createInstrument(spec, equipmentSystem);
    root.add(instrument);
    instruments.push(instrument);
  });
  root.userData.instrumentCount = instruments.length;
  return { root, instruments, specs: INSTRUMENT_SPECS };
}

export { INSTRUMENT_SPECS };
