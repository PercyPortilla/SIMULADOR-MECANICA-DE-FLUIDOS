import { describe, expect, it } from 'vitest';
import {
  WORLD_UNITS_PER_METER,
  SITE_EXTENT,
  REFERENCE_EQUIPMENT_DIMENSIONS,
  PIT_DESIGN,
  PLANT_CLEARANCES,
  ROAD_DEFINITIONS,
} from '../../src/scene/config/siteDesign.js';
import { PLANT_ZONE_ORDER, getPlantZone } from '../../src/scene/layout/plantLayout.js';

function rectangleGap(a, b) {
  const dx = Math.max(0,
    Math.max(a.position.x - a.width / 2, b.position.x - b.width / 2)
      - Math.min(a.position.x + a.width / 2, b.position.x + b.width / 2));
  const dz = Math.max(0,
    Math.max(a.position.z - a.depth / 2, b.position.z - b.depth / 2)
      - Math.min(a.position.z + a.depth / 2, b.position.z + b.depth / 2));
  return Math.hypot(dx, dz);
}

describe('site metric master contract', () => {
  it('uses one Three.js unit per metre on a mine-scale domain', () => {
    expect(WORLD_UNITS_PER_METER).toBe(1);
    expect(SITE_EXTENT.width).toBeGreaterThanOrEqual(800);
    expect(SITE_EXTENT.depth).toBeGreaterThanOrEqual(500);
  });

  it('keeps the reference fleet in a coherent open-pit size family', () => {
    const truck = REFERENCE_EQUIPMENT_DIMENSIONS.haulTruck;
    const loader = REFERENCE_EQUIPMENT_DIMENSIONS.wheelLoader;
    const shovel = REFERENCE_EQUIPMENT_DIMENSIONS.miningShovel;
    expect(truck.lengthM).toBeCloseTo(10);
    expect(truck.widthM).toBeGreaterThanOrEqual(5);
    expect(loader.lengthM).toBeCloseTo(12);
    expect(shovel.widthM).toBeCloseTo(8);
    expect(shovel.heightM).toBeGreaterThan(8);
  });

  it('defines a real pit footprint with ten-metre benches and a working floor', () => {
    expect(PIT_DESIGN.radiusX * 2).toBeGreaterThanOrEqual(250);
    expect(PIT_DESIGN.radiusZ * 2).toBeGreaterThanOrEqual(180);
    expect(PIT_DESIGN.benchHeightM).toBe(10);
    expect(PIT_DESIGN.floorElevation).toBeLessThan(-20);
  });

  it('uses a truck-controlled primary haul road, not the previous 9 m service width', () => {
    const road = ROAD_DEFINITIONS['ROAD-01'];
    expect(road.widthM).toBeGreaterThanOrEqual(18);
    expect(road.widthM / REFERENCE_EQUIPMENT_DIMENSIONS.haulTruck.widthM).toBeGreaterThanOrEqual(3.5);
  });

  it('keeps process zones separated instead of compacted into overlapping islands', () => {
    for (let i = 0; i < PLANT_ZONE_ORDER.length; i += 1) {
      for (let j = i + 1; j < PLANT_ZONE_ORDER.length; j += 1) {
        const a = getPlantZone(PLANT_ZONE_ORDER[i]);
        const b = getPlantZone(PLANT_ZONE_ORDER[j]);
        const overlapX = Math.min(a.position.x + a.width / 2, b.position.x + b.width / 2)
          - Math.max(a.position.x - a.width / 2, b.position.x - b.width / 2);
        const overlapZ = Math.min(a.position.z + a.depth / 2, b.position.z + b.depth / 2)
          - Math.max(a.position.z - a.depth / 2, b.position.z - b.depth / 2);
        const connected = a.connections.includes(PLANT_ZONE_ORDER[j]) || b.connections.includes(PLANT_ZONE_ORDER[i]);
        if (!connected) expect(overlapX > 0 && overlapZ > 0).toBe(false);
      }
    }
    expect(rectangleGap(getPlantZone('Z1'), getPlantZone('Z2'))).toBeGreaterThanOrEqual(PLANT_CLEARANCES.minimumModuleGapM);
    expect(rectangleGap(getPlantZone('Z4'), getPlantZone('Z5'))).toBeGreaterThanOrEqual(PLANT_CLEARANCES.minimumModuleGapM);
  });
});
