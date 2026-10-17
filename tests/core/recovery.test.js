import { describe, expect, it } from 'vitest';
import { calculateStageEfficiencyBalance } from '../../src/core/recovery/index.js';

describe('recovery stage-efficiency mass balance', () => {
  it('never invents efficiencies and multiplies only explicit stage inputs', () => {
    const result = calculateStageEfficiencyBalance({ feedMetalKgH: 10, efficiencies: [0.9, 0.8, 0.95, 0.98] });
    expect(result.stages).toHaveLength(4);
    expect(result.finalMetalKgH).toBeCloseTo(10 * 0.9 * 0.8 * 0.95 * 0.98, 12);
    expect(result.overallRecovery).toBeCloseTo(0.9 * 0.8 * 0.95 * 0.98, 12);
  });
});
