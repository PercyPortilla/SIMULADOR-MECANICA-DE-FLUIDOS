import { describe, expect, it } from 'vitest';
import { createMobileEquipment } from '../../src/scene/vehicles/mobileEquipment.js';
import { getTerrainHeight } from '../../src/scene/environment/terrainHeight.js';
import { REFERENCE_EQUIPMENT_DIMENSIONS } from '../../src/scene/config/siteDesign.js';

describe('maquinaria móvil minera', () => {
  it('crea tres haul trucks, wheel loader y shovel/excavadora reconocibles', () => {
    const mobile = createMobileEquipment();
    expect(mobile.haulTrucks).toHaveLength(3);
    expect(mobile.wheelLoader).toBeTruthy();
    expect(mobile.excavator).toBeTruthy();
    expect(mobile.root.userData.haulTruckCount).toBe(3);
    expect(mobile.root.userData.wheelLoaderCount).toBe(1);
    expect(mobile.root.userData.excavatorCount).toBe(1);
    expect(mobile.root.getObjectByName('truck-dump-bed')).toBeTruthy();
    expect(mobile.root.getObjectByName('loader-bucket')).toBeTruthy();
    expect(mobile.root.getObjectByName('excavator-bucket')).toBeTruthy();
  });

  it('uses a metric reference family for mining fleet dimensions', () => {
    expect(REFERENCE_EQUIPMENT_DIMENSIONS.haulTruck.lengthM).toBeCloseTo(10);
    expect(REFERENCE_EQUIPMENT_DIMENSIONS.haulTruck.widthM).toBeGreaterThan(5);
    expect(REFERENCE_EQUIPMENT_DIMENSIONS.wheelLoader.lengthM).toBeCloseTo(12);
    expect(REFERENCE_EQUIPMENT_DIMENSIONS.miningShovel.widthM).toBeCloseTo(8);
  });

  it('apoya cada equipo móvil sobre la topografía real', () => {
    const mobile = createMobileEquipment();
    [...mobile.haulTrucks, mobile.wheelLoader, mobile.excavator].forEach((vehicle) => {
      const expectedY = getTerrainHeight(vehicle.position.x, vehicle.position.z);
      expect(vehicle.position.y).toBeCloseTo(expectedY, 8);
      expect(vehicle.userData.terrainY).toBeCloseTo(expectedY, 8);
    });
  });

  it('anima TRUCK-01 sobre ROAD-01, conserva terreno y mantiene el tercero como standby ROM', () => {
    const mobile = createMobileEquipment();
    const truck = mobile.haulTrucks[0];
    const before = truck.position.clone();
    for (let index = 0; index < 120; index += 1) mobile.update(0.1);

    expect(truck.position.distanceTo(before)).toBeGreaterThan(0);
    expect(truck.position.y).toBeCloseTo(getTerrainHeight(truck.position.x, truck.position.z), 8);
    expect(truck.userData.routeId).toBe('ROAD-01');
    expect(mobile.truck01RouteLength).toBeGreaterThan(300);
    expect(mobile.haulTrucks[1].userData.routeId).toBe('ROAD-01');
    expect(mobile.haulTrucks[2].userData.operationalState).toBe('rom-standby');
  });
});
