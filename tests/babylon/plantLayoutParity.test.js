import { describe, expect, it } from 'vitest';
import {
  PIT_DESIGN,
  PLANT_CLEARANCES,
  RECEPTION_EARTHWORK,
  REFERENCE_EQUIPMENT_DIMENSIONS,
  ROAD_DEFINITIONS,
  SITE_EXTENT,
  WORLD_UNITS_PER_METER,
} from '../../src/scene/config/siteDesign.js';
import {
  PLANT_ZONE_ORDER,
  getPlantLayoutBounds,
  getPlantZone,
  getZoneTransform,
} from '../../src/scene/layout/plantLayout.js';
import { getZoneElevation } from '../../src/scene/environment/terrainHeight.js';

function rectangleGap(a, b) {
  const dx = Math.max(
    0,
    Math.max(a.position.x - a.width / 2, b.position.x - b.width / 2)
      - Math.min(a.position.x + a.width / 2, b.position.x + b.width / 2),
  );
  const dz = Math.max(
    0,
    Math.max(a.position.z - a.depth / 2, b.position.z - b.depth / 2)
      - Math.min(a.position.z + a.depth / 2, b.position.z + b.depth / 2),
  );
  return Math.hypot(dx, dz);
}

function overlapArea(a, b) {
  const ax0 = a.position.x - a.width / 2;
  const ax1 = a.position.x + a.width / 2;
  const az0 = a.position.z - a.depth / 2;
  const az1 = a.position.z + a.depth / 2;
  const bx0 = b.position.x - b.width / 2;
  const bx1 = b.position.x + b.width / 2;
  const bz0 = b.position.z - b.depth / 2;
  const bz1 = b.position.z + b.depth / 2;
  return Math.max(0, Math.min(ax1, bx1) - Math.max(ax0, bx0))
    * Math.max(0, Math.min(az1, bz1) - Math.max(az0, bz0));
}

describe('renderer-neutral site and plant layout parity', () => {
  it('keeps the one-metre mine-scale site contract', () => {
    expect(WORLD_UNITS_PER_METER).toBe(1);
    expect(SITE_EXTENT).toEqual({ width: 860, depth: 560 });
    expect(PIT_DESIGN).toMatchObject({
      floorElevation: -30,
      benchHeightM: 10,
      benchCount: 4,
    });
    expect(REFERENCE_EQUIPMENT_DIMENSIONS.haulTruck.widthM).toBeGreaterThanOrEqual(5);
    expect(ROAD_DEFINITIONS['ROAD-01'].widthM / REFERENCE_EQUIPMENT_DIMENSIONS.haulTruck.widthM)
      .toBeGreaterThanOrEqual(3.5);
  });

  it('keeps the approved elevated reception earthwork contract', () => {
    expect(RECEPTION_EARTHWORK.center).toEqual([-110, -30]);
    expect(RECEPTION_EARTHWORK.crestSizeM).toEqual([58, 48]);
    expect(RECEPTION_EARTHWORK.crestElevationM).toBe(10);
    expect(RECEPTION_EARTHWORK.bermWidthM).toBeGreaterThanOrEqual(4);
    expect(RECEPTION_EARTHWORK.toeSlopeRunM).toBeGreaterThanOrEqual(10);
  });

  it('keeps exactly eight centrally addressable zones in process order', () => {
    expect(PLANT_ZONE_ORDER).toEqual(['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6', 'Z7', 'Z8']);
    PLANT_ZONE_ORDER.forEach((zoneId, index) => {
      const zone = getPlantZone(zoneId);
      expect(zone.id).toBe(zoneId);
      expect(zone.width).toBeGreaterThan(0);
      expect(zone.depth).toBeGreaterThan(0);
      expect(Number.isFinite(zone.elevation)).toBe(true);
      const transform = getZoneTransform(zoneId);
      expect(transform.position).toEqual({
        x: zone.position.x,
        y: zone.elevation,
        z: zone.position.z,
      });
      if (index < PLANT_ZONE_ORDER.length - 1) {
        expect(zone.connections).toContain(PLANT_ZONE_ORDER[index + 1]);
      }
    });
    expect(getPlantZone('Z8').connections).toEqual([]);
  });

  it('keeps elevated reception, separated non-adjacent zones and validated adjacent clearances', () => {
    expect(getPlantZone('Z1').elevation).toBe(getZoneElevation('reception'));
    expect(getPlantZone('Z2').elevation).toBeLessThan(getPlantZone('Z1').elevation);
    for (let i = 0; i < PLANT_ZONE_ORDER.length; i += 1) {
      for (let j = i + 1; j < PLANT_ZONE_ORDER.length; j += 1) {
        const a = getPlantZone(PLANT_ZONE_ORDER[i]);
        const b = getPlantZone(PLANT_ZONE_ORDER[j]);
        const connected = a.connections.includes(b.id) || b.connections.includes(a.id);
        if (!connected) expect(overlapArea(a, b), `${a.id}/${b.id}`).toBe(0);
      }
    }
    expect(rectangleGap(getPlantZone('Z1'), getPlantZone('Z2')))
      .toBeGreaterThanOrEqual(PLANT_CLEARANCES.minimumModuleGapM);
    expect(rectangleGap(getPlantZone('Z4'), getPlantZone('Z5')))
      .toBeGreaterThanOrEqual(PLANT_CLEARANCES.minimumModuleGapM);
  });

  it('exposes site-scale bounds that frame the complete process plant', () => {
    const bounds = getPlantLayoutBounds();
    expect(bounds.maxX - bounds.minX).toBeGreaterThan(300);
    expect(bounds.maxZ - bounds.minZ).toBeGreaterThan(100);
    expect(bounds.maxY).toBeGreaterThan(bounds.minY);
  });
});
