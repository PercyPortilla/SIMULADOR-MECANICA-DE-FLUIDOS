import { describe, expect, it } from 'vitest';
import {
  createCipAdsorptionTrain,
  createElectrowinningCells,
} from '../../src/scene/equipment/recoveryEquipment.js';
import { collectSceneResourceStats, createBaseScene } from '../../src/scene/baseEnvironment.js';

function resourceStats(group) {
  const geometries = new Set();
  const materials = new Set();
  let meshes = 0;
  group.traverse((object) => {
    if (!object.isMesh) return;
    meshes += 1;
    geometries.add(object.geometry);
    if (Array.isArray(object.material)) object.material.forEach((material) => materials.add(material));
    else materials.add(object.material);
  });
  return { meshes, uniqueGeometries: geometries.size, uniqueMaterials: materials.size };
}

describe('V24F recovery resource reuse', () => {
  it('collects whole-scene resource metrics and preserves instancing for mine context', () => {
    const base = createBaseScene();
    const stats = collectSceneResourceStats(base.environmentRoot);
    expect(stats.objects).toBeGreaterThan(stats.meshes);
    expect(stats.meshes).toBeGreaterThan(100);
    expect(stats.instancedMeshes).toBeGreaterThan(0);
    expect(stats.uniqueGeometries).toBeLessThan(stats.meshes);
    expect(stats.uniqueMaterials).toBeLessThan(stats.meshes);
    expect(base.resourceStats.meshes).toBe(stats.meshes);
  });

  it('reuses immutable resources across repeated CIP vessels', () => {
    const cip = createCipAdsorptionTrain({ position: [0, 0, 0] }).group3D;
    expect(cip.getObjectByName('CIP-ADSORPTION-tank-1').geometry)
      .toBe(cip.getObjectByName('CIP-ADSORPTION-tank-2').geometry);
    expect(cip.getObjectByName('CIP-ADSORPTION-tank-1').material)
      .toBe(cip.getObjectByName('CIP-ADSORPTION-tank-3').material);
    expect(cip.getObjectByName('CIP-ADSORPTION-guard-1').geometry)
      .toBe(cip.getObjectByName('CIP-ADSORPTION-guard-3').geometry);
    const stats = resourceStats(cip);
    expect(stats.meshes).toBeGreaterThanOrEqual(24);
    expect(stats.uniqueGeometries).toBeLessThan(stats.meshes);
    expect(stats.uniqueMaterials).toBeLessThan(stats.meshes);
  });

  it('reuses geometry/material resources across the five EW cells', () => {
    const ew = createElectrowinningCells({ position: [0, 0, 0] }).group3D;
    expect(ew.getObjectByName('EW-CELLS-cell-1').geometry)
      .toBe(ew.getObjectByName('EW-CELLS-cell-5').geometry);
    expect(ew.getObjectByName('EW-CELLS-cell-rim-1').material)
      .toBe(ew.getObjectByName('EW-CELLS-cell-rim-5').material);
    expect(ew.getObjectByName('EW-CELLS-electrode-1-1').geometry)
      .toBe(ew.getObjectByName('EW-CELLS-electrode-5-1').geometry);
    const stats = resourceStats(ew);
    expect(stats.meshes).toBeGreaterThanOrEqual(26);
    expect(stats.uniqueGeometries).toBeLessThan(stats.meshes);
    expect(stats.uniqueMaterials).toBeLessThan(stats.meshes);
  });
});
