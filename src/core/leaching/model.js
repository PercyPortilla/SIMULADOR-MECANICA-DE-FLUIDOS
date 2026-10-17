import { assertFiniteNumber, assertNonNegativeNumber, assertPositiveNumber } from '../validation.js';

export function calculateResidenceTimeHours({ usefulVolumeM3, flowRateM3s }) {
  assertPositiveNumber(usefulVolumeM3, 'usefulVolumeM3');
  assertPositiveNumber(flowRateM3s, 'flowRateM3s');
  return usefulVolumeM3 / flowRateM3s / 3600;
}

export function calculateCstrsInSeriesConversion({ rateConstantPerH, residenceTimeH, reactorCount }) {
  assertNonNegativeNumber(rateConstantPerH, 'rateConstantPerH');
  assertNonNegativeNumber(residenceTimeH, 'residenceTimeH');
  if (!Number.isInteger(reactorCount) || reactorCount < 1) {
    throw new RangeError('reactorCount debe ser un entero >= 1.');
  }
  if (rateConstantPerH === 0 || residenceTimeH === 0) return 0;
  const perTankResidenceH = residenceTimeH / reactorCount;
  const remainingFraction = (1 / (1 + rateConstantPerH * perTankResidenceH)) ** reactorCount;
  return 1 - remainingFraction;
}

export function calculateCstrSeriesStages({ rateConstantPerH, residenceTimeH, reactorCount, feedGradeGL = null }) {
  assertNonNegativeNumber(rateConstantPerH, 'rateConstantPerH');
  assertNonNegativeNumber(residenceTimeH, 'residenceTimeH');
  if (!Number.isInteger(reactorCount) || reactorCount < 1) throw new RangeError('reactorCount debe ser un entero >= 1.');
  if (feedGradeGL !== null) assertNonNegativeNumber(feedGradeGL, 'feedGradeGL');
  const perTankResidenceH = residenceTimeH / reactorCount;
  const stageFactor = 1 / (1 + rateConstantPerH * perTankResidenceH);
  return Array.from({ length: reactorCount }, (_, index) => {
    const remainingFraction = stageFactor ** (index + 1);
    return {
      reactor: index + 1,
      residenceTimePerTankH: perTankResidenceH,
      remainingFraction,
      conversion: 1 - remainingFraction,
      estimatedGradeGL: feedGradeGL === null ? null : feedGradeGL * remainingFraction,
    };
  });
}

export function calculateEmpiricalLeachingRateConstant({
  baseRateConstantPerH,
  temperatureC = 25,
  referenceTemperatureC = 25,
  ph = 2,
  referencePh = 2,
  freeCyanideGL = 0,
  referenceCyanideGL = 0,
  dissolvedOxygenMgL = 0,
  referenceOxygenMgL = 0,
  coupleTemperature = false,
  couplePh = false,
  coupleCyanide = false,
  coupleOxygen = false,
  betaTemperaturePerC = 0,
  betaPhPerUnit = 0,
  betaCyanidePerGL = 0,
  betaOxygenPerMgL = 0,
  exponentLimit = 7,
}) {
  assertNonNegativeNumber(baseRateConstantPerH, 'baseRateConstantPerH');
  [temperatureC, referenceTemperatureC, ph, referencePh, freeCyanideGL, referenceCyanideGL,
    dissolvedOxygenMgL, referenceOxygenMgL, betaTemperaturePerC, betaPhPerUnit,
    betaCyanidePerGL, betaOxygenPerMgL].forEach((value, index) => assertFiniteNumber(value, `leachCorrection[${index}]`));
  assertPositiveNumber(exponentLimit, 'exponentLimit');
  const terms = {
    temperature: coupleTemperature ? betaTemperaturePerC * (temperatureC - referenceTemperatureC) : 0,
    ph: couplePh ? betaPhPerUnit * (ph - referencePh) : 0,
    cyanide: coupleCyanide ? betaCyanidePerGL * (freeCyanideGL - referenceCyanideGL) : 0,
    oxygen: coupleOxygen ? betaOxygenPerMgL * (dissolvedOxygenMgL - referenceOxygenMgL) : 0,
  };
  const rawExponent = Object.values(terms).reduce((sum, value) => sum + value, 0);
  const clampedExponent = Math.max(-exponentLimit, Math.min(exponentLimit, rawExponent));
  const anyCoupling = coupleTemperature || couplePh || coupleCyanide || coupleOxygen;
  return {
    baseRateConstantPerH,
    effectiveRateConstantPerH: baseRateConstantPerH * Math.exp(clampedExponent),
    terms,
    rawExponent,
    clampedExponent,
    exponentWasClamped: clampedExponent !== rawExponent,
    couplingEnabled: anyCoupling,
    calibrated: !anyCoupling,
    modelStatus: anyCoupling
      ? 'Corrección empírica activada por el usuario; los coeficientes β requieren calibración experimental.'
      : 'Sin acoplamiento empírico: k efectivo = k ingresado.',
  };
}
