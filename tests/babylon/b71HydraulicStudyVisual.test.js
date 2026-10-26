import { CreateBox, NullEngine, Scene, TransformNode } from '@babylonjs/core';
import { describe, expect, it } from 'vitest';
import { applyB71HydraulicStudyVisual } from '../../src/babylon/assets/b71HydraulicStudyVisual.js';

function addBox(scene, parent, name, position, size) {
  const mesh = CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, scene);
  mesh.parent = parent;
  mesh.position.set(...position);
  return mesh;
}

describe('B71 hydraulic study visual', () => {
  it('enhances only the studied wet circuit with concrete, pipe seams and mineral slurry', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    const host = new TransformNode('PULPA-LAB-V57-SITE', scene);
    const root = new TransformNode('V57_FIXTURE_ROOT', scene);

    const sag = addBox(scene, root, 'CIV_SAG_FOUNDATION', [145, 20.69, -90], [42, 1.3, 28]);
    const sumpPad = addBox(scene, root, 'CIV_SUMP_FOUNDATION', [180, 20.34, -90], [22, 0.6, 20]);
    addBox(scene, root, 'CIV_PUMP_FOUNDATION', [205, 20.315, -90], [17, 0.55, 13]);
    addBox(scene, root, 'CIV_CYCLONE_TOWER_FOUNDATION', [232, 20.465, -105], [31, 0.85, 28]);
    const untouched = addBox(scene, root, 'CIV_UNRELATED_FOUNDATION', [320, 20, -90], [10, 1, 10]);

    addBox(scene, root, 'MILL-01_TROMMEL_DISCHARGE', [162.1, 23.6, -90], [19.9, 3.2, 2.5]);
    addBox(scene, root, 'SUMP-01_INLET_PIPE', [174.5, 23.0, -90], [5.0, 0.52, 0.52]);
    addBox(scene, root, 'SUMP-01_SUCTION_NOZZLE', [184.0, 22.0, -90], [2.0, 1.16, 1.16]);
    addBox(scene, root, 'SLURRY-PUMP-01_SUCTION_SEG02', [197.95, 22.1, -90], [9.92, 1.04, 0.84]);
    addBox(scene, root, 'SLURRY-PUMP-01_VOLUTE', [205.0, 22.2, -90], [0.96, 3.32, 3.32]);
    addBox(scene, root, 'SLURRY-PUMP-01_DISCHARGE_PIPE', [205.0, 25.05, -90], [0.96, 3.3, 0.96]);
    addBox(scene, root, 'CLASS-01_FEED_LINE_SEG01', [206.5, 26.7, -90], [3.0, 0.96, 0.96]);
    const slurry = addBox(scene, root, 'SUMP-01_SLURRY', [180.0, 21.84, -90], [5.65, 2.08, 5.65]);

    const visual = applyB71HydraulicStudyVisual({ scene, rootNodes: [root], host });

    expect(visual.concreteMeshes.map((mesh) => mesh.name)).toEqual(expect.arrayContaining([
      'CIV_SAG_FOUNDATION',
      'CIV_SUMP_FOUNDATION',
      'CIV_PUMP_FOUNDATION',
      'CIV_CYCLONE_TOWER_FOUNDATION',
    ]));
    expect(sag.material?.name).toBe('b71-study-industrial-concrete');
    expect(sumpPad.material?.name).toBe('b71-study-industrial-concrete');
    expect(untouched.material?.name).not.toBe('b71-study-industrial-concrete');

    expect(visual.bridges).toHaveLength(3);
    expect(visual.bridges.every((mesh) => mesh.isPickable === false)).toBe(true);
    expect(visual.bridges.every((mesh) => mesh.metadata?.visualOnly === true)).toBe(true);

    expect(slurry.material?.name).toBe('b71-study-mineral-slurry');
    expect(visual.minerals).toHaveLength(0);
    expect(slurry.metadata?.b77LegacyMineralParticlesRetired).toBe(true);
    expect(host.metadata.b71HydraulicStudy).toMatchObject({
      seamBridgeCount: 3,
      mineralParticleCount: 0,
      disseminatedGoldCount: 0,
    });

    visual.dispose();
    scene.dispose();
    engine.dispose();
  });
});
