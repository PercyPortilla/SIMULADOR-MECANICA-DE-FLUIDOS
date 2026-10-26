import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';

const CONCRETE_NAMES = Object.freeze(new Set([
  'CIV_SAG_FOUNDATION',
  'CIV_SUMP_FOUNDATION',
  'CIV_PUMP_FOUNDATION',
  'CIV_CYCLONE_TOWER_FOUNDATION',
]));

const PIPE_PAIR_SPECS = Object.freeze([
  Object.freeze({ id: 'mill-to-sump', from: 'MILL-01_TROMMEL_DISCHARGE', to: 'SUMP-01_INLET_PIPE', diameter: 1.18 }),
  Object.freeze({ id: 'sump-to-pump', from: 'SLURRY-PUMP-01_SUCTION_SEG02', to: 'SLURRY-PUMP-01_VOLUTE', diameter: 1.04 }),
  Object.freeze({ id: 'pump-to-class', from: 'SLURRY-PUMP-01_DISCHARGE_PIPE', to: 'CLASS-01_FEED_LINE_SEG01', diameter: 0.92 }),
]);

function visitHierarchy(root, callback) {
  callback(root);
  root.getDescendants?.(false)?.forEach(callback);
}

function nodeIndex(rootNodes) {
  const result = new Map();
  rootNodes.forEach((root) => visitHierarchy(root, (node) => {
    if (node?.name && !result.has(node.name)) result.set(node.name, node);
  }));
  return result;
}

function createConcreteTexture(scene) {
  if (typeof document === 'undefined') return null;
  const texture = new DynamicTexture('b71-study-concrete-texture', { width: 256, height: 256 }, scene, false);
  const context = texture.getContext();
  if (!context) return null;
  context.fillStyle = '#666a66';
  context.fillRect(0, 0, 256, 256);
  let seed = 0xB71;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  const flecks = ['#777a75', '#595d59', '#85867f', '#4e524f'];
  for (let index = 0; index < 1150; index += 1) {
    context.globalAlpha = 0.12 + random() * 0.22;
    context.fillStyle = flecks[Math.floor(random() * flecks.length)];
    const size = random() > 0.88 ? 2 : 1;
    context.fillRect(Math.floor(random() * 256), Math.floor(random() * 256), size, size);
  }
  context.globalAlpha = 1;
  texture.update(false);
  texture.hasAlpha = false;
  texture.uScale = 5;
  texture.vScale = 5;
  return texture;
}

function createMaterials(scene) {
  const concreteTexture = createConcreteTexture(scene);
  const concrete = new StandardMaterial('b71-study-industrial-concrete', scene);
  concrete.diffuseColor = new Color3(0.78, 0.79, 0.76);
  concrete.ambientColor = new Color3(0.09, 0.09, 0.085);
  concrete.specularColor = new Color3(0.025, 0.027, 0.025);
  concrete.specularPower = 3;
  if (concreteTexture) concrete.diffuseTexture = concreteTexture;

  const pipe = new StandardMaterial('b71-study-pipe-shell', scene);
  pipe.diffuseColor = new Color3(0.22, 0.29, 0.31);
  pipe.ambientColor = new Color3(0.035, 0.045, 0.048);
  pipe.specularColor = new Color3(0.30, 0.34, 0.35);
  pipe.specularPower = 28;

  const flange = new StandardMaterial('b71-study-pipe-flange', scene);
  flange.diffuseColor = new Color3(0.28, 0.32, 0.33);
  flange.specularColor = new Color3(0.38, 0.40, 0.40);
  flange.specularPower = 34;

  const slurry = new StandardMaterial('b71-study-mineral-slurry', scene);
  slurry.diffuseColor = new Color3(0.32, 0.235, 0.16);
  slurry.ambientColor = new Color3(0.075, 0.052, 0.035);
  slurry.specularColor = new Color3(0.07, 0.06, 0.045);
  slurry.specularPower = 6;
  slurry.alpha = 0.84;
  slurry.backFaceCulling = false;

  const quartz = new StandardMaterial('b71-study-quartz', scene);
  quartz.diffuseColor = new Color3(0.72, 0.71, 0.66);
  quartz.specularColor = new Color3(0.17, 0.17, 0.15);
  quartz.specularPower = 18;

  const pyrite = new StandardMaterial('b71-study-pyrite', scene);
  pyrite.diffuseColor = new Color3(0.34, 0.27, 0.10);
  pyrite.specularColor = new Color3(0.44, 0.35, 0.13);
  pyrite.specularPower = 26;

  const gold = new StandardMaterial('b71-study-disseminated-gold', scene);
  gold.diffuseColor = new Color3(0.72, 0.49, 0.08);
  gold.specularColor = new Color3(0.76, 0.60, 0.19);
  gold.specularPower = 42;
  gold.emissiveColor = new Color3(0.035, 0.022, 0.002);

  return { concreteTexture, concrete, pipe, flange, slurry, quartz, pyrite, gold };
}

function isTargetConcrete(node) {
  const name = String(node?.name ?? '');
  if (CONCRETE_NAMES.has(name)) return true;
  if (/^MILL-01_BEARING_PEDESTAL_/.test(name)) return true;
  if (/^SUMP-01_(?:CUT_|FLOOR$|WALL_)/.test(name) && !name.includes('_TRANS_')) return true;
  if (/^SLURRY-PUMP-01_SUCTION_SUPPORT_\d+_FOOT$/.test(name)) return true;
  return /^CLASS-01_FEED_LINE_SUPPORT_\d+_FOOT$/.test(name);
}

function isTargetPipeShell(node) {
  const name = String(node?.name ?? '');
  if (name === 'SUMP-01_INLET_PIPE' || name === 'SUMP-01_SUCTION_NOZZLE') return true;
  if (name === 'SLURRY-PUMP-01_DISCHARGE_PIPE') return true;
  if (/^SLURRY-PUMP-01_SUCTION_(?:SEG\d+|ELBOW_\d+)$/.test(name)) return true;
  if (/^CLASS-01_FEED_LINE_(?:SEG\d+|ELBOW_\d+)$/.test(name)) return true;
  return /^V57_MILL_TO_SUMP_/.test(name) && !name.includes('FLUID');
}

function bounds(node) {
  if (!node?.getBoundingInfo) return null;
  node.computeWorldMatrix?.(true);
  const box = node.getBoundingInfo().boundingBox;
  return {
    center: box.centerWorld.clone(),
    half: box.extendSizeWorld.clone(),
  };
}

function surfacePoint(box, direction) {
  const extent = extentAlong(box, direction);
  return box.center.add(direction.scale(extent));
}

function extentAlong(box, direction) {
  return Math.abs(direction.x) * box.half.x
    + Math.abs(direction.y) * box.half.y
    + Math.abs(direction.z) * box.half.z;
}

function alignCylinder(mesh, start, end) {
  const direction = end.subtract(start);
  const rotation = Quaternion.Identity();
  Quaternion.FromUnitVectorsToRef(Vector3.Up(), direction.normalize(), rotation);
  mesh.rotationQuaternion = rotation;
  mesh.position.copyFrom(Vector3.Lerp(start, end, 0.5));
}

function addBridge(scene, root, index, spec, materials) {
  const from = index.get(spec.from);
  const to = index.get(spec.to);
  const fromBounds = bounds(from);
  const toBounds = bounds(to);
  if (!fromBounds || !toBounds) return null;
  const direction = toBounds.center.subtract(fromBounds.center);
  const centerDistance = direction.length();
  if (centerDistance <= 1e-8) return null;
  direction.normalize();
  const start = surfacePoint(fromBounds, direction);
  const end = surfacePoint(toBounds, direction.scale(-1));
  const signedGap = centerDistance - extentAlong(fromBounds, direction) - extentAlong(toBounds, direction);
  const midpoint = Vector3.Lerp(start, end, 0.5);
  const actualStart = signedGap > 0.12 ? start : midpoint.subtract(direction.scale(0.16));
  const actualEnd = signedGap > 0.12 ? end : midpoint.add(direction.scale(0.16));
  const length = Math.max(0.32, Vector3.Distance(actualStart, actualEnd));

  const bridge = CreateCylinder(`B71_${spec.id}_SEAM_BRIDGE`, {
    height: length,
    diameter: spec.diameter,
    tessellation: 24,
    cap: 3,
  }, scene);
  bridge.parent = root;
  alignCylinder(bridge, actualStart, actualEnd);
  bridge.material = materials.pipe;
  bridge.isPickable = false;
  bridge.metadata = { visualOnly: true, b71HydraulicStudy: true, seamBridge: spec.id };

  [actualStart, actualEnd].forEach((point, flangeIndex) => {
    const other = flangeIndex === 0 ? actualEnd : actualStart;
    const flange = CreateCylinder(`B71_${spec.id}_FLANGE_${flangeIndex + 1}`, {
      height: 0.16,
      diameter: spec.diameter * 1.22,
      tessellation: 24,
      cap: 3,
    }, scene);
    flange.parent = root;
    const axis = other.subtract(point).normalize();
    const a = point.subtract(axis.scale(0.08));
    const b = point.add(axis.scale(0.08));
    alignCylinder(flange, a, b);
    flange.material = materials.flange;
    flange.isPickable = false;
    flange.metadata = { visualOnly: true, b71HydraulicStudy: true, pipeFlange: true, seamBridge: spec.id };
  });
  return bridge;
}

function addSumpMinerals(scene, root, index, materials) {
  const slurryMesh = index.get('SUMP-01_SLURRY');
  const slurryBounds = bounds(slurryMesh);
  if (!slurryMesh || !slurryBounds) return { minerals: [], slurryMesh: null };
  slurryMesh.material = materials.slurry;
  slurryMesh.metadata = { ...(slurryMesh.metadata ?? {}), b71MineralSlurry: true, visualOnly: true };
  const mineralsRoot = new TransformNode('B71_SUMP_MINERALIZATION', scene);
  mineralsRoot.parent = root;
  mineralsRoot.metadata = { visualOnly: true, b71HydraulicStudy: true, inspectionInterior: true };
  const minerals = [];
  const specs = [
    { kind: 'quartz', count: 34, diameter: 0.065, material: materials.quartz },
    { kind: 'pyrite', count: 22, diameter: 0.048, material: materials.pyrite },
    { kind: 'gold', count: 8, diameter: 0.030, material: materials.gold },
  ];
  let sequence = 0;
  specs.forEach((spec) => {
    for (let i = 0; i < spec.count; i += 1) {
      const angle = (sequence * 2.399963229728653) % (Math.PI * 2);
      const radial = 0.18 + (((sequence * 41) % 97) / 97) * Math.max(0.25, Math.min(slurryBounds.half.x, slurryBounds.half.z) * 0.82);
      const vertical = -slurryBounds.half.y * 0.68 + (((sequence * 29) % 89) / 89) * slurryBounds.half.y * 1.34;
      const particle = CreateSphere(`B71_SUMP_${spec.kind.toUpperCase()}_${String(i + 1).padStart(2, '0')}`, {
        diameter: spec.diameter,
        segments: spec.kind === 'gold' ? 6 : 4,
      }, scene);
      particle.parent = mineralsRoot;
      particle.position.set(
        slurryBounds.center.x + Math.cos(angle) * radial,
        slurryBounds.center.y + vertical,
        slurryBounds.center.z + Math.sin(angle) * radial,
      );
      particle.material = spec.material;
      particle.isPickable = false;
      particle.metadata = {
        visualOnly: true,
        b71HydraulicStudy: true,
        inspectionInterior: true,
        mineral: spec.kind,
        disseminated: spec.kind === 'gold',
      };
      minerals.push(particle);
      sequence += 1;
    }
  });
  return { minerals, slurryMesh };
}

export function applyB71HydraulicStudyVisual({ scene, rootNodes = [], host } = {}) {
  if (!scene || !host) throw new TypeError('B71 hydraulic visual requires scene and host.');
  const index = nodeIndex(rootNodes);
  const root = new TransformNode('B71-HYDRAULIC-STUDY-VISUALS', scene);
  root.parent = host;
  root.metadata = { visualOnly: true, b71HydraulicStudy: true };
  const materials = createMaterials(scene);
  const concreteMeshes = [];
  const pipeMeshes = [];
  index.forEach((node) => {
    if (!('material' in node)) return;
    if (isTargetConcrete(node)) {
      node.material = materials.concrete;
      node.receiveShadows = true;
      node.metadata = { ...(node.metadata ?? {}), b71Concrete: true, visualOnly: true };
      concreteMeshes.push(node);
    }
    if (isTargetPipeShell(node)) {
      node.material = materials.pipe;
      node.receiveShadows = true;
      node.metadata = { ...(node.metadata ?? {}), b71PipeShell: true, visualOnly: true };
      pipeMeshes.push(node);
    }
  });
  const bridges = PIPE_PAIR_SPECS.map((spec) => addBridge(scene, root, index, spec, materials)).filter(Boolean);
  const mineralization = addSumpMinerals(scene, root, index, materials);
  host.metadata = {
    ...(host.metadata ?? {}),
    b71HydraulicStudy: {
      concreteMeshCount: concreteMeshes.length,
      pipeMeshCount: pipeMeshes.length,
      seamBridgeCount: bridges.length,
      mineralParticleCount: mineralization.minerals.length,
      disseminatedGoldCount: mineralization.minerals.filter((mesh) => mesh.metadata?.mineral === 'gold').length,
    },
  };
  return {
    root,
    materials,
    concreteMeshes,
    pipeMeshes,
    bridges,
    minerals: mineralization.minerals,
    slurryMesh: mineralization.slurryMesh,
    dispose() {
      root.dispose(false, true);
      Object.entries(materials).forEach(([key, value]) => {
        if (key !== 'concreteTexture') value?.dispose?.(false, true);
      });
      materials.concreteTexture?.dispose?.();
    },
  };
}
