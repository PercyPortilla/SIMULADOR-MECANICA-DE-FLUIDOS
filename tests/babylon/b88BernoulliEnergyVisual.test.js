import { NullEngine, Scene, TransformNode } from '@babylonjs/core';
import { describe, expect, it } from 'vitest';
import { applyB88BernoulliEnergyVisual } from '../../src/babylon/lab/b88BernoulliEnergyVisual.js';

describe('B88 Bernoulli energy visual', () => {
  it('uses available system metrics while explicitly leaving nodal pressure unresolved', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    const parent = new TransformNode('LAB_PARENT', scene);
    const visual = applyB88BernoulliEnergyVisual({ scene, parent });

    visual.setMetrics({
      flowRateM3s: 0.05,
      densityKgM3: 1450,
      pressureDropPa: 180000,
      pumpHeadM: 19.5,
      totalLossHeadM: 8.2,
      staticHeadM: 3.85,
      rheologyModel: 'Herschel-Bulkley',
      basis: 'pump-operating-point',
    });
    visual.setMode('didactic');

    expect(visual.pointBars.A.kinetic.metadata.velocityMps).toBeGreaterThan(0);
    expect(visual.pointBars.B.kinetic.metadata.velocityMps)
      .toBeGreaterThan(visual.pointBars.A.kinetic.metadata.velocityMps);
    expect(visual.pointPanels.A.plane.metadata.labReadoutText).toContain('P nodal: N/D');
    expect(visual.systemBars.pump.metadata.valueM).toBeCloseTo(19.5, 8);
    expect(visual.systemBars.losses.metadata.valueM).toBeCloseTo(8.2, 8);
    expect(visual.systemBars.pressure.metadata.valueM).toBeGreaterThan(0);
    expect(visual.systemPanel.plane.metadata.labReadoutText).toContain('P nodal A/B/C no inventada');
    expect(visual.lossHotspots.map((item) => item.metadata.lossSubtype)).toEqual(['reducer', 'valve', 'elbow']);

    visual.setMode('realistic');
    expect(visual.systemBars.pump.isEnabled()).toBe(false);
    visual.setMode('presentation');
    expect(visual.systemBars.pump.isEnabled()).toBe(true);

    visual.dispose();
    scene.dispose();
    engine.dispose();
  });
});
