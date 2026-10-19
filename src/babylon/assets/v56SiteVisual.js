import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { V56_SITE_VISUAL_URL } from '../../scene/integration/v56Layout.js';
import { loadBabylonAssetContainer } from './gltfLoader.js';
import { createBabylonV57PresentationFinish } from './v57PresentationFinish.js';

function visitHierarchy(root, callback) {
  callback(root);
  root.getDescendants?.(false)?.forEach(callback);
}

function markV56Node(node) {
  node.metadata = {
    ...(node.metadata ?? {}),
    blenderImported: true,
    siteRevision: 'V56',
    v56AuthoritativeVisual: true,
    v55AuthoritativeVisual: true,
    // Temporary compatibility flag while inspection/label code transitions
    // from the V50 naming contract to the V56 production visual.
    v50AuthoritativeVisual: true,
    v49AuthoritativeVisual: true,
    visualOnly: true,
  };
  if ('isPickable' in node) node.isPickable = false;
  if (typeof node.receiveShadows === 'boolean') node.receiveShadows = true;
}

export function attachBabylonV56SiteVisual({
  scene,
  url = V56_SITE_VISUAL_URL,
  loadContainer = loadBabylonAssetContainer,
} = {}) {
  if (!scene) throw new TypeError('Babylon V56 site visual requires a Scene.');
  if (scene.useRightHandedSystem !== true) throw new Error('Babylon V56 site visual requires a right-handed Scene.');

  const host = new TransformNode('PULPA-LAB-V56-SITE', scene);
  host.metadata = {
    siteRevision: 'V56',
    blenderVisualUrl: url,
    blenderVisualStatus: 'loading',
    authoritativeVisibleScene: true,
  };

  let container = null;
  let rootNodes = [];
  let animationGroups = [];
  let presentationFinish = null;
  let animationsEnabled = true;
  let disposed = false;

  function syncAnimationState() {
    animationGroups.forEach((group) => {
      if (animationsEnabled) {
        if (group.isStarted) group.play?.(true);
        else group.start?.(true, 1, group.from, group.to, false);
      } else {
        group.pause?.();
      }
    });
    presentationFinish?.setAnimationsEnabled?.(animationsEnabled);
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
        visitHierarchy(root, markV56Node);
      });
      presentationFinish = createBabylonV57PresentationFinish({ scene, parent: host });
      host.metadata.blenderVisualStatus = 'loaded';
      host.metadata.blenderVisualLoaded = true;
      host.metadata.importedRootCount = rootNodes.length;
      host.metadata.importedMeshCount = rootNodes.reduce(
        (sum, root) => sum + (root.getChildMeshes?.(false)?.length ?? 0),
        0,
      );
      host.metadata.animationGroupCount = animationGroups.length;
      host.metadata.presentationFinishRevision = 'V57';
      host.metadata.presentationFinishEnabled = true;
      syncAnimationState();
      return host;
    })
    .catch((error) => {
      if (disposed) return null;
      host.metadata.blenderVisualStatus = 'error-legacy-fallback';
      host.metadata.blenderVisualError = error?.message || String(error);
      console.warn('[PULPA LAB V56] No se pudo cargar el sitio Blender V56; se conserva el fallback procedural.', error);
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
      presentationFinish?.dispose?.();
      presentationFinish = null;
      container?.dispose?.();
      rootNodes = [];
      host.dispose();
    },
  };
}

export { V56_SITE_VISUAL_URL };
