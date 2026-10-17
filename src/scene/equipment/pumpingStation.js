import { createSlurryPump } from './pump.js';
import { getZoneTransform } from '../layout/plantLayout.js';
import { getTerrainHeight } from '../environment/terrainHeight.js';

export const PUMPING_STATION_PUMP_IDS = Object.freeze(['PUMP-01']);
export const PUMPING_STATION_NOMINAL_DIAMETER_M = 0.05;

export function createPumpingStationEquipment() {
  const zone = getZoneTransform('Z7');
  const x = zone.position.x;
  const z = zone.position.z;
  const groundY = getTerrainHeight(x, z);

  const pump = createSlurryPump({
    id: 'PUMP-01',
    position: { x, y: groundY, z },
    rotationY: zone.rotationY,
  });

  return {
    pumps: [pump],
    groundElevation: groundY,
  };
}
