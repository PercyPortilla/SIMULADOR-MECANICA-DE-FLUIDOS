import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Plane } from '@babylonjs/core/Maths/math.plane.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import {
  INSPECTION_CIRCUIT_ORDER,
  INSPECTION_FOCUS_PROFILES,
  INSPECTION_MODES,
  getInspectionCircuitContext,
  getInspectionTargetLabel,
} from '../../scene/inspection/inspectionContracts.js';
import { V57_INSPECTION_NODE_ALIASES } from '../../scene/integration/v57Layout.js';

function nodeMetadata(node) {
  return node?.metadata ?? {};
}

function isAuthoritativeBlenderVisual(node) {
  const metadata = nodeMetadata(node);
  return metadata.v57AuthoritativeVisual === true;
}

function inferImportedRole(mesh) {
  const metadata = nodeMetadata(mesh);
  const name = String(mesh?.name || '').toUpperCase();
  if (metadata.inspectionRole) return metadata.inspectionRole;
  if (/_(?:SLURRY|FLUID|CHARGE|ORE|LINER|IMPELLER|SHAFT|VORTEX|BAFFLE|BLADE|SCREEN|ELECTROLYTE|CATHODE|MELT|REFRACTORY|JAW)(?:_|$)/.test(name)) return 'interior';
  if (/_(?:SHELL|WALL|CASING|BARREL|CONE|HOPPER|TANK|COVER|VOLUTE|FLOOR|CELL|CRUCIBLE|COLUMN|EXCHANGER)(?:_|$)/.test(name)) return 'shell';
  return 'structure';
}

function isInterior(mesh) {
  return nodeMetadata(mesh).inspectionInterior === true || inferImportedRole(mesh) === 'interior';
}

function isShell(mesh) {
  const metadata = nodeMetadata(mesh);
  if (metadata.inspectionShell === true || inferImportedRole(mesh) === 'shell') return true;
  return /shell|body|casing|hopper|tank|cell|hood|cover|lid|volute|chute|feeder|bed/i.test(mesh?.name || '');
}

function cutPlaneFor(id, framing) {
  const center = framing?.center ?? Vector3.Zero();
  // Long horizontal machines read much better with a longitudinal side cut.
  // Vertical vessels/cyclones use a half-section through X so internals remain
  // visible while preserving the silhouette of the other half.
  if (id === 'MILL-01' || id === 'SLURRY-PUMP-01' || id === 'PUMP-01') {
    return new Plane(0, 0, 1, -center.z);
  }
  if (/^R-0[1-4]$/.test(id)
    || ['CLASS-01', 'CIP-ADSORPTION', 'ELUTION-SKID', 'EW-CELLS', 'SMELTING-FURNACE', 'SUMP-01'].includes(id)) {
    return new Plane(1, 0, 0, -center.x);
  }
  const size = framing?.size ?? Vector3.Zero();
  return size.x >= size.z
    ? new Plane(0, 0, 1, -center.z)
    : new Plane(1, 0, 0, -center.x);
}

function allSceneNodes(scene) {
  return [...(scene.transformNodes ?? []), ...(scene.meshes ?? [])];
}

function resolveV57AliasSources(scene, alias) {
  if (!alias) return [];
  const names = new Set(alias.names ?? []);
  const prefixes = alias.prefixes ?? [];
  const seen = new Set();
  return allSceneNodes(scene).filter((node) => {
    if (!isAuthoritativeBlenderVisual(node)) return false;
    const match = names.has(node.name) || prefixes.some((prefix) => node.name?.startsWith(prefix));
    if (!match || seen.has(node)) return false;
    seen.add(node);
    return true;
  });
}

function findTarget(scene, id, aliasRoot = null) {
  const transformMatches = (scene.transformNodes ?? []).filter((node) => node.name === id);
  const meshMatches = (scene.meshes ?? []).filter((node) => node.name === id);
  const candidates = [...transformMatches, ...meshMatches];
  const exactV57 = candidates.find(isAuthoritativeBlenderVisual);
  if (exactV57) return exactV57;

  const alias = V57_INSPECTION_NODE_ALIASES[id];
  if (alias && aliasRoot) {
    const sources = resolveV57AliasSources(scene, alias);
    const hasV57Scene = sources.length > 0 || allSceneNodes(scene).some(
      (node) => isAuthoritativeBlenderVisual(node),
    );
    if (sources.length || (alias.semanticOnly && hasV57Scene)) {
      const proxy = new TransformNode(`inspection-v57-alias-${id}`, scene);
      proxy.parent = aliasRoot;
      proxy.metadata = {
        v57InspectionAlias: true,
        inspectionCanonicalId: id,
        inspectionAliasSources: sources,
        inspectionAliasBounds: alias.bounds ?? null,
        semanticOnly: alias.semanticOnly === true,
        proxySemantics: alias.proxySemantics ?? null,
        siteRevision: 'V57',
      };
      return proxy;
    }
  }

  return candidates[0]
    ?? scene.getTransformNodeByName(id)
    ?? scene.getMeshByName(id)
    ?? null;
}

function directBounds(node) {
  if (!node) return null;
  node.computeWorldMatrix?.(true);
  const bounds = node.getHierarchyBoundingVectors?.(true);
  if (!bounds?.min || !bounds?.max) return null;
  const values = [bounds.min.x, bounds.min.y, bounds.min.z, bounds.max.x, bounds.max.y, bounds.max.z];
  if (!values.every(Number.isFinite)) return null;
  const size = bounds.max.subtract(bounds.min);
  if (size.lengthSquared() <= 1e-12) return null;
  return {
    min: bounds.min.clone(),
    max: bounds.max.clone(),
    center: Vector3.Center(bounds.min, bounds.max),
    size,
  };
}

function getBounds(node) {
  if (!node) return null;
  const metadata = nodeMetadata(node);
  const explicit = metadata.inspectionAliasBounds;
  if (explicit?.center?.length === 3 && explicit?.size?.length === 3) {
    const center = Vector3.FromArray(explicit.center);
    const size = Vector3.FromArray(explicit.size);
    return {
      min: center.subtract(size.scale(0.5)),
      max: center.add(size.scale(0.5)),
      center,
      size,
    };
  }
  const sources = metadata.inspectionAliasSources;
  if (Array.isArray(sources) && sources.length) {
    const sourceBounds = sources.map(directBounds).filter(Boolean);
    if (sourceBounds.length) {
      const min = sourceBounds[0].min.clone();
      const max = sourceBounds[0].max.clone();
      sourceBounds.slice(1).forEach((bounds) => {
        min.minimizeInPlace(bounds.min);
        max.maximizeInPlace(bounds.max);
      });
      return { min, max, center: Vector3.Center(min, max), size: max.subtract(min) };
    }
  }
  return directBounds(node);
}

function collectNodeMeshes(node) {
  if (!node) return [];
  return [
    ...(node.getBoundingInfo && 'material' in node ? [node] : []),
    ...(node.getChildMeshes?.(false) ?? []),
  ];
}

function collectInspectableMeshes(target) {
  if (!target) return [];
  const sources = nodeMetadata(target).inspectionAliasSources;
  const candidates = Array.isArray(sources)
    ? sources.flatMap((source) => collectNodeMeshes(source))
    : collectNodeMeshes(target);
  const meshes = [];
  const seen = new Set();
  candidates.forEach((mesh) => {
    if (!mesh || seen.has(mesh)) return;
    seen.add(mesh);
    meshes.push(mesh);
  });
  return meshes;
}

function pointAlongPolyline(points, fraction) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const route = points.map((point) => Vector3.FromArray(point));
  const lengths = route.slice(0, -1).map((point, index) => Vector3.Distance(point, route[index + 1]));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  if (total <= 1e-8) return route[0].clone();
  let remaining = Math.max(0, Math.min(1, Number(fraction) || 0.5)) * total;
  for (let index = 0; index < lengths.length; index += 1) {
    const length = lengths[index];
    if (remaining <= length || index === lengths.length - 1) {
      return Vector3.Lerp(route[index], route[index + 1], length <= 1e-8 ? 0 : remaining / length);
    }
    remaining -= length;
  }
  return route.at(-1).clone();
}

export function computeBabylonInspectionFraming(target, id = target?.name) {
  const bounds = getBounds(target);
  if (!bounds) return null;
  const profile = INSPECTION_FOCUS_PROFILES[id];
  if (!profile) {
    return {
      id,
      center: bounds.center,
      size: bounds.size,
      fullSize: bounds.size.clone(),
      focused: false,
      source: 'full-bounds',
    };
  }
  if (profile.focusObjectName) {
    const focus = target.getChildren?.((node) => node.name === profile.focusObjectName, false)?.[0]
      ?? target.getChildMeshes?.(false, (mesh) => mesh.name === profile.focusObjectName)?.[0]
      ?? null;
    const focusBounds = getBounds(focus);
    if (focusBounds) {
      return {
        id,
        center: focusBounds.center,
        size: focusBounds.size,
        fullSize: bounds.size,
        focused: true,
        source: `object:${profile.focusObjectName}`,
      };
    }
  }
  const routeCenter = pointAlongPolyline(nodeMetadata(target).routePoints, profile.routeFraction);
  const size = bounds.size.clone();
  if (Number.isFinite(profile.maxSpanM) && profile.maxSpanM > 0) {
    size.x = Math.min(size.x, profile.maxSpanM);
    size.z = Math.min(size.z, profile.maxSpanM);
  }
  return {
    id,
    center: routeCenter ?? bounds.center,
    size,
    fullSize: bounds.size,
    focused: true,
    source: routeCenter ? 'route-metadata' : 'capped-bounds',
  };
}

function createContextBox(scene, root, target, id, role, color, padding = 0.18) {
  const bounds = getBounds(target);
  if (!bounds) return null;
  const box = CreateBox(`inspection-${role}-${id}`, {
    width: Math.max(0.05, bounds.size.x + padding),
    height: Math.max(0.05, bounds.size.y + padding),
    depth: Math.max(0.05, bounds.size.z + padding),
  }, scene);
  box.parent = root;
  box.position.copyFrom(bounds.center);
  const material = new StandardMaterial(`${box.name}-material`, scene);
  material.emissiveColor = color;
  material.diffuseColor = Color3.Black();
  material.wireframe = true;
  material.disableLighting = true;
  box.material = material;
  box.isPickable = false;
  box.renderingGroupId = 3;
  box.metadata = { inspectionContext: true, targetId: id, role, targetObject: target };
  return box;
}

const OPERATIONAL_STATUS_COLORS = Object.freeze({
  valid: '#72d3a5',
  educational: '#f0b35a',
  limited: '#f0b35a',
  invalid: '#df7f72',
  pending: '#8ba0aa',
  neutral: '#8ba0aa',
});

function createOperationalBeacon(scene, root, target, id, status) {
  const bounds = getBounds(target);
  if (!bounds || !status) return null;
  const tone = OPERATIONAL_STATUS_COLORS[status.tone] ? status.tone : 'neutral';
  const span = Math.max(bounds.size.x, bounds.size.y, bounds.size.z);
  const diameter = Math.min(1.4, Math.max(0.55, span * 0.055));
  const beacon = CreateSphere(`inspection-status-${id}`, { diameter, segments: 12 }, scene);
  beacon.parent = root;
  beacon.position.copyFrom(bounds.center);
  beacon.position.y += bounds.size.y / 2 + diameter * 1.35;
  const material = new StandardMaterial(`${beacon.name}-material`, scene);
  material.emissiveColor = Color3.FromHexString(OPERATIONAL_STATUS_COLORS[tone]);
  material.diffuseColor = Color3.Black();
  material.disableLighting = true;
  beacon.material = material;
  beacon.isPickable = false;
  beacon.renderingGroupId = 3;
  beacon.metadata = {
    inspectionOperationalStatus: true,
    targetId: id,
    tone,
    label: status.label ?? '',
    visualOnly: true,
  };
  return beacon;
}

export function createBabylonEquipmentInspectionSystem({ scene } = {}) {
  if (!scene) throw new TypeError('Babylon Inspection requiere Scene.');
  const targets = new Map();
  const contextOverlay = new TransformNode('inspection-circuit-context', scene);
  contextOverlay.metadata = { inspectionOverlay: true };
  const hoverOverlay = new TransformNode('inspection-hover-context', scene);
  hoverOverlay.metadata = { inspectionHoverOverlay: true };
  const statusOverlay = new TransformNode('inspection-operational-status', scene);
  statusOverlay.metadata = { inspectionOperationalStatusOverlay: true, visualOnly: true };
  const aliasRoot = new TransformNode('inspection-v50-aliases', scene);
  aliasRoot.metadata = { inspectionAliasRoot: true, visualOnly: true };
  let currentTargetId = null;
  let currentMode = 'normal';
  let hoverTargetId = null;
  let operationalStatus = null;
  let activeSnapshot = null;
  const pickTargetIds = new Map();
  const pickabilitySnapshot = new Map();

  function restorePickability() {
    pickabilitySnapshot.forEach((isPickable, mesh) => {
      if (!mesh?.isDisposed?.()) mesh.isPickable = isPickable;
    });
    pickabilitySnapshot.clear();
    pickTargetIds.clear();
  }

  function syncPickableMeshes() {
    restorePickability();
    INSPECTION_CIRCUIT_ORDER.forEach((id) => {
      const target = targets.get(id);
      if (!target || nodeMetadata(target).semanticOnly === true) return;
      collectInspectableMeshes(target)
        .filter((mesh) => isAuthoritativeBlenderVisual(mesh))
        .forEach((mesh) => {
          if (!pickabilitySnapshot.has(mesh)) pickabilitySnapshot.set(mesh, Boolean(mesh.isPickable));
          if (pickTargetIds.has(mesh)) return;
          pickTargetIds.set(mesh, id);
          mesh.isPickable = true;
        });
    });
    return pickTargetIds.size;
  }

  function rebuildTargets() {
    restorePickability();
    clearHoverOverlay();
    clearStatusOverlay();
    hoverTargetId = null;
    targets.clear();
    aliasRoot.getChildren?.().forEach((node) => node.dispose?.());
    INSPECTION_CIRCUIT_ORDER.forEach((id) => {
      const target = findTarget(scene, id, aliasRoot);
      if (target) targets.set(id, target);
    });
    syncPickableMeshes();
  }

  function resolvePickTargetId(mesh) {
    return pickTargetIds.get(mesh) ?? null;
  }

  function clearContextOverlay() {
    contextOverlay.getChildMeshes(false).forEach((mesh) => {
      mesh.material?.dispose?.(false, false);
      mesh.dispose(false, false);
    });
  }

  function clearHoverOverlay() {
    hoverOverlay.getChildMeshes(false).forEach((mesh) => {
      mesh.material?.dispose?.(false, false);
      mesh.dispose(false, false);
    });
  }

  function clearStatusOverlay() {
    statusOverlay.getChildMeshes(false).forEach((mesh) => {
      mesh.material?.dispose?.(false, false);
      mesh.dispose(false, false);
    });
  }

  function refreshStatusOverlay() {
    clearStatusOverlay();
    if (!currentTargetId || !operationalStatus) return null;
    const target = targets.get(currentTargetId);
    if (!target) return null;
    return createOperationalBeacon(scene, statusOverlay, target, currentTargetId, operationalStatus);
  }

  function refreshHoverOverlay() {
    clearHoverOverlay();
    if (!hoverTargetId || hoverTargetId === currentTargetId) return null;
    const target = targets.get(hoverTargetId);
    if (!target) return null;
    return createContextBox(
      scene,
      hoverOverlay,
      target,
      hoverTargetId,
      'hover',
      Color3.FromHexString('#fff2a8'),
      0.30,
    );
  }

  function updateContextOverlay(id) {
    clearContextOverlay();
    if (!id) return;
    const context = getInspectionCircuitContext(id);
    createContextBox(scene, contextOverlay, targets.get(id), id, 'selected', Color3.FromHexString('#7de3ed'));
    if (context.previousId && targets.has(context.previousId)) {
      createContextBox(scene, contextOverlay, targets.get(context.previousId), context.previousId, 'upstream', Color3.FromHexString('#f0b35a'));
    }
    if (context.nextId && targets.has(context.nextId)) {
      createContextBox(scene, contextOverlay, targets.get(context.nextId), context.nextId, 'downstream', Color3.FromHexString('#a8d18d'));
    }
  }

  function restore() {
    if (!activeSnapshot) return;
    activeSnapshot.entries.forEach((entry) => {
      if (entry.mesh.material !== entry.material) entry.mesh.material?.dispose?.(false, false);
      entry.mesh.material = entry.material;
      entry.mesh.isVisible = entry.isVisible;
      entry.mesh.visibility = entry.visibility;
      entry.mesh.renderingGroupId = entry.renderingGroupId;
    });
    activeSnapshot.target.metadata = { ...nodeMetadata(activeSnapshot.target), inspectionMode: 'normal' };
    activeSnapshot = null;
  }

  function applyMode(target, mode) {
    restore();
    target.metadata = { ...nodeMetadata(target), inspectionMode: mode };
    if (mode === 'normal') return;
    const meshes = collectInspectableMeshes(target);
    const entries = meshes.map((mesh) => ({
      mesh,
      material: mesh.material,
      isVisible: mesh.isVisible,
      visibility: mesh.visibility,
      renderingGroupId: mesh.renderingGroupId,
    }));
    activeSnapshot = { target, entries };
    const framing = computeBabylonInspectionFraming(target, currentTargetId);
    const cutPlane = cutPlaneFor(currentTargetId, framing);
    entries.forEach((entry, index) => {
      const { mesh } = entry;
      const interior = isInterior(mesh);
      const shell = isShell(mesh);
      if (interior) {
        mesh.isVisible = true;
        mesh.visibility = 1;
        mesh.renderingGroupId = 3;
      }
      if (!entry.material?.clone) return;
      const clone = entry.material.clone(`${entry.material.name || 'inspection'}-${mode}-${index}`);
      mesh.material = clone;
      if (interior) {
        clone.alpha = Math.max(Number(clone.alpha) || 1, 0.76);
        clone.backFaceCulling = false;
        return;
      }
      if (mode === 'transparent') {
        clone.alpha = shell ? 0.20 : Math.min(Number(clone.alpha) || 1, 0.34);
        clone.backFaceCulling = false;
        clone.separateCullingPass = true;
        mesh.renderingGroupId = shell ? 2 : 1;
      } else if (mode === 'cutaway' && shell) {
        clone.clipPlane = cutPlane.clone();
        clone.alpha = Math.min(Number(clone.alpha) || 1, 0.92);
        clone.backFaceCulling = false;
        clone.separateCullingPass = true;
        mesh.renderingGroupId = 1;
      } else if (mode === 'cutaway') {
        // Dim frames/guards so the sectioned internals are not obscured.
        clone.alpha = Math.min(Number(clone.alpha) || 1, 0.24);
        clone.backFaceCulling = false;
        mesh.renderingGroupId = 1;
      } else if (mode === 'interior') {
        if (shell) {
          mesh.isVisible = false;
        } else {
          clone.alpha = 0.07;
          clone.backFaceCulling = false;
          mesh.renderingGroupId = 1;
        }
      }
    });
  }

  function refreshContextOverlay() {
    const id = currentTargetId;
    if (id) updateContextOverlay(id);
  }

  function getTargetInfo(id) {
    const target = targets.get(id);
    if (!target) return null;
    const context = getInspectionCircuitContext(id);
    const metadata = nodeMetadata(target);
    const inspectableMeshes = collectInspectableMeshes(target);
    const conveyor = Boolean(metadata.conveyorId) || id.startsWith('CV-');
    const connection = Boolean(metadata.connectionId) || id.startsWith('P-') || id.startsWith('MT-');
    return {
      id,
      label: getInspectionTargetLabel(id, {
        conveyor,
        connection,
      }),
      kind: metadata.inspectionKind || metadata.type || (connection ? 'connection' : conveyor ? 'conveyor' : 'equipment'),
      supportsModes: metadata.semanticOnly !== true && inspectableMeshes.length > 0,
      semanticOnly: metadata.semanticOnly === true,
      proxySemantics: metadata.proxySemantics ?? null,
      circuitOrder: context.index,
      previousId: context.previousId,
      nextId: context.nextId,
    };
  }

  function getTargets() {
    return INSPECTION_CIRCUIT_ORDER.map((id) => getTargetInfo(id)).filter(Boolean);
  }

  function refreshTargets() {
    const previousTarget = currentTargetId;
    const previousMode = currentMode;
    restore();
    rebuildTargets();
    if (previousTarget && targets.has(previousTarget)) {
      currentTargetId = previousTarget;
      currentMode = previousMode;
      if (previousMode !== 'normal') applyMode(targets.get(previousTarget), previousMode);
      updateContextOverlay(previousTarget);
      refreshStatusOverlay();
    } else if (previousTarget) {
      currentTargetId = null;
      currentMode = 'normal';
      updateContextOverlay(null);
      refreshStatusOverlay();
    }
    return getTargets();
  }

  function setTarget(id) {
    restore();
    if (!id) {
      currentTargetId = null;
      currentMode = 'normal';
      updateContextOverlay(null);
      refreshHoverOverlay();
      refreshStatusOverlay();
      return null;
    }
    if (!targets.has(id)) rebuildTargets();
    if (!targets.has(id)) throw new RangeError(`Equipo Babylon no inspeccionable: ${id}.`);
    if (currentTargetId !== id) operationalStatus = null;
    currentTargetId = id;
    currentMode = 'normal';
    updateContextOverlay(id);
    refreshHoverOverlay();
    refreshStatusOverlay();
    return targets.get(id);
  }

  function setHoverTarget(id) {
    const nextId = id && targets.has(id) ? id : null;
    if (nextId === hoverTargetId) return nextId ? targets.get(nextId) : null;
    hoverTargetId = nextId;
    refreshHoverOverlay();
    return nextId ? targets.get(nextId) : null;
  }

  function setOperationalStatus(status) {
    operationalStatus = status && typeof status === 'object'
      ? Object.freeze({
        tone: OPERATIONAL_STATUS_COLORS[status.tone] ? status.tone : 'neutral',
        label: String(status.label ?? ''),
      })
      : null;
    refreshStatusOverlay();
    return operationalStatus;
  }

  function setMode(mode) {
    if (!INSPECTION_MODES.includes(mode)) throw new RangeError(`Modo Babylon de inspección inválido: ${mode}.`);
    currentMode = mode;
    if (!currentTargetId) {
      restore();
      return;
    }
    const target = targets.get(currentTargetId);
    const metadata = nodeMetadata(target);
    const supportsModes = metadata.semanticOnly !== true && collectInspectableMeshes(target).length > 0;
    if (mode !== 'normal' && !supportsModes) {
      currentMode = 'normal';
      restore();
      target.metadata = { ...metadata, inspectionMode: 'normal' };
      return 'normal';
    }
    applyMode(target, mode);
    return mode;
  }

  rebuildTargets();
  return {
    modes: INSPECTION_MODES,
    contextOverlay,
    hoverOverlay,
    statusOverlay,
    getTargets,
    getTargetInfo,
    refreshTargets,
    setTarget,
    setHoverTarget,
    setOperationalStatus,
    setMode,
    resolvePickTargetId,
    getPickableMeshCount: () => pickTargetIds.size,
    getFraming: (id = currentTargetId) => (id && targets.has(id) ? computeBabylonInspectionFraming(targets.get(id), id) : null),
    getContext: (id = currentTargetId) => getInspectionCircuitContext(id),
    refreshContextOverlay,
    get targetId() { return currentTargetId; },
    get hoverTargetId() { return hoverTargetId; },
    get operationalStatus() { return operationalStatus; },
    get mode() { return currentMode; },
    dispose() {
      restore();
      restorePickability();
      clearContextOverlay();
      clearHoverOverlay();
      clearStatusOverlay();
      contextOverlay.dispose();
      hoverOverlay.dispose();
      statusOverlay.dispose();
      aliasRoot.dispose();
      targets.clear();
    },
  };
}
