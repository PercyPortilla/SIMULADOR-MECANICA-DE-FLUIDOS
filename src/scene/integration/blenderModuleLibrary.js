import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const loader = new GLTFLoader();
const sourceCache = new Map();

export const BLENDER_MODULE_URLS = Object.freeze({
  conveyorHead: 'models/pulpa-blender/v15-modules/CONVEYOR-HEAD-MODULE.glb',
  conveyorTail: 'models/pulpa-blender/v15-modules/CONVEYOR-TAIL-MODULE.glb',
  conveyorIdler: 'models/pulpa-blender/v15-modules/CONVEYOR-IDLER-MODULE.glb',
  conveyorTransferHood: 'models/pulpa-blender/v15-modules/CONVEYOR-TRANSFER-HOOD.glb',
  pipeValve: 'models/pulpa-blender/v15-modules/PIPE-VALVE-MODULE.glb',
  pipeFlange: 'models/pulpa-blender/v15-modules/PIPE-FLANGE-MODULE.glb',
  pipeSaddle: 'models/pulpa-blender/v15-modules/PIPE-SADDLE-MODULE.glb',
});

export function cloneBlenderModuleSource(source) {
  // Static hybrid modules never mutate their source geometry/materials. Sharing
  // these immutable GPU resources across repeated valves, flanges, saddles and
  // conveyor stations avoids hundreds of duplicate buffers/material programs.
  return source.clone(true);
}

export function optimizeStaticModuleScene(scene) {
  scene.updateMatrixWorld(true);
  const byMaterial = new Map();
  const passthrough = [];
  scene.traverse((object) => {
    if (!object.isMesh || !object.geometry || object.visible === false) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    // glTF modules currently export one material per primitive. Keep the rare
    // multi-material mesh intact rather than risking group/index corruption.
    if (materials.length !== 1 || !materials[0]) {
      passthrough.push(object.clone());
      return;
    }
    const geometry = object.geometry.clone();
    geometry.applyMatrix4(object.matrixWorld);
    const material = materials[0];
    if (!byMaterial.has(material)) byMaterial.set(material, []);
    byMaterial.get(material).push(geometry);
  });

  const flattened = new THREE.Group();
  flattened.name = scene.name || 'blender-static-module';
  flattened.userData = { ...scene.userData, blenderStaticFlattened: true };
  let index = 0;
  byMaterial.forEach((geometries, material) => {
    const merged = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false);
    if (!merged) {
      geometries.forEach((geometry) => {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = `${flattened.name}-part-${index += 1}`;
        flattened.add(mesh);
      });
      return;
    }
    if (geometries.length > 1) geometries.forEach((geometry) => geometry.dispose());
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = `${flattened.name}-material-${index += 1}`;
    flattened.add(mesh);
  });
  passthrough.forEach((object) => flattened.add(object));
  return flattened;
}

function prepareSource(scene, { castShadow = true } = {}) {
  scene.traverse((object) => {
    object.userData.blenderHybridSource = true;
    if (!object.isMesh) return;
    object.castShadow = castShadow;
    object.receiveShadow = true;
    object.userData.inspectionRole ||= 'structure';
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.filter(Boolean).forEach((material) => {
      material.side = THREE.FrontSide;
      material.needsUpdate = true;
    });
  });
  return scene;
}

function loadSource(url) {
  if (!sourceCache.has(url)) {
    sourceCache.set(url, new Promise((resolve, reject) => {
      loader.load(url, (gltf) => {
        const optimized = optimizeStaticModuleScene(gltf.scene);
        const smallRepeatedHardware = /CONVEYOR-IDLER|PIPE-(?:VALVE|FLANGE|SADDLE)/.test(url);
        resolve(prepareSource(optimized, { castShadow: !smallRepeatedHardware }));
      }, undefined, reject);
    }));
  }
  return sourceCache.get(url);
}

function applyVector3(target, value, fallback = [0, 0, 0]) {
  if (value instanceof THREE.Vector3) {
    target.copy(value);
    return;
  }
  const [x, y, z] = Array.isArray(value) ? value : fallback;
  target.set(x, y, z);
}

function markLodContentChanged(object) {
  let current = object;
  while (current) {
    current.userData.lodContentRevision = Number(current.userData.lodContentRevision || 0) + 1;
    current = current.parent;
  }
}

export function attachBlenderModule({
  parent,
  url,
  name,
  position = [0, 0, 0],
  scale = [1, 1, 1],
  rotation = [0, 0, 0],
  quaternion = null,
  userData = {},
  onReady = null,
} = {}) {
  if (!parent || !url) throw new TypeError('attachBlenderModule necesita parent y url.');
  const host = new THREE.Group();
  host.name = name || 'blender-hybrid-module';
  host.userData = {
    blenderHybridModule: true,
    blenderModuleUrl: url,
    blenderModuleStatus: typeof window === 'undefined' ? 'ssr-skip' : 'loading',
    ...userData,
  };
  applyVector3(host.position, position);
  applyVector3(host.scale, scale, [1, 1, 1]);
  if (quaternion instanceof THREE.Quaternion) host.quaternion.copy(quaternion);
  else applyVector3(host.rotation, rotation);
  parent.add(host);

  if (typeof window === 'undefined') {
    return {
      host,
      loaded: false,
      dispose() { host.removeFromParent(); },
    };
  }

  let imported = null;
  let disposed = false;
  loadSource(url)
    .then((source) => {
      if (disposed) return;
      imported = cloneBlenderModuleSource(source);
      imported.name = `${host.name}-visual`;
      imported.userData.blenderHybridImported = true;
      host.add(imported);
      host.userData.blenderModuleStatus = 'loaded';
      markLodContentChanged(host);
      host.updateMatrixWorld(true);
      onReady?.({ host, imported });
    })
    .catch((error) => {
      if (disposed) return;
      host.userData.blenderModuleStatus = 'error';
      host.userData.blenderModuleError = error?.message || String(error);
      console.warn(`[PULPA LAB] Módulo Blender no disponible: ${url}`, error);
    });

  return {
    host,
    get loaded() { return Boolean(imported); },
    dispose() {
      disposed = true;
      // Geometry/material resources belong to the cached source and are shared
      // by all module instances; removing one host must not dispose them.
      host.removeFromParent();
    },
  };
}

export function quaternionFromLocalX(direction) {
  const vector = direction instanceof THREE.Vector3 ? direction.clone() : new THREE.Vector3(...direction);
  if (vector.lengthSq() < 1e-10) return new THREE.Quaternion();
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), vector.normalize());
}

export function resetBlenderModuleCacheForTests() {
  sourceCache.clear();
}
