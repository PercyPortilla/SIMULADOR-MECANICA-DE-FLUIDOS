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
  BERNOULLI_EULER_LAB_FRAMINGS,
  applyBernoulliEulerLabVisual,
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
    const plantRoot = new TransformNode('V57_SHARED_GLTF_ROOT', scene);
    plantRoot.parent = host;
    plantRoot.metadata = { v57AuthoritativeVisual: true };
    const rootNodes = [plantRoot];
    [sump.root, pump.root, klass.root, suction.root, discharge.root, unrelated.root]
      .forEach((root) => { root.parent = plantRoot; });

    const legacySeam = CreateBox('B71_mill-to-sump_SEAM_BRIDGE', { size: 1 }, scene);
    legacySeam.metadata = { b71HydraulicStudy: true, seamBridge: 'mill-to-sump' };
    const unrelatedFoundation = CreateBox('B73_FOUNDATION_R-01', { size: 1 }, scene);
    unrelatedFoundation.metadata = { b73LocalFoundation: true, equipmentId: 'R-01' };
    const terrainApron = CreateBox('B80_TERRAIN_EDGE_CONTINUATION_TEST', { size: 1 }, scene);
    terrainApron.metadata = { b80TerrainEdgeContinuation: true };
    const processBridge = CreateBox('B81_CLASS-OVERFLOW-TO-R01_SEG01', { size: 1 }, scene);
    processBridge.metadata = { b81ProcessContinuity: true };
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

    const legacyRoot = new TransformNode('B78-BERNOULLI-EULER-LAB', scene);
    const legacyMesh = CreateBox('B78_LEGACY_LAB_MESH', { size: 1 }, scene);
    legacyMesh.parent = legacyRoot;

    const lab = applyBernoulliEulerLabVisual({ scene, host, rootNodes });
    expect(lab.active).toBe(false);
    expect(legacyRoot.isDisposed()).toBe(true);
    expect(legacyMesh.isDisposed()).toBe(true);
    expect(lab.root.name).toBe('BERNOULLI-EULER-LAB');
    const originalClearColor = scene.clearColor.clone();
    expect(BERNOULLI_EULER_LAB_FRAMINGS.overview.center).toEqual([205, 26.5, -96]);
    expect(lab.setActive(true, 'didactic')).toBe(true);
    expect(sump.root.isEnabled()).toBe(true);
    expect(pump.root.isEnabled()).toBe(true);
    expect(klass.root.isEnabled()).toBe(true);
    expect(suction.root.isEnabled()).toBe(true);
    expect(discharge.root.isEnabled()).toBe(true);
    expect(plantRoot.isEnabled()).toBe(true);
    expect(unrelated.root.isEnabled()).toBe(true);
    expect(unrelated.mesh.isVisible).toBe(false);
    expect(legacySeam.isVisible).toBe(false);
    expect(unrelatedFoundation.isVisible).toBe(false);
    expect(terrainApron.isVisible).toBe(false);
    expect(processBridge.isVisible).toBe(false);
    expect(lab.markers.A.isEnabled()).toBe(true);
    expect(lab.markerLabels.A.label.isEnabled()).toBe(true);
    expect(lab.markers.A.position.asArray()).toEqual([184, 22.15, -90]);
    expect(lab.markers.B.position.asArray()).toEqual([205, 25.15, -90]);
    expect(lab.markers.C.position.asArray()).toEqual([228.2, 26.95, -103.1]);
    expect(ambient.isEnabled()).toBe(false);
    expect(scene.fogEnabled).toBe(false);
    expect(scene.clearColor.r).toBeCloseTo(0.018, 8);

    lab.setMode('realistic');
    expect(lab.markers.A.isEnabled()).toBe(false);
    expect(lab.markerLabels.A.label.isEnabled()).toBe(false);
    lab.setMode('presentation');
    expect(lab.markers.C.isEnabled()).toBe(true);

    // B74/B75 own internal slurry visibility. Simulate their normal-state
    // restore before B78 exits; B78 must not overwrite it with lab visibility.
    slurryBody.visibility = 0.015;
    expect(lab.setActive(false)).toBe(false);
    expect(unrelated.root.isEnabled()).toBe(true);
    expect(unrelated.mesh.isVisible).toBe(true);
    expect(legacySeam.isVisible).toBe(true);
    expect(unrelatedFoundation.isVisible).toBe(true);
    expect(terrainApron.isVisible).toBe(true);
    expect(processBridge.isVisible).toBe(true);
    expect(slurryBody.visibility).toBeCloseTo(0.015, 8);
    expect(ambient.intensity).toBeCloseTo(0.85, 8);
    expect(ambient.isEnabled()).toBe(true);
    expect(scene.clearColor.asArray()).toEqual(originalClearColor.asArray());

    // Re-entry must not accumulate hidden state, stale lights or legacy roots.
    expect(lab.setActive(true, 'presentation')).toBe(true);
    expect(unrelated.mesh.isVisible).toBe(false);
    expect(lab.setActive(false)).toBe(false);
    expect(unrelated.mesh.isVisible).toBe(true);
    expect(ambient.isEnabled()).toBe(true);
    expect(scene.clearColor.asArray()).toEqual(originalClearColor.asArray());
    expect(scene.transformNodes.filter((node) => node.name === 'BERNOULLI-EULER-LAB')).toHaveLength(1);

    lab.dispose();
    scene.dispose();
    engine.dispose();
  });
});

