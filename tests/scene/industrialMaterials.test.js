import { describe, expect, it } from 'vitest';
import {
  applyIndustrialPaletteToScene,
  createIndustrialMaterial,
  createPipeMaterial,
  resetIndustrialPalette,
  SURFACE_MATERIAL_PROFILES,
} from '../../src/scene/materials/industrialMaterials.js';
import * as THREE from 'three';

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

  it('uses distinct multi-scale surface profiles so soil, road and concrete do not tile in lockstep', () => {
    const terrain = createIndustrialMaterial('terrain');
    const road = createIndustrialMaterial('road');
    const concrete = createIndustrialMaterial('concrete');
    for (const [role, material] of [['terrain', terrain], ['road', road], ['concrete', concrete]]) {
      const profile = SURFACE_MATERIAL_PROFILES[role];
      expect(material.userData.surfaceProfile).toEqual(profile);
      expect(new Set([
        profile.albedoRepeat.join('x'),
        profile.roughnessRepeat.join('x'),
        profile.bumpRepeat.join('x'),
      ]).size).toBe(3);
      expect(material.bumpScale).toBeCloseTo(profile.bumpScale, 8);
    }
    expect(SURFACE_MATERIAL_PROFILES.terrain.albedoRepeat).not.toEqual(SURFACE_MATERIAL_PROFILES.road.albedoRepeat);
    expect(SURFACE_MATERIAL_PROFILES.road.albedoRepeat).not.toEqual(SURFACE_MATERIAL_PROFILES.concrete.albedoRepeat);
  });

  it('keeps dark steel readable while preserving contrast with process steel and belts', () => {
    const darkSteel = createIndustrialMaterial('darkSteel');
    const processSteel = createIndustrialMaterial('processSteel');
    const belt = createIndustrialMaterial('conveyorBelt');
    const luminanceProxy = (material) => material.color.r + material.color.g + material.color.b;

    expect(luminanceProxy(darkSteel)).toBeGreaterThan(luminanceProxy(belt));
    expect(luminanceProxy(processSteel)).toBeGreaterThan(luminanceProxy(darkSteel));
  });

  it('can lock specialized civil colors against global scene-palette recoloring', () => {
    const material = createIndustrialMaterial('terrain', { color: 0x6a5b4a, preserveColor: true });
    const original = material.color.getHex();
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material));
    try {
      applyIndustrialPaletteToScene(root, { terrain: 0xf0dfbf });
      expect(material.userData.paletteColorLocked).toBe(true);
      expect(material.color.getHex()).toBe(original);
    } finally {
      resetIndustrialPalette();
    }
  });
});
