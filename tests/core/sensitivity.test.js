import { describe, expect, it } from 'vitest';
import {
  createLinearSweepValues,
  runSensitivitySweep,
} from '../../src/core/sensitivity/index.js';

describe('deterministic sensitivity sweep', () => {
  it('creates inclusive values without cumulative stepping drift', () => {
    expect(createLinearSweepValues({ min: 1, max: 2, steps: 5 })).toEqual([
      1,
      1.25,
      1.5,
      1.75,
      2,
    ]);
  });

  it('evaluates a pure calculation deterministically without mutating baseline input', () => {
    const baseline = {
      transport: {
        pipe1: {
          velocityMps: 1,
          lengthM: 100,
        },
      },
    };
    const values = createLinearSweepValues({ min: 1, max: 2, steps: 3 });
    const calculate = (candidate) => {
      const velocity = candidate.transport.pipe1.velocityMps;
      candidate.transport.pipe1.lengthM = 999;
      return {
        pressureDropPa: 100 * velocity ** 2,
        internalLengthM: candidate.transport.pipe1.lengthM,
      };
    };
    const options = {
      baseInput: baseline,
      parameterPath: 'transport.pipe1.velocityMps',
      values,
      calculate,
      projectResult: (result) => result.pressureDropPa,
    };

    const first = runSensitivitySweep(options);
    const second = runSensitivitySweep(options);

    expect(first).toEqual(second);
    expect(first.map((point) => point.parameterValue)).toEqual([1, 1.5, 2]);
    expect(first.map((point) => point.result)).toEqual([100, 225, 400]);
    expect(baseline).toEqual({
      transport: { pipe1: { velocityMps: 1, lengthM: 100 } },
    });
  });

  it('fails fast on a misspelled parameter path', () => {
    expect(() => runSensitivitySweep({
      baseInput: { transport: { pipe1: { velocityMps: 1 } } },
      parameterPath: 'transport.pipe1.velocittyMps',
      values: [1, 2],
      calculate: () => 0,
    })).toThrow(/No existe la ruta/);
  });
});
