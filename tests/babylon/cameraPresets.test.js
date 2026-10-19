import { describe, expect, it } from 'vitest';
import { ArcRotateCamera, FreeCamera, NullEngine, Scene, Vector3 } from '@babylonjs/core';
import {
  createCameraPresetConfigs,
  createV30CameraPresetConfigs,
  createV50CameraPresetConfigs,
} from '../../src/scene/cameras/cameraPresetConfigs.js';
import {
  BABYLON_CAMERA_FAR,
  BABYLON_CAMERA_NEAR,
  CAMERA_PRESET_ORDER,
  applyBabylonCameraPresetRevision,
  createBabylonCameraPresetConfigs,
  createBabylonPresetCameras,
} from '../../src/babylon/cameras/cameraPresets.js';

describe('Babylon camera preset parity', () => {
  it('uses the nine authoritative V50 preset configs by default', () => {
    expect(CAMERA_PRESET_ORDER).toHaveLength(9);
    expect(createBabylonCameraPresetConfigs()).toEqual(createCameraPresetConfigs());
    expect(createCameraPresetConfigs()).toEqual(createV50CameraPresetConfigs());
    expect(createV50CameraPresetConfigs().general).toMatchObject({
      position: [260, 105, 120],
      target: [255, 2.8, -13],
      fov: 40,
    });
  });

  it('can switch the existing camera rig back to the V30 fallback contract', () => {
    const engine = new NullEngine({ renderWidth: 1096, renderHeight: 520 });
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    const cameras = createBabylonPresetCameras(scene);
    const v30 = createV30CameraPresetConfigs();
    applyBabylonCameraPresetRevision(cameras, 'V30');
    CAMERA_PRESET_ORDER.forEach((id) => {
      expect(cameras[id].metadata.presetPosition).toEqual(v30[id].position);
      expect(cameras[id].metadata.presetTarget).toEqual(v30[id].target);
      expect(Vector3.Distance(cameras[id].position, Vector3.FromArray(v30[id].position))).toBeLessThan(1e-6);
    });
    engine.dispose();
  });

  it('creates eight fixed cameras and one ArcRotate Inspection camera', () => {
    const engine = new NullEngine({ renderWidth: 1096, renderHeight: 520 });
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    const cameras = createBabylonPresetCameras(scene);
    const configs = createCameraPresetConfigs();

    expect(Object.keys(cameras)).toEqual(CAMERA_PRESET_ORDER);
    CAMERA_PRESET_ORDER.forEach((id) => {
      const camera = cameras[id];
      scene.activeCamera = camera;
      scene.render();
      expect(camera.metadata.presetId).toBe(id);
      expect(camera.metadata.presetPosition).toEqual(configs[id].position);
      expect(camera.metadata.presetTarget).toEqual(configs[id].target);
      expect(camera.minZ).toBe(BABYLON_CAMERA_NEAR);
      expect(camera.maxZ).toBe(BABYLON_CAMERA_FAR);
      expect(camera.fov).toBeCloseTo((configs[id].fov * Math.PI) / 180, 10);
      expect(Vector3.Distance(camera.position, Vector3.FromArray(configs[id].position))).toBeLessThan(1e-6);
      const expectedDirection = Vector3.FromArray(configs[id].target)
        .subtract(Vector3.FromArray(configs[id].position))
        .normalize();
      expect(Vector3.Dot(camera.getForwardRay().direction, expectedDirection)).toBeGreaterThan(0.999999);
      if (id === 'inspection') expect(camera).toBeInstanceOf(ArcRotateCamera);
      else expect(camera).toBeInstanceOf(FreeCamera);
    });

    engine.dispose();
  });
});
