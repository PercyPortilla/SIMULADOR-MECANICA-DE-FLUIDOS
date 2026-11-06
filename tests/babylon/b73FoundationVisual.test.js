import { describe, expect, it } from 'vitest';
import {
  B73_FOUNDATION_SPECS,
  B73_SUPERSEDED_CONTINUOUS_FOUNDATIONS,
  computeB73FoundationThickness,
  computeB73FoundationTopY,
  resolveB73FoundationDimensions,
} from '../../src/babylon/assets/b73FoundationVisual.js';

describe('B73 local equipment foundations', () => {
  it('retires the oversized V49 and legacy CIV process slabs replaced by local B73/B76 foundations', () => {
    expect(B73_SUPERSEDED_CONTINUOUS_FOUNDATIONS).toEqual([
      'V49_PAD_RECOVERY',
      'V49_PAD_LEACH_CIP',
      'V49_PAD_CLASS_PUMP',
      'V49_PAD_SUMP',
      'V49_PAD_MILL',
      'CIV_SAG_FOUNDATION',
      'CIV_SUMP_FOUNDATION',
      'CIV_PUMP_FOUNDATION',
      'CIV_CYCLONE_TOWER_FOUNDATION',
    ]);
  });

  it('defines discrete foundations for the wet-process and recovery equipment only', () => {
    const ids = B73_FOUNDATION_SPECS.map((spec) => spec.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining([
      'MILL-01',
      'SUMP-01',
      'SLURRY-PUMP-01',
      'CLASS-01',
      'R-01',
      'R-02',
      'R-03',
      'R-04',
      'CIP-ADSORPTION',
      'ELUTION-SKID',
      'EW-CELLS',
      'SMELTING-FURNACE',
    ]));
    expect(ids).not.toContain('PUMP-01');
  });

  it('keeps dynamic pads bounded instead of recreating a plant-wide slab', () => {
    const spec = B73_FOUNDATION_SPECS.find((entry) => entry.id === 'MILL-01');
    const dimensions = resolveB73FoundationDimensions(spec, { x: 28, z: 20 });
    expect(dimensions.widthM).toBe(spec.maxWidthM);
    expect(dimensions.depthM).toBe(spec.maxDepthM);
    expect(dimensions.widthM * dimensions.depthM).toBeLessThan(250);
  });

  it('uses circular local foundations for the leach reactors', () => {
    const spec = B73_FOUNDATION_SPECS.find((entry) => entry.id === 'R-01');
    const dimensions = resolveB73FoundationDimensions(spec, { x: 10, z: 12 });
    expect(dimensions.shape).toBe('cylinder');
    expect(dimensions.diameterM).toBeGreaterThanOrEqual(spec.minDiameterM);
    expect(dimensions.diameterM).toBeLessThanOrEqual(spec.maxDiameterM);
  });

  it('never lets a foundation top cut through the equipment envelope', () => {
    expect(computeB73FoundationTopY({
      equipmentMinY: 25.20,
      terrainSamples: [25.05, 25.08, 25.02],
      revealM: 0.06,
    })).toBeCloseTo(25.14, 6);

    expect(computeB73FoundationTopY({
      equipmentMinY: 25.10,
      terrainSamples: [25.08, 25.12],
      revealM: 0.06,
    })).toBeCloseTo(25.075, 6);
  });

  it('deepens the embedded slab when local terrain relief increases', () => {
    const flat = computeB73FoundationThickness({
      baseThicknessM: 0.40,
      terrainSamples: [25.0, 25.03, 25.01],
      revealM: 0.06,
    });
    const sloped = computeB73FoundationThickness({
      baseThicknessM: 0.40,
      terrainSamples: [25.0, 25.42, 25.18],
      revealM: 0.06,
    });
    expect(flat).toBeCloseTo(0.40, 6);
    expect(sloped).toBeGreaterThan(flat);
    expect(sloped).toBeLessThanOrEqual(0.90);
  });
});
