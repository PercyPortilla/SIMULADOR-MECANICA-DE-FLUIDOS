import { describe, expect, it } from 'vitest';
import {
  calculateMixtureDensity,
  calculateSolidVolumeFraction,
} from '../../src/core/slurry/index.js';

const mixture = {
  solidsMassFraction: 0.35,
  solidDensityKgM3: 2650,
  liquidDensityKgM3: 1000,
};

describe('slurry calculations', () => {
  it('matches the V1 mixture equation', () => {
    expect(calculateMixtureDensity(mixture)).toBeCloseTo(1278.6489746683, 10);
  });

  it('matches the V1 solid volume fraction', () => {
    expect(calculateSolidVolumeFraction(mixture)).toBeCloseTo(0.1688781665, 10);
  });
});
