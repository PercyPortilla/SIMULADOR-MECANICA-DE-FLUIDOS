import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import {
  CAMERA_PRESET_ORDER,
} from '../../ui/cameraMetadata.js';
import {
  createCameraPresetConfigs,
} from '../../scene/cameras/cameraPresetConfigs.js';

export const BABYLON_CAMERA_NEAR = 0.1;
export const BABYLON_CAMERA_FAR = 1600;
export const INSPECTION_CAMERA_ID = 'inspection';

function toVector3(values) {
  return Vector3.FromArray(values);
}

function applySharedCameraConfig(camera, id, config) {
  camera.name = `camera-${id}`;
  camera.fov = (config.fov * Math.PI) / 180;
  camera.minZ = BABYLON_CAMERA_NEAR;
  camera.maxZ = BABYLON_CAMERA_FAR;
  camera.metadata = {
    ...(camera.metadata ?? {}),
    presetId: id,
    navigationMode: id === INSPECTION_CAMERA_ID ? 'orbit-pan-zoom' : 'fixed-preset',
    fovDegrees: config.fov,
    presetPosition: [...config.position],
    presetTarget: [...config.target],
  };
  return camera;
}

function createFixedPresetCamera(scene, id, config) {
  const position = toVector3(config.position);
  const camera = new FreeCamera(`camera-${id}`, position.clone(), scene);
  camera.setTarget(toVector3(config.target));
  // Babylon nudges a perfectly vertical FreeCamera by 0.001 m when setTarget()
  // resolves the Top-view singularity. Keep the resulting orientation, but
  // restore the authoritative V30 preset position exactly.
  camera.position.copyFrom(position);
  return applySharedCameraConfig(camera, id, config);
}

function createInspectionCamera(scene, config) {
  const target = toVector3(config.target);
  const position = toVector3(config.position);
  const camera = new ArcRotateCamera(
    'camera-inspection',
    0,
    Math.PI / 2,
    Math.max(BABYLON_CAMERA_NEAR, Vector3.Distance(position, target)),
    target,
    scene,
  );
  // setPosition derives alpha/beta/radius from the authoritative V30 pose,
  // avoiding Babylon spherical-convention drift during the migration.
  camera.setPosition(position);
  camera.setTarget(target);
  camera.lowerRadiusLimit = 0.8;
  camera.upperRadiusLimit = 1200;
  // Keep Inspection above the plant floor. Allowing beta to cross under the
  // target was the main source of the apparent OrbitControls "flip".
  camera.lowerBetaLimit = 0.10;
  camera.upperBetaLimit = Math.PI * 0.485;
  // Shorter inertia prevents accumulated drag/wheel offsets from continuing
  // after the user releases the pointer.
  camera.inertia = 0.56;
  camera.panningInertia = 0.56;
  camera.angularSensibilityX = 800;
  camera.angularSensibilityY = 800;
  camera.wheelPrecision = 20;
  camera.panningSensibility = 1000;
  camera.pinchPrecision = 85;
  camera.useNaturalPinchZoom = true;
  return applySharedCameraConfig(camera, INSPECTION_CAMERA_ID, config);
}

export function clearBabylonInspectionCameraInertia(camera) {
  if (!(camera instanceof ArcRotateCamera)) return false;
  camera.inertialAlphaOffset = 0;
  camera.inertialBetaOffset = 0;
  camera.inertialRadiusOffset = 0;
  camera.inertialPanningX = 0;
  camera.inertialPanningY = 0;
  return true;
}

/**
 * Reuses the existing V30 camera configuration as immutable migration data.
 * No Three camera instance is consumed here; only numeric position/target/FOV
 * values are copied into Babylon cameras.
 */
export function createBabylonCameraPresetConfigs() {
  return createCameraPresetConfigs();
}

export function applyBabylonCameraPresetRevision(cameras, revision = 'V57') {
  if (!cameras) throw new TypeError('Babylon camera revision switch requires camera handles.');
  const configs = createCameraPresetConfigs({ revision });
  CAMERA_PRESET_ORDER.forEach((id) => {
    const camera = cameras[id];
    const config = configs[id];
    if (!camera || !config) return;
    const position = toVector3(config.position);
    const target = toVector3(config.target);
    if (camera instanceof ArcRotateCamera) {
      camera.setPosition(position);
      camera.setTarget(target);
    } else {
      camera.position.copyFrom(position);
      camera.setTarget(target);
      camera.position.copyFrom(position);
    }
    applySharedCameraConfig(camera, id, config);
  });
  return configs;
}

export function createBabylonPresetCameras(scene) {
  if (!scene) throw new TypeError('Babylon preset cameras require a Scene.');
  const configs = createBabylonCameraPresetConfigs();
  return Object.fromEntries(CAMERA_PRESET_ORDER.map((id) => {
    const config = configs[id];
    const camera = id === INSPECTION_CAMERA_ID
      ? createInspectionCamera(scene, config)
      : createFixedPresetCamera(scene, id, config);
    return [id, camera];
  }));
}

export function setInspectionControlsAttached(camera, canvas, attached) {
  if (!(camera instanceof ArcRotateCamera)) {
    throw new TypeError('Inspection controls require an ArcRotateCamera.');
  }
  clearBabylonInspectionCameraInertia(camera);
  if (attached) {
    // Runtime lifecycle already guarantees this path is entered only while
    // Inspection is detached. Avoid a redundant detach/attach churn, which
    // also caused duplicate lifecycle events in NullEngine tests.
    camera.attachControl(canvas, false);
  } else camera.detachControl();
}

export { CAMERA_PRESET_ORDER };
