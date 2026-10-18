import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import {
  RECEPTION_EARTHWORK_BLENDER_URL,
  RECEPTION_EARTHWORK_TERRAIN_REVISION,
} from '../../scene/integration/blenderContracts.js';
import { loadBabylonAssetContainer } from './gltfLoader.js';

function prepareImportedNode(node) {
  node.metadata = {
    ...(node.metadata ?? {}),
    visualOnly: true,
    authoritativeTerrain: false,
    blenderImported: true,
    terrainRealismRevision: RECEPTION_EARTHWORK_TERRAIN_REVISION,
  };
  if (typeof node.receiveShadows === 'boolean') node.receiveShadows = true;
  if ('isPickable' in node) node.isPickable = false;
  return node;
}

function visitHierarchy(root, callback) {
  callback(root);
  root.getDescendants?.(false)?.forEach(callback);
}

export function attachBabylonReceptionEarthwork({
  scene,
  url = RECEPTION_EARTHWORK_BLENDER_URL,
  loadContainer = loadBabylonAssetContainer,
} = {}) {
  if (!scene) throw new TypeError('Babylon reception earthwork requires a Scene.');
  if (scene.useRightHandedSystem !== true) {
    throw new Error('Reception earthwork requires a right-handed Babylon scene.');
  }

  const host = new TransformNode('reception-earthwork-v26-overlay', scene);
  host.metadata = {
    visualOnly: true,
    authoritativeTerrain: false,
    blenderVisualUrl: url,
    terrainRealismRevision: RECEPTION_EARTHWORK_TERRAIN_REVISION,
    blenderVisualStatus: 'loading',
  };

  let container = null;
  let disposed = false;
  let importedRootNodes = [];

  const ready = Promise.resolve()
    .then(() => loadContainer(url, scene))
    .then((loadedContainer) => {
      if (disposed) {
        loadedContainer?.dispose?.();
        return null;
      }
      container = loadedContainer;
      container.addAllToScene();
      importedRootNodes = [...container.rootNodes];
      importedRootNodes.forEach((root) => {
        root.parent = host;
        visitHierarchy(root, prepareImportedNode);
      });
      host.metadata.blenderVisualStatus = 'loaded';
      host.metadata.blenderVisualLoaded = true;
      host.metadata.importedRootCount = importedRootNodes.length;
      host.metadata.importedMeshCount = importedRootNodes.reduce(
        (sum, root) => sum + root.getChildMeshes?.(false)?.length,
        0,
      );
      return host;
    })
    .catch((error) => {
      if (disposed) return null;
      host.metadata.blenderVisualStatus = 'error-procedural-fallback';
      host.metadata.blenderVisualError = error?.message || String(error);
      console.warn('[PULPA LAB V31] No se pudo cargar el terraplén Blender V26 en Babylon.', error);
      return null;
    });

  return {
    host,
    ready,
    get loaded() { return host.metadata?.blenderVisualStatus === 'loaded'; },
    get rootNodes() { return [...importedRootNodes]; },
    dispose() {
      if (disposed) return;
      disposed = true;
      container?.dispose?.();
      host.dispose();
      importedRootNodes = [];
    },
  };
}

export {
  RECEPTION_EARTHWORK_BLENDER_URL,
  RECEPTION_EARTHWORK_TERRAIN_REVISION,
};
