import {
  assertFiniteNumber,
  assertNonNegativeNumber,
  assertPositiveNumber,
} from '../validation.js';

function validateRate(rate) {
  assertNonNegativeNumber(rate, 'shearRateS-1');
}

function validateStress(stress) {
  assertNonNegativeNumber(stress, 'shearStressPa');
}

function validateYieldAndConsistency({ yieldStressPa, consistencyIndex, flowIndex }) {
  assertNonNegativeNumber(yieldStressPa, 'yieldStressPa');
  assertPositiveNumber(consistencyIndex, 'consistencyIndex');
  assertPositiveNumber(flowIndex, 'flowIndex');
}

function validateCasson({ yieldStressPa, cassonViscosityPaS }) {
  assertNonNegativeNumber(yieldStressPa, 'yieldStressPa');
  assertPositiveNumber(cassonViscosityPaS, 'cassonViscosityPaS');
}

/** Herschel–Bulkley: tau = tau_y + K * gamma^n. */
export function calculateHerschelBulkleyStress({
  shearRateS_1,
  yieldStressPa,
  consistencyIndex,
  flowIndex,
}) {
  validateRate(shearRateS_1);
  validateYieldAndConsistency({ yieldStressPa, consistencyIndex, flowIndex });
  return yieldStressPa + consistencyIndex * shearRateS_1 ** flowIndex;
}

export function calculateHerschelBulkleyShearRate({
  shearStressPa,
  yieldStressPa,
  consistencyIndex,
  flowIndex,
}) {
  validateStress(shearStressPa);
  validateYieldAndConsistency({ yieldStressPa, consistencyIndex, flowIndex });
  return (Math.max(shearStressPa - yieldStressPa, 0) / consistencyIndex) ** (1 / flowIndex);
}

/** Bingham plastic: tau = tau_y + mu_p * gamma. */
export function calculateBinghamStress({ shearRateS_1, yieldStressPa, plasticViscosityPaS }) {
  validateRate(shearRateS_1);
  assertNonNegativeNumber(yieldStressPa, 'yieldStressPa');
  assertPositiveNumber(plasticViscosityPaS, 'plasticViscosityPaS');
  return yieldStressPa + plasticViscosityPaS * shearRateS_1;
}

export function calculateBinghamShearRate({ shearStressPa, yieldStressPa, plasticViscosityPaS }) {
  validateStress(shearStressPa);
  assertNonNegativeNumber(yieldStressPa, 'yieldStressPa');
  assertPositiveNumber(plasticViscosityPaS, 'plasticViscosityPaS');
  return Math.max(shearStressPa - yieldStressPa, 0) / plasticViscosityPaS;
}

/** Casson: sqrt(tau) = sqrt(tau_y) + sqrt(mu_c * gamma). */
export function calculateCassonStress({ shearRateS_1, yieldStressPa, cassonViscosityPaS }) {
  validateRate(shearRateS_1);
  validateCasson({ yieldStressPa, cassonViscosityPaS });
  return (Math.sqrt(yieldStressPa) + Math.sqrt(cassonViscosityPaS * shearRateS_1)) ** 2;
}

export function calculateCassonShearRate({ shearStressPa, yieldStressPa, cassonViscosityPaS }) {
  validateStress(shearStressPa);
  validateCasson({ yieldStressPa, cassonViscosityPaS });
  if (shearStressPa <= yieldStressPa) return 0;
  return (Math.sqrt(shearStressPa) - Math.sqrt(yieldStressPa)) ** 2 / cassonViscosityPaS;
}

/** Power law: tau = K * gamma^n. */
export function calculatePowerLawStress({ shearRateS_1, consistencyIndex, flowIndex }) {
  validateRate(shearRateS_1);
  assertPositiveNumber(consistencyIndex, 'consistencyIndex');
  assertPositiveNumber(flowIndex, 'flowIndex');
  return consistencyIndex * shearRateS_1 ** flowIndex;
}

export function calculatePowerLawShearRate({ shearStressPa, consistencyIndex, flowIndex }) {
  validateStress(shearStressPa);
  assertPositiveNumber(consistencyIndex, 'consistencyIndex');
  assertPositiveNumber(flowIndex, 'flowIndex');
  return (shearStressPa / consistencyIndex) ** (1 / flowIndex);
}

/** Keep the finite-number guard available to callers extending this module. */
export function assertRheologyNumber(value, name) {
  assertFiniteNumber(value, name);
}
