import { assertNonNegativeNumber, assertPositiveNumber } from '../validation.js';

/** Laminar pressure drop: deltaP = 4 * wallStress * L / D. */
export function calculateLaminarPressureDrop({ wallStressPa, lengthM, innerDiameterM }) {
  assertNonNegativeNumber(wallStressPa, 'wallStressPa');
  assertPositiveNumber(lengthM, 'lengthM');
  assertPositiveNumber(innerDiameterM, 'innerDiameterM');
  return 4 * wallStressPa * lengthM / innerDiameterM;
}

/** Circular-pipe volumetric flow: Q = V * pi * D² / 4. */
export function calculatePipeFlowRate({ velocityMps, innerDiameterM }) {
  assertNonNegativeNumber(velocityMps, 'velocityMps');
  assertPositiveNumber(innerDiameterM, 'innerDiameterM');
  return velocityMps * Math.PI * innerDiameterM ** 2 / 4;
}

