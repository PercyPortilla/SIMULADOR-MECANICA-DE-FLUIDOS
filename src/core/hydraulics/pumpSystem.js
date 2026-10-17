import {
  assertFiniteNumber,
  assertNonNegativeNumber,
  assertPositiveNumber,
} from '../validation.js';
import { STANDARD_GRAVITY_M_S2 } from './advanced.js';

function validateCurveCoefficient(value, name) {
  assertNonNegativeNumber(value, name);
}

export function calculatePumpHead({
  flowRateM3s,
  shutoffHeadM,
  linearHeadCoefficientS_M2 = 0,
  quadraticHeadCoefficientS2_M5 = 0,
}) {
  assertNonNegativeNumber(flowRateM3s, 'flowRateM3s');
  assertNonNegativeNumber(shutoffHeadM, 'shutoffHeadM');
  validateCurveCoefficient(linearHeadCoefficientS_M2, 'linearHeadCoefficientS_M2');
  validateCurveCoefficient(quadraticHeadCoefficientS2_M5, 'quadraticHeadCoefficientS2_M5');
  return shutoffHeadM
    - linearHeadCoefficientS_M2 * flowRateM3s
    - quadraticHeadCoefficientS2_M5 * flowRateM3s ** 2;
}

export function calculateSystemHead({
  flowRateM3s,
  staticHeadM = 0,
  resistanceCoefficientS2_M5 = 0,
}) {
  assertNonNegativeNumber(flowRateM3s, 'flowRateM3s');
  assertFiniteNumber(staticHeadM, 'staticHeadM');
  validateCurveCoefficient(resistanceCoefficientS2_M5, 'resistanceCoefficientS2_M5');
  return staticHeadM + resistanceCoefficientS2_M5 * flowRateM3s ** 2;
}

export function solvePumpSystemOperatingPoint({
  pumpCurve,
  systemCurve,
  minFlowRateM3s = 0,
  maxFlowRateM3s,
  relativeTolerance = 1e-9,
  maxIterations = 100,
}) {
  assertNonNegativeNumber(minFlowRateM3s, 'minFlowRateM3s');
  assertPositiveNumber(maxFlowRateM3s, 'maxFlowRateM3s');
  assertPositiveNumber(relativeTolerance, 'relativeTolerance');
  if (maxFlowRateM3s <= minFlowRateM3s) {
    throw new RangeError('maxFlowRateM3s debe ser mayor que minFlowRateM3s.');
  }
  if (!Number.isInteger(maxIterations) || maxIterations < 1) {
    throw new RangeError('maxIterations debe ser un entero mayor o igual que 1.');
  }

  const evaluate = (flowRateM3s) => {
    const pumpHeadM = calculatePumpHead({ flowRateM3s, ...pumpCurve });
    const systemHeadM = calculateSystemHead({ flowRateM3s, ...systemCurve });
    return { flowRateM3s, pumpHeadM, systemHeadM, residualHeadM: pumpHeadM - systemHeadM };
  };

  let lower = evaluate(minFlowRateM3s);
  let upper = evaluate(maxFlowRateM3s);
  if (lower.residualHeadM === 0) return { ...lower, iterations: 0, method: 'bisection' };
  if (upper.residualHeadM === 0) return { ...upper, iterations: 0, method: 'bisection' };
  if (Math.sign(lower.residualHeadM) === Math.sign(upper.residualHeadM)) {
    throw new RangeError('Las curvas de bomba y sistema no quedan acotadas por el intervalo de caudal.');
  }

  for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
    const midpoint = evaluate((lower.flowRateM3s + upper.flowRateM3s) / 2);
    const scale = Math.max(Math.abs(midpoint.pumpHeadM), Math.abs(midpoint.systemHeadM), 1);
    if (Math.abs(midpoint.residualHeadM) / scale <= relativeTolerance) {
      return { ...midpoint, iterations: iteration, method: 'bisection' };
    }
    if (Math.sign(midpoint.residualHeadM) === Math.sign(lower.residualHeadM)) lower = midpoint;
    else upper = midpoint;
  }

  const midpoint = evaluate((lower.flowRateM3s + upper.flowRateM3s) / 2);
  return { ...midpoint, iterations: maxIterations, method: 'bisection' };
}

export function samplePumpSystemCurves({
  pumpCurve,
  systemCurve,
  maxFlowRateM3s,
  pointCount = 41,
}) {
  assertPositiveNumber(maxFlowRateM3s, 'maxFlowRateM3s');
  if (!Number.isInteger(pointCount) || pointCount < 2) {
    throw new RangeError('pointCount debe ser un entero mayor o igual que 2.');
  }
  const flowRateM3s = [];
  const pumpHeadM = [];
  const systemHeadM = [];
  for (let index = 0; index < pointCount; index += 1) {
    const flow = maxFlowRateM3s * index / (pointCount - 1);
    flowRateM3s.push(flow);
    pumpHeadM.push(calculatePumpHead({ flowRateM3s: flow, ...pumpCurve }));
    systemHeadM.push(calculateSystemHead({ flowRateM3s: flow, ...systemCurve }));
  }
  return { flowRateM3s, pumpHeadM, systemHeadM };
}

export function calculateNpshAvailable({
  surfaceAbsolutePressurePa,
  vaporPressurePa,
  densityKgM3,
  suctionStaticHeadM = 0,
  suctionHeadLossM = 0,
  gravityMps2 = STANDARD_GRAVITY_M_S2,
}) {
  assertNonNegativeNumber(surfaceAbsolutePressurePa, 'surfaceAbsolutePressurePa');
  assertNonNegativeNumber(vaporPressurePa, 'vaporPressurePa');
  assertPositiveNumber(densityKgM3, 'densityKgM3');
  assertFiniteNumber(suctionStaticHeadM, 'suctionStaticHeadM');
  assertNonNegativeNumber(suctionHeadLossM, 'suctionHeadLossM');
  assertPositiveNumber(gravityMps2, 'gravityMps2');
  return (surfaceAbsolutePressurePa - vaporPressurePa) / (densityKgM3 * gravityMps2)
    + suctionStaticHeadM
    - suctionHeadLossM;
}

export function calculateNpshRequired({
  flowRateM3s,
  baseNpshM = 0,
  linearNpshCoefficientS_M2 = 0,
  quadraticNpshCoefficientS2_M5 = 0,
}) {
  assertNonNegativeNumber(flowRateM3s, 'flowRateM3s');
  assertNonNegativeNumber(baseNpshM, 'baseNpshM');
  validateCurveCoefficient(linearNpshCoefficientS_M2, 'linearNpshCoefficientS_M2');
  validateCurveCoefficient(quadraticNpshCoefficientS2_M5, 'quadraticNpshCoefficientS2_M5');
  return baseNpshM
    + linearNpshCoefficientS_M2 * flowRateM3s
    + quadraticNpshCoefficientS2_M5 * flowRateM3s ** 2;
}

export function assessNpsh({ availableNpshM, requiredNpshM, minimumMarginM = 0 }) {
  assertFiniteNumber(availableNpshM, 'availableNpshM');
  assertNonNegativeNumber(requiredNpshM, 'requiredNpshM');
  assertNonNegativeNumber(minimumMarginM, 'minimumMarginM');
  const marginM = availableNpshM - requiredNpshM;
  return {
    availableNpshM,
    requiredNpshM,
    marginM,
    marginRatio: requiredNpshM > 0 ? availableNpshM / requiredNpshM : null,
    meetsRequirement: marginM >= minimumMarginM,
  };
}

function validateTabulatedCurve(points, valueKey, name) {
  if (!Array.isArray(points) || points.length < 2) throw new RangeError(`${name} requiere al menos dos puntos.`);
  const sorted = points.map((point, index) => {
    const flowRateM3s = Number(point?.flowRateM3s);
    const value = Number(point?.[valueKey]);
    assertNonNegativeNumber(flowRateM3s, `${name}[${index}].flowRateM3s`);
    assertFiniteNumber(value, `${name}[${index}].${valueKey}`);
    return { flowRateM3s, [valueKey]: value };
  }).sort((a, b) => a.flowRateM3s - b.flowRateM3s);
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index].flowRateM3s <= sorted[index - 1].flowRateM3s) throw new RangeError(`${name} requiere caudales estrictamente crecientes.`);
  }
  return sorted;
}

export function interpolateTabulatedCurve(points, flowRateM3s, valueKey, { allowExtrapolation = false, name = 'curve' } = {}) {
  assertNonNegativeNumber(flowRateM3s, 'flowRateM3s');
  const sorted = validateTabulatedCurve(points, valueKey, name);
  if (!allowExtrapolation && (flowRateM3s < sorted[0].flowRateM3s || flowRateM3s > sorted.at(-1).flowRateM3s)) return null;
  if (flowRateM3s <= sorted[0].flowRateM3s) return sorted[0][valueKey];
  if (flowRateM3s >= sorted.at(-1).flowRateM3s) return sorted.at(-1)[valueKey];
  for (let index = 1; index < sorted.length; index += 1) {
    const right = sorted[index];
    if (flowRateM3s <= right.flowRateM3s) {
      const left = sorted[index - 1];
      const t = (flowRateM3s - left.flowRateM3s) / (right.flowRateM3s - left.flowRateM3s);
      return left[valueKey] + t * (right[valueKey] - left[valueKey]);
    }
  }
  return null;
}

export function solveTabulatedPumpSystemOperatingPoint({ pumpCurve, systemHeadAtFlow, relativeTolerance = 1e-7, maxIterations = 80 }) {
  const sorted = validateTabulatedCurve(pumpCurve, 'headM', 'pumpCurve');
  if (typeof systemHeadAtFlow !== 'function') throw new TypeError('systemHeadAtFlow debe ser una función.');
  const residual = (flowRateM3s) => {
    const pumpHeadM = interpolateTabulatedCurve(sorted, flowRateM3s, 'headM', { name: 'pumpCurve' });
    const systemHeadM = systemHeadAtFlow(flowRateM3s);
    assertFiniteNumber(systemHeadM, 'systemHeadM');
    return { flowRateM3s, pumpHeadM, systemHeadM, residualHeadM: pumpHeadM - systemHeadM };
  };
  const intersections = [];
  for (let index = 1; index < sorted.length; index += 1) {
    let left = residual(sorted[index - 1].flowRateM3s);
    let right = residual(sorted[index].flowRateM3s);
    if (left.residualHeadM === 0) intersections.push(left);
    if (Math.sign(left.residualHeadM) === Math.sign(right.residualHeadM) && right.residualHeadM !== 0) continue;
    if (right.residualHeadM === 0) { intersections.push(right); continue; }
    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
      const middle = residual((left.flowRateM3s + right.flowRateM3s) / 2);
      const scale = Math.max(1, Math.abs(middle.pumpHeadM), Math.abs(middle.systemHeadM));
      if (Math.abs(middle.residualHeadM) / scale <= relativeTolerance) { left = middle; right = middle; break; }
      if (Math.sign(middle.residualHeadM) === Math.sign(left.residualHeadM)) left = middle;
      else right = middle;
    }
    const point = residual((left.flowRateM3s + right.flowRateM3s) / 2);
    if (!intersections.some((entry) => Math.abs(entry.flowRateM3s - point.flowRateM3s) < 1e-8)) intersections.push(point);
  }
  return {
    status: intersections.length === 0 ? 'no-intersection' : intersections.length === 1 ? 'unique' : 'multiple-intersections',
    operatingPoint: intersections[0] ?? null,
    intersections,
    flowDomainM3s: [sorted[0].flowRateM3s, sorted.at(-1).flowRateM3s],
    extrapolated: false,
  };
}

export function sampleTabulatedPumpSystemCurves({ pumpCurve, systemHeadAtFlow, pointCount = 41 }) {
  const sorted = validateTabulatedCurve(pumpCurve, 'headM', 'pumpCurve');
  if (!Number.isInteger(pointCount) || pointCount < 2) throw new RangeError('pointCount debe ser >= 2.');
  const min = sorted[0].flowRateM3s;
  const max = sorted.at(-1).flowRateM3s;
  const flowRateM3s = [];
  const pumpHeadM = [];
  const systemHeadM = [];
  for (let index = 0; index < pointCount; index += 1) {
    const q = min + (max - min) * index / (pointCount - 1);
    flowRateM3s.push(q);
    pumpHeadM.push(interpolateTabulatedCurve(sorted, q, 'headM', { name: 'pumpCurve' }));
    systemHeadM.push(systemHeadAtFlow(q));
  }
  return { flowRateM3s, pumpHeadM, systemHeadM };
}
