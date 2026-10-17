import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeletonAware } from 'three/addons/utils/SkeletonUtils.js';
import { SECONDARY_SHADOW_DETAIL } from '../performance/secondaryShadowPolicy.js';

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
    preserveProceduralOverlays: Object.freeze(['STOCKPILE-RECLAIM-motion', 'STOCKPILE-RECLAIM-v24-feed-flow']),
  }),
  'EXCAVATOR-01': Object.freeze({
    url: 'models/pulpa-blender/MINING-SHOVEL.glb',
    playAllAnimations: true,
    materialLoadNode: 'MINING-SHOVEL_BUCKET_ORE',
    initialMaterialLoadVisible: false,
  }),
  'TRUCK-01': Object.freeze({
    url: 'models/pulpa-blender/HAUL-TRUCK.glb',
    semanticControl: 'haul-truck',
  }),
  'TRUCK-02': Object.freeze({
    url: 'models/pulpa-blender/HAUL-TRUCK.glb',
    semanticControl: 'haul-truck',
  }),
  'TRUCK-03': Object.freeze({
    url: 'models/pulpa-blender/HAUL-TRUCK.glb',
    semanticControl: 'haul-truck',
  }),
  'LOADER-01': Object.freeze({
    url: 'models/pulpa-blender/WHEEL-LOADER.glb',
    playAllAnimations: true,
    semanticControl: 'wheel-loader',
    materialLoadNode: 'WHEEL-LOADER_BUCKET_ORE',
    initialMaterialLoadVisible: false,
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
    keepProceduralUpdate: true,
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
      'CLASS-01-v24-mechanical-access',
    ]),
  }),
  'R-01': Object.freeze({
    url: 'models/pulpa-blender/LEACH-REACTOR.glb',
    expectedAnimation: 'LEACH_REACTOR_Agitator',
    educationalProcessNodes: Object.freeze([{ name: 'LEACH-REACTOR_SLURRY', mode: 'liquid', phase: 0.0 }]),
  }),
  'R-02': Object.freeze({
    url: 'models/pulpa-blender/LEACH-REACTOR.glb',
    expectedAnimation: 'LEACH_REACTOR_Agitator',
    educationalProcessNodes: Object.freeze([{ name: 'LEACH-REACTOR_SLURRY', mode: 'liquid', phase: 0.9 }]),
  }),
  'R-03': Object.freeze({
    url: 'models/pulpa-blender/LEACH-REACTOR.glb',
    expectedAnimation: 'LEACH_REACTOR_Agitator',
    educationalProcessNodes: Object.freeze([{ name: 'LEACH-REACTOR_SLURRY', mode: 'liquid', phase: 1.8 }]),
  }),
  'R-04': Object.freeze({
    url: 'models/pulpa-blender/LEACH-REACTOR.glb',
    expectedAnimation: 'LEACH_REACTOR_Agitator',
    educationalProcessNodes: Object.freeze([{ name: 'LEACH-REACTOR_SLURRY', mode: 'liquid', phase: 2.7 }]),
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
    educationalProcessNodes: Object.freeze([
      { name: 'CIP-ADSORPTION_SLURRY_-500', mode: 'liquid', phase: 0.0 },
      { name: 'CIP-ADSORPTION_SLURRY_-167', mode: 'liquid', phase: 0.7 },
      { name: 'CIP-ADSORPTION_SLURRY_+167', mode: 'liquid', phase: 1.4 },
      { name: 'CIP-ADSORPTION_SLURRY_+500', mode: 'liquid', phase: 2.1 },
    ]),
    preserveProceduralOverlays: Object.freeze([
      'cip-access-ladder',
      'cip-service-deck',
      'cip-pump-a-skid',
      'cip-pump-a-motor',
      'cip-pump-b-skid',
      'cip-pump-b-motor',
    ]),
  }),
  'ELUTION-SKID': Object.freeze({
    url: 'models/pulpa-blender/ELUTION-SKID.glb',
    educationalHostProcessNodes: Object.freeze([
      { name: 'elution-column-solution', mode: 'liquid', phase: 0.3 },
      { name: 'elution-tank-liquid', mode: 'liquid', phase: 1.1 },
    ]),
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
    educationalProcessNodes: Object.freeze([
      { name: 'EW-CELLS_ELECTROLYTE_1', mode: 'liquid', phase: 0.0 },
      { name: 'EW-CELLS_ELECTROLYTE_2', mode: 'liquid', phase: 0.8 },
      { name: 'EW-CELLS_ELECTROLYTE_3', mode: 'liquid', phase: 1.6 },
      { name: 'EW-CELLS_ELECTROLYTE_4', mode: 'liquid', phase: 2.4 },
    ]),
  }),
  'SMELTING-FURNACE': Object.freeze({
    url: 'models/pulpa-blender/SMELTING-FURNACE.glb',
    expectedAnimation: 'SMELTING_FURNACE_Tilt',
    animationPacing: Object.freeze({
      cycleSeconds: 16,
      activeStartSeconds: 8.8,
      activeEndSeconds: 13.12,
    }),
    educationalProcessNodes: Object.freeze([
      { name: 'SMELTING-FURNACE_MELT', mode: 'glow', phase: 0.0 },
      { name: 'SMELTING-FURNACE_CRUCIBLE_GLOW', mode: 'glow', phase: 1.1 },
    ]),
  }),
});

const loader = new GLTFLoader();
const sourceCache = new Map();

export function cloneBlenderReplacementSource(source) {
  // Each equipment instance needs its own Object3D transforms and animation
  // state, but immutable glTF geometry/material resources can be shared.
  // SkeletonUtils keeps this safe if a future asset introduces skinned meshes.
  return cloneSkeletonAware(source);
}

export function shouldCastImportedShadow(object) {
  return !SECONDARY_SHADOW_DETAIL.test(String(object?.name || ''));
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

export function updateImportedEducationalProcessVisuals(scene, descriptors = [], elapsedSeconds = 0) {
  if (!scene || !Array.isArray(descriptors) || !Number.isFinite(elapsedSeconds)) return 0;
  let updated = 0;
  descriptors.forEach((descriptor) => {
    const node = scene.getObjectByName?.(descriptor.name);
    if (!node) return;
    node.userData.v24EducationalProcessVisual = true;
    node.userData.visualOnly = true;
    node.userData.physicsModel = 'neutral-educational-cue';
    const phase = Number(descriptor.phase || 0);
    if (descriptor.mode === 'liquid') {
      node.userData.v24RestScale ||= node.scale.toArray();
      node.userData.v24RestRotationY ??= node.rotation.y;
      const [sx, sy, sz] = node.userData.v24RestScale;
      node.scale.set(sx, sy * (1 + Math.sin(elapsedSeconds * 1.35 + phase) * 0.0045), sz);
      node.rotation.y = Number(node.userData.v24RestRotationY) + Math.sin(elapsedSeconds * 0.42 + phase) * 0.012;
      updated += 1;
      return;
    }
    if (descriptor.mode === 'glow') {
      node.traverse((object) => {
        if (!object.material) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.filter(Boolean).forEach((material) => {
          if (!Number.isFinite(material.emissiveIntensity)) return;
          material.userData.v24RestEmissiveIntensity ??= material.emissiveIntensity;
          const base = Number(material.userData.v24RestEmissiveIntensity || 0);
          material.emissiveIntensity = Math.max(0, base * (1 + Math.sin(elapsedSeconds * 2.5 + phase) * 0.10));
          material.needsUpdate = true;
        });
      });
      updated += 1;
    }
  });
  return updated;
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

function decorateWheelLoaderSemantics(handle, controller) {
  const originalAdvanceWheelTravel = handle.advanceWheelTravel?.bind(handle);
  const wheelRadiusM = 1.25;
  let cumulativeTravelM = 0;
  const wheelNames = ['FL', 'FR', 'RL', 'RR'].map((code) => `WHEEL-LOADER_WHEEL_${code}`);

  const syncWheelTravel = () => {
    wheelNames.forEach((name) => {
      const wheel = getImportedNode(controller, name);
      if (wheel) wheel.rotation.z = restRotation(wheel, 2) - cumulativeTravelM / wheelRadiusM;
    });
  };

  if (originalAdvanceWheelTravel) {
    handle.advanceWheelTravel = (distanceM) => {
      originalAdvanceWheelTravel(distanceM);
      if (!Number.isFinite(distanceM) || Math.abs(distanceM) < 1e-8) return;
      cumulativeTravelM += distanceM;
      syncWheelTravel();
    };
  }
  handle.syncSemanticWheelTravel = syncWheelTravel;
  handle.root.userData.blenderSemanticControl = 'wheel-loader';
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
  let pacedAnimation = null;
  let animationCycleElapsed = 0;
  let enabled = true;
  let disposed = false;
  let materialLoadVisible = spec.initialMaterialLoadVisible ?? true;
  let educationalElapsed = 0;

  function applyPacedAnimationTime(seconds) {
    if (!mixer || !pacedAnimation) return;
    const { clip, cycleSeconds, activeStartSeconds, activeEndSeconds } = pacedAnimation;
    const cycleTime = ((seconds % cycleSeconds) + cycleSeconds) % cycleSeconds;
    animationCycleElapsed = cycleTime;
    let clipTime = 0;
    if (cycleTime >= activeEndSeconds) clipTime = clip.duration;
    else if (cycleTime > activeStartSeconds) {
      const progress = (cycleTime - activeStartSeconds) / (activeEndSeconds - activeStartSeconds);
      clipTime = THREE.MathUtils.clamp(progress, 0, 1) * clip.duration;
    }
    mixer.setTime(clipTime);
  }

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
        const pacing = spec.animationPacing;
        if (preferred && pacing
          && Number(pacing.cycleSeconds) > 0
          && Number(pacing.activeStartSeconds) >= 0
          && Number(pacing.activeEndSeconds) > Number(pacing.activeStartSeconds)
          && Number(pacing.activeEndSeconds) <= Number(pacing.cycleSeconds)) {
          pacedAnimation = {
            clip: preferred,
            cycleSeconds: Number(pacing.cycleSeconds),
            activeStartSeconds: Number(pacing.activeStartSeconds),
            activeEndSeconds: Number(pacing.activeEndSeconds),
          };
          hostRoot.userData.blenderAnimationPacing = {
            cycleSeconds: pacedAnimation.cycleSeconds,
            activeStartSeconds: pacedAnimation.activeStartSeconds,
            activeEndSeconds: pacedAnimation.activeEndSeconds,
          };
          applyPacedAnimationTime(0);
        }
        const phaseOffset = Number(hostRoot.userData.animationPhaseOffset || 0);
        if (Number.isFinite(phaseOffset) && phaseOffset > 0) {
          if (pacedAnimation) applyPacedAnimationTime(phaseOffset);
          else mixer.setTime(phaseOffset);
        }
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
      if (!enabled || !Number.isFinite(dt) || dt <= 0) return;
      const safeDt = Math.min(dt, 0.1);
      if (mixer) {
        if (pacedAnimation) applyPacedAnimationTime(animationCycleElapsed + safeDt);
        else mixer.update(safeDt);
      }
      if (imported && spec.educationalProcessNodes?.length) {
        educationalElapsed += safeDt;
        updateImportedEducationalProcessVisuals(imported, spec.educationalProcessNodes, educationalElapsed);
      }
      if (spec.educationalHostProcessNodes?.length) {
        educationalElapsed += imported && spec.educationalProcessNodes?.length ? 0 : safeDt;
        updateImportedEducationalProcessVisuals(hostRoot, spec.educationalHostProcessNodes, educationalElapsed);
      }
    },
    setAnimationEnabled(value) {
      enabled = Boolean(value);
      if (mixer) mixer.timeScale = enabled ? 1 : 0;
    },
    setAnimationTime(seconds) {
      if (!mixer || !Number.isFinite(seconds) || seconds < 0) return;
      if (pacedAnimation) applyPacedAnimationTime(seconds);
      else mixer.setTime(seconds);
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
  if (spec.semanticControl === 'wheel-loader') {
    decorateWheelLoaderSemantics(handle, controller);
  }

  if (spec.materialLoadNode) {
    handle.setMaterialLoadVisible = (visible) => controller?.setMaterialLoadVisible(visible);
  }
  handle.setVisualAnimationTime = (seconds) => {
    controller?.setAnimationTime(seconds);
    handle.syncSemanticWheelTravel?.();
  };

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
