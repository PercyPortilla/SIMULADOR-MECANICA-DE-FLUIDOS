import { describe, expect, it } from 'vitest';
import {
  PLANT_ZONE_ORDER,
  getPlantLayoutBounds,
  getPlantZone,
  getZoneTransform,
} from '../../src/scene/layout/plantLayout.js';
import { getZoneElevation } from '../../src/scene/environment/terrainHeight.js';

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

describe('plant master layout', () => {
  it('defines exactly eight centrally addressable zones in process order', () => {
    expect(PLANT_ZONE_ORDER).toEqual(['Z1', 'Z2', 'Z3', 'Z4', 'Z5', 'Z6', 'Z7', 'Z8']);
    PLANT_ZONE_ORDER.forEach((zoneId) => {
      const zone = getPlantZone(zoneId);
      expect(zone.id).toBe(zoneId);
      expect(zone.width).toBeGreaterThan(0);
      expect(zone.depth).toBeGreaterThan(0);
      expect(Number.isFinite(zone.elevation)).toBe(true);
    });
  });

  it('keeps the logical process flow in one direction without duplicate coordinate sources', () => {
    for (let index = 0; index < PLANT_ZONE_ORDER.length - 1; index += 1) {
      const zone = getPlantZone(PLANT_ZONE_ORDER[index]);
      expect(zone.connections).toContain(PLANT_ZONE_ORDER[index + 1]);
      const transform = getZoneTransform(zone.id);
      expect(transform.position.x).toBe(zone.position.x);
      expect(transform.position.z).toBe(zone.position.z);
      expect(transform.position.y).toBe(zone.elevation);
    }
    expect(getPlantZone('Z8').connections).toEqual([]);
  });

  it('uses the elevated reception and gives leaching the largest footprint', () => {
    expect(getPlantZone('Z1').elevation).toBe(getZoneElevation('reception'));
    expect(getPlantZone('Z2').elevation).toBeLessThan(getPlantZone('Z1').elevation);
    const areas = PLANT_ZONE_ORDER.map((zoneId) => {
      const zone = getPlantZone(zoneId);
      return [zoneId, zone.width * zone.depth];
    });
    const largest = areas.reduce((best, current) => current[1] > best[1] ? current : best);
    expect(largest[0]).toBe('Z8');
  });

  it('does not overlap temporary zone footprints', () => {
    for (let i = 0; i < PLANT_ZONE_ORDER.length; i += 1) {
      for (let j = i + 1; j < PLANT_ZONE_ORDER.length; j += 1) {
        const a = getPlantZone(PLANT_ZONE_ORDER[i]);
        const b = getPlantZone(PLANT_ZONE_ORDER[j]);
        const connected = a.connections.includes(b.id) || b.connections.includes(a.id);
        if (!connected) expect(overlapArea(a, b)).toBe(0);
      }
    }
  });

  it('exposes bounds wide enough to frame the complete plant', () => {
    const bounds = getPlantLayoutBounds();
    expect(bounds.maxX - bounds.minX).toBeGreaterThan(90);
    expect(bounds.maxZ - bounds.minZ).toBeGreaterThan(40);
    expect(bounds.maxY).toBeGreaterThan(bounds.minY);
  });
});
