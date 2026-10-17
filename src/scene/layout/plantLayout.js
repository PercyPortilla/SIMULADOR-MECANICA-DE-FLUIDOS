import { getTerrainHeight, getZoneElevation } from '../environment/terrainHeight.js';
import { PLANT_ZONE_DEFINITIONS } from '../config/siteDesign.js';

function freezeZone(definition) {
  const elevation = definition.elevationKey
    ? getZoneElevation(definition.elevationKey)
    : getTerrainHeight(definition.position.x, definition.position.z);
  return Object.freeze({
    ...definition,
    position: Object.freeze({ ...definition.position }),
    elevation,
    connections: Object.freeze([...definition.connections]),
  });
}

const ZONES = Object.freeze(Object.fromEntries(
  Object.entries(PLANT_ZONE_DEFINITIONS).map(([id, definition]) => [id, freezeZone(definition)]),
));

export const PLANT_LAYOUT = ZONES;
export const PLANT_ZONE_ORDER = Object.freeze(Object.keys(ZONES));

export function getPlantZone(zoneId) {
  const zone = ZONES[zoneId];
  if (!zone) throw new RangeError(`Zona de planta desconocida: ${zoneId}.`);
  return zone;
}

export function getZoneTransform(zoneId) {
  const zone = getPlantZone(zoneId);
  return {
    position: { x: zone.position.x, y: zone.elevation, z: zone.position.z },
    rotationY: zone.rotationY,
    width: zone.width,
    depth: zone.depth,
  };
}

export function getPlantLayoutBounds() {
  let minX = Infinity; let maxX = -Infinity; let minZ = Infinity; let maxZ = -Infinity; let minY = Infinity; let maxY = -Infinity;
  PLANT_ZONE_ORDER.forEach((zoneId) => {
    const zone = getPlantZone(zoneId);
    minX = Math.min(minX, zone.position.x - zone.width / 2);
    maxX = Math.max(maxX, zone.position.x + zone.width / 2);
    minZ = Math.min(minZ, zone.position.z - zone.depth / 2);
    maxZ = Math.max(maxZ, zone.position.z + zone.depth / 2);
    minY = Math.min(minY, zone.elevation);
    maxY = Math.max(maxY, zone.elevation);
  });
  return Object.freeze({ minX, maxX, minY, maxY, minZ, maxZ });
}
