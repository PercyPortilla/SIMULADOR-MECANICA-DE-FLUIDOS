import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';

let loaderRegistration = null;

export function ensureBabylonGltf2Loader() {
  // Register the standard extensions as well (e.g. KHR_texture_transform).
  // Importing the loader alone leaves valid authored Blender assets unloadable.
  loaderRegistration ??= import('@babylonjs/loaders/glTF/2.0/index.js');
  return loaderRegistration;
}

export async function loadBabylonAssetContainer(source, scene) {
  await ensureBabylonGltf2Loader();
  return LoadAssetContainerAsync(source, scene);
}
