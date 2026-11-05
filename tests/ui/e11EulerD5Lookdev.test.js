import { describe, it, expect, vi } from 'vitest';
import {
  applyE11EulerD5Lookdev,
  classifyE11EulerSurface,
  E11_EULER_D5_PROFILE,
} from '../../src/babylon/assets/e11EulerD5Lookdev.js';

function sampleMaterial(name, { metallic = .86, roughness = .27, alpha = 1, fails = false } = {}) {
  return {
    name, metallic, roughness, alpha,
    clone: vi.fn(function (cloneName) {
      if (fails) throw Error('CLONE_FAILED');
      return {
        ...this, name: cloneName,
        albedoColor: { scale: vi.fn(n => ({ scaledBy: n })) },
        dispose: vi.fn(),
      };
    }),
  };
}

function source() {
  const satin = sampleMaterial('L53B_CYCLONE_00_SILVER_SATIN_PBR_EDUCATIONAL');
  const steel = sampleMaterial('L20_OPTIONC_cast_pump_graphite');
  const slurry = sampleMaterial('MAT_V57_B51_SLURRY_CORE', { alpha: .86 });
  const meshes = [
    { name: 'CLASS-01_CYCLONE_00_BARREL_LAB', material: satin },
    { name: 'CLASS-01_CYCLONE_01_BARREL_LAB', material: satin },
    { name: 'SLURRY-PUMP-01_CASING_LAB', material: steel },
    { name: 'SUMP-01_SLURRY_SURFACE_LAB', material: slurry },
  ];
  const lights = [
    { name: 'ambient-industrial-light', intensity: .85 },
    { name: 'mine-sun-key-light', intensity: 1.65 },
    { name: 'unrelated-light', intensity: .4 },
  ];
  const processing = { exposure: 1.05, contrast: 1.12 };
  return { scene: { lights, imageProcessingConfiguration: processing },
    container: { meshes }, satin, steel, slurry, lights, processing, meshes };
}

describe('E11 D5 visual upgrade isolated to the authentic Euler container', () => {
  it('classifies only opaque physical surfaces, not slurry or transparent educational signals', () => {
    expect(classifyE11EulerSurface('L53B_CYCLONE_00_SILVER_SATIN_PBR_EDUCATIONAL')).toBe('satin');
    expect(classifyE11EulerSurface('MAT_V57_CIVIL_CONCRETE')).toBe('mineral');
    expect(classifyE11EulerSurface('MAT_V57_SLURRY_PIPE')).toBe('structural');
    expect(classifyE11EulerSurface('MAT_V57_B51_SLURRY_CORE')).toBeNull();
    expect(classifyE11EulerSurface('MAT_V57_CLASS_AIR_CORE')).toBeNull();
    expect(classifyE11EulerSurface('MAT_V57_SAG_TRANSPARENT')).toBeNull();
  });

  it('clones PBR once per unique material, leaves signed GLB instances and flow untouched', () => {
    const t = source();
    const originalMats = t.meshes.map(mesh => mesh.material);
    const look = applyE11EulerD5Lookdev(t);
    expect(look.status).toMatchObject({ active: true, tunedMeshes: 3,
      clonedMaterials: 2, adjustedLights: 2,
      originalMaterialsUnchanged: true, uiModified: false, solverModified: false });
    expect(t.meshes[0].material).toBe(t.meshes[1].material);
    expect(t.meshes[0].material).not.toBe(t.satin);
    expect(t.meshes[0].material.roughness).toBe(.47);
    expect(t.meshes[0].material.metallic).toBe(.68);
    expect(t.satin.roughness).toBe(.27);
    expect(t.satin.metallic).toBe(.86);
    expect(t.meshes[3].material).toBe(t.slurry);
    expect(t.slurry.clone).not.toHaveBeenCalled();
    expect(t.processing.exposure).toBe(E11_EULER_D5_PROFILE.exposure);
    expect(t.lights[2].intensity).toBe(.4);
    const clones = t.meshes.slice(0, 3).map(mesh => mesh.material);
    look.restore();
    expect(t.meshes.map(mesh => mesh.material)).toEqual(originalMats);
    expect(clones[0].dispose).toHaveBeenCalledOnce();
    expect(clones[2].dispose).toHaveBeenCalledOnce();
    expect(t.processing).toEqual({ exposure: 1.05, contrast: 1.12 });
    expect(t.lights.map(light => light.intensity)).toEqual([.85, 1.65, .4]);
    expect(look.status.active).toBe(false);
    look.restore(); // repeated exits never dispose twice
    expect(clones[0].dispose).toHaveBeenCalledOnce();
  });

  it('restores illumination, exposure and all materials even after a clone exception', () => {
    const t = source();
    t.meshes[2].material = sampleMaterial('L20_OPTIONC_cast_pump_graphite', { fails: true });
    const originals = t.meshes.map(mesh => mesh.material);
    expect(() => applyE11EulerD5Lookdev(t)).toThrow('CLONE_FAILED');
    expect(t.meshes.map(mesh => mesh.material)).toEqual(originals);
    expect(t.processing).toEqual({ exposure: 1.05, contrast: 1.12 });
    expect(t.lights.map(light => light.intensity)).toEqual([.85, 1.65, .4]);
  });

  it('never assigns to Babylon mesh instances; only the source mesh owns the material', () => {
    const t = source();
    const instance = {
      name: 'CLASS-01_INSTANCED_BOLT', isAnInstance: true,
      sourceMesh: t.meshes[0],
      get material() { return t.satin; },
      set material(_value) { throw Error('SHOULD_NOT_ASSIGN_INSTANCE_MATERIAL'); },
    };
    t.container.meshes.push(instance);
    const look = applyE11EulerD5Lookdev(t);
    expect(look.status.tunedMeshes).toBe(3);
    look.restore();
    expect(instance.material).toBe(t.satin);
  });
});
