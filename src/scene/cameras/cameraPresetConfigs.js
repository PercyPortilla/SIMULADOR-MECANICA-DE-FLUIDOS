import { getPlantLayoutBounds, getPlantZone } from '../layout/plantLayout.js';
import { getTerrainHeight } from '../environment/terrainHeight.js';
import { getSiteOverviewBounds, PIT_DESIGN } from '../config/siteDesign.js';

function vector(x, y, z) {
  return [x, y, z];
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function lerp(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function zoneTarget(zoneId, lift = 2.5) {
  const zone = getPlantZone(zoneId);
  return vector(zone.position.x, zone.elevation + lift, zone.position.z);
}

function safePosition(x, y, z, clearance = 4) {
  return vector(x, Math.max(y, getTerrainHeight(x, z) + clearance), z);
}

function preset(position, target, fov = 45) {
  return Object.freeze({
    position: Object.freeze([...position]),
    target: Object.freeze([...target]),
    fov,
  });
}

/**
 * Renderer-neutral V30 camera contract.
 *
 * This module intentionally contains no Three.js or Babylon.js types. Both
 * runtimes consume the same numeric position/target/FOV data so camera parity
 * can be asserted during the V31 migration.
 */
export function createCameraPresetConfigs() {
  const plantBounds = getPlantLayoutBounds();
  const siteBounds = getSiteOverviewBounds();
  const plantCenter = vector(
    (plantBounds.minX + plantBounds.maxX) / 2,
    (plantBounds.minY + plantBounds.maxY) / 2 + 3,
    (plantBounds.minZ + plantBounds.maxZ) / 2,
  );
  const siteCenter = vector(
    (siteBounds.minX + siteBounds.maxX) / 2,
    4,
    (siteBounds.minZ + siteBounds.maxZ) / 2,
  );

  const reception = zoneTarget('Z1', 4.5);
  const crushingStockpile = lerp(zoneTarget('Z2', 4), zoneTarget('Z3', 4), 0.56);
  const grindingClassification = lerp(zoneTarget('Z4', 3.5), zoneTarget('Z5', 3.5), 0.52);
  const leaching = zoneTarget('Z6', 4.5);
  const recovery = zoneTarget('Z8', 4.0);
  const pitTarget = vector(PIT_DESIGN.center.x, PIT_DESIGN.floorElevation + 8, PIT_DESIGN.center.z);
  const siteTarget = lerp(pitTarget, plantCenter, 0.57);
  const pitOverviewTarget = add(lerp(pitTarget, plantCenter, 0.28), vector(8, 7, -5));

  // Keep this calculation even though the current crushing preset is manually
  // tuned. It documents the shared Z2/Z3 focus used by the V30 camera design.
  void crushingStockpile;

  return Object.freeze({
    general: preset(
      safePosition(205, 270, -335, 30),
      add(siteTarget, vector(15, 4, -6)),
      45,
    ),
    top: preset(
      safePosition(siteCenter[0], 650, siteCenter[2], 30),
      siteCenter,
      42,
    ),
    oblique: preset(
      safePosition(-425, 190, -165, 24),
      pitOverviewTarget,
      44,
    ),
    reception: preset(
      safePosition(reception[0] - 50, reception[1] + 32, reception[2] + 50, 9),
      add(reception, vector(2, 0.5, -2)),
      48,
    ),
    crushing: preset(
      safePosition(-105.75, 63.78, 49.32, 9),
      vector(-27.62, 8.63, -38),
      43,
    ),
    grinding: preset(
      safePosition(
        grindingClassification[0] - 35,
        grindingClassification[1] + 25,
        grindingClassification[2] + 39,
        9,
      ),
      add(grindingClassification, vector(-2, 0.5, 0)),
      44,
    ),
    leaching: preset(
      safePosition(leaching[0], leaching[1] + 29, leaching[2] - 56, 9),
      add(leaching, vector(0, 1.5, 0)),
      42,
    ),
    recovery: preset(
      safePosition(204.98, 45.42, -14.59, 9),
      vector(204.98, 6.35, -90.31),
      42,
    ),
    inspection: (() => {
      const target = add(grindingClassification, vector(3, 1, -2));
      return preset(
        safePosition(target[0] + 14, target[1] + 9, target[2] + 15, 4),
        target,
        50,
      );
    })(),
  });
}
