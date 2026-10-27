import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { V57_SITE_VISUAL_URL } from '../../scene/integration/v57Layout.js';
import { loadBabylonAssetContainer } from './gltfLoader.js';
import { applyB71HydraulicStudyVisual } from './b71HydraulicStudyVisual.js';
import { applyB73FoundationVisual } from './b73FoundationVisual.js';
import { applyB74SlurryFlowVisual } from './b74SlurryFlowVisual.js';
import { applyB75EquipmentSlurryVisual } from './b75EquipmentSlurryVisual.js';
import { applyB80TerrainCivilVisual } from './b80TerrainCivilVisual.js';
import { applyB81ProcessContinuityVisual } from './b81ProcessContinuityVisual.js';
import { applyB82OperationalAnimationVisual } from './b82OperationalAnimationVisual.js';
import { applyB83VisualCleanup } from './b83VisualCleanup.js';
import { applyBernoulliEulerLabVisual } from '../lab/bernoulliEulerLabVisual.js';

function visitHierarchy(root, callback) {
  callback(root);
  root.getDescendants?.(false)?.forEach(callback);
}

function createB64TerrainTexture(scene) {
  if (typeof document === 'undefined') return null;
  const texture = new DynamicTexture('b64-terrain-earth-texture', { width: 512, height: 512 }, scene, false);
  const context = texture.getContext();
  if (!context) return null;

  let seed = 0xB64;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  const palette = ['#6f5840', '#7d6549', '#8a7255', '#5f4d3a', '#967a59', '#6b6255'];
  context.fillStyle = '#765f45';
  context.fillRect(0, 0, 512, 512);
  for (let index = 0; index < 5200; index += 1) {
    const x = Math.floor(random() * 512);
    const y = Math.floor(random() * 512);
    const size = 1 + Math.floor(random() * 4);
    context.globalAlpha = 0.18 + random() * 0.34;
    context.fillStyle = palette[Math.floor(random() * palette.length)];
    context.fillRect(x, y, size, size);
  }
  context.globalAlpha = 0.12;
  for (let index = 0; index < 80; index += 1) {
    context.beginPath();
    context.fillStyle = index % 3 === 0 ? '#a58a65' : '#55483a';
    context.arc(random() * 512, random() * 512, 3 + random() * 10, 0, Math.PI * 2);
    context.fill();
  }
  context.globalAlpha = 1;
  texture.update(false);
  texture.hasAlpha = false;
  texture.uScale = 26;
  texture.vScale = 26;
  return texture;
}

function materialHasEmbeddedTerrainTexture(material) {
  if (!material) return false;
  const subMaterials = Array.isArray(material.subMaterials)
    ? material.subMaterials.filter(Boolean)
    : [];
  if (subMaterials.length) return subMaterials.every(materialHasEmbeddedTerrainTexture);
  return Boolean(material.albedoTexture || material.diffuseTexture);
}

function applyB64TerrainMaterial({ rootNodes, scene, host }) {
  const terrainMeshes = [];
  rootNodes.forEach((root) => {
    visitHierarchy(root, (node) => {
      if (!('material' in node)) return;
      if (!String(node.name ?? '').startsWith('V57_TERRAIN_INTEGRATED')) return;
      terrainMeshes.push(node);
    });
  });

  if (!terrainMeshes.length) {
    host.metadata.terrainMaterialStatus = 'B64-terrain-mesh-not-found';
    return null;
  }

  if (terrainMeshes.every((mesh) => materialHasEmbeddedTerrainTexture(mesh.material))) {
    terrainMeshes.forEach((mesh) => {
      mesh.receiveShadows = true;
      mesh.metadata = {
        ...(mesh.metadata ?? {}),
        terrainMaterialBuild: 'B64-embedded',
      };
    });
    host.metadata.terrainMaterialStatus = 'B64-embedded-texture';
    host.metadata.terrainMaterialMeshCount = terrainMeshes.length;
    return null;
  }

  const material = new StandardMaterial('b64-terrain-earth-material', scene);
  const texture = createB64TerrainTexture(scene);
  material.diffuseColor = texture ? new Color3(0.92, 0.88, 0.80) : new Color3(0.46, 0.35, 0.24);
  if (texture) material.diffuseTexture = texture;
  material.ambientColor = new Color3(0.16, 0.12, 0.08);
  material.specularColor = new Color3(0.035, 0.035, 0.03);
  material.specularPower = 4;
  material.metadata = {
    terrainMaterialBuild: 'B64',
    visualOnly: true,
    externalTextureDependency: false,
  };

  terrainMeshes.forEach((mesh) => {
    mesh.material = material;
    mesh.receiveShadows = true;
    mesh.metadata = {
      ...(mesh.metadata ?? {}),
      terrainMaterialBuild: 'B64',
    };
  });
  host.metadata.terrainMaterialStatus = 'B64-runtime-earth-applied';
  host.metadata.terrainMaterialMeshCount = terrainMeshes.length;
  return material;
}

function markV57Node(node) {
  node.metadata = {
    ...(node.metadata ?? {}),
    blenderImported: true,
    siteRevision: 'V57',
    visualBuild: 'B64',
    v57AuthoritativeVisual: true,
    visualOnly: true,
  };
  if ('isPickable' in node) node.isPickable = false;
  if (node.metadata?.v57InspectionOnly === true && 'isVisible' in node) node.isVisible = false;
  if (typeof node.receiveShadows === 'boolean') node.receiveShadows = true;
}

export function attachBabylonV57SiteVisual({
  scene,
  url = V57_SITE_VISUAL_URL,
  loadContainer = loadBabylonAssetContainer,
} = {}) {
  if (!scene) throw new TypeError('Babylon V57 site visual requires a Scene.');
  if (scene.useRightHandedSystem !== true) throw new Error('Babylon V57 site visual requires a right-handed Scene.');

  const host = new TransformNode('PULPA-LAB-V57-SITE', scene);
  host.metadata = {
    siteRevision: 'V57',
    blenderVisualUrl: url,
    blenderVisualStatus: 'loading',
    authoritativeVisibleScene: true,
  };

  let container = null;
  let rootNodes = [];
  let animationGroups = [];
  let animationsEnabled = true;
  let disposed = false;
  let b64TerrainMaterial = null;
  let b71HydraulicStudyVisual = null;
  let b73FoundationVisual = null;
  let b74SlurryFlowVisual = null;
  let b75EquipmentSlurryVisual = null;
  let b80TerrainCivilVisual = null;
  let b81ProcessContinuityVisual = null;
  let b82OperationalAnimationVisual = null;
  let b83VisualCleanup = null;
  let bernoulliEulerLabVisual = null;
  let processMetrics = Object.freeze({});
  let inspectionState = Object.freeze({ targetId: null, mode: 'normal' });
  let labViewState = Object.freeze({ active: false, mode: 'realistic' });

  function syncAnimationState() {
    animationGroups.forEach((group) => {
      if (animationsEnabled) {
        if (group.isStarted) group.play?.(true);
        else group.start?.(true, 1, group.from, group.to, false);
      } else group.pause?.();
    });
  }

  const ready = Promise.resolve()
    .then(() => loadContainer(url, scene))
    .then((loadedContainer) => {
      if (disposed) {
        loadedContainer?.dispose?.();
        return null;
      }
      container = loadedContainer;
      container.addAllToScene();
      rootNodes = [...(container.rootNodes ?? [])];
      animationGroups = [...(container.animationGroups ?? [])];
      rootNodes.forEach((root) => {
        root.parent = host;
        visitHierarchy(root, markV57Node);
      });
      b64TerrainMaterial = applyB64TerrainMaterial({ rootNodes, scene, host });
      b71HydraulicStudyVisual = applyB71HydraulicStudyVisual({ scene, rootNodes, host });
      b73FoundationVisual = applyB73FoundationVisual({ scene, rootNodes, host });
      b80TerrainCivilVisual = applyB80TerrainCivilVisual({ scene, rootNodes, host });
      b81ProcessContinuityVisual = applyB81ProcessContinuityVisual({ scene, rootNodes, host });
      b82OperationalAnimationVisual = applyB82OperationalAnimationVisual({
        scene,
        rootNodes,
        host,
        animationGroups,
      });
      b83VisualCleanup = applyB83VisualCleanup({ scene, rootNodes, host });
      b74SlurryFlowVisual = applyB74SlurryFlowVisual({
        scene,
        rootNodes: [...rootNodes, b81ProcessContinuityVisual.root],
        host,
      });
      b74SlurryFlowVisual.setMetrics(processMetrics);
      b74SlurryFlowVisual.setAnimationsEnabled(animationsEnabled);
      b74SlurryFlowVisual.setInspectionState(inspectionState);
      b75EquipmentSlurryVisual = applyB75EquipmentSlurryVisual({ scene, rootNodes, host });
      b75EquipmentSlurryVisual.setMetrics(processMetrics);
      b75EquipmentSlurryVisual.setAnimationsEnabled(animationsEnabled);
      b75EquipmentSlurryVisual.setInspectionState(inspectionState);
      b75EquipmentSlurryVisual.setLabState(labViewState);
      b82OperationalAnimationVisual.setAnimationsEnabled(animationsEnabled);
      b82OperationalAnimationVisual.setLabState(labViewState);
      bernoulliEulerLabVisual = applyBernoulliEulerLabVisual({
        scene,
        rootNodes,
        host,
      });
      bernoulliEulerLabVisual.setMetrics(processMetrics);
      bernoulliEulerLabVisual.setActive(labViewState.active, labViewState.mode);
      b74SlurryFlowVisual.setLabState(labViewState);
      host.metadata.blenderVisualStatus = 'loaded';
      host.metadata.blenderVisualLoaded = true;
      host.metadata.importedRootCount = rootNodes.length;
      host.metadata.importedMeshCount = rootNodes.reduce(
        (sum, root) => sum + (root.getChildMeshes?.(false)?.length ?? 0),
        0,
      );
      host.metadata.animationGroupCount = animationGroups.length;
      syncAnimationState();
      return host;
    })
    .catch((error) => {
      if (disposed) return null;
      host.metadata.blenderVisualStatus = 'error';
      host.metadata.blenderVisualError = error?.message || String(error);
      console.error('[PULPA LAB V57/B64] No se pudo cargar la escena autoritativa.', error);
      return null;
    });

  return {
    host,
    ready,
    setAnimationsEnabled(enabled) {
      animationsEnabled = Boolean(enabled);
      syncAnimationState();
      b74SlurryFlowVisual?.setAnimationsEnabled?.(animationsEnabled);
      b75EquipmentSlurryVisual?.setAnimationsEnabled?.(animationsEnabled);
      b82OperationalAnimationVisual?.setAnimationsEnabled?.(animationsEnabled);
      return animationsEnabled;
    },
    setProcessMetrics(nextMetrics = {}) {
      processMetrics = Object.freeze({ ...nextMetrics });
      b74SlurryFlowVisual?.setMetrics?.(processMetrics);
      b75EquipmentSlurryVisual?.setMetrics?.(processMetrics);
      bernoulliEulerLabVisual?.setMetrics?.(processMetrics);
      return processMetrics;
    },
    setInspectionState(nextState = {}) {
      inspectionState = Object.freeze({
        targetId: nextState.targetId ? String(nextState.targetId) : null,
        mode: ['transparent', 'cutaway', 'interior'].includes(nextState.mode) ? nextState.mode : 'normal',
      });
      b74SlurryFlowVisual?.setInspectionState?.(inspectionState);
      b75EquipmentSlurryVisual?.setInspectionState?.(inspectionState);
      return inspectionState;
    },
    setLabViewState(nextState = {}) {
      labViewState = Object.freeze({
        active: Boolean(nextState.active),
        mode: ['realistic', 'didactic', 'presentation'].includes(nextState.mode)
          ? nextState.mode
          : 'realistic',
      });
      b74SlurryFlowVisual?.setLabState?.(labViewState);
      b75EquipmentSlurryVisual?.setLabState?.(labViewState);
      b82OperationalAnimationVisual?.setLabState?.(labViewState);
      bernoulliEulerLabVisual?.setActive?.(labViewState.active, labViewState.mode);
      return labViewState;
    },
    update(deltaSeconds) {
      const pipeMoved = b74SlurryFlowVisual?.update?.(deltaSeconds) ?? false;
      const equipmentMoved = b75EquipmentSlurryVisual?.update?.(deltaSeconds) ?? false;
      const operationalMoved = b82OperationalAnimationVisual?.update?.(deltaSeconds) ?? false;
      const labMoved = bernoulliEulerLabVisual?.update?.(deltaSeconds) ?? false;
      return pipeMoved || equipmentMoved || operationalMoved || labMoved;
    },
    get loaded() { return host.metadata?.blenderVisualStatus === 'loaded'; },
    get rootNodes() { return [...rootNodes]; },
    get animationGroups() { return [...animationGroups]; },
    get inspectionState() { return inspectionState; },
    get labViewState() { return labViewState; },
    get labFramings() { return bernoulliEulerLabVisual?.framing ?? null; },
    dispose() {
      if (disposed) return;
      disposed = true;
      animationGroups.forEach((group) => group.stop?.());
      animationGroups = [];
      b64TerrainMaterial?.dispose?.(false, true);
      b64TerrainMaterial = null;
      bernoulliEulerLabVisual?.dispose?.();
      bernoulliEulerLabVisual = null;
      b75EquipmentSlurryVisual?.dispose?.();
      b75EquipmentSlurryVisual = null;
      b74SlurryFlowVisual?.dispose?.();
      b74SlurryFlowVisual = null;
      b73FoundationVisual?.dispose?.();
      b73FoundationVisual = null;
      b80TerrainCivilVisual?.dispose?.();
      b80TerrainCivilVisual = null;
      b81ProcessContinuityVisual?.dispose?.();
      b81ProcessContinuityVisual = null;
      b82OperationalAnimationVisual?.dispose?.();
      b82OperationalAnimationVisual = null;
      b83VisualCleanup?.dispose?.();
      b83VisualCleanup = null;
      b71HydraulicStudyVisual?.dispose?.();
      b71HydraulicStudyVisual = null;
      container?.dispose?.();
      rootNodes = [];
      host.dispose();
    },
  };
}

export { V57_SITE_VISUAL_URL };
