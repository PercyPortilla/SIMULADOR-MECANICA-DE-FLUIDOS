import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';

export const B81_CONTINUITY_SPECS = Object.freeze([
  Object.freeze({
    id: 'CV01-TO-CRUSHER',
    sourceName: 'CV-01_HEAD_PULLEY',
    targetName: 'PRIMARY-CRUSHER_FEED_CHUTE.001',
    kind: 'ore-chute',
    minGapM: 0.25,
    maxGapM: 6.0,
    widthM: 1.5,
  }),
  Object.freeze({
    id: 'CV03-TO-MILL',
    sourceName: 'TRANSFER-TOWER-03_CHUTE',
    targetName: 'MILL-01_FEED_CHUTE',
    kind: 'ore-chute',
    minGapM: 0.25,
    maxGapM: 3.0,
    widthM: 1.35,
  }),
  Object.freeze({
    id: 'CLASS-OVERFLOW-TO-R01',
    sourceName: 'CLASS-01_OVERFLOW_TO_LEACH_SEG02',
    targetName: 'R-01_INLET_NOZZLE',
    kind: 'pipe-orthogonal',
    minGapM: 0.25,
    maxGapM: 20.0,
    diameterM: 0.72,
  }),
  Object.freeze({
    id: 'LEACH2-TO-R03',
    sourceName: 'LEACH_TRANSFER_2_00',
    targetName: 'R-03_INLET_NOZZLE',
    kind: 'pipe-straight',
    minGapM: 0.25,
    maxGapM: 13.0,
    diameterM: 0.56,
  }),
  Object.freeze({
    id: 'R04-TO-LEACH-TRANSFER',
    sourceName: 'R-04_OUTLET_NOZZLE',
    targetName: 'B52_R04_TO_PUMP_SEG00',
    kind: 'pipe-straight',
    minGapM: 0.25,
    maxGapM: 4.0,
    diameterM: 0.56,
  }),
  Object.freeze({
    id: 'R04-TRANSFER-TO-PUMP01',
    sourceName: 'B52_R04_TO_PUMP_SEG02',
    targetName: 'PUMP-01_SUCTION_NOZZLE',
    kind: 'pipe-straight',
    minGapM: 0.25,
    maxGapM: 6.0,
    diameterM: 0.56,
  }),
  Object.freeze({
    id: 'LEACH-TRANSFER-TO-CIP01',
    sourceName: 'B52_PUMP_TO_CIP_SEG02',
    targetName: 'CIP-01_INLET_NOZZLE',
    kind: 'pipe-straight',
    minGapM: 0.25,
    maxGapM: 9.0,
    diameterM: 0.56,
  }),
  Object.freeze({
    id: 'CIP-TAKEOFF-TO-LOADED-CARBON-ROUTE',
    sourceName: 'V57_CIP_LOADED_CARBON_TAKEOFF_FLUID_01',
    targetName: 'V57_CIP01_TO_ELUTION_CARBON_FLUID_00',
    kind: 'carbon-orthogonal',
    minGapM: 0.25,
    maxGapM: 12.0,
    diameterM: 0.30,
  }),
  Object.freeze({
    id: 'LOADED-CARBON-ROUTE-TO-SCREEN',
    sourceName: 'V57_CIP01_TO_ELUTION_CARBON_04',
    targetName: 'LOADED-CARBON-SCREEN',
    kind: 'carbon-straight',
    minGapM: 0.25,
    maxGapM: 2.0,
    diameterM: 0.30,
  }),
  Object.freeze({
    id: 'CALCINE-TO-SMELTING',
    sourceName: 'B53_CALCINE_TO_SMELTING_06',
    targetName: 'SMELTING-CALCINE-FEED-HOPPER',
    kind: 'solid-chute',
    minGapM: 0.25,
    maxGapM: 13.0,
    widthM: 0.72,
  }),
]);

export const B81_SUPERSEDED_TRANSFER_ROOTS = Object.freeze([
  'TRANSFER-TOWER-STOCKPILE_ROOT',
]);

function visitHierarchy(root, callback) {
  callback(root);
  root.getDescendants?.(false)?.forEach(callback);
}

function indexNodes(rootNodes) {
  const result = new Map();
  rootNodes.forEach((root) => {
    visitHierarchy(root, (node) => {
      if (node?.name && !result.has(node.name)) result.set(node.name, node);
    });
  });
  return result;
}

function hideSupersededTransferRoots(rootNodes) {
  const names = new Set(B81_SUPERSEDED_TRANSFER_ROOTS);
  const hidden = [];
  rootNodes.forEach((root) => {
    visitHierarchy(root, (node) => {
      if (!node || !names.has(String(node.name ?? ''))) return;
      node.setEnabled?.(false);
      if ('isVisible' in node) node.isVisible = false;
      node.metadata = {
        ...(node.metadata ?? {}),
        b81SupersededTransferGeometry: true,
        visualBuild: 'B81',
      };
      hidden.push(node.name);
    });
  });
  return hidden;
}

export function getB81WorldBounds(node) {
  if (!node) return null;
  node.computeWorldMatrix?.(true);
  const bounds = node.getHierarchyBoundingVectors?.(true);
  if (!bounds?.min || !bounds?.max) return null;
  const values = [
    bounds.min.x, bounds.min.y, bounds.min.z,
    bounds.max.x, bounds.max.y, bounds.max.z,
  ];
  if (!values.every(Number.isFinite)) return null;
  return Object.freeze({
    min: bounds.min.clone(),
    max: bounds.max.clone(),
    center: Vector3.Center(bounds.min, bounds.max),
  });
}

function closestAxisPair(aMin, aMax, bMin, bMax) {
  if (aMax < bMin) return [aMax, bMin];
  if (bMax < aMin) return [aMin, bMax];
  const common = (Math.max(aMin, bMin) + Math.min(aMax, bMax)) / 2;
  return [common, common];
}

export function closestPointsBetweenB81Bounds(sourceBounds, targetBounds) {
  if (!sourceBounds || !targetBounds) return null;
  const [sx, tx] = closestAxisPair(sourceBounds.min.x, sourceBounds.max.x, targetBounds.min.x, targetBounds.max.x);
  const [sy, ty] = closestAxisPair(sourceBounds.min.y, sourceBounds.max.y, targetBounds.min.y, targetBounds.max.y);
  const [sz, tz] = closestAxisPair(sourceBounds.min.z, sourceBounds.max.z, targetBounds.min.z, targetBounds.max.z);
  const source = new Vector3(sx, sy, sz);
  const target = new Vector3(tx, ty, tz);
  return Object.freeze({
    source,
    target,
    gapM: Vector3.Distance(source, target),
  });
}

function createMaterials(scene) {
  const chute = new StandardMaterial('b81-continuity-chute-steel', scene);
  chute.diffuseColor = new Color3(0.22, 0.25, 0.26);
  chute.ambientColor = new Color3(0.045, 0.05, 0.052);
  chute.specularColor = new Color3(0.20, 0.22, 0.22);
  chute.specularPower = 22;

  const slurry = new StandardMaterial('b81-continuity-slurry-pipe', scene);
  slurry.diffuseColor = new Color3(0.24, 0.36, 0.39);
  slurry.ambientColor = new Color3(0.04, 0.055, 0.06);
  slurry.specularColor = new Color3(0.22, 0.26, 0.27);
  slurry.specularPower = 28;

  const carbon = new StandardMaterial('b81-continuity-carbon-route', scene);
  carbon.diffuseColor = new Color3(0.20, 0.18, 0.15);
  carbon.ambientColor = new Color3(0.04, 0.035, 0.03);
  carbon.specularColor = new Color3(0.08, 0.075, 0.065);
  carbon.specularPower = 8;
  return { chute, slurry, carbon };
}

function alignAlong(mesh, start, end) {
  const direction = end.subtract(start);
  const length = direction.length();
  if (!(length > 1e-8)) return 0;
  const rotation = Quaternion.Identity();
  Quaternion.FromUnitVectorsToRef(Vector3.Up(), direction.normalize(), rotation);
  mesh.rotationQuaternion = rotation;
  mesh.position = Vector3.Lerp(start, end, 0.5);
  return length;
}

function markBridge(mesh, spec, gapM, role) {
  mesh.isPickable = false;
  mesh.receiveShadows = true;
  mesh.metadata = {
    visualOnly: true,
    siteRevision: 'V57',
    visualBuild: 'B81',
    v57AuthoritativeVisual: true,
    b81ProcessContinuity: true,
    continuityId: spec.id,
    continuityRole: role,
    sourceName: spec.sourceName,
    targetName: spec.targetName,
    measuredGapM: gapM,
  };
}

function createChute(scene, parent, start, end, spec, material, gapM) {
  const length = Vector3.Distance(start, end);
  if (!(length > 1e-8)) return [];
  const width = Number(spec.widthM) || 1.2;
  const mesh = CreateBox(`B81_${spec.id}_CHUTE`, {
    width,
    height: length,
    depth: width * 0.82,
  }, scene);
  mesh.parent = parent;
  alignAlong(mesh, start, end);
  mesh.material = material;
  markBridge(mesh, spec, gapM, 'ore-chute');
  return [mesh];
}

function createPipeSegment(scene, parent, start, end, spec, material, gapM, suffix) {
  const length = Vector3.Distance(start, end);
  if (!(length > 1e-8)) return null;
  const mesh = CreateCylinder(`B81_${spec.id}_${suffix}`, {
    height: length,
    diameter: Number(spec.diameterM) || 0.5,
    tessellation: 24,
    cap: 3,
  }, scene);
  mesh.parent = parent;
  alignAlong(mesh, start, end);
  mesh.material = material;
  markBridge(mesh, spec, gapM, 'pipe');
  return mesh;
}

function createPipe(scene, parent, start, end, spec, material, gapM, orthogonal) {
  const meshes = [];
  if (!orthogonal) {
    const segment = createPipeSegment(scene, parent, start, end, spec, material, gapM, 'SEG01');
    if (segment) meshes.push(segment);
    return meshes;
  }

  const delta = end.subtract(start);
  const useXFirst = Math.abs(delta.x) >= Math.abs(delta.z);
  const corner = useXFirst
    ? new Vector3(end.x, start.y, start.z)
    : new Vector3(start.x, start.y, end.z);
  const corner2 = new Vector3(corner.x, end.y, corner.z);
  const route = [start, corner, corner2, end].filter((point, index, points) => (
    index === 0 || Vector3.Distance(point, points[index - 1]) > 0.05
  ));
  for (let index = 0; index < route.length - 1; index += 1) {
    const segment = createPipeSegment(
      scene,
      parent,
      route[index],
      route[index + 1],
      spec,
      material,
      gapM,
      `SEG${String(index + 1).padStart(2, '0')}`,
    );
    if (segment) meshes.push(segment);
  }
  route.slice(1, -1).forEach((point, index) => {
    const joint = CreateSphere(`B81_${spec.id}_ELBOW_${index + 1}`, {
      diameter: (Number(spec.diameterM) || 0.5) * 1.06,
      segments: 12,
    }, scene);
    joint.parent = parent;
    joint.position.copyFrom(point);
    joint.material = material;
    markBridge(joint, spec, gapM, 'elbow');
    meshes.push(joint);
  });
  return meshes;
}

export function applyB81ProcessContinuityVisual({
  scene,
  rootNodes = [],
  host,
  specs = B81_CONTINUITY_SPECS,
} = {}) {
  if (!scene || !host) throw new TypeError('B81 process continuity visual requires scene and host.');
  const root = new TransformNode('B81_PROCESS_CONTINUITY_CLOSURE', scene);
  root.parent = host;
  root.metadata = {
    visualOnly: true,
    siteRevision: 'V57',
    visualBuild: 'B81',
    v57AuthoritativeVisual: true,
    purpose: 'close measured authored GLB process gaps without changing solver topology',
  };
  const materials = createMaterials(scene);
  const nodeIndex = indexNodes(rootNodes);
  const hiddenSupersededRoots = hideSupersededTransferRoots(rootNodes);
  const bridges = new Map();
  const skipped = [];
  const blockers = [];

  specs.forEach((spec) => {
    const sourceNode = nodeIndex.get(spec.sourceName);
    const targetNode = nodeIndex.get(spec.targetName);
    if (!sourceNode || !targetNode) {
      blockers.push(Object.freeze({ id: spec.id, reason: 'missing-node', source: Boolean(sourceNode), target: Boolean(targetNode) }));
      return;
    }
    const endpoints = closestPointsBetweenB81Bounds(
      getB81WorldBounds(sourceNode),
      getB81WorldBounds(targetNode),
    );
    if (!endpoints) {
      blockers.push(Object.freeze({ id: spec.id, reason: 'missing-bounds' }));
      return;
    }
    if (endpoints.gapM < (Number(spec.minGapM) || 0)) {
      skipped.push(Object.freeze({ id: spec.id, reason: 'already-continuous', gapM: endpoints.gapM }));
      return;
    }
    if (endpoints.gapM > (Number(spec.maxGapM) || Infinity)) {
      blockers.push(Object.freeze({ id: spec.id, reason: 'gap-out-of-contract', gapM: endpoints.gapM }));
      return;
    }

    const material = spec.kind.startsWith('carbon') ? materials.carbon
      : spec.kind.startsWith('pipe') ? materials.slurry
        : materials.chute;
    const meshes = spec.kind.endsWith('chute')
      ? createChute(scene, root, endpoints.source, endpoints.target, spec, material, endpoints.gapM)
      : createPipe(
        scene,
        root,
        endpoints.source,
        endpoints.target,
        spec,
        material,
        endpoints.gapM,
        spec.kind.endsWith('orthogonal'),
      );
    bridges.set(spec.id, Object.freeze({
      spec,
      source: endpoints.source.clone(),
      target: endpoints.target.clone(),
      gapM: endpoints.gapM,
      meshes: Object.freeze([...meshes]),
    }));
  });

  root.metadata.bridgeCount = bridges.size;
  root.metadata.skippedCount = skipped.length;
  root.metadata.blockerCount = blockers.length;
  root.metadata.hiddenSupersededRoots = [...hiddenSupersededRoots];
  host.metadata = {
    ...(host.metadata ?? {}),
    b81ProcessContinuity: true,
    b81BridgeCount: bridges.size,
    b81SkippedCount: skipped.length,
    b81BlockerCount: blockers.length,
    b81HiddenSupersededTransferRootCount: hiddenSupersededRoots.length,
  };

  return {
    root,
    bridges,
    skipped,
    blockers,
    hiddenSupersededRoots,
    dispose() {
      root.dispose(false, true);
      Object.values(materials).forEach((material) => material.dispose(false, true));
      bridges.clear();
    },
  };
}
