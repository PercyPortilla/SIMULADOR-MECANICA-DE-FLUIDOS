import { describe, expect, it } from 'vitest';
import {
  CreateBox,
  CreateGround,
  NullEngine,
  Scene,
  TransformNode,
} from '@babylonjs/core';
import {
  applyB73FoundationVisual,
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
      'CIV_LEACH_BASE',
      'CIV_CIP_BASE',
      'CIV_ELUTION_BASE',
      'CIV_EW_BASE',
      'CIV_SMELTING_BASE',
      'PUMP-01_FOUNDATION',
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
    const dimensions = resolveB73FoundationDimensions(spec, { x: 10.7, z: 5.0 });
    expect(dimensions.widthM).toBeCloseTo(12.4, 6);
    expect(dimensions.depthM).toBe(spec.minDepthM);
    expect(dimensions.widthM * dimensions.depthM).toBeLessThan(250);
  });

  it('never clamps a foundation smaller than its actual support footprint plus margin', () => {
    const spec = B73_FOUNDATION_SPECS.find((entry) => entry.id === 'MILL-01');
    const dimensions = resolveB73FoundationDimensions(spec, { x: 28, z: 20 });
    expect(dimensions.widthM).toBeGreaterThanOrEqual(28 + spec.marginM * 2);
    expect(dimensions.depthM).toBeGreaterThanOrEqual(20 + spec.marginM * 2);
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

  it('centers B80 foundations on load-bearing V57 meshes and creates six local CIP bases', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    const host = new TransformNode('site-host', scene);
    const imported = new TransformNode('imported-root', scene);
    imported.parent = host;
    const terrain = CreateGround('V57_TERRAIN_INTEGRATED', { width: 1200, height: 800, subdivisions: 2 }, scene);
    terrain.position.y = 0;
    terrain.parent = imported;

    const addSupport = (name, position, size) => {
      const mesh = CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, scene);
      mesh.position.set(...position);
      mesh.parent = imported;
      mesh.metadata = { v57AuthoritativeVisual: true };
      return mesh;
    };

    addSupport('ELUTION-SKID_FRAME', [430, 2, -162], [15, 0.55, 8]);
    [
      [474.8, -159.5], [479.6, -159.5], [484.4, -159.5], [489.2, -159.5],
      [474.8, -164.5], [479.6, -164.5], [484.4, -164.5], [489.2, -164.5],
    ].forEach(([x, z], index) => {
      addSupport(`EW-CELL-${String(index + 1).padStart(2, '0')}-TANK`, [x, 2, z], [3.8, 1.8, 1.9]);
    });
    const cipCenters = [
      [365, -88], [392, -88], [419, -88],
      [419, -120], [392, -120], [365, -120],
    ];
    cipCenters.forEach(([x, z], index) => {
      addSupport(`CIP-${String(index + 1).padStart(2, '0')}_BOTTOM`, [x, 1, z], [9.66, 0.36, 9.66]);
    });
    const authoredSmelting = addSupport('SMELTING-FOUNDATION-V57', [482, 0.25, -205], [22, 0.24, 16]);

    const visual = applyB73FoundationVisual({ scene, rootNodes: [imported], host });
    expect(visual.foundations.get('ELUTION-SKID').position.x).toBeCloseTo(430, 6);
    expect(visual.foundations.get('EW-CELLS').position.x).toBeCloseTo(482, 6);
    cipCenters.forEach(([x, z], index) => {
      const key = `CIP-ADSORPTION-${String(index + 1).padStart(2, '0')}`;
      const foundation = visual.foundations.get(key);
      expect(foundation).toBeTruthy();
      expect(foundation.position.x).toBeCloseTo(x, 6);
      expect(foundation.position.z).toBeCloseTo(z, 6);
      expect(foundation.metadata.diameterM).toBeCloseTo(9.66 + 1.4, 6);
    });
    expect([...visual.foundations.keys()].filter((key) => key.startsWith('CIP-ADSORPTION-'))).toHaveLength(6);
    expect(visual.foundations.get('SMELTING-FURNACE')).toBe(authoredSmelting);
    expect(authoredSmelting.metadata.b73ReusedAuthoredFoundation).toBe(true);

    visual.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('fails closed when a focused support selector is missing instead of falling back to huge equipment bounds', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    const host = new TransformNode('site-host', scene);
    const imported = new TransformNode('imported-root', scene);
    imported.parent = host;
    CreateGround('V57_TERRAIN_INTEGRATED', { width: 1200, height: 800, subdivisions: 2 }, scene).parent = imported;

    const hugeMill = CreateBox('MILL-01_ROOT', { width: 180, height: 30, depth: 110 }, scene);
    hugeMill.position.set(150, 18, -90);
    hugeMill.parent = imported;
    hugeMill.metadata = { v57AuthoritativeVisual: true };

    const visual = applyB73FoundationVisual({ scene, rootNodes: [imported], host });
    expect(visual.foundations.has('MILL-01')).toBe(false);
    expect(visual.skipped).toContain('MILL-01');

    visual.dispose();
    scene.dispose();
    engine.dispose();
  });
});
