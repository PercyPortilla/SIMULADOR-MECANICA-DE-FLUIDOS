import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CAMERA_PRESET_ORDER, createCameraPresetConfigs, createPresetCameras } from '../../src/scene/cameras/cameraPresets.js';
import { getPlantZone } from '../../src/scene/layout/plantLayout.js';
import { getTerrainHeight } from '../../src/scene/environment/terrainHeight.js';
import { getSiteOverviewBounds, PIT_DESIGN } from '../../src/scene/config/siteDesign.js';

describe('professional camera presets', () => {
  it('defines the nine requested presets in one central configuration', () => {
    expect(CAMERA_PRESET_ORDER).toEqual([
      'general', 'top', 'oblique', 'reception', 'crushing',
      'grinding', 'leaching', 'recovery', 'inspection',
    ]);
    expect(Object.keys(createCameraPresetConfigs())).toEqual(CAMERA_PRESET_ORDER);
    expect(Object.keys(createPresetCameras())).toEqual(CAMERA_PRESET_ORDER);
  });

  it('keeps all camera positions above terrain', () => {
    const configs = createCameraPresetConfigs();
    CAMERA_PRESET_ORDER.forEach((id) => {
      const [x, y, z] = configs[id].position;
      expect(y).toBeGreaterThan(getTerrainHeight(x, z));
    });
  });

  it('builds a near-vertical top preset centered on the expanded site bounds', () => {
    const bounds = getSiteOverviewBounds();
    const top = createCameraPresetConfigs().top;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    expect(Math.abs(top.position[0] - centerX)).toBeLessThan(0.001);
    expect(Math.abs(top.target[0] - centerX)).toBeLessThan(0.001);
    expect(Math.abs(top.target[2] - centerZ)).toBeLessThan(0.001);
    expect(top.position[1] - top.target[1]).toBeGreaterThan(500);
  });

  it('uses overview presets that include both the open pit and processing plant', () => {
    const config = createCameraPresetConfigs().general;
    const camera = new THREE.PerspectiveCamera(config.fov, 16 / 9, 0.1, 1600);
    camera.position.fromArray(config.position);
    camera.lookAt(...config.target);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();

    const pit = new THREE.Vector3(PIT_DESIGN.center.x, PIT_DESIGN.floorElevation + 8, PIT_DESIGN.center.z).project(camera);
    const recovery = getPlantZone('Z8');
    const plant = new THREE.Vector3(recovery.position.x, recovery.elevation + 5, recovery.position.z).project(camera);
    for (const point of [pit, plant]) {
      expect(point.x).toBeGreaterThan(-1.1);
      expect(point.x).toBeLessThan(1.1);
      expect(point.y).toBeGreaterThan(-1.1);
      expect(point.y).toBeLessThan(1.1);
    }
    expect(config.fov).toBe(45);
  });

  it('uses the oblique preset as a readable open-pit overview', () => {
    const config = createCameraPresetConfigs().oblique;
    const camera = new THREE.PerspectiveCamera(config.fov, 16 / 9, 0.1, 1600);
    camera.position.fromArray(config.position);
    camera.lookAt(...config.target);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();
    const pit = new THREE.Vector3(PIT_DESIGN.center.x, PIT_DESIGN.floorElevation + 5, PIT_DESIGN.center.z).project(camera);
    expect(Math.abs(pit.x)).toBeLessThan(0.75);
    expect(Math.abs(pit.y)).toBeLessThan(0.75);
  });

  it('makes inspection a close technical view while allowing large-site navigation', () => {
    const configs = createCameraPresetConfigs();
    const inspection = configs.inspection;
    const general = configs.general;
    const inspectionDistance = new THREE.Vector3(...inspection.position)
      .distanceTo(new THREE.Vector3(...inspection.target));
    const generalDistance = new THREE.Vector3(...general.position)
      .distanceTo(new THREE.Vector3(...general.target));
    expect(inspectionDistance).toBeLessThan(30);
    expect(inspectionDistance).toBeLessThan(generalDistance * 0.2);
  });

  it('reserves orbit/pan/zoom exclusively for Inspección and uses site-scale clipping', () => {
    const cameras = createPresetCameras();
    CAMERA_PRESET_ORDER.forEach((id) => {
      expect(cameras[id].userData.navigationMode).toBe(id === 'inspection' ? 'orbit-pan-zoom' : 'fixed-preset');
      expect(cameras[id].far).toBeGreaterThanOrEqual(1500);
    });
  });
});
