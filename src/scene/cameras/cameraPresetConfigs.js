import { V49_SITE_BOUNDS, V49_ZONE_ANCHORS } from '../integration/v49Layout.js';
import { getPlantLayoutBounds, getPlantZone } from '../layout/plantLayout.js';
import { getTerrainHeight } from '../environment/terrainHeight.js';
import { getSiteOverviewBounds, PIT_DESIGN } from '../config/siteDesign.js';

function vector(x, y, z) {
  return [x, y, z];
}

function preset(position, target, fov = 45) {
  return Object.freeze({
    position: Object.freeze([...position]),
    target: Object.freeze([...target]),
    fov,
  });
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

function anchor(zoneId) {
  const point = V49_ZONE_ANCHORS[zoneId];
  if (!point) throw new RangeError(`Ancla V49 desconocida: ${zoneId}.`);
  return vector(point.x, point.y, point.z);
}

/**
 * Renderer-neutral V49 camera contract.
 *
 * V49 is authored in Blender and exported to glTF/Babylon Y-up coordinates.
 * These presets deliberately frame that final 422 x 112 m site instead of the
 * superseded V30 open-pit/procedural layout.
 */
export function createV49CameraPresetConfigs() {
  const siteCenter = vector(
    (V49_SITE_BOUNDS.minX + V49_SITE_BOUNDS.maxX) / 2,
    2.5,
    (V49_SITE_BOUNDS.minZ + V49_SITE_BOUNDS.maxZ) / 2,
  );
  const reception = anchor('Z1');
  const grinding = anchor('Z4');
  const classification = anchor('Z5');
  const leaching = anchor('Z6');
  const recovery = anchor('Z8');

  return Object.freeze({
    general: preset(
      vector(430, 155, 165),
      vector(205, 3.0, -6),
      44,
    ),
    top: preset(
      vector(siteCenter[0], 420, siteCenter[2]),
      siteCenter,
      40,
    ),
    oblique: preset(
      vector(410, 120, 120),
      vector(200, 2.5, -7),
      44,
    ),
    reception: preset(
      vector(reception[0] - 34, reception[1] + 30, reception[2] + 44),
      vector(191, 3.0, 0),
      48,
    ),
    crushing: preset(
      vector(185, 33, 40),
      vector(223, 3.3, 0),
      44,
    ),
    grinding: preset(
      vector(grinding[0] + 22, grinding[1] + 26, -4),
      vector((grinding[0] + classification[0]) / 2, 4.5, -35),
      44,
    ),
    leaching: preset(
      vector(leaching[0] + 32, leaching[1] + 28, 3),
      vector(leaching[0], leaching[1] - 0.5, leaching[2]),
      42,
    ),
    recovery: preset(
      vector(recovery[0] + 24, recovery[1] + 27, 1),
      vector(recovery[0], recovery[1] - 0.5, recovery[2]),
      42,
    ),
    inspection: preset(
      vector(338, 18, -12),
      vector(320, 4.0, -35),
      50,
    ),
  });
}

export function createV30CameraPresetConfigs() {
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
  void crushingStockpile;
  return Object.freeze({
    general: preset(safePosition(205, 270, -335, 30), add(siteTarget, vector(15, 4, -6)), 45),
    top: preset(safePosition(siteCenter[0], 650, siteCenter[2], 30), siteCenter, 42),
    oblique: preset(safePosition(-425, 190, -165, 24), pitOverviewTarget, 44),
    reception: preset(
      safePosition(reception[0] - 50, reception[1] + 32, reception[2] + 50, 9),
      add(reception, vector(2, 0.5, -2)),
      48,
    ),
    crushing: preset(safePosition(-105.75, 63.78, 49.32, 9), vector(-27.62, 8.63, -38), 43),
    grinding: preset(
      safePosition(grindingClassification[0] - 35, grindingClassification[1] + 25, grindingClassification[2] + 39, 9),
      add(grindingClassification, vector(-2, 0.5, 0)),
      44,
    ),
    leaching: preset(
      safePosition(leaching[0], leaching[1] + 29, leaching[2] - 56, 9),
      add(leaching, vector(0, 1.5, 0)),
      42,
    ),
    recovery: preset(safePosition(204.98, 45.42, -14.59, 9), vector(204.98, 6.35, -90.31), 42),
    inspection: (() => {
      const target = add(grindingClassification, vector(3, 1, -2));
      return preset(safePosition(target[0] + 14, target[1] + 9, target[2] + 15, 4), target, 50);
    })(),
  });
}

export function createCameraPresetConfigs({ revision = 'V49' } = {}) {
  return revision === 'V30' ? createV30CameraPresetConfigs() : createV49CameraPresetConfigs();
}
