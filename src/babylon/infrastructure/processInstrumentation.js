import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { CreateDisc } from '@babylonjs/core/Meshes/Builders/discBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';

export const INSTRUMENT_SPECS = Object.freeze([
  Object.freeze({ tag: 'PT-101', type: 'PT', equipmentId: 'SLURRY-PUMP-01', portId: 'discharge', offset: Object.freeze([0.55, 0.62, 0.42]) }),
  Object.freeze({ tag: 'PI-101', type: 'PI', equipmentId: 'SLURRY-PUMP-01', portId: 'discharge', offset: Object.freeze([0.24, 0.38, -0.48]) }),
  Object.freeze({ tag: 'PT-201', type: 'PT', equipmentId: 'PUMP-01', portId: 'discharge', offset: Object.freeze([0.55, 0.62, 0.42]) }),
  Object.freeze({ tag: 'PI-201', type: 'PI', equipmentId: 'PUMP-01', portId: 'discharge', offset: Object.freeze([0.24, 0.38, -0.48]) }),
  Object.freeze({ tag: 'FT-301', type: 'FT', equipmentId: 'CLASS-01', portId: 'feed', offset: Object.freeze([0.58, 0.48, 0.44]) }),
  Object.freeze({ tag: 'LT-401', type: 'LT', equipmentId: 'R-01', portId: 'overflowOut', offset: Object.freeze([0.42, 0.65, 0.46]) }),
  Object.freeze({ tag: 'LT-402', type: 'LT', equipmentId: 'R-02', portId: 'overflowOut', offset: Object.freeze([0.42, 0.65, 0.46]) }),
  Object.freeze({ tag: 'LT-403', type: 'LT', equipmentId: 'R-03', portId: 'overflowOut', offset: Object.freeze([0.42, 0.65, 0.46]) }),
  Object.freeze({ tag: 'LT-404', type: 'LT', equipmentId: 'R-04', portId: 'overflowOut', offset: Object.freeze([0.42, 0.65, 0.46]) }),
  Object.freeze({ tag: 'FT-501', type: 'FT', equipmentId: 'CIP-ADSORPTION', portId: 'feed', offset: Object.freeze([0.55, 0.46, 0.38]) }),
  Object.freeze({ tag: 'PT-601', type: 'PT', equipmentId: 'ELUTION-SKID', portId: 'pregnantSolutionOut', offset: Object.freeze([0.48, 0.52, 0.38]) }),
  Object.freeze({ tag: 'LT-701', type: 'LT', equipmentId: 'EW-CELLS', portId: 'electrolyteOut', offset: Object.freeze([0.42, 0.58, 0.44]) }),
]);

function requireRightHandedScene(scene) {
  if (!scene) throw new TypeError('Babylon process instrumentation requires a Scene.');
  if (scene.useRightHandedSystem !== true) {
    throw new Error('Babylon process instrumentation requires scene.useRightHandedSystem = true.');
  }
}

function colorFromHex(hex) {
  return new Color3(
    ((hex >> 16) & 0xff) / 255,
    ((hex >> 8) & 0xff) / 255,
    (hex & 0xff) / 255,
  );
}

function material(scene, name, hex, { alpha = 1 } = {}) {
  const result = new StandardMaterial(name, scene);
  result.diffuseColor = colorFromHex(hex);
  result.specularColor = new Color3(0.035, 0.035, 0.03);
  result.specularPower = 5;
  result.alpha = alpha;
  if (alpha < 1) result.disableDepthWrite = true;
  return result;
}

function cylinderBetween(scene, name, start, end, radius, useMaterial, radialSegments = 12) {
  const direction = end.subtract(start);
  const length = Math.max(1e-5, direction.length());
  const mesh = CreateCylinder(name, {
    diameterTop: radius * 2,
    diameterBottom: radius * 2,
    height: length,
    tessellation: radialSegments,
  }, scene);
  mesh.position.copyFrom(start.add(end).scale(0.5));
  const rotation = Quaternion.Identity();
  Quaternion.FromUnitVectorsToRef(Vector3.Up(), direction.normalize(), rotation);
  mesh.rotationQuaternion = rotation;
  mesh.material = useMaterial;
  mesh.receiveShadows = true;
  mesh.metadata = {
    visualOnly: true,
    radiusM: radius,
    lengthM: length,
    radialSegments,
    start: start.asArray(),
    end: end.asArray(),
  };
  return mesh;
}

function createDial(scene, tag, type, materials) {
  const group = new TransformNode(`${tag}-dial`, scene);
  const body = CreateCylinder(`${tag}-body`, {
    diameter: 0.34,
    height: 0.085,
    tessellation: 24,
  }, scene);
  body.rotation.x = Math.PI / 2;
  body.material = materials.processSteel;
  body.metadata = { radiusM: 0.17, heightM: 0.085, tessellation: 24 };
  body.parent = group;

  const face = CreateDisc(`${tag}-face`, { radius: 0.145, tessellation: 28 }, scene);
  face.position.z = 0.046;
  face.material = materials.face;
  face.metadata = { radiusM: 0.145, tessellation: 28 };
  face.parent = group;

  const needle = CreateBox(`${tag}-needle`, { width: 0.012, height: 0.105, depth: 0.008 }, scene);
  needle.position.set(0.025, 0.015, 0.052);
  needle.rotation.z = type === 'FT' ? -0.42 : 0.28;
  needle.material = materials.needle;
  needle.metadata = { dimensionsM: [0.012, 0.105, 0.008] };
  needle.parent = group;
  return group;
}

function createLevelIndicator(scene, tag, materials) {
  const group = new TransformNode(`${tag}-level-indicator`, scene);
  const tube = CreateCylinder(`${tag}-sight-glass`, {
    diameter: 0.11,
    height: 0.62,
    tessellation: 14,
  }, scene);
  tube.material = materials.glass;
  tube.metadata = { radiusM: 0.055, heightM: 0.62, tessellation: 14 };
  tube.parent = group;

  const top = CreateBox(`${tag}-level-cap-top`, { width: 0.22, height: 0.07, depth: 0.16 }, scene);
  top.position.y = 0.34;
  top.material = materials.structuralSteel;
  top.metadata = { dimensionsM: [0.22, 0.07, 0.16] };
  top.parent = group;
  const bottom = CreateBox(`${tag}-level-cap-bottom`, { width: 0.22, height: 0.07, depth: 0.16 }, scene);
  bottom.position.y = -0.34;
  bottom.material = materials.structuralSteel;
  bottom.metadata = { dimensionsM: [0.22, 0.07, 0.16] };
  bottom.parent = group;

  const float = CreateBox(`${tag}-level-marker`, { width: 0.09, height: 0.035, depth: 0.09 }, scene);
  float.position.y = 0.08;
  float.material = materials.levelMarker;
  float.metadata = { dimensionsM: [0.09, 0.035, 0.09] };
  float.parent = group;
  return group;
}

function createInstrument(scene, spec, equipmentSystem, materials) {
  const anchor = equipmentSystem.getPortWorldPosition(spec.equipmentId, spec.portId);
  const offset = Vector3.FromArray(spec.offset);
  const center = anchor.add(offset);
  const group = new TransformNode(spec.tag, scene);
  group.metadata = {
    instrumentTag: spec.tag,
    instrumentType: spec.type,
    equipmentId: spec.equipmentId,
    portId: spec.portId,
    offset: [...spec.offset],
    visualOnly: true,
    educationalInstrumentation: true,
    solverCoupled: false,
    sourceVariable: null,
    anchorPoint: anchor.asArray(),
    centerPoint: center.asArray(),
  };

  const branchEnd = center.add(new Vector3(0, -0.20, 0));
  const branch = cylinderBetween(scene, `${spec.tag}-visual-branch`, anchor, branchEnd, 0.027, materials.processSteel, 10);
  branch.parent = group;

  const indicator = spec.type === 'LT'
    ? createLevelIndicator(scene, spec.tag, materials)
    : createDial(scene, spec.tag, spec.type, materials);
  indicator.position.copyFrom(center);
  indicator.parent = group;

  const tagPlate = CreateBox(`${spec.tag}-tag-plate`, { width: 0.25, height: 0.08, depth: 0.035 }, scene);
  tagPlate.position.copyFrom(center.add(new Vector3(0, -0.27, 0)));
  tagPlate.material = materials.tagPlate;
  tagPlate.metadata = { dimensionsM: [0.25, 0.08, 0.035] };
  tagPlate.parent = group;
  return group;
}

export function createBabylonProcessInstrumentation({ scene, equipmentSystem } = {}) {
  requireRightHandedScene(scene);
  if (!equipmentSystem?.getPortWorldPosition) {
    throw new TypeError('Babylon process instrumentation requires integrated processEquipmentSystem.');
  }
  const root = new TransformNode('v24-process-instrumentation', scene);
  root.metadata = {
    visualOnly: true,
    educationalInstrumentation: true,
    solverCoupled: false,
    coordinateSystem: 'right-handed',
    worldUnitsPerMeter: 1,
  };
  const materials = {
    processSteel: material(scene, 'instrument-process-steel', 0xaeb5b3),
    structuralSteel: material(scene, 'instrument-structural-steel', 0x697679),
    face: material(scene, 'instrument-face', 0xe8ece8),
    needle: material(scene, 'instrument-needle', 0x9f2923),
    glass: material(scene, 'instrument-glass', 0xa9d6dc, { alpha: 0.52 }),
    levelMarker: material(scene, 'instrument-level-marker', 0xd5a52d),
    tagPlate: material(scene, 'instrument-tag-plate', 0xd3a12c),
  };
  const instruments = INSTRUMENT_SPECS.map((spec) => {
    const instrument = createInstrument(scene, spec, equipmentSystem, materials);
    instrument.parent = root;
    return instrument;
  });
  root.metadata.instrumentCount = instruments.length;
  return { root, instruments, specs: INSTRUMENT_SPECS, materials };
}
