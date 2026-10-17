import { describe, expect, it } from 'vitest';
import { EQUIPMENT_CATALOG } from '../../src/equipment/catalog/equipmentCatalog.js';

const REQUIRED_METHODS = [
  'create', 'update', 'setAnimationEnabled', 'setInspectionMode',
  'getPorts', 'getDimensions', 'getBoundingBox', 'dispose',
];

describe('Equipment Catalog V1', () => {
  it('contains the 15 approved isolated equipment families', () => {
    expect(EQUIPMENT_CATALOG).toHaveLength(15);
  });

  for (const entry of EQUIPMENT_CATALOG) {
    it(`${entry.key} exposes the isolated asset contract`, () => {
      const asset = entry.create();
      expect(asset.root.position.toArray()).toEqual([0, 0, 0]);
      for (const method of REQUIRED_METHODS) expect(typeof asset[method]).toBe('function');
      const dims = asset.getDimensions();
      expect(dims.length).toBeGreaterThan(0);
      expect(dims.width).toBeGreaterThan(0);
      expect(dims.height).toBeGreaterThan(0);
      expect(asset.metadata.referenceClass).toBeTruthy();
      expect(Array.isArray(asset.getPorts())).toBe(true);
      asset.dispose();
    });
  }

  it('ports remain attached to asset transforms', () => {
    const asset = EQUIPMENT_CATALOG.find((item) => item.key === 'slurryPump').create();
    const before = asset.getPorts()[0].position.clone();
    asset.root.position.set(5, 2, -3);
    asset.root.rotation.y = Math.PI / 2;
    const after = asset.getPorts()[0].position.clone();
    expect(after.distanceTo(before)).toBeGreaterThan(1);
    asset.dispose();
  });
});
