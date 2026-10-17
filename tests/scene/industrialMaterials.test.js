import { describe, expect, it } from 'vitest';
import { createIndustrialMaterial, createPipeMaterial } from '../../src/scene/materials/industrialMaterials.js';

describe('industrial materials', () => {
  it('differentiates concrete and structural steel physically', () => {
    const concrete = createIndustrialMaterial('concrete');
    const steel = createIndustrialMaterial('structuralSteel');
    expect(concrete.metalness).toBe(0);
    expect(concrete.roughness).toBeGreaterThan(0.85);
    expect(steel.metalness).toBeGreaterThan(0.5);
    expect(steel.roughness).toBeLessThan(concrete.roughness);
  });

  it('keeps HDPE visually non-metallic and steel pipe metallic', () => {
    const hdpe = createPipeMaterial('HDPE');
    const steel = createPipeMaterial('acero');
    expect(hdpe.metalness).toBeLessThan(0.1);
    expect(steel.metalness).toBeGreaterThan(0.5);
  });

  it('keeps terrain and road surfaces highly rough and non-metallic for mine-scale readability', () => {
    const terrain = createIndustrialMaterial('terrain');
    const road = createIndustrialMaterial('road');
    expect(terrain.roughness).toBeGreaterThanOrEqual(0.98);
    expect(road.roughness).toBe(1);
    expect(terrain.metalness).toBe(0);
    expect(road.metalness).toBe(0);
    expect(terrain.bumpScale).toBeLessThan(0.11);
  });

  it('keeps dark steel readable while preserving contrast with process steel and belts', () => {
    const darkSteel = createIndustrialMaterial('darkSteel');
    const processSteel = createIndustrialMaterial('processSteel');
    const belt = createIndustrialMaterial('conveyorBelt');
    const luminanceProxy = (material) => material.color.r + material.color.g + material.color.b;

    expect(luminanceProxy(darkSteel)).toBeGreaterThan(luminanceProxy(belt));
    expect(luminanceProxy(processSteel)).toBeGreaterThan(luminanceProxy(darkSteel));
  });
});
