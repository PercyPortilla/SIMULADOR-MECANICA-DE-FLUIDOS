import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  BLENDER_REPLACEMENT_SPECS,
  cloneBlenderReplacementSource,
  shouldCastImportedShadow,
} from '../../src/scene/integration/blenderVisualReplacement.js';
import { createIntegratedPlant } from '../../src/scene/integration/integratedPlant.js';

describe('Blender visual replacements', () => {
  it('registers rheology-core and leaching GLB assets', () => {
    expect(Object.keys(BLENDER_REPLACEMENT_SPECS)).toEqual([
      'ROM-HOPPER',
      'APRON-FEEDER',
      'PRIMARY-CRUSHER',
      'STOCKPILE-RECLAIM',
      'EXCAVATOR-01',
      'TRUCK-01',
      'LOADER-01',
      'MILL-01',
      'SUMP-01',
      'SLURRY-PUMP-01',
      'CLASS-01',
      'R-01',
      'R-02',
      'R-03',
      'R-04',
      'PUMP-01',
      'CIP-ADSORPTION',
      'ELUTION-SKID',
      'EW-CELLS',
      'SMELTING-FURNACE',
    ]);
    Object.values(BLENDER_REPLACEMENT_SPECS).forEach((spec) => {
      expect(spec.url).toMatch(/^models\/pulpa-blender\/.+\.glb$/);
    });
  });

  it('keeps procedural fallback active outside a browser', () => {
    const plant = createIntegratedPlant();
    for (const id of [
      'ROM-HOPPER',
      'APRON-FEEDER',
      'PRIMARY-CRUSHER',
      'STOCKPILE-RECLAIM',
      'MILL-01',
      'SUMP-01',
      'SLURRY-PUMP-01',
      'CLASS-01',
      'R-01',
      'R-02',
      'R-03',
      'R-04',
      'PUMP-01',
      'CIP-ADSORPTION',
      'ELUTION-SKID',
      'EW-CELLS',
      'SMELTING-FURNACE',
    ]) {
      const equipment = plant.getEquipment(id);
      expect(equipment.group3D.userData.blenderReplacement).toBe(true);
      expect(equipment.group3D.userData.blenderVisualStatus).toBe('ssr-fallback');
    }
  });

  it('keeps haul-truck dynamics under semantic control instead of a canned clip', () => {
    expect(BLENDER_REPLACEMENT_SPECS['TRUCK-01'].semanticControl).toBe('haul-truck');
    expect(BLENDER_REPLACEMENT_SPECS['EXCAVATOR-01'].playAllAnimations).toBe(true);
    expect(BLENDER_REPLACEMENT_SPECS['LOADER-01'].playAllAnimations).toBe(true);
  });

  it('preserves the cyclone process-flow overlay when the static Blender shell loads', () => {
    const spec = BLENDER_REPLACEMENT_SPECS['CLASS-01'];
    expect(spec.keepProceduralUpdate).toBe(true);
    expect(spec.preserveProceduralOverlays).toContain('cyclone-1-swirl');
    expect(spec.preserveProceduralOverlays).toContain('cyclone-manifold-suspended-solids');
  });

  it('maps shovel and loader ore loads onto their Blender nodes', () => {
    expect(BLENDER_REPLACEMENT_SPECS['EXCAVATOR-01'].materialLoadNode).toBe('MINING-SHOVEL_BUCKET_ORE');
    expect(BLENDER_REPLACEMENT_SPECS['LOADER-01'].materialLoadNode).toBe('WHEEL-LOADER_BUCKET_ORE');
  });

  it('keeps instance transforms independent while sharing immutable GLB resources', () => {
    const source = new THREE.Group();
    const pivot = new THREE.Group();
    pivot.name = 'animated-pivot';
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'shared-mesh';
    pivot.add(mesh);
    source.add(pivot);

    const first = cloneBlenderReplacementSource(source);
    const second = cloneBlenderReplacementSource(source);
    first.getObjectByName('animated-pivot').rotation.x = 0.75;

    expect(second.getObjectByName('animated-pivot').rotation.x).toBeCloseTo(0, 10);
    expect(first.getObjectByName('shared-mesh').geometry).toBe(geometry);
    expect(second.getObjectByName('shared-mesh').geometry).toBe(geometry);
    expect(first.getObjectByName('shared-mesh').material).toBe(material);
    expect(second.getObjectByName('shared-mesh').material).toBe(material);

    geometry.dispose();
    material.dispose();
  });

  it('keeps shadows on major equipment while skipping tiny repeated details', () => {
    expect(shouldCastImportedShadow({ name: 'PRIMARY-CRUSHER_MOVING_JAW' })).toBe(true);
    expect(shouldCastImportedShadow({ name: 'MILL-01_SHELL' })).toBe(true);
    expect(shouldCastImportedShadow({ name: 'LEACH-REACTOR_LADDER_RUNG_12' })).toBe(false);
    expect(shouldCastImportedShadow({ name: 'CIP-ADSORPTION_RAIL_POST_95.0_2.95' })).toBe(false);
    expect(shouldCastImportedShadow({ name: 'PRIMARY-CRUSHER_FLYWHEEL_SPOKE_02_4' })).toBe(false);
    expect(shouldCastImportedShadow({ name: 'SLURRY-PUMP-01_DETAIL_MOTOR_FIN_05' })).toBe(false);
  });
});
