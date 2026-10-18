import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Plane } from '@babylonjs/core/Maths/math.plane.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import {
  INSPECTION_CIRCUIT_ORDER,
  INSPECTION_FOCUS_PROFILES,
  INSPECTION_MODES,
  getInspectionCircuitContext,
  getInspectionTargetLabel,
} from '../../scene/inspection/inspectionContracts.js';

function nodeMetadata(node) {
  return node?.metadata ?? {};
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

function findTarget(scene, id) {
  return scene.getTransformNodeByName(id) ?? scene.getMeshByName(id) ?? null;
}

function getBounds(node) {
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

function createContextBox(scene, root, target, id, role, color) {
  const bounds = getBounds(target);
  if (!bounds) return null;
  const box = CreateBox(`inspection-${role}-${id}`, {
    width: Math.max(0.05, bounds.size.x + 0.18),
    height: Math.max(0.05, bounds.size.y + 0.18),
    depth: Math.max(0.05, bounds.size.z + 0.18),
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

export function createBabylonEquipmentInspectionSystem({ scene } = {}) {
  if (!scene) throw new TypeError('Babylon Inspection requiere Scene.');
  const targets = new Map();
  const contextOverlay = new TransformNode('inspection-circuit-context', scene);
  contextOverlay.metadata = { inspectionOverlay: true };
  let currentTargetId = null;
  let currentMode = 'normal';
  let activeSnapshot = null;

  function rebuildTargets() {
    targets.clear();
    INSPECTION_CIRCUIT_ORDER.forEach((id) => {
      const target = findTarget(scene, id);
      if (target) targets.set(id, target);
    });
  }

  function clearContextOverlay() {
    contextOverlay.getChildMeshes(false).forEach((mesh) => {
      mesh.material?.dispose?.(false, false);
      mesh.dispose(false, false);
    });
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
    const meshes = target.getChildMeshes?.(false) ?? [];
    const entries = meshes.map((mesh) => ({
      mesh,
      material: mesh.material,
      isVisible: mesh.isVisible,
      visibility: mesh.visibility,
      renderingGroupId: mesh.renderingGroupId,
    }));
    activeSnapshot = { target, entries };
    const framing = computeBabylonInspectionFraming(target, currentTargetId);
    const centerX = framing?.center?.x ?? target.getAbsolutePosition?.().x ?? 0;
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
        return;
      }
      if (mode === 'transparent') {
        clone.alpha = shell ? 0.26 : Math.min(Number(clone.alpha) || 1, 0.44);
        mesh.renderingGroupId = shell ? 2 : 1;
      } else if (mode === 'cutaway' && shell) {
        clone.clipPlane = new Plane(1, 0, 0, -centerX);
        mesh.renderingGroupId = 1;
      } else if (mode === 'interior') {
        if (shell) {
          mesh.isVisible = false;
        } else {
          clone.alpha = 0.10;
          mesh.renderingGroupId = 1;
        }
      }
    });
  }

  function refreshContextOverlay() {
    const id = currentTargetId;
    if (id) updateContextOverlay(id);
  }

  function getTargets() {
    return INSPECTION_CIRCUIT_ORDER.filter((id) => targets.has(id)).map((id) => {
      const target = targets.get(id);
      const context = getInspectionCircuitContext(id);
      const metadata = nodeMetadata(target);
      return {
        id,
        label: getInspectionTargetLabel(id, {
          conveyor: Boolean(metadata.conveyorId) || id.startsWith('CV-'),
          connection: Boolean(metadata.connectionId) || id.startsWith('P-') || id.startsWith('MT-'),
        }),
        kind: metadata.inspectionKind || metadata.type || 'equipment',
        circuitOrder: context.index,
        previousId: context.previousId,
        nextId: context.nextId,
      };
    });
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
    } else if (previousTarget) {
      currentTargetId = null;
      currentMode = 'normal';
      updateContextOverlay(null);
    }
    return getTargets();
  }

  function setTarget(id) {
    restore();
    if (!id) {
      currentTargetId = null;
      currentMode = 'normal';
      updateContextOverlay(null);
      return null;
    }
    if (!targets.has(id)) rebuildTargets();
    if (!targets.has(id)) throw new RangeError(`Equipo Babylon no inspeccionable: ${id}.`);
    currentTargetId = id;
    currentMode = 'normal';
    updateContextOverlay(id);
    return targets.get(id);
  }

  function setMode(mode) {
    if (!INSPECTION_MODES.includes(mode)) throw new RangeError(`Modo Babylon de inspección inválido: ${mode}.`);
    currentMode = mode;
    if (!currentTargetId) {
      restore();
      return;
    }
    applyMode(targets.get(currentTargetId), mode);
  }

  rebuildTargets();
  return {
    modes: INSPECTION_MODES,
    contextOverlay,
    getTargets,
    refreshTargets,
    setTarget,
    setMode,
    getFraming: (id = currentTargetId) => (id && targets.has(id) ? computeBabylonInspectionFraming(targets.get(id), id) : null),
    getContext: (id = currentTargetId) => getInspectionCircuitContext(id),
    refreshContextOverlay,
    get targetId() { return currentTargetId; },
    get mode() { return currentMode; },
    dispose() {
      restore();
      clearContextOverlay();
      contextOverlay.dispose();
      targets.clear();
    },
  };
}
