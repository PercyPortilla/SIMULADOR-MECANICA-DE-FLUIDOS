import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { getBlenderEquipmentContract } from '../../scene/integration/blenderEquipmentContracts.js';
import { loadBabylonAssetContainer } from './gltfLoader.js';

function descendants(root) {
  return [root, ...(root.getDescendants?.(false) ?? [])];
}

function prepareImportedNode(node, instanceId) {
  node.metadata = {
    ...(node.metadata ?? {}),
    blenderImported: true,
    instanceId,
    visualOnly: true,
  };
  if ('receiveShadows' in node) node.receiveShadows = true;
  return node;
}

function hideImportedPrefixes(rootNodes, prefixes = []) {
  if (!prefixes.length) return 0;
  let hidden = 0;
  rootNodes.forEach((root) => descendants(root).forEach((node) => {
    if (!prefixes.some((prefix) => String(node.name || '').startsWith(prefix))) return;
    node.setEnabled?.(false);
    if ('isVisible' in node) node.isVisible = false;
    node.metadata = { ...(node.metadata ?? {}), hiddenByMigrationContract: true };
    hidden += 1;
  }));
  return hidden;
}

function findNode(rootNodes, name) {
  if (!name) return null;
  for (const root of rootNodes) {
    const match = descendants(root).find((node) => node.name === name);
    if (match) return match;
  }
  return null;
}

function uniqueMaterials(material) {
  if (!material) return [];
  if (Array.isArray(material.subMaterials)) return material.subMaterials.filter(Boolean);
  return [material];
}

function protectMirroredVisualCulling(rootNodes, importedScale) {
  const determinantSign = importedScale.reduce((product, value) => product * Number(value || 0), 1);
  if (!(determinantSign < 0)) return 0;
  const touched = new Set();
  let meshCount = 0;
  rootNodes.forEach((root) => descendants(root).forEach((node) => {
    if (!('material' in node) || !node.material) return;
    meshCount += 1;
    uniqueMaterials(node.material).forEach((material) => {
      if (touched.has(material)) return;
      touched.add(material);
      if ('backFaceCulling' in material) material.backFaceCulling = false;
      if ('cullBackFaces' in material) material.cullBackFaces = false;
      material.metadata = {
        ...(material.metadata ?? {}),
        mirroredVisualCullingSafe: true,
      };
    });
    node.metadata = {
      ...(node.metadata ?? {}),
      mirroredVisualCullingSafe: true,
    };
  }));
  return meshCount;
}

function selectAnimationGroups(groups, spec) {
  if (!groups.length) return { controlled: [], selectedName: null, fallbackUsed: false };
  if (spec.playAllAnimations) {
    return {
      controlled: [...groups],
      selectedName: groups[0]?.name ?? null,
      fallbackUsed: false,
    };
  }
  const exact = spec.expectedAnimation
    ? groups.find((group) => group.name === spec.expectedAnimation)
    : null;
  if (exact) return { controlled: [exact], selectedName: exact.name, fallbackUsed: false };
  const namedFallback = groups.find((group) => group.name === 'Animation');
  if (namedFallback) {
    return {
      controlled: [namedFallback],
      selectedName: namedFallback.name,
      fallbackUsed: Boolean(spec.expectedAnimation),
    };
  }
  return {
    controlled: [groups[0]],
    selectedName: groups[0].name ?? null,
    fallbackUsed: Boolean(spec.expectedAnimation),
  };
}

function centerOfBounds(bounds) {
  return bounds.min.add(bounds.max).scale(0.5);
}

function stabilizeRotationPivot(rootNodes, repair) {
  const axis = repair?.axis ?? 'x';
  const node = findNode(rootNodes, repair?.nodeName);
  if (!node?.parent || !['x', 'y', 'z'].includes(axis)) return null;
  const bounds = node.getHierarchyBoundingVectors?.(true);
  if (!bounds || !Number.isFinite(bounds.min?.x) || !Number.isFinite(bounds.max?.x)) return null;

  const parent = node.parent;
  parent.computeWorldMatrix?.(true);
  node.computeWorldMatrix?.(true);
  const centerWorld = centerOfBounds(bounds);
  const inverseParent = parent.getWorldMatrix?.().clone().invert();
  if (!inverseParent) return null;
  const centerParent = Vector3.TransformCoordinates(centerWorld, inverseParent);
  const desired = node.position.clone();
  if (axis !== 'x') desired.x = centerParent.x;
  if (axis !== 'y') desired.y = centerParent.y;
  if (axis !== 'z') desired.z = centerParent.z;
  const shift = desired.subtract(node.position);
  if (shift.lengthSquared() < 1e-12) {
    node.metadata = {
      ...(node.metadata ?? {}),
      rotationPivotStabilized: true,
      rotationPivotAxis: axis,
      rotationPivotShift: [0, 0, 0],
    };
    return node;
  }

  const children = (node.getChildren?.(undefined, true) ?? [])
    .filter((child) => typeof child.setParent === 'function');
  children.forEach((child) => child.setParent(parent, true, true));
  node.position.copyFrom(desired);
  node.computeWorldMatrix?.(true);
  children.forEach((child) => child.setParent(node, true, true));
  node.metadata = {
    ...(node.metadata ?? {}),
    rotationPivotStabilized: true,
    rotationPivotAxis: axis,
    rotationPivotShift: shift.asArray(),
  };
  return node;
}

export function attachBabylonEquipmentVisual({
  scene,
  instanceId,
  spec = getBlenderEquipmentContract(instanceId),
  loadContainer = loadBabylonAssetContainer,
} = {}) {
  if (!scene) throw new TypeError('Babylon equipment visual requires a Scene.');
  if (scene.useRightHandedSystem !== true) throw new Error('Babylon equipment visual requires a right-handed Scene.');
  if (!instanceId || !spec?.url) throw new TypeError('Babylon equipment visual requires instanceId and Blender contract.');

  const host = new TransformNode(`${instanceId}-BLENDER-HOST`, scene);
  host.metadata = {
    instanceId,
    blenderVisualUrl: spec.url,
    blenderVisualStatus: 'loading',
    semanticControl: spec.semanticControl ?? null,
    visualOnly: true,
  };
  const visualRoot = new TransformNode(`${instanceId}-BLENDER-VISUAL`, scene);
  visualRoot.parent = host;
  const importedScale = spec.importedScale ?? [1, 1, 1];
  visualRoot.scaling = Vector3.FromArray(importedScale);
  visualRoot.metadata = {
    visualOnly: true,
    importedScale: [...importedScale],
  };

  let container = null;
  let rootNodes = [];
  let animationGroups = [];
  let controlledAnimationGroups = [];
  let disposed = false;
  let materialLoadNode = null;
  let animationsEnabled = false;
  let pacedAnimationElapsed = 0;

  const animationPacing = (() => {
    const pacing = spec.animationPacing;
    if (!pacing) return null;
    const cycleSeconds = Number(pacing.cycleSeconds);
    const activeStartSeconds = Number(pacing.activeStartSeconds);
    const activeEndSeconds = Number(pacing.activeEndSeconds);
    if (!(cycleSeconds > 0)
      || !(activeStartSeconds >= 0)
      || !(activeEndSeconds > activeStartSeconds)
      || !(activeEndSeconds <= cycleSeconds)) return null;
    return { cycleSeconds, activeStartSeconds, activeEndSeconds };
  })();

  function applyPacedAnimationTime() {
    if (!animationPacing || controlledAnimationGroups.length !== 1) return false;
    const group = controlledAnimationGroups[0];
    if (typeof group.goToFrame !== 'function') return false;
    const from = Number(group.from);
    const to = Number(group.to);
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return false;
    const cycleTime = ((pacedAnimationElapsed % animationPacing.cycleSeconds) + animationPacing.cycleSeconds)
      % animationPacing.cycleSeconds;
    let progress = 0;
    if (cycleTime >= animationPacing.activeEndSeconds) progress = 1;
    else if (cycleTime > animationPacing.activeStartSeconds) {
      progress = (cycleTime - animationPacing.activeStartSeconds)
        / (animationPacing.activeEndSeconds - animationPacing.activeStartSeconds);
    }
    group.goToFrame(from + (to - from) * progress);
    return true;
  }

  function applyAnimationState() {
    controlledAnimationGroups.forEach((group) => {
      if (animationsEnabled) {
        group.play?.(true);
        if (animationPacing && typeof group.goToFrame === 'function') {
          group.pause?.();
          applyPacedAnimationTime();
        }
      } else group.pause?.();
    });
  }

  function setAnimationsEnabled(enabled) {
    animationsEnabled = Boolean(enabled);
    applyAnimationState();
    return animationsEnabled;
  }

  function setMaterialLoadVisible(visible) {
    if (!materialLoadNode) return false;
    materialLoadNode.setEnabled?.(Boolean(visible));
    if ('isVisible' in materialLoadNode) materialLoadNode.isVisible = Boolean(visible);
    return true;
  }

  const ready = Promise.resolve()
    .then(() => loadContainer(spec.url, scene))
    .then((loadedContainer) => {
      if (disposed) {
        loadedContainer?.dispose?.();
        return null;
      }
      container = loadedContainer;
      container.addAllToScene();
      rootNodes = [...container.rootNodes];
      animationGroups = [...(container.animationGroups ?? [])];
      animationGroups.forEach((group) => group.stop?.());
      rootNodes.forEach((root) => {
        root.parent = visualRoot;
        descendants(root).forEach((node) => prepareImportedNode(node, instanceId));
      });
      const hiddenNodeCount = hideImportedPrefixes(rootNodes, spec.hideImportedNamePrefixes);
      const mirroredCullingSafeMeshCount = protectMirroredVisualCulling(rootNodes, importedScale);
      const repairedPivot = spec.rotationPivotRepair
        ? stabilizeRotationPivot(rootNodes, spec.rotationPivotRepair)
        : null;
      materialLoadNode = findNode(rootNodes, spec.materialLoadNode);
      if (materialLoadNode && spec.initialMaterialLoadVisible !== undefined) {
        setMaterialLoadVisible(spec.initialMaterialLoadVisible);
      }
      const animationSelection = selectAnimationGroups(animationGroups, spec);
      controlledAnimationGroups = animationSelection.controlled;
      applyAnimationState();

      host.metadata.blenderVisualStatus = 'loaded';
      host.metadata.blenderVisualLoaded = true;
      host.metadata.importedRootCount = rootNodes.length;
      host.metadata.importedMeshCount = rootNodes.reduce(
        (sum, root) => sum + (root.getChildMeshes?.(false)?.length ?? 0),
        0,
      );
      host.metadata.animationGroupCount = animationGroups.length;
      host.metadata.animationGroupNames = animationGroups.map((group) => group.name);
      host.metadata.controlledAnimationGroupNames = controlledAnimationGroups.map((group) => group.name);
      host.metadata.expectedAnimation = spec.expectedAnimation ?? null;
      host.metadata.selectedAnimationGroupName = animationSelection.selectedName;
      host.metadata.animationFallbackUsed = animationSelection.fallbackUsed;
      host.metadata.hiddenNodeCount = hiddenNodeCount;
      host.metadata.mirroredCullingSafeMeshCount = mirroredCullingSafeMeshCount;
      host.metadata.rotationPivotRepaired = Boolean(repairedPivot);
      host.metadata.materialLoadNodeFound = Boolean(materialLoadNode);
      host.metadata.blenderAnimationPacing = animationPacing ? { ...animationPacing } : null;
      return host;
    })
    .catch((error) => {
      if (disposed) return null;
      host.metadata.blenderVisualStatus = 'error';
      host.metadata.blenderVisualError = error?.message || String(error);
      console.warn(`[PULPA LAB V31] No se pudo cargar ${instanceId} en Babylon.`, error);
      return null;
    });

  const pacingObserver = animationPacing
    ? scene.onBeforeRenderObservable.add(() => {
      if (!animationsEnabled || disposed) return;
      const dt = Math.min(0.1, Math.max(0, Number(scene.getEngine?.().getDeltaTime?.() ?? 0) / 1000));
      if (!(dt > 0)) return;
      pacedAnimationElapsed += dt;
      applyPacedAnimationTime();
    })
    : null;

  return {
    host,
    visualRoot,
    spec,
    ready,
    setAnimationsEnabled,
    setMaterialLoadVisible,
    get loaded() { return host.metadata?.blenderVisualStatus === 'loaded'; },
    get animationsEnabled() { return animationsEnabled; },
    get rootNodes() { return [...rootNodes]; },
    get animationGroups() { return [...animationGroups]; },
    get controlledAnimationGroups() { return [...controlledAnimationGroups]; },
    get materialLoadNode() { return materialLoadNode; },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (pacingObserver) scene.onBeforeRenderObservable.remove(pacingObserver);
      animationGroups.forEach((group) => group.stop?.());
      container?.dispose?.();
      host.dispose();
      rootNodes = [];
      animationGroups = [];
      controlledAnimationGroups = [];
      materialLoadNode = null;
    },
  };
}
