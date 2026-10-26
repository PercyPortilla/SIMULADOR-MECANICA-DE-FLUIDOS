import { CreateBox, NullEngine, Scene, TransformNode, Vector3 } from '@babylonjs/core';
import { describe, expect, it } from 'vitest';
import {
  B74_FLOW_SPECS,
  B76_SLURRY_DIAMETER_RATIO,
  applyB74SlurryFlowVisual,
  calculateB74PathVelocityMps,
  orderB74RoutePoints,
} from '../../src/babylon/assets/b74SlurryFlowVisual.js';

function addBox(scene, parent, name, position, size) {
  const mesh = CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, scene);
  mesh.parent = parent;
  mesh.position.set(...position);
  mesh.metadata = { v57AuthoritativeVisual: true };
  return mesh;
}

describe('B74 slurry flow visualization', () => {
  it('extends the B76 wet-flow visual through leach and into CIP', () => {
    expect(B74_FLOW_SPECS.map((spec) => spec.connectionId)).toEqual(expect.arrayContaining([
      'P-MILL-TO-SUMP',
      'P-SUMP-TO-PUMP',
      'P-PUMP-TO-CYCLONES',
      'P-CLASSIFICATION-TO-LEACH',
      'P-LEACH-R01-R02',
      'P-LEACH-R02-R03',
      'P-LEACH-R03-R04',
      'P-PUMP-01-TO-CIP',
    ]));
    expect(B76_SLURRY_DIAMETER_RATIO).toBeGreaterThanOrEqual(0.8);
    expect(B76_SLURRY_DIAMETER_RATIO).toBeLessThan(1);
  });

  it('derives physical line velocity from Q/A', () => {
    const q = 0.05;
    const d = 0.25;
    const expected = q / (Math.PI * d * d / 4);
    expect(calculateB74PathVelocityMps(q, d)).toBeCloseTo(expected, 10);
    expect(calculateB74PathVelocityMps(0, d, 1.7)).toBeCloseTo(1.7, 10);
  });

  it('orders route samples from source toward target', () => {
    const points = [
      [7, 0, 0], [3, 0, 0], [9, 0, 0], [1, 0, 0],
    ].map((value) => new Vector3(...value));
    const ordered = orderB74RoutePoints(points, [0, 0, 0], [10, 0, 0]);
    expect(ordered[0].x).toBeLessThan(ordered.at(-1).x);
  });

  it('builds animated slurry bodies and mineral tracers on the real V57 wet-line names', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    const host = new TransformNode('PULPA-LAB-V57-SITE', scene);
    const root = new TransformNode('V57_FIXTURE_ROOT', scene);

    addBox(scene, root, 'MILL-01_TROMMEL_DISCHARGE', [161.0, 24.0, -90.0], [5.0, 0.8, 0.8]);
    addBox(scene, root, 'V57_MILL_TO_SUMP_SEG01', [166.0, 23.7, -90.0], [5.0, 0.8, 0.8]);
    addBox(scene, root, 'SUMP-01_INLET_PIPE', [171.0, 23.4, -90.0], [5.0, 0.8, 0.8]);

    addBox(scene, root, 'SUMP-01_SUCTION_NOZZLE', [184.0, 22.2, -90.0], [2.0, 1.0, 1.0]);
    addBox(scene, root, 'SLURRY-PUMP-01_SUCTION_SEG01', [190.0, 22.2, -90.0], [9.0, 1.0, 1.0]);
    addBox(scene, root, 'SLURRY-PUMP-01_SUCTION_ELBOW_01', [196.0, 22.6, -90.0], [1.2, 1.2, 1.2]);
    addBox(scene, root, 'SLURRY-PUMP-01_SUCTION_SEG02', [200.0, 22.8, -90.0], [6.0, 1.0, 1.0]);
    addBox(scene, root, 'SLURRY-PUMP-01_VOLUTE', [205.0, 23.0, -90.0], [3.0, 3.0, 3.0]);

    addBox(scene, root, 'SLURRY-PUMP-01_DISCHARGE_PIPE', [207.0, 25.0, -91.0], [1.0, 4.0, 1.0]);
    addBox(scene, root, 'CLASS-01_FEED_LINE_SEG01', [211.0, 26.8, -94.0], [7.0, 1.0, 1.0]);
    addBox(scene, root, 'CLASS-01_FEED_LINE_ELBOW_01', [215.0, 26.8, -98.0], [1.2, 1.2, 1.2]);
    addBox(scene, root, 'CLASS-01_FEED_LINE_SEG02', [220.0, 26.8, -101.0], [8.0, 1.0, 1.0]);

    const visual = applyB74SlurryFlowVisual({ scene, rootNodes: [root], host });
    const availablePaths = visual.paths.filter((path) => !path.skipped);
    expect(availablePaths).toHaveLength(3);
    expect(availablePaths.every((path) => path.fluidSegments.length > 0)).toBe(true);
    expect(availablePaths.every((path) => path.tracers.length >= 10)).toBe(true);

    visual.setMetrics({
      flowRateM3s: 0.035,
      imposedFlowRateM3s: 0.03,
      solidsMassFraction: 0.38,
      solidVolumeFraction: 0.19,
      densityKgM3: 1450,
      feedGoldKgH: 1.2,
      basis: 'pump-operating-point',
    });

    const firstPath = visual.paths[0];
    const firstTracer = firstPath.tracers[0];
    const positionRef = firstTracer.position;
    expect(firstPath.fluidSegments[0].visibility).toBeLessThan(0.2);
    expect(firstTracer.visibility).toBeLessThan(0.2);
    visual.setInspectionState({ targetId: 'P-MILL-TO-SUMP', mode: 'transparent' });
    expect(firstPath.fluidSegments[0].visibility).toBe(1);
    expect(firstTracer.visibility).toBeGreaterThan(0.5);
    const before = firstTracer.position.clone();
    expect(firstPath.velocityMps).toBeGreaterThan(0);
    expect(visual.update(0.1)).toBe(true);
    expect(firstTracer.position).toBe(positionRef);
    expect(firstTracer.position.equalsWithEpsilon(before, 1e-7)).toBe(false);
    expect(firstPath.tracers.some((mesh) => mesh.metadata?.mineral === 'gold')).toBe(true);
    expect(firstPath.tracers.every((mesh) => mesh.metadata?.concentrationNotToScale === true)).toBe(true);
    expect(host.metadata.b74SlurryFlow.pathCount).toBe(3);

    visual.setAnimationsEnabled(false);
    const stopped = firstTracer.position.clone();
    expect(visual.update(0.1)).toBe(false);
    expect(firstTracer.position.equalsWithEpsilon(stopped, 1e-7)).toBe(true);

    visual.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('keeps a visible slurry body on long authored downstream segments allowed by the route spec', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    const host = new TransformNode('PULPA-LAB-V57-SITE', scene);
    const root = new TransformNode('V57_DOWNSTREAM_FIXTURE', scene);
    addBox(scene, root, 'B52_R04_TO_PUMP_SEG00', [344, 29.7, -122], [22, 0.8, 0.8]);

    const visual = applyB74SlurryFlowVisual({ scene, rootNodes: [root], host });
    const downstream = visual.paths.find((path) => path.spec.id === 'r04-to-cip');
    expect(downstream.skipped).toBe(false);
    expect(downstream.totalLengthM).toBeGreaterThan(18);
    expect(downstream.fluidSegments.length).toBeGreaterThan(0);

    visual.dispose();
    scene.dispose();
    engine.dispose();
  });
});
