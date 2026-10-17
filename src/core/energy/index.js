import { assertNonNegativeNumber, assertPositiveNumber } from '../validation.js';

function assertEfficiency(value, name) {
  assertPositiveNumber(value, name);
  if (value > 1) throw new RangeError(`${name} debe ser <= 1.`);
}

export function calculatePumpEnergy({
  flowRateM3s,
  requiredPressurePa,
  pumpEfficiency,
  motorEfficiency = 1,
  operatingHoursPerYear = 0,
  electricityPricePerKwh = 0,
}) {
  assertNonNegativeNumber(flowRateM3s, 'flowRateM3s');
  assertNonNegativeNumber(requiredPressurePa, 'requiredPressurePa');
  assertEfficiency(pumpEfficiency, 'pumpEfficiency');
  assertEfficiency(motorEfficiency, 'motorEfficiency');
  assertNonNegativeNumber(operatingHoursPerYear, 'operatingHoursPerYear');
  assertNonNegativeNumber(electricityPricePerKwh, 'electricityPricePerKwh');

  const hydraulicPowerW = flowRateM3s * requiredPressurePa;
  const shaftPowerW = hydraulicPowerW / pumpEfficiency;
  const electricalPowerW = shaftPowerW / motorEfficiency;
  const annualEnergyKwh = electricalPowerW / 1000 * operatingHoursPerYear;
  return {
    hydraulicPowerW,
    shaftPowerW,
    electricalPowerW,
    annualEnergyKwh,
    annualEnergyCost: annualEnergyKwh * electricityPricePerKwh,
  };
}
