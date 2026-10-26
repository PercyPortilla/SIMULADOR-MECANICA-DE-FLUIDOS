import {
  CreateBox,
  HemisphericLight,
  NullEngine,
  Scene,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import { describe, expect, it } from 'vitest';
import {
  B78_LAB_FRAMINGS,
  applyB78BernoulliEulerLabVisual,
} from '../../src/babylon/lab/bernoulliEulerLabVisual.js';

function authoredRoot(scene, name, position = [0, 0, 0]) {
  const root = new TransformNode(name, scene);
  root.position.set(...position);
  root.metadata = { v57AuthoritativeVisual: true };
  const mesh = CreateBox(name + '_BODY', { size: 2 }, scene);
  mesh.parent = root;
  mesh.metadata = { v57AuthoritativeVisual: true };
  return { root, mesh };
}

describe('B78 Bernoulli–Euler lab visual', () => {
  it('isolates SUMP→PUMP→CLASS roots, hides legacy extras and restores the scene exactly', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    const host = new TransformNode('PULPA-LAB-V57-SITE', scene);
    const sump = authoredRoot(scene, 'SUMP-01_ROOT', [178, 23, -90]);
    const pump = authoredRoot(scene, 'SLURRY-PUMP-01_ROOT', [207, 24, -90]);
    const klass = authoredRoot(scene, 'CLASS-01_ROOT', [228, 27, -103]);
    const suction = authoredRoot(scene, 'SLURRY-PUMP-01_SUCTION_SHELL_ROOT', [193, 23, -90]);
    const discharge = authoredRoot(scene, 'PIPE-1_ROOT', [219, 28, -96]);
    const unrelated = authoredRoot(scene, 'R-01_ROOT', [268, 30, -88]);
    const rootNodes = [sump.root, pump.root, klass.root, suction.root, discharge.root, unrelated.root];
    rootNodes.forEach((root) => { root.parent = host; });

    const legacySeam = CreateBox('B71_mill-to-sump_SEAM_BRIDGE', { size: 1 }, scene);
    legacySeam.metadata = { b71HydraulicStudy: true, seamBridge: 'mill-to-sump' };
    const unrelatedFoundation = CreateBox('B73_FOUNDATION_R-01', { size: 1 }, scene);
    unrelatedFoundation.metadata = { b73LocalFoundation: true, equipmentId: 'R-01' };
    const slurryBody = CreateBox('B74_sump-to-pump_SLURRY_01', { size: 0.5 }, scene);
    slurryBody.visibility = 0.7;
    slurryBody.metadata = {
      v57AuthoritativeVisual: true,
      slurryFlowBody: true,
      inspectionInterior: true,
      connectionId: 'P-SUMP-TO-PUMP',
    };
    const ambient = new HemisphericLight('ambient-industrial-light', new Vector3(0, 1, 0), scene);
    ambient.intensity = 0.85;

    const lab = applyB78BernoulliEulerLabVisual({ scene, host, rootNodes });
    expect(lab.active).toBe(false);
    expect(B78_LAB_FRAMINGS.overview.center).toEqual([205, 26.5, -96]);
    expect(lab.setActive(true, 'didactic')).toBe(true);
    expect(sump.root.isEnabled()).toBe(true);
    expect(pump.root.isEnabled()).toBe(true);
    expect(klass.root.isEnabled()).toBe(true);
    expect(suction.root.isEnabled()).toBe(true);
    expect(discharge.root.isEnabled()).toBe(true);
    expect(unrelated.root.isEnabled()).toBe(false);
    expect(legacySeam.isVisible).toBe(false);
    expect(unrelatedFoundation.isVisible).toBe(false);
    expect(lab.markers.A.isEnabled()).toBe(true);
    expect(ambient.intensity).toBeCloseTo(0.30, 8);

    lab.setMode('realistic');
    expect(lab.markers.A.isEnabled()).toBe(false);
    lab.setMode('presentation');
    expect(lab.markers.C.isEnabled()).toBe(true);

    // B74/B75 own internal slurry visibility. Simulate their normal-state
    // restore before B78 exits; B78 must not overwrite it with lab visibility.
    slurryBody.visibility = 0.015;
    expect(lab.setActive(false)).toBe(false);
    expect(unrelated.root.isEnabled()).toBe(true);
    expect(legacySeam.isVisible).toBe(true);
    expect(unrelatedFoundation.isVisible).toBe(true);
    expect(slurryBody.visibility).toBeCloseTo(0.015, 8);
    expect(ambient.intensity).toBeCloseTo(0.85, 8);

    lab.dispose();
    scene.dispose();
    engine.dispose();
  });
});

