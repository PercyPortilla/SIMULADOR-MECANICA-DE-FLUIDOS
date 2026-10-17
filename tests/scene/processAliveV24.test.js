import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BLENDER_REPLACEMENT_SPECS, updateImportedEducationalProcessVisuals } from '../../src/scene/integration/blenderVisualReplacement.js';

describe('V24 Bloque 8 - planta de proceso viva', () => {
  it('declares neutral educational process cues without solver semantics', () => {
    expect(BLENDER_REPLACEMENT_SPECS['SUMP-01'].keepProceduralUpdate).toBe(true);
    expect(BLENDER_REPLACEMENT_SPECS['ELUTION-SKID'].keepProceduralUpdate).not.toBe(true);
    expect(BLENDER_REPLACEMENT_SPECS['ELUTION-SKID'].educationalHostProcessNodes).toHaveLength(2);
    for (const id of ['R-01', 'R-02', 'R-03', 'R-04', 'CIP-ADSORPTION', 'EW-CELLS', 'SMELTING-FURNACE']) {
      expect(BLENDER_REPLACEMENT_SPECS[id].educationalProcessNodes?.length).toBeGreaterThan(0);
    }
  });

  it('animates imported liquid/glow nodes only as tiny visual cues', () => {
    const scene = new THREE.Group();
    const liquid = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 16), new THREE.MeshStandardMaterial());
    liquid.name = 'TEST-LIQUID';
    const glowMaterial = new THREE.MeshStandardMaterial({ emissive: 0xff6600, emissiveIntensity: 2.0 });
    const glow = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), glowMaterial);
    glow.name = 'TEST-GLOW';
    scene.add(liquid, glow);
    const liquidScale = liquid.scale.clone();
    const glowBase = glowMaterial.emissiveIntensity;

    const count = updateImportedEducationalProcessVisuals(scene, [
      { name: 'TEST-LIQUID', mode: 'liquid', phase: 0.4 },
      { name: 'TEST-GLOW', mode: 'glow', phase: 0.8 },
    ], 1.25);

    expect(count).toBe(2);
    expect(Math.abs(liquid.scale.y - liquidScale.y)).toBeGreaterThan(0);
    expect(Math.abs(liquid.scale.y - liquidScale.y)).toBeLessThan(0.006);
    expect(Math.abs(glowMaterial.emissiveIntensity - glowBase)).toBeGreaterThan(0);
    expect(Math.abs(glowMaterial.emissiveIntensity - glowBase)).toBeLessThan(0.25);
    expect(liquid.userData.physicsModel).toBe('neutral-educational-cue');
    expect(glow.userData.physicsModel).toBe('neutral-educational-cue');
  });
});
