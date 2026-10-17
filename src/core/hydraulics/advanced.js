import { assertFiniteNumber, assertNonNegativeNumber, assertPositiveNumber } from '../validation.js';

export const STANDARD_GRAVITY_M_S2 = 9.80665;

export function calculateReynoldsNumber({ densityKgM3, velocityMps, innerDiameterM, viscosityPaS }) {
  assertPositiveNumber(densityKgM3, 'densityKgM3');
  assertNonNegativeNumber(velocityMps, 'velocityMps');
  assertPositiveNumber(innerDiameterM, 'innerDiameterM');
  assertPositiveNumber(viscosityPaS, 'viscosityPaS');
  return densityKgM3 * velocityMps * innerDiameterM / viscosityPaS;
}

export function classifyNewtonianRegime(reynoldsNumber) {
  assertNonNegativeNumber(reynoldsNumber, 'reynoldsNumber');
  if (reynoldsNumber === 0) return 'stagnant';
  if (reynoldsNumber < 2300) return 'laminar';
  if (reynoldsNumber < 4000) return 'transition';
  return 'turbulent';
}

export function calculateDarcyFrictionFactor({ reynoldsNumber, relativeRoughness = 0 }) {
  assertNonNegativeNumber(reynoldsNumber, 'reynoldsNumber');
  assertNonNegativeNumber(relativeRoughness, 'relativeRoughness');
  if (reynoldsNumber === 0) return 0;
  if (reynoldsNumber < 2300) return 64 / reynoldsNumber;
  if (reynoldsNumber < 4000) return null;

  let frictionFactor = 0.02;
  for (let iteration = 0; iteration < 64; iteration += 1) {
    const inverseSqrt = -2 * Math.log10(
      relativeRoughness / 3.7 + 2.51 / (reynoldsNumber * Math.sqrt(frictionFactor)),
    );
    const next = 1 / inverseSqrt ** 2;
    if (Math.abs(next - frictionFactor) < 1e-12) return next;
    frictionFactor = next;
  }
  return frictionFactor;
}

/** Churchill (1977) explicit Darcy friction factor spanning all regimes. */
export function calculateChurchillDarcyFrictionFactor({ reynoldsNumber, relativeRoughness = 0 }) {
  assertNonNegativeNumber(reynoldsNumber, 'reynoldsNumber');
  assertNonNegativeNumber(relativeRoughness, 'relativeRoughness');
  if (reynoldsNumber === 0) return 0;
  const term = (7 / reynoldsNumber) ** 0.9 + 0.27 * relativeRoughness;
  const A = (2.457 * Math.log(1 / term)) ** 16;
  const B = (37530 / reynoldsNumber) ** 16;
  return 8 * ((8 / reynoldsNumber) ** 12 + 1 / (A + B) ** 1.5) ** (1 / 12);
}

export function calculateDarcyWeisbachPressureDrop({
  frictionFactor,
  lengthM,
  innerDiameterM,
  densityKgM3,
  velocityMps,
}) {
  assertNonNegativeNumber(frictionFactor, 'frictionFactor');
  assertPositiveNumber(lengthM, 'lengthM');
  assertPositiveNumber(innerDiameterM, 'innerDiameterM');
  assertPositiveNumber(densityKgM3, 'densityKgM3');
  assertNonNegativeNumber(velocityMps, 'velocityMps');
  return frictionFactor * (lengthM / innerDiameterM) * densityKgM3 * velocityMps ** 2 / 2;
}

export function calculateMinorLossPressureDrop({ lossCoefficient, densityKgM3, velocityMps }) {
  assertNonNegativeNumber(lossCoefficient, 'lossCoefficient');
  assertPositiveNumber(densityKgM3, 'densityKgM3');
  assertNonNegativeNumber(velocityMps, 'velocityMps');
  return lossCoefficient * densityKgM3 * velocityMps ** 2 / 2;
}

export function calculateStaticPressureChange({ densityKgM3, elevationChangeM, gravityMps2 = STANDARD_GRAVITY_M_S2 }) {
  assertPositiveNumber(densityKgM3, 'densityKgM3');
  assertFiniteNumber(elevationChangeM, 'elevationChangeM');
  assertPositiveNumber(gravityMps2, 'gravityMps2');
  return densityKgM3 * gravityMps2 * elevationChangeM;
}

export function calculatePressureHead({ pressurePa, densityKgM3, gravityMps2 = STANDARD_GRAVITY_M_S2 }) {
  assertFiniteNumber(pressurePa, 'pressurePa');
  assertPositiveNumber(densityKgM3, 'densityKgM3');
  assertPositiveNumber(gravityMps2, 'gravityMps2');
  return pressurePa / (densityKgM3 * gravityMps2);
}

export function calculatePressureProfile({
  distributedPressureDropPa,
  lengthM,
  pointCount = 21,
}) {
  assertNonNegativeNumber(distributedPressureDropPa, 'distributedPressureDropPa');
  assertPositiveNumber(lengthM, 'lengthM');
  if (!Number.isInteger(pointCount) || pointCount < 2) throw new RangeError('pointCount debe ser >= 2.');
  const distanceM = [];
  const requiredPressurePa = [];
  for (let index = 0; index < pointCount; index += 1) {
    const fraction = index / (pointCount - 1);
    distanceM.push(lengthM * fraction);
    requiredPressurePa.push(distributedPressureDropPa * fraction);
  }
  return { distanceM, requiredPressurePa };
}
