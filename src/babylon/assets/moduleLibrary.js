import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { BLENDER_MODULE_URLS } from '../../scene/integration/blenderModuleContracts.js';
import { loadBabylonAssetContainer } from './gltfLoader.js';

const sceneCaches = new WeakMap();

function sceneCache(scene) {
  if (!sceneCaches.has(scene)) sceneCaches.set(scene, new Map());
  return sceneCaches.get(scene);
}

async function loadSourceContainer(scene, url, loadContainer) {
  const cache = sceneCache(scene);
  if (!cache.has(url)) cache.set(url, Promise.resolve(loadContainer(url, scene)));
  return cache.get(url);
}

function cloneContainerIntoScene(container, namePrefix) {
  if (typeof container.instantiateModelsToScene === 'function') {
    const instance = container.instantiateModelsToScene(
      (name) => `${namePrefix}-${name}`,
      true,
      { doNotInstantiate: true },
    );
    return {
      rootNodes: instance.rootNodes ?? [],
      animationGroups: instance.animationGroups ?? [],
      dispose() {
        (instance.rootNodes ?? []).forEach((node) => node.dispose?.(false, true));
        (instance.animationGroups ?? []).forEach((group) => group.dispose?.());
      },
    };
  }
  container.addAllToScene?.();
  return {
    rootNodes: [...(container.rootNodes ?? [])],
    animationGroups: [...(container.animationGroups ?? [])],
    dispose() {},
  };
}

export function quaternionFromLocalX(direction) {
  const vector = direction instanceof Vector3 ? direction.clone() : Vector3.FromArray(direction);
  if (vector.lengthSquared() < 1e-12) return Quaternion.Identity();
  vector.normalize();
  const quaternion = Quaternion.Identity();
  Quaternion.FromUnitVectorsToRef(Vector3.Right(), vector, quaternion);
  return quaternion;
}

export function attachBabylonBlenderModule({
  scene,
  parent,
  url,
  name = 'babylon-blender-hybrid-module',
  position = [0, 0, 0],
  scale = [1, 1, 1],
  rotationQuaternion = null,
  metadata = {},
  onReady = null,
  loadContainer = loadBabylonAssetContainer,
} = {}) {
  if (!scene || !parent || !url) throw new TypeError('Babylon Blender module requires scene, parent and url.');
  if (scene.useRightHandedSystem !== true) throw new Error('Babylon Blender module requires a right-handed Scene.');
  const host = new TransformNode(name, scene);
  host.parent = parent;
  host.position = position instanceof Vector3 ? position.clone() : Vector3.FromArray(position);
  host.scaling = scale instanceof Vector3 ? scale.clone() : Vector3.FromArray(scale);
  if (rotationQuaternion) host.rotationQuaternion = rotationQuaternion.clone?.() ?? Quaternion.FromArray(rotationQuaternion);
  host.metadata = {
    blenderHybridModule: true,
    blenderModuleUrl: url,
    blenderModuleStatus: typeof window === 'undefined' && loadContainer === loadBabylonAssetContainer ? 'ssr-skip' : 'loading',
    visualOnly: true,
    ...metadata,
  };
  let clone = null;
  let disposed = false;
  const shouldLoad = scene.metadata?.visualAuthority !== 'V57/B63'
    && (typeof window !== 'undefined' || loadContainer !== loadBabylonAssetContainer);
  if (scene.metadata?.visualAuthority === 'V57/B63') host.metadata.blenderModuleStatus = 'authored-in-B63';
  const ready = shouldLoad
    ? loadSourceContainer(scene, url, loadContainer)
      .then((container) => {
        if (disposed) return null;
        clone = cloneContainerIntoScene(container, name);
        clone.rootNodes.forEach((root) => {
          root.parent = host;
          root.getChildMeshes?.(false)?.forEach((mesh) => {
            mesh.receiveShadows = true;
            mesh.metadata = { ...(mesh.metadata ?? {}), blenderHybridImported: true, visualOnly: true };
          });
        });
        host.metadata.blenderModuleStatus = 'loaded';
        host.metadata.importedRootCount = clone.rootNodes.length;
        onReady?.({ host, imported: clone.rootNodes });
        return host;
      })
      .catch((error) => {
        if (!disposed) {
          host.metadata.blenderModuleStatus = 'error';
          host.metadata.blenderModuleError = error?.message || String(error);
        }
        return null;
      })
    : Promise.resolve(null);
  return {
    host,
    ready,
    get loaded() { return host.metadata.blenderModuleStatus === 'loaded'; },
    dispose() {
      if (disposed) return;
      disposed = true;
      clone?.dispose?.();
      host.dispose(false, false);
    },
  };
}

export { BLENDER_MODULE_URLS };
