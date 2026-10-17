import { assertNonNegativeNumber, assertPositiveNumber } from '../validation.js';
import {
  calculateBinghamShearRate,
  calculateCassonShearRate,
  calculateHerschelBulkleyShearRate,
  calculatePowerLawShearRate,
} from './models.js';

function calculateProfileShearRate(model, shearStressPa, parameters, empiricalStressScale) {
  const constitutiveStressPa = shearStressPa / empiricalStressScale;
  if (model === 'bingham') {
    return calculateBinghamShearRate({ shearStressPa: constitutiveStressPa, ...parameters });
  }
  if (model === 'casson') {
    return calculateCassonShearRate({ shearStressPa: constitutiveStressPa, ...parameters });
  }
  if (model === 'power') {
    return calculatePowerLawShearRate({ shearStressPa: constitutiveStressPa, ...parameters });
  }
  if (model === 'hb') {
    return calculateHerschelBulkleyShearRate({ shearStressPa: constitutiveStressPa, ...parameters });
  }
  throw new RangeError(`Modelo reológico no soportado: ${model}.`);
}

/**
 * Laminar, fully developed, no-slip pipe profile from the V1 model.
 * Returns numerical arrays in SI units and the calculated mean velocity.
 */
export function calculateLaminarProfile({
  model,
  parameters,
  radiusM,
  wallStressPa,
  nodeCount = 401,
  empiricalStressScale = 1,
}) {
  assertPositiveNumber(radiusM, 'radiusM');
  assertNonNegativeNumber(wallStressPa, 'wallStressPa');
  assertPositiveNumber(empiricalStressScale, 'empiricalStressScale');
  if (!Number.isInteger(nodeCount) || nodeCount < 2) {
    throw new RangeError('nodeCount debe ser un entero mayor o igual que 2.');
  }

  const radius = [];
  const stress = [];
  const shearRateValues = [];
  const velocity = new Array(nodeCount).fill(0);
  const step = radiusM / (nodeCount - 1);

  for (let index = 0; index < nodeCount; index += 1) {
    const r = index * step;
    radius.push(r);
    const tau = wallStressPa * index / (nodeCount - 1);
    stress.push(tau);
    shearRateValues.push(calculateProfileShearRate(model, tau, parameters, empiricalStressScale));
  }

  for (let index = nodeCount - 2; index >= 0; index -= 1) {
    velocity[index] = velocity[index + 1]
      + (shearRateValues[index] + shearRateValues[index + 1]) * step / 2;
  }

  let integral = 0;
  for (let index = 1; index < nodeCount; index += 1) {
    integral += (velocity[index] * radius[index]
      + velocity[index - 1] * radius[index - 1]) * step / 2;
  }

  return {
    radiusM: radius,
    shearStressPa: stress,
    shearRateS_1: shearRateValues,
    velocityMps: velocity,
    apparentViscosityPaS: shearRateValues.map((shearRate, index) => (
      shearRate > 0 ? stress[index] / shearRate : null
    )),
    meanVelocityMps: 2 * integral / radiusM ** 2,
    wallStressPa,
    empiricalStressScale,
  };
}

/**
 * Solves the wall shear stress required to reproduce a target mean velocity
 * with the same validated laminar profile model used above.
 *
 * This is intentionally a numerical inversion of calculateLaminarProfile,
 * rather than a new empirical correlation. It keeps the controller tied to
 * the already-tested constitutive equations for Bingham, power-law and
 * Herschel–Bulkley fluids.
 */
export function solveWallStressForMeanVelocity({
  model,
  parameters,
  radiusM,
  targetMeanVelocityMps,
  nodeCount = 401,
  relativeTolerance = 1e-8,
  maxIterations = 96,
  empiricalStressScale = 1,
}) {
  assertPositiveNumber(radiusM, 'radiusM');
  assertNonNegativeNumber(targetMeanVelocityMps, 'targetMeanVelocityMps');
  assertPositiveNumber(relativeTolerance, 'relativeTolerance');
  assertPositiveNumber(empiricalStressScale, 'empiricalStressScale');
  if (!Number.isInteger(maxIterations) || maxIterations < 1) {
    throw new RangeError('maxIterations debe ser un entero mayor o igual que 1.');
  }

  if (targetMeanVelocityMps === 0) {
    const profile = calculateLaminarProfile({
      model,
      parameters,
      radiusM,
      wallStressPa: 0,
      nodeCount,
      empiricalStressScale,
    });
    return { wallStressPa: 0, profile };
  }

  const evaluate = (wallStressPa) => calculateLaminarProfile({
    model,
    parameters,
    radiusM,
    wallStressPa,
    nodeCount,
    empiricalStressScale,
  });

  let lower = 0;
  let upper = 1;
  let upperProfile = evaluate(upper);
  let expansionCount = 0;
  while (upperProfile.meanVelocityMps < targetMeanVelocityMps) {
    upper *= 2;
    expansionCount += 1;
    if (!Number.isFinite(upper) || expansionCount > maxIterations) {
      throw new RangeError('No se pudo acotar el esfuerzo de pared para la velocidad objetivo.');
    }
    upperProfile = evaluate(upper);
  }

  let profile = upperProfile;
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const midpoint = (lower + upper) / 2;
    profile = evaluate(midpoint);
    const error = profile.meanVelocityMps - targetMeanVelocityMps;
    const scale = Math.max(targetMeanVelocityMps, 1e-12);
    if (Math.abs(error) / scale <= relativeTolerance) {
      return { wallStressPa: midpoint, profile };
    }
    if (error < 0) lower = midpoint;
    else upper = midpoint;
  }

  const wallStressPa = (lower + upper) / 2;
  profile = evaluate(wallStressPa);
  return { wallStressPa, profile };
}
