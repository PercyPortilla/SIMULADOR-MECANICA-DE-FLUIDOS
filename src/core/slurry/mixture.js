import { assertFraction, assertPositiveNumber } from '../validation.js';

/**
 * Calculates homogeneous slurry density using SI units.
 * solidsMassFraction is a fraction [0, 1]; densities are kg/m³.
 */
export function calculateMixtureDensity({
  solidsMassFraction,
  solidDensityKgM3,
  liquidDensityKgM3,
}) {
  assertFraction(solidsMassFraction, 'solidsMassFraction');
  assertPositiveNumber(solidDensityKgM3, 'solidDensityKgM3');
  assertPositiveNumber(liquidDensityKgM3, 'liquidDensityKgM3');

  const w = solidsMassFraction;
  return 1 / (w / solidDensityKgM3 + (1 - w) / liquidDensityKgM3);
}

/**
 * Calculates the solid volume fraction from the same mixture model.
 */
export function calculateSolidVolumeFraction(input) {
  const densityKgM3 = calculateMixtureDensity(input);
  return input.solidsMassFraction / input.solidDensityKgM3 * densityKgM3;
}
