import { NullEngine, Scene, TransformNode } from '@babylonjs/core';
import { describe, expect, it } from 'vitest';
import { applyB87HydraulicRigVisual } from '../../src/babylon/lab/b87HydraulicRigVisual.js';

describe('B87 Bernoulli–Euler hydraulic rig visual', () => {
  it('builds a dedicated industrial accessory set without process/solver dependencies', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    const parent = new TransformNode('LAB_PARENT', scene);

    const rig = applyB87HydraulicRigVisual({ scene, parent });
    expect(rig.root.parent).toBe(parent);
    expect(rig.reducer.metadata.labAccessoryType).toBe('reducer');
    expect(rig.valve.body.metadata.labAccessoryType).toBe('valve');
    expect(rig.suctionWindow.glass.metadata.connectionId).toBe('P-SUMP-TO-PUMP');
    expect(rig.dischargeWindow.glass.metadata.connectionId).toBe('P-PUMP-TO-CYCLONES');
    expect(rig.supports).toHaveLength(4);
    expect(rig.grid.length).toBeGreaterThan(10);
    expect(scene.meshes.every((mesh) => mesh.metadata?.bernoulliEulerLab === true)).toBe(true);

    const realisticAlpha = rig.materials.glass.alpha;
    rig.setMode('didactic');
    expect(rig.materials.glass.alpha).toBeGreaterThan(realisticAlpha);
    rig.setMode('presentation');
    expect(rig.materials.glass.alpha).toBeGreaterThan(0.5);

    rig.dispose();
    scene.dispose();
    engine.dispose();
  });
});
