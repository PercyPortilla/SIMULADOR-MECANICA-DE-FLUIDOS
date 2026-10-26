import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { V57_SITE_VISUAL_URL } from '../../scene/integration/v57Layout.js';
import { loadBabylonAssetContainer } from './gltfLoader.js';

function visitHierarchy(root, callback) {
  callback(root);
  root.getDescendants?.(false)?.forEach(callback);
}

function markV57Node(node) {
  node.metadata = {
    ...(node.metadata ?? {}),
    blenderImported: true,
    siteRevision: 'V57',
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
      console.error('[PULPA LAB V57] No se pudo cargar el sitio Blender V57. B62 bloquea cualquier fallback visual antiguo.', error);
      return null;
    });

  return {
    host,
    ready,
    setAnimationsEnabled(enabled) {
      animationsEnabled = Boolean(enabled);
      syncAnimationState();
      return animationsEnabled;
    },
    get loaded() { return host.metadata?.blenderVisualStatus === 'loaded'; },
    get rootNodes() { return [...rootNodes]; },
    get animationGroups() { return [...animationGroups]; },
    dispose() {
      if (disposed) return;
      disposed = true;
      animationGroups.forEach((group) => group.stop?.());
      animationGroups = [];
      container?.dispose?.();
      rootNodes = [];
      host.dispose();
    },
  };
}

export { V57_SITE_VISUAL_URL };
