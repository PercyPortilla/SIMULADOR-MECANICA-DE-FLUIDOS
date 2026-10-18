import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export const RECEPTION_EARTHWORK_BLENDER_URL = 'models/pulpa-blender/RECEPTION-EARTHWORK-V26.glb';
export const RECEPTION_EARTHWORK_TERRAIN_REVISION = 'V26';

const loader = new GLTFLoader();

function prepareVisual(scene) {
  scene.name = 'RECEPTION-EARTHWORK-V26-BLENDER';
  scene.userData.visualOnly = true;
  scene.userData.authoritativeTerrain = false;
  scene.traverse((object) => {
    object.userData.visualOnly = true;
    object.userData.authoritativeTerrain = false;
    if (!object.isMesh) return;
    object.castShadow = false;
    object.receiveShadow = true;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach((material) => {
      material.depthWrite = true;
      material.side = THREE.FrontSide;
      material.needsUpdate = true;
    });
  });
  return scene;
}

export function attachReceptionEarthworkBlenderOverlay({ parent } = {}) {
  if (!parent?.add) throw new TypeError('attachReceptionEarthworkBlenderOverlay necesita un parent Three.js.');
  const root = new THREE.Group();
  root.name = 'reception-earthwork-v26-overlay';
  root.userData.visualOnly = true;
  root.userData.authoritativeTerrain = false;
  root.userData.blenderVisualUrl = RECEPTION_EARTHWORK_BLENDER_URL;
  root.userData.terrainRealismRevision = RECEPTION_EARTHWORK_TERRAIN_REVISION;
  root.userData.blenderVisualStatus = 'procedural-fallback';
  parent.add(root);

  let imported = null;
  let disposed = false;

  if (typeof window === 'undefined') {
    root.userData.blenderVisualStatus = 'ssr-procedural-fallback';
    return {
      root,
      get loaded() { return false; },
      dispose() { root.removeFromParent(); },
    };
  }

  root.userData.blenderVisualStatus = 'loading';
  loader.load(
    RECEPTION_EARTHWORK_BLENDER_URL,
    (gltf) => {
      if (disposed) return;
      imported = prepareVisual(gltf.scene);
      root.add(imported);
      root.userData.blenderVisualStatus = 'loaded';
      root.userData.blenderVisualLoaded = true;
    },
    undefined,
    (error) => {
      if (disposed) return;
      root.userData.blenderVisualStatus = 'error-procedural-fallback';
      root.userData.blenderVisualError = error?.message || String(error);
      console.warn('[PULPA LAB] No se pudo cargar el terraplén Blender V26; se conserva el terreno procedural.', error);
    },
  );

  return {
    root,
    get loaded() { return Boolean(imported); },
    dispose() {
      disposed = true;
      if (imported) {
        imported.traverse((object) => {
          object.geometry?.dispose?.();
          if (Array.isArray(object.material)) object.material.forEach((material) => material?.dispose?.());
          else object.material?.dispose?.();
        });
        imported.removeFromParent();
      }
      root.removeFromParent();
    },
  };
}
