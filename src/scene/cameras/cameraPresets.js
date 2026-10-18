import * as THREE from 'three';
import { getPlantLayoutBounds, getPlantZone } from '../layout/plantLayout.js';
import { getTerrainHeight } from '../environment/terrainHeight.js';
import { getSiteOverviewBounds, PIT_DESIGN } from '../config/siteDesign.js';
import { CAMERA_PRESET_ORDER } from '../../ui/cameraMetadata.js';
export { CAMERA_PRESET_ORDER, CAMERA_PRESET_LABELS } from '../../ui/cameraMetadata.js';

function zoneTarget(zoneId, lift = 2.5) {
  const zone = getPlantZone(zoneId);
  return new THREE.Vector3(zone.position.x, zone.elevation + lift, zone.position.z);
}
function safePosition(x, y, z, clearance = 4) {
  return new THREE.Vector3(x, Math.max(y, getTerrainHeight(x, z) + clearance), z);
}
function preset(position, target, fov = 45) {
  return Object.freeze({ position: Object.freeze(position.toArray()), target: Object.freeze(target.toArray()), fov });
}

export function createCameraPresetConfigs() {
  const plantBounds = getPlantLayoutBounds();
  const siteBounds = getSiteOverviewBounds();
  const plantCenter = new THREE.Vector3(
    (plantBounds.minX + plantBounds.maxX) / 2,
    (plantBounds.minY + plantBounds.maxY) / 2 + 3,
    (plantBounds.minZ + plantBounds.maxZ) / 2,
  );
  const siteCenter = new THREE.Vector3(
    (siteBounds.minX + siteBounds.maxX) / 2,
    4,
    (siteBounds.minZ + siteBounds.maxZ) / 2,
  );

  const reception = zoneTarget('Z1', 4.5);
  const crushingStockpile = zoneTarget('Z2', 4).lerp(zoneTarget('Z3', 4), 0.56);
  const grindingClassification = zoneTarget('Z4', 3.5).lerp(zoneTarget('Z5', 3.5), 0.52);
  const leaching = zoneTarget('Z6', 4.5);
  const recovery = zoneTarget('Z8', 4.0);
  const pitTarget = new THREE.Vector3(PIT_DESIGN.center.x, PIT_DESIGN.floorElevation + 8, PIT_DESIGN.center.z);
  const siteTarget = pitTarget.clone().lerp(plantCenter, 0.57);
  const pitOverviewTarget = pitTarget.clone().lerp(plantCenter, 0.28).add(new THREE.Vector3(8, 7, -5));

  return Object.freeze({
    general: preset(
      safePosition(205, 270, -335, 30),
      siteTarget.clone().add(new THREE.Vector3(15, 4, -6)),
      45,
    ),
    top: preset(
      safePosition(siteCenter.x, 650, siteCenter.z, 30),
      siteCenter,
      42,
    ),
    oblique: preset(
      safePosition(-425, 190, -165, 24),
      pitOverviewTarget,
      44,
    ),
    reception: preset(
      safePosition(reception.x - 50, reception.y + 32, reception.z + 50, 9),
      reception.clone().add(new THREE.Vector3(2, 0.5, -2)),
      48,
    ),
    crushing: preset(
      safePosition(-105.75, 63.78, 49.32, 9),
      new THREE.Vector3(-27.62, 8.63, -38),
      43,
    ),
    grinding: preset(
      safePosition(grindingClassification.x - 35, grindingClassification.y + 25, grindingClassification.z + 39, 9),
      grindingClassification.clone().add(new THREE.Vector3(-2, 0.5, 0)),
      44,
    ),
    leaching: preset(
      safePosition(leaching.x, leaching.y + 29, leaching.z - 56, 9),
      leaching.clone().add(new THREE.Vector3(0, 1.5, 0)),
      42,
    ),
    recovery: preset(
      safePosition(204.98, 45.42, -14.59, 9),
      new THREE.Vector3(204.98, 6.35, -90.31),
      42,
    ),
    inspection: (() => {
      const target = grindingClassification.clone().add(new THREE.Vector3(3, 1, -2));
      return preset(safePosition(target.x + 14, target.y + 9, target.z + 15, 4), target, 50);
    })(),
  });
}

export function createPresetCameras() {
  const configs = createCameraPresetConfigs();
  return Object.fromEntries(CAMERA_PRESET_ORDER.map((id) => {
    const config = configs[id];
    const camera = new THREE.PerspectiveCamera(config.fov, 1, 0.1, 1600);
    camera.name = `camera-${id}`;
    camera.position.fromArray(config.position);
    camera.lookAt(...config.target);
    camera.userData.target = new THREE.Vector3(...config.target);
    camera.userData.presetId = id;
    camera.userData.navigationMode = id === 'inspection' ? 'orbit-pan-zoom' : 'fixed-preset';
    return [id, camera];
  }));
}
