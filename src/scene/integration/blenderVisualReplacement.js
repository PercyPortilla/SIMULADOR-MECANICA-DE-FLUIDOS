import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeletonAware } from 'three/addons/utils/SkeletonUtils.js';

export const BLENDER_REPLACEMENT_SPECS = Object.freeze({
  'ROM-HOPPER': Object.freeze({
    url: 'models/pulpa-blender/ROM-HOPPER.glb',
    keepProceduralUpdate: true,
    preserveProceduralOverlays: Object.freeze(['rom-grizzly']),
  }),
  'APRON-FEEDER': Object.freeze({
    url: 'models/pulpa-blender/APRON-FEEDER.glb',
    playAllAnimations: true,
  }),
  'PRIMARY-CRUSHER': Object.freeze({
    url: 'models/pulpa-blender/PRIMARY-CRUSHER.glb',
    playAllAnimations: true,
    preserveProceduralOverlays: Object.freeze(['PRIMARY-CRUSHER-v23-safety-overlay']),
  }),
  'STOCKPILE-RECLAIM': Object.freeze({
    url: 'models/pulpa-blender/STOCKPILE-RECLAIM.glb',
    preserveProceduralOverlays: Object.freeze(['STOCKPILE-RECLAIM-motion']),
  }),
  'EXCAVATOR-01': Object.freeze({
    url: 'models/pulpa-blender/MINING-SHOVEL.glb',
    playAllAnimations: true,
    materialLoadNode: 'MINING-SHOVEL_BUCKET_ORE',
  }),
  'TRUCK-01': Object.freeze({
    url: 'models/pulpa-blender/HAUL-TRUCK.glb',
    semanticControl: 'haul-truck',
  }),
  'LOADER-01': Object.freeze({
    url: 'models/pulpa-blender/WHEEL-LOADER.glb',
    playAllAnimations: true,
    materialLoadNode: 'WHEEL-LOADER_BUCKET_ORE',
  }),
  'MILL-01': Object.freeze({
    url: 'models/pulpa-blender/MILL-01.glb',
    expectedAnimation: 'MILL-01_Rotation',
    rotationPivotRepair: Object.freeze({ nodeName: 'MILL-01_ROTATING_GROUP', axis: 'x' }),
    preserveProceduralOverlays: Object.freeze(['mill-charge']),
    proceduralOverlayAnchors: Object.freeze({ 'mill-charge': 'MILL-01_ROTATING_GROUP' }),
  }),
  'SUMP-01': Object.freeze({
    url: 'models/pulpa-blender/SUMP-01.glb',
    preserveProceduralOverlays: Object.freeze(['SUMP-01-slurry', 'SUMP-01-suspended-solids']),
  }),
  'SLURRY-PUMP-01': Object.freeze({
    url: 'models/pulpa-blender/SLURRY-PUMP-01.glb',
    expectedAnimation: 'SLURRY-PUMP-01_ShaftRotation',
    rotationPivotRepair: Object.freeze({ nodeName: 'SLURRY-PUMP-01_ROTATING_GROUP', axis: 'x' }),
    preserveProceduralOverlays: Object.freeze(['pump-impeller', 'pump-slurry-path']),
    proceduralOverlayAnchors: Object.freeze({ 'pump-impeller': 'SLURRY-PUMP-01_ROTATING_GROUP' }),
  }),
  'CLASS-01': Object.freeze({
    url: 'models/pulpa-blender/CLASS-01.glb',
    keepProceduralUpdate: true,
    preserveProceduralOverlays: Object.freeze([
      'cyclone-1-swirl',
      'cyclone-2-swirl',
      'cyclone-3-swirl',
      'cyclone-4-swirl',
      'cyclone-5-swirl',
      'cyclone-6-swirl',
      'cyclone-manifold-suspended-solids',
    ]),
  }),
  'R-01': Object.freeze({
    url: 'models/pulpa-blender/LEACH-REACTOR.glb',
    expectedAnimation: 'LEACH_REACTOR_Agitator',
  }),
  'R-02': Object.freeze({
    url: 'models/pulpa-blender/LEACH-REACTOR.glb',
    expectedAnimation: 'LEACH_REACTOR_Agitator',
  }),
  'R-03': Object.freeze({
    url: 'models/pulpa-blender/LEACH-REACTOR.glb',
    expectedAnimation: 'LEACH_REACTOR_Agitator',
  }),
  'R-04': Object.freeze({
    url: 'models/pulpa-blender/LEACH-REACTOR.glb',
    expectedAnimation: 'LEACH_REACTOR_Agitator',
  }),
  'PUMP-01': Object.freeze({
    url: 'models/pulpa-blender/SLURRY-PUMP-01.glb',
    expectedAnimation: 'SLURRY-PUMP-01_ShaftRotation',
    rotationPivotRepair: Object.freeze({ nodeName: 'SLURRY-PUMP-01_ROTATING_GROUP', axis: 'x' }),
    preserveProceduralOverlays: Object.freeze(['pump-impeller', 'pump-slurry-path']),
    proceduralOverlayAnchors: Object.freeze({ 'pump-impeller': 'SLURRY-PUMP-01_ROTATING_GROUP' }),
  }),
  'CIP-ADSORPTION': Object.freeze({
    url: 'models/pulpa-blender/CIP-ADSORPTION.glb',
    expectedAnimation: 'CIP_Agitators',
  }),
  'ELUTION-SKID': Object.freeze({
    url: 'models/pulpa-blender/ELUTION-SKID.glb',
    preserveProceduralOverlays: Object.freeze([
      'elution-column-solution',
      'elution-tank-liquid',
      'elution-hx-tube--4',
      'elution-hx-tube--3',
      'elution-hx-tube--2',
      'elution-hx-tube--1',
      'elution-hx-tube-0',
      'elution-hx-tube-1',
      'elution-hx-tube-2',
      'elution-hx-tube-3',
      'elution-hx-tube-4',
    ]),
  }),
  'EW-CELLS': Object.freeze({
    url: 'models/pulpa-blender/EW-CELLS.glb',
  }),
  'SMELTING-FURNACE': Object.freeze({
    url: 'models/pulpa-blender/SMELTING-FURNACE.glb',
    expectedAnimation: 'SMELTING_FURNACE_Tilt',
  }),
});

const loader = new GLTFLoader();
const sourceCache = new Map();
const MINOR_SHADOW_DETAIL = /(_RAIL_POST|_LADDER_RUNG|_MOTOR_FIN|_FLYWHEEL_SPOKE|_JAW_RIB)/i;

export function cloneBlenderReplacementSource(source) {
  // Each equipment instance needs its own Object3D transforms and animation
  // state, but immutable glTF geometry/material resources can be shared.
  // SkeletonUtils keeps this safe if a future asset introduces skinned meshes.
  return cloneSkeletonAware(source);
}

export function shouldCastImportedShadow(object) {
  return !MINOR_SHADOW_DETAIL.test(String(object?.name || ''));
}

function inferInspectionRole(object) {
  const name = String(object.name || '').toLowerCase();
  if (/slurry|fluid|charge|liner|impeller|shaft|vortex/.test(name)) return 'interior';
  if (/shell|wall|casing|barrel|cone|hopper|tank|cover|volute|floor/.test(name)) return 'shell';
  return 'structure';
}

function prepareImportedScene(scene, instanceId) {
  scene.name = `${instanceId}-BLENDER-VISUAL`;
  scene.userData.blenderImported = true;
  scene.userData.instanceId = instanceId;

  scene.traverse((object) => {
    object.userData.blenderImported = true;
    object.userData.blenderRestRotation = [object.rotation.x, object.rotation.y, object.rotation.z];
    if (object.isMesh) {
      // Keep silhouette/major machinery shadows, but stop tiny repeated details
      // from expanding the shadow pass with little visual benefit.
      object.castShadow = shouldCastImportedShadow(object);
      object.receiveShadow = true;
      object.userData.inspectionRole ||= inferInspectionRole(object);
      if (object.userData.inspectionRole === 'shell') object.userData.inspectionShell = true;
      if (object.userData.inspectionRole === 'interior') object.userData.inspectionInterior = true;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.filter(Boolean).forEach((material) => {
        material.side = THREE.FrontSide;
        material.needsUpdate = true;
      });
    }
  });
  return scene;
}

function getImportedNode(controller, name) {
  return controller?.scene?.getObjectByName?.(name) ?? null;
}

function restRotation(node, axisIndex) {
  return Number(node?.userData?.blenderRestRotation?.[axisIndex] ?? 0);
}

export function stabilizeImportedRotationPivot(scene, { nodeName, axis = 'x' } = {}) {
  const node = scene?.getObjectByName?.(nodeName);
  if (!node?.parent || !['x', 'y', 'z'].includes(axis)) return null;
  scene.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(node, true);
  if (bounds.isEmpty()) return null;
  const centerWorld = bounds.getCenter(new THREE.Vector3());
  const parent = node.parent;
  const centerParent = parent.worldToLocal(centerWorld.clone());
  const desired = node.position.clone();
  if (axis !== 'x') desired.x = centerParent.x;
  if (axis !== 'y') desired.y = centerParent.y;
  if (axis !== 'z') desired.z = centerParent.z;
  const shift = desired.clone().sub(node.position);
  if (shift.lengthSq() < 1e-12) return node;

  // Preserve the exact rest pose while relocating only the rotation axis.
  // Animation tracks keep targeting the same named node, but its children no
  // longer orbit around an unrelated scene origin and therefore cannot dive
  // through the foundation when the clip rotates.
  const children = [...node.children];
  children.forEach((child) => parent.attach(child));
  node.position.copy(desired);
  node.updateMatrixWorld(true);
  children.forEach((child) => node.attach(child));
  node.userData.rotationPivotStabilized = true;
  node.userData.rotationPivotAxis = axis;
  node.userData.rotationPivotShift = shift.toArray();
  scene.updateMatrixWorld(true);
  return node;
}

function decorateHaulTruckSemantics(handle, controller) {
  const originalSetLoaded = handle.setLoaded?.bind(handle);
  const originalSetDumpAngle = handle.setDumpAngle?.bind(handle);
  const originalSetSteering = handle.setSteering?.bind(handle);
  const originalAdvanceWheelTravel = handle.advanceWheelTravel?.bind(handle);
  const wheelRadiusM = 1.42;

  if (originalSetLoaded) {
    handle.setLoaded = (loaded) => {
      originalSetLoaded(loaded);
      const ore = getImportedNode(controller, 'HAUL-TRUCK_ORE_LOAD');
      if (ore) ore.visible = Boolean(loaded);
    };
  }

  if (originalSetDumpAngle) {
    handle.setDumpAngle = (radians) => {
      originalSetDumpAngle(radians);
      const pivot = getImportedNode(controller, 'HAUL-TRUCK_DUMP_PIVOT');
      if (pivot) pivot.rotation.z = restRotation(pivot, 2) + radians;
    };
  }

  if (originalSetSteering) {
    handle.setSteering = (radians) => {
      originalSetSteering(radians);
      const clamped = THREE.MathUtils.clamp(radians, -THREE.MathUtils.degToRad(28), THREE.MathUtils.degToRad(28));
      ['HAUL-TRUCK_WHEEL_STEER_FL', 'HAUL-TRUCK_WHEEL_STEER_FR'].forEach((name) => {
        const pivot = getImportedNode(controller, name);
        if (pivot) pivot.rotation.y = restRotation(pivot, 1) + clamped;
      });
    };
  }

  if (originalAdvanceWheelTravel) {
    handle.advanceWheelTravel = (distanceM) => {
      originalAdvanceWheelTravel(distanceM);
      if (!Number.isFinite(distanceM) || Math.abs(distanceM) < 1e-8) return;
      const names = ['FL', 'FR', 'RL1', 'RL2', 'RR1', 'RR2'].map((code) => 'HAUL-TRUCK_WHEEL_SPIN_' + code);
      names.forEach((name) => {
        const spin = getImportedNode(controller, name);
        if (spin) spin.rotation.z -= distanceM / wheelRadiusM;
      });
    };
  }

  handle.root.userData.blenderSemanticControl = 'haul-truck';
}

function makeFallbackGroup(hostRoot, instanceId) {
  const fallback = new THREE.Group();
  fallback.name = `${instanceId}-PROCEDURAL-FALLBACK`;
  fallback.userData.blenderFallback = true;
  const existing = [...hostRoot.children];
  existing.forEach((child) => fallback.add(child));
  hostRoot.add(fallback);
  return fallback;
}

function preserveProceduralOverlays(hostRoot, fallback, imported, names = [], anchors = {}) {
  const preserved = [];
  names.forEach((name) => {
    const object = fallback.getObjectByName(name);
    if (!object) return;
    hostRoot.attach(object);
    const anchorName = anchors?.[name];
    const anchor = anchorName ? imported?.getObjectByName(anchorName) : null;
    if (anchor) {
      anchor.attach(object);
      object.userData.blenderProceduralOverlayAnchor = anchorName;
    }
    object.userData.blenderProceduralOverlay = true;
    preserved.push(object);
  });
  return preserved;
}

function loadGltf(url) {
  if (!sourceCache.has(url)) {
    const request = new Promise((resolve, reject) => {
      loader.load(url, resolve, undefined, reject);
    }).catch((error) => {
      // Do not permanently poison the cache after a transient/network failure.
      sourceCache.delete(url);
      throw error;
    });
    sourceCache.set(url, request);
  }
  return sourceCache.get(url);
}

export function attachBlenderVisualReplacement({
  hostRoot,
  instanceId,
  onReady = null,
} = {}) {
  if (!hostRoot || !instanceId) throw new TypeError('attachBlenderVisualReplacement necesita hostRoot e instanceId.');
  const spec = BLENDER_REPLACEMENT_SPECS[instanceId];
  if (!spec) return null;

  hostRoot.userData.blenderReplacement = true;
  hostRoot.userData.blenderVisualUrl = spec.url;
  hostRoot.userData.blenderVisualStatus = 'fallback';

  if (typeof window === 'undefined') {
    hostRoot.userData.blenderVisualStatus = 'ssr-fallback';
    return {
      loaded: false,
      update() {},
      setAnimationEnabled() {},
      setAnimationTime() {},
      setMaterialLoadVisible() {},
      dispose() {},
    };
  }

  const fallback = makeFallbackGroup(hostRoot, instanceId);
  let imported = null;
  let mixer = null;
  let enabled = true;
  let disposed = false;
  let materialLoadVisible = true;

  hostRoot.userData.blenderVisualStatus = 'loading';

  loadGltf(spec.url)
    .then((sourceGltf) => {
      if (disposed) return;
      const gltf = {
        ...sourceGltf,
        scene: cloneBlenderReplacementSource(sourceGltf.scene),
        animations: sourceGltf.animations ?? [],
      };
      imported = prepareImportedScene(gltf.scene, instanceId);
      imported.position.set(0, 0, 0);
      imported.rotation.set(0, 0, 0);
      imported.scale.set(1, 1, 1);
      if (spec.rotationPivotRepair) stabilizeImportedRotationPivot(imported, spec.rotationPivotRepair);
      hostRoot.add(imported);
      if (spec.preserveProceduralOverlays?.length) {
        const overlays = preserveProceduralOverlays(
          hostRoot,
          fallback,
          imported,
          spec.preserveProceduralOverlays,
          spec.proceduralOverlayAnchors,
        );
        hostRoot.userData.blenderProceduralOverlayCount = overlays.length;
      }
      if (spec.materialLoadNode) {
        const load = imported.getObjectByName(spec.materialLoadNode);
        if (load) load.visible = materialLoadVisible;
      }
      fallback.visible = false;

      if (Array.isArray(gltf.animations) && gltf.animations.length) {
        mixer = new THREE.AnimationMixer(imported);
        const preferred = gltf.animations.find((clip) => clip.name === spec.expectedAnimation) ?? gltf.animations[0];
        const clipsToPlay = spec.playAllAnimations ? gltf.animations : (preferred ? [preferred] : []);
        clipsToPlay.forEach((clip) => mixer.clipAction(clip).play());
        const phaseOffset = Number(hostRoot.userData.animationPhaseOffset || 0);
        if (Number.isFinite(phaseOffset) && phaseOffset > 0) mixer.setTime(phaseOffset);
        hostRoot.userData.blenderAnimationClips = gltf.animations.map((clip) => clip.name);
      } else {
        hostRoot.userData.blenderAnimationClips = [];
      }

      hostRoot.userData.blenderVisualStatus = 'loaded';
      hostRoot.userData.blenderVisualLoaded = true;
      hostRoot.updateMatrixWorld(true);
      onReady?.({ gltf, scene: imported, mixer, fallback });
    })
    .catch((error) => {
      if (disposed) return;
      fallback.visible = true;
      hostRoot.userData.blenderVisualStatus = 'error-fallback';
      hostRoot.userData.blenderVisualError = error?.message || String(error);
      console.warn(`[PULPA LAB] No se pudo cargar ${spec.url}; se conserva fallback procedural.`, error);
    });

  return {
    get loaded() { return Boolean(imported); },
    get scene() { return imported; },
    update(dt) {
      if (!enabled || !mixer || !Number.isFinite(dt) || dt <= 0) return;
      mixer.update(Math.min(dt, 0.1));
    },
    setAnimationEnabled(value) {
      enabled = Boolean(value);
      if (mixer) mixer.timeScale = enabled ? 1 : 0;
    },
    setAnimationTime(seconds) {
      if (!mixer || !Number.isFinite(seconds) || seconds < 0) return;
      mixer.setTime(seconds);
    },
    setMaterialLoadVisible(value) {
      materialLoadVisible = Boolean(value);
      if (!imported || !spec.materialLoadNode) return;
      const load = imported.getObjectByName(spec.materialLoadNode);
      if (load) load.visible = materialLoadVisible;
    },
    dispose() {
      disposed = true;
      mixer?.stopAllAction();
      if (imported) {
        // Geometry/materials are owned by the cached source and intentionally
        // shared by sibling instances. Removing one instance must not dispose
        // resources that R-01..R-04, pumps, etc. can still be using.
        imported.removeFromParent();
      }
      fallback.visible = true;
    },
  };
}

export function decorateHandleWithBlenderReplacement(handle, instanceId) {
  if (!handle?.root || !BLENDER_REPLACEMENT_SPECS[instanceId]) return null;
  const spec = BLENDER_REPLACEMENT_SPECS[instanceId];
  const originalUpdate = handle.update?.bind(handle);
  const originalSetAnimationEnabled = handle.setAnimationEnabled?.bind(handle);
  const originalDispose = handle.dispose?.bind(handle);

  const controller = attachBlenderVisualReplacement({
    hostRoot: handle.root,
    instanceId,
  });

  if (spec.semanticControl === 'haul-truck') {
    decorateHaulTruckSemantics(handle, controller);
  }

  if (spec.materialLoadNode) {
    handle.setMaterialLoadVisible = (visible) => controller?.setMaterialLoadVisible(visible);
  }
  handle.setVisualAnimationTime = (seconds) => controller?.setAnimationTime(seconds);

  handle.update = (dt) => {
    if (!controller?.loaded || spec.keepProceduralUpdate) originalUpdate?.(dt);
    controller?.update(dt);
  };
  handle.setAnimationEnabled = (enabled) => {
    originalSetAnimationEnabled?.(enabled);
    controller?.setAnimationEnabled(enabled);
  };
  handle.dispose = () => {
    controller?.dispose();
    originalDispose?.();
  };
  return controller;
}

export function resetBlenderReplacementCacheForTests() {
  sourceCache.clear();
}
