import { describe, expect, it } from 'vitest';
import {
  CreateBox,
  NullEngine,
  Scene,
  TransformNode,
} from '@babylonjs/core';
import { applyB83VisualCleanup, classifyB83NodeName } from '../../src/babylon/assets/b83VisualCleanup.js';
import { createBabylonEquipmentInspectionSystem } from '../../src/babylon/inspection/equipmentInspection.js';

describe('B83 visual cleanup and Inspection modes', () => {
  it('classifies debug/duplicate variants separately from true process internals', () => {
    expect(classifyB83NodeName('CV-01_HEAD_PULLEY_ROTATION_WITNESS')).toBe('retired-variant');
    expect(classifyB83NodeName('ROM-HOPPER_TRANSPARENT_BACK')).toBe('retired-variant');
    expect(classifyB83NodeName('SUMP-01_CUT_SIDE')).toBe('retired-variant');
    expect(classifyB83NodeName('SLURRY-PUMP-01_FLUID_VOLUTE')).toBe('inspection-interior');
    expect(classifyB83NodeName('CLASS-01_OVERFLOW_TO_LEACH_FLUID_SEG01')).toBe('inspection-interior');
    expect(classifyB83NodeName('MILL-01_SHELL')).toBeNull();
  });

  it('keeps retired variants hidden while interior fluid is revealable and restores clean Normal', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    const host = new TransformNode('PULPA-LAB-V57-SITE', scene);
    const sump = new TransformNode('SUMP-01_ROOT', scene);
    sump.parent = host;
    sump.metadata = { v57AuthoritativeVisual: true };
    const shell = CreateBox('SUMP-01_SHELL', { size: 4 }, scene);
    shell.parent = sump;
    shell.metadata = { v57AuthoritativeVisual: true };
    const fluid = CreateBox('SUMP-01_INLET_FLUID', { size: 2 }, scene);
    fluid.parent = sump;
    fluid.metadata = { v57AuthoritativeVisual: true };
    const cut = CreateBox('SUMP-01_CUT_SIDE', { size: 2 }, scene);
    cut.parent = sump;
    cut.metadata = { v57AuthoritativeVisual: true };
    const witness = CreateBox('CV-01_HEAD_PULLEY_ROTATION_WITNESS', { size: 1 }, scene);
    witness.parent = sump;
    witness.metadata = { v57AuthoritativeVisual: true };

    const cleanup = applyB83VisualCleanup({ scene, rootNodes: [sump], host });
    expect(fluid.isVisible).toBe(false);
    expect(fluid.metadata.inspectionInterior).toBe(true);
    expect(cut.isVisible).toBe(false);
    expect(cut.metadata.inspectionExcluded).toBe(true);
    expect(witness.isVisible).toBe(false);
    expect(witness.metadata.inspectionExcluded).toBe(true);
    expect(shell.isVisible).toBe(true);

    const inspection = createBabylonEquipmentInspectionSystem({ scene });
    inspection.setTarget('SUMP-01');
    inspection.setMode('transparent');
    expect(fluid.isVisible).toBe(true);
    expect(cut.isVisible).toBe(false);
    expect(witness.isVisible).toBe(false);
    inspection.setMode('interior');
    expect(fluid.isVisible).toBe(true);
    expect(cut.isVisible).toBe(false);
    inspection.setMode('normal');
    expect(fluid.isVisible).toBe(false);
    expect(cut.isVisible).toBe(false);
    expect(shell.isVisible).toBe(true);

    inspection.dispose();
    cleanup.dispose();
    scene.dispose();
    engine.dispose();
  });
});
