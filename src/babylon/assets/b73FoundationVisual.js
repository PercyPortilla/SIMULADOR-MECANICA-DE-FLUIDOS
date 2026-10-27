import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Ray } from '@babylonjs/core/Culling/ray.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import {
  V57_EQUIPMENT_ANCHORS,
  V57_INSPECTION_NODE_ALIASES,
} from '../../scene/integration/v57Layout.js';

export const B73_SUPERSEDED_CONTINUOUS_FOUNDATIONS = Object.freeze([
  'V49_PAD_RECOVERY',
  'V49_PAD_LEACH_CIP',
  'V49_PAD_CLASS_PUMP',
  'V49_PAD_SUMP',
  'V49_PAD_MILL',
  'CIV_SAG_FOUNDATION',
  'CIV_SUMP_FOUNDATION',
  'CIV_PUMP_FOUNDATION',
  'CIV_CYCLONE_TOWER_FOUNDATION',
  'CIV_LEACH_BASE',
  'CIV_CIP_BASE',
  'CIV_ELUTION_BASE',
  'CIV_EW_BASE',
  'CIV_SMELTING_BASE',
]);

export const B73_FOUNDATION_SPECS = Object.freeze([
  Object.freeze({
    id: 'MILL-01',
    shape: 'box',
    focusNames: Object.freeze(['MILL-01_BEARING_PEDESTAL_141.05', 'MILL-01_BEARING_PEDESTAL_148.95']),
    minWidthM: 12.0,
    minDepthM: 8.5,
    maxWidthM: 18.0,
    maxDepthM: 13.0,
    marginM: 0.85,
    thicknessM: 0.46,
    revealM: 0.07,
  }),
  Object.freeze({
    id: 'SUMP-01',
    shape: 'box',
    focusNames: Object.freeze(['SUMP-01_FLOOR']),
    minWidthM: 7.0,
    minDepthM: 6.0,
    maxWidthM: 10.5,
    maxDepthM: 9.0,
    marginM: 0.65,
    thicknessM: 0.40,
    revealM: 0.05,
  }),
  Object.freeze({
    id: 'SLURRY-PUMP-01',
    shape: 'box',
    focusNames: Object.freeze(['SLURRY-PUMP-01_BASE']),
    minWidthM: 7.0,
    minDepthM: 5.0,
    maxWidthM: 10.0,
    maxDepthM: 7.5,
    marginM: 0.70,
    thicknessM: 0.38,
    revealM: 0.06,
  }),
  Object.freeze({
    id: 'CLASS-01',
    shape: 'box',
    focusPrefixes: Object.freeze(['CLASS-01_COLUMN_']),
    minWidthM: 9.5,
    minDepthM: 8.0,
    maxWidthM: 14.0,
    maxDepthM: 12.0,
    marginM: 0.80,
    thicknessM: 0.42,
    revealM: 0.06,
  }),
  ...Object.freeze(Array.from({ length: 4 }, (_, index) => {
    const number = String(index + 1).padStart(2, '0');
    return Object.freeze({
      id: `R-${number}`,
      shape: 'cylinder',
      focusNames: Object.freeze([`R-${number}_BOTTOM`]),
      minDiameterM: 11.0,
      maxDiameterM: 16.5,
      marginM: 0.75,
      thicknessM: 0.42,
      revealM: 0.06,
    });
  })),
  Object.freeze({
    id: 'CIP-ADSORPTION',
    shape: 'cylinder',
    minDiameterM: 10.5,
    maxDiameterM: 12.0,
    marginM: 0.70,
    thicknessM: 0.42,
    revealM: 0.06,
    instances: Object.freeze(Array.from({ length: 6 }, (_, index) => {
      const number = String(index + 1).padStart(2, '0');
      return Object.freeze({
        key: number,
        focusNames: Object.freeze([`CIP-${number}_BOTTOM`]),
      });
    })),
  }),
  Object.freeze({
    id: 'ELUTION-SKID',
    shape: 'box',
    focusNames: Object.freeze(['ELUTION-SKID_FRAME']),
    minWidthM: 12.0,
    minDepthM: 8.0,
    maxWidthM: 19.0,
    maxDepthM: 13.0,
    marginM: 0.75,
    thicknessM: 0.40,
    revealM: 0.06,
  }),
  Object.freeze({
    id: 'EW-CELLS',
    shape: 'box',
    focusNames: Object.freeze(Array.from({ length: 8 }, (_, index) => `EW-CELL-${String(index + 1).padStart(2, '0')}-TANK`)),
    minWidthM: 13.0,
    minDepthM: 8.0,
    maxWidthM: 21.0,
    maxDepthM: 14.0,
    marginM: 0.75,
    thicknessM: 0.40,
    revealM: 0.06,
  }),
  Object.freeze({
    id: 'PUMP-01',
    shape: 'box',
    reuseFoundationName: 'PUMP-01_FOUNDATION',
    minWidthM: 4.4,
    minDepthM: 7.1,
    maxWidthM: 6.0,
    maxDepthM: 9.0,
    marginM: 0.35,
    thicknessM: 0.36,
    revealM: 0.05,
  }),
  Object.freeze({
    id: 'SMELTING-FURNACE',
    shape: 'box',
    reuseFoundationName: 'SMELTING-FOUNDATION-V57',
    minWidthM: 10.0,
    minDepthM: 8.0,
    maxWidthM: 16.0,
    maxDepthM: 13.0,
    marginM: 0.75,
    thicknessM: 0.42,
    revealM: 0.06,
  }),
]);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function finite(value) {
  return Number.isFinite(Number(value));
}

function isV57Node(node) {
  return node?.metadata?.v57AuthoritativeVisual === true;
}

function allV57Nodes(scene) {
  return [...(scene?.transformNodes ?? []), ...(scene?.meshes ?? [])].filter(isV57Node);
}

function resolveAliasSources(scene, equipmentId) {
  const alias = V57_INSPECTION_NODE_ALIASES[equipmentId];
  if (!alias || alias.semanticOnly) return [];
  const names = new Set(alias.names ?? []);
  const prefixes = alias.prefixes ?? [];
  const seen = new Set();
  return allV57Nodes(scene).filter((node) => {
    const name = String(node?.name ?? '');
    const match = names.has(name) || prefixes.some((prefix) => name.startsWith(prefix));
    if (!match || seen.has(node)) return false;
    seen.add(node);
    return true;
  });
}

function resolveFocusedSources(scene, spec, instance = null) {
  const names = new Set(instance?.focusNames ?? spec?.focusNames ?? []);
  const prefixes = instance?.focusPrefixes ?? spec?.focusPrefixes ?? [];
  if (!names.size && !prefixes.length) return [];
  return allV57Nodes(scene).filter((node) => {
    const name = String(node?.name ?? '');
    return names.has(name) || prefixes.some((prefix) => name.startsWith(prefix));
  });
}

function resolveFoundationBounds(scene, spec, instance = null) {
  const focused = resolveFocusedSources(scene, spec, instance);
  if (focused.length) return aggregateBounds(focused);
  const hasFocusContract = Boolean(
    instance?.focusNames?.length
    || instance?.focusPrefixes?.length
    || spec?.focusNames?.length
    || spec?.focusPrefixes?.length,
  );
  if (instance || hasFocusContract) return null;
  return aggregateBounds(resolveAliasSources(scene, spec.id));
}

function directBounds(node) {
  if (!node) return null;
  node.computeWorldMatrix?.(true);
  const bounds = node.getHierarchyBoundingVectors?.(true);
  if (!bounds?.min || !bounds?.max) return null;
  const values = [bounds.min.x, bounds.min.y, bounds.min.z, bounds.max.x, bounds.max.y, bounds.max.z];
  if (!values.every(Number.isFinite)) return null;
  const size = bounds.max.subtract(bounds.min);
  if (size.lengthSquared() <= 1e-10) return null;
  return {
    min: bounds.min.clone(),
    max: bounds.max.clone(),
    center: Vector3.Center(bounds.min, bounds.max),
    size,
  };
}

function aggregateBounds(nodes) {
  const bounds = nodes.map(directBounds).filter(Boolean);
  if (!bounds.length) return null;
  const min = bounds[0].min.clone();
  const max = bounds[0].max.clone();
  bounds.slice(1).forEach((entry) => {
    min.minimizeInPlace(entry.min);
    max.maximizeInPlace(entry.max);
  });
  return {
    min,
    max,
    center: Vector3.Center(min, max),
    size: max.subtract(min),
  };
}

export function resolveB73FoundationDimensions(spec, boundsSize = null) {
  if (!spec) return null;
  const sx = finite(boundsSize?.x) ? Number(boundsSize.x) : 0;
  const sz = finite(boundsSize?.z) ? Number(boundsSize.z) : 0;
  const margin = Math.max(0, Number(spec.marginM) || 0);
  if (spec.shape === 'cylinder') {
    const required = Math.max(sx, sz) + margin * 2;
    const designMin = Number(spec.minDiameterM) || 1;
    const designMax = Number(spec.maxDiameterM) || Infinity;
    const diameter = required > designMax ? required : clamp(required, designMin, designMax);
    return Object.freeze({ shape: 'cylinder', diameterM: diameter, widthM: diameter, depthM: diameter });
  }
  const requiredWidth = sx + margin * 2;
  const requiredDepth = sz + margin * 2;
  const designMinWidth = Number(spec.minWidthM) || 1;
  const designMaxWidth = Number(spec.maxWidthM) || Infinity;
  const designMinDepth = Number(spec.minDepthM) || 1;
  const designMaxDepth = Number(spec.maxDepthM) || Infinity;
  const width = requiredWidth > designMaxWidth
    ? requiredWidth
    : clamp(requiredWidth, designMinWidth, designMaxWidth);
  const depth = requiredDepth > designMaxDepth
    ? requiredDepth
    : clamp(requiredDepth, designMinDepth, designMaxDepth);
  return Object.freeze({ shape: 'box', widthM: width, depthM: depth });
}

export function computeB73FoundationTopY({
  equipmentMinY,
  terrainSamples = [],
  revealM = 0.06,
  clearanceM = 0.025,
} = {}) {
  const minY = Number(equipmentMinY);
  if (!Number.isFinite(minY)) return null;
  const validGround = terrainSamples.map(Number).filter(Number.isFinite);
  if (!validGround.length) return minY - Math.max(0, Number(clearanceM) || 0);
  const terrainHigh = Math.max(...validGround);
  const terrainTop = terrainHigh + Math.max(0, Number(revealM) || 0);
  return Math.min(minY - Math.max(0, Number(clearanceM) || 0), terrainTop);
}

export function computeB73FoundationThickness({
  baseThicknessM = 0.40,
  terrainSamples = [],
  revealM = 0.06,
} = {}) {
  const validGround = terrainSamples.map(Number).filter(Number.isFinite);
  if (validGround.length < 2) return Math.max(0.24, Number(baseThicknessM) || 0.40);
  const relief = Math.max(...validGround) - Math.min(...validGround);
  return clamp(
    Math.max(Number(baseThicknessM) || 0.40, relief + Math.max(0, Number(revealM) || 0) + 0.14),
    0.24,
    0.90,
  );
}

function importedTerrainHeight(scene, x, z) {
  if (!scene?.pickWithRay || !finite(x) || !finite(z)) return null;
  const ray = new Ray(new Vector3(Number(x), 180, Number(z)), new Vector3(0, -1, 0), 360);
  const pick = scene.pickWithRay(
    ray,
    (mesh) => String(mesh?.name ?? '').startsWith('V57_TERRAIN_INTEGRATED')
      && mesh.isEnabled?.() !== false
      && mesh.isVisible !== false,
    false,
  );
  return pick?.hit && finite(pick.pickedPoint?.y) ? Number(pick.pickedPoint.y) : null;
}

function sampleTerrain(scene, centerX, centerZ, widthM, depthM) {
  const halfX = Math.max(0.2, Number(widthM) * 0.42);
  const halfZ = Math.max(0.2, Number(depthM) * 0.42);
  return [
    [centerX, centerZ],
    [centerX - halfX, centerZ - halfZ],
    [centerX + halfX, centerZ - halfZ],
    [centerX + halfX, centerZ + halfZ],
    [centerX - halfX, centerZ + halfZ],
  ].map(([x, z]) => importedTerrainHeight(scene, x, z)).filter(Number.isFinite);
}

function createConcreteMaterial(scene) {
  const material = new StandardMaterial('b73-local-foundation-concrete', scene);
  // B76: local foundations must read as industrial concrete, not as bright
  // white slabs under ACES exposure.
  material.diffuseColor = new Color3(0.36, 0.38, 0.37);
  material.ambientColor = new Color3(0.11, 0.11, 0.105);
  material.specularColor = new Color3(0.024, 0.024, 0.022);
  material.specularPower = 3;
  material.metadata = {
    visualOnly: true,
    b73LocalFoundationMaterial: true,
  };
  return material;
}

function hideSupersededContinuousFoundations(rootNodes) {
  const hidden = [];
  const names = B73_SUPERSEDED_CONTINUOUS_FOUNDATIONS;
  const seen = new Set();
  rootNodes.flatMap((root) => [root, ...(root.getDescendants?.(false) ?? [])]).forEach((node) => {
    if (!node || seen.has(node)) return;
    seen.add(node);
    const nodeName = String(node.name ?? '');
    const matched = names.find((name) => nodeName === name || nodeName.startsWith(`${name}.`));
    if (!matched) return;
    node.setEnabled?.(false);
    if ('isVisible' in node) node.isVisible = false;
    node.metadata = {
      ...(node.metadata ?? {}),
      b73SupersededContinuousFoundation: true,
      b73SupersededName: matched,
    };
    hidden.push(nodeName);
  });
  return hidden;
}

function foundationCenter(spec, bounds) {
  if (bounds) return { x: bounds.center.x, z: bounds.center.z };
  const anchor = V57_EQUIPMENT_ANCHORS[spec.id];
  return anchor ? { x: anchor.x, z: anchor.z } : null;
}

function createFoundationMesh(scene, root, material, spec, bounds, { key = spec.id } = {}) {
  const center = foundationCenter(spec, bounds);
  if (!center || !bounds) return null;
  const dimensions = resolveB73FoundationDimensions(spec, bounds.size);
  if (!dimensions) return null;
  const terrainSamples = sampleTerrain(scene, center.x, center.z, dimensions.widthM, dimensions.depthM);
  const topY = computeB73FoundationTopY({
    equipmentMinY: bounds.min.y,
    terrainSamples,
    revealM: spec.revealM,
  });
  if (!Number.isFinite(topY)) return null;
  const thickness = computeB73FoundationThickness({
    baseThicknessM: spec.thicknessM,
    terrainSamples,
    revealM: spec.revealM,
  });

  const mesh = spec.shape === 'cylinder'
    ? CreateCylinder(`B73_FOUNDATION_${key}`, {
      diameter: dimensions.diameterM,
      height: thickness,
      tessellation: 48,
      subdivisions: 1,
      cap: 3,
    }, scene)
    : CreateBox(`B73_FOUNDATION_${key}`, {
      width: dimensions.widthM,
      height: thickness,
      depth: dimensions.depthM,
    }, scene);

  mesh.parent = root;
  mesh.position.set(center.x, topY - thickness / 2, center.z);
  mesh.material = material;
  mesh.receiveShadows = true;
  mesh.isPickable = false;
  mesh.metadata = {
    visualOnly: true,
    siteRevision: 'V57',
    visualBuild: 'B73/B76',
    v57AuthoritativeVisual: true,
    b73LocalFoundation: true,
    equipmentId: spec.id,
    foundationKey: key,
    foundationFocus: Boolean(spec.focusNames?.length || spec.focusPrefixes?.length || spec.instances?.length),
    foundationShape: spec.shape,
    widthM: dimensions.widthM,
    depthM: dimensions.depthM,
    diameterM: dimensions.diameterM ?? null,
    thicknessM: thickness,
    topY,
    equipmentMinY: bounds.min.y,
    terrainSamples,
    partiallyEmbedded: true,
  };
  return mesh;
}

export function applyB73FoundationVisual({ scene, rootNodes, host } = {}) {
  if (!scene || !Array.isArray(rootNodes) || !host) {
    throw new TypeError('B73 foundation visual requires scene, rootNodes and host.');
  }

  const root = new TransformNode('B73_LOCAL_EQUIPMENT_FOUNDATIONS', scene);
  root.parent = host;
  root.metadata = {
    visualOnly: true,
    siteRevision: 'V57',
    visualBuild: 'B73/B76',
    v57AuthoritativeVisual: true,
    purpose: 'replace oversized continuous process slabs with local equipment foundations',
  };

  const material = createConcreteMaterial(scene);
  const hiddenContinuousFoundations = hideSupersededContinuousFoundations(rootNodes);
  const foundations = new Map();
  const skipped = [];

  B73_FOUNDATION_SPECS.forEach((spec) => {
    if (spec.reuseFoundationName) {
      const reused = allV57Nodes(scene).find((node) => node.name === spec.reuseFoundationName) ?? null;
      if (reused) {
        if ('material' in reused) reused.material = material;
        reused.setEnabled?.(true);
        if ('isVisible' in reused) reused.isVisible = true;
        reused.metadata = {
          ...(reused.metadata ?? {}),
          b73LocalFoundation: true,
          b73ReusedAuthoredFoundation: true,
          equipmentId: spec.id,
          foundationKey: spec.id,
          visualBuild: 'B73/B80',
        };
        foundations.set(spec.id, reused);
      } else {
        skipped.push(spec.id);
      }
      return;
    }
    if (spec.instances?.length) {
      spec.instances.forEach((instance) => {
        const key = `${spec.id}-${instance.key}`;
        const bounds = resolveFoundationBounds(scene, spec, instance);
        const mesh = createFoundationMesh(scene, root, material, spec, bounds, { key });
        if (mesh) foundations.set(key, mesh);
        else skipped.push(key);
      });
      return;
    }
    const bounds = resolveFoundationBounds(scene, spec);
    const mesh = createFoundationMesh(scene, root, material, spec, bounds);
    if (mesh) foundations.set(spec.id, mesh);
    else skipped.push(spec.id);
  });

  root.metadata.hiddenContinuousFoundations = [...hiddenContinuousFoundations];
  root.metadata.localFoundationCount = foundations.size;
  root.metadata.skippedFoundationIds = [...skipped];

  host.metadata = {
    ...(host.metadata ?? {}),
    b73FoundationVisual: true,
    b73HiddenContinuousFoundationCount: hiddenContinuousFoundations.length,
    b73LocalFoundationCount: foundations.size,
    b73SkippedFoundationIds: [...skipped],
  };

  return {
    root,
    foundations,
    hiddenContinuousFoundations,
    skipped,
    dispose() {
      root.dispose(false, true);
      material.dispose(false, true);
      foundations.clear();
    },
  };
}
