import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader.js';

let loaderRegistration = null;

export function ensureBabylonGltf2Loader() {
  loaderRegistration ??= import('@babylonjs/loaders/glTF/2.0/glTFLoader.js');
  return loaderRegistration;
}

export async function loadBabylonAssetContainer(source, scene) {
  await ensureBabylonGltf2Loader();
  return LoadAssetContainerAsync(source, scene);
}
