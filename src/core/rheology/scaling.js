import { assertFiniteNumber, assertNonNegativeNumber, assertPositiveNumber } from '../validation.js';

export function calculateEmpiricalRheologyScale({
  solidVolumeFraction,
  referenceSolidVolumeFraction,
  concentrationExponent = 0,
  temperatureC = 25,
  referenceTemperatureC = 25,
  ph = 0,
  referencePh = 0,
  dissolvedGradeGL = 0,
  referenceDissolvedGradeGL = 0,
  betaTemperaturePerC = 0,
  betaPhPerUnit = 0,
  betaConcentrationPerGL = 0,
  exponentLimit = 7,
}) {
  assertNonNegativeNumber(solidVolumeFraction, 'solidVolumeFraction');
  assertPositiveNumber(referenceSolidVolumeFraction, 'referenceSolidVolumeFraction');
  assertNonNegativeNumber(concentrationExponent, 'concentrationExponent');
  [temperatureC, referenceTemperatureC, ph, referencePh, dissolvedGradeGL, referenceDissolvedGradeGL,
    betaTemperaturePerC, betaPhPerUnit, betaConcentrationPerGL].forEach((value, index) => assertFiniteNumber(value, `scaleInput[${index}]`));
  assertPositiveNumber(exponentLimit, 'exponentLimit');

  const concentrationScale = solidVolumeFraction === 0 && concentrationExponent === 0
    ? 1
    : (solidVolumeFraction / referenceSolidVolumeFraction) ** concentrationExponent;
  const concentrationExponentTerm = concentrationScale === 0
    ? Number.NEGATIVE_INFINITY
    : Math.log(concentrationScale);
  const rawCorrectionExponent = -betaTemperaturePerC * (temperatureC - referenceTemperatureC)
    + betaPhPerUnit * (ph - referencePh)
    + betaConcentrationPerGL * (dissolvedGradeGL - referenceDissolvedGradeGL);
  const rawExponent = concentrationExponentTerm + rawCorrectionExponent;
  const clampedExponent = Math.max(-exponentLimit, Math.min(exponentLimit, rawExponent));
  const exponentWasClamped = clampedExponent !== rawExponent;
  return {
    factor: Math.exp(clampedExponent),
    concentrationScale,
    concentrationExponentTerm,
    rawCorrectionExponent,
    rawExponent,
    clampedExponent,
    exponentWasClamped,
    warning: exponentWasClamped
      ? `Exponente empírico total limitado a ±${exponentLimit}.`
      : null,
    method: 'empirical concentration/temperature/pH/grade scale',
    calibrated: false,
  };
}
