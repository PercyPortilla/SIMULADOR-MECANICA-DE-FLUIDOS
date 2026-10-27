const G = 9.80665;

export const BERNOULLI_EULER_LAB_MODES = Object.freeze([
  Object.freeze({ id: 'realistic', label: 'Realista' }),
  Object.freeze({ id: 'didactic', label: 'Didáctico' }),
  Object.freeze({ id: 'presentation', label: 'Exposición' }),
]);

export const BERNOULLI_EULER_LAB_POINTS = Object.freeze({
  A: Object.freeze({ id: 'A', label: 'Succión / SUMP', elevationM: 22.99, diameterM: 0.30 }),
  B: Object.freeze({ id: 'B', label: 'Descarga de bomba', elevationM: 23.62, diameterM: 0.25 }),
  C: Object.freeze({ id: 'C', label: 'Entrada a ciclones', elevationM: 26.84, diameterM: 0.25 }),
});

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function velocityFromFlow(flowRateM3s, diameterM) {
  const q = finite(flowRateM3s);
  const d = finite(diameterM);
  if (q === null || d === null || d <= 0) return null;
  return q / (Math.PI * d * d / 4);
}

function pressureToHead(pressurePa, densityKgM3) {
  const pressure = finite(pressurePa);
  const density = finite(densityKgM3);
  if (pressure === null || density === null || density <= 0) return null;
  return pressure / (density * G);
}

export function getBernoulliEulerLabReadout(state = {}, results = {}) {
  const imposedFlowRateM3s = finite(results.transport?.flowRateM3s) ?? 0;
  const operatingFlowRateM3s = finite(results.pump?.operatingFlowRateM3s);
  const flowRateM3s = operatingFlowRateM3s !== null && operatingFlowRateM3s >= 0
    ? operatingFlowRateM3s
    : imposedFlowRateM3s;
  const densityKgM3 = finite(results.slurry?.densityKgM3);
  const distributedPressureDropPa = finite(results.transport?.distributedPressureDropPa);
  const minorLossPressurePa = finite(results.transport?.minorLossPressurePa);
  const staticPressurePa = finite(results.transport?.staticPressurePa);
  const pressureDropPa = finite(results.transport?.pressureDropPa);
  const pumpHeadM = finite(results.pump?.operatingPoint?.pumpHeadM)
    ?? finite(results.transport?.totalHeadM);
  const distributedHeadM = pressureToHead(distributedPressureDropPa, densityKgM3);
  const minorLossHeadM = pressureToHead(minorLossPressurePa, densityKgM3);
  const staticHeadM = pressureToHead(staticPressurePa, densityKgM3);
  const totalLossHeadM = distributedHeadM === null && minorLossHeadM === null
    ? null
    : (distributedHeadM ?? 0) + (minorLossHeadM ?? 0);

  const points = Object.fromEntries(Object.entries(BERNOULLI_EULER_LAB_POINTS).map(([key, point]) => [
    key,
    Object.freeze({
      ...point,
      velocityMps: velocityFromFlow(flowRateM3s, point.diameterM),
      pressurePa: null,
      pressureScope: 'P nodal no resuelta por el solver actual',
    }),
  ]));

  return Object.freeze({
    flowRateM3s,
    imposedFlowRateM3s,
    operatingFlowRateM3s,
    basis: operatingFlowRateM3s !== null && operatingFlowRateM3s >= 0
      ? 'pump-operating-point'
      : 'transport-imposed-flow',
    densityKgM3,
    pressureDropPa,
    pumpHeadM,
    distributedHeadM,
    minorLossHeadM,
    staticHeadM,
    totalLossHeadM,
    points: Object.freeze(points),
    equations: Object.freeze({
      euler: 'dp/ρ + V·dV + g·dz = 0',
      bernoulli: 'P/ρg + V²/2g + z + H_b − h_f = constante',
    }),
    scopeNote: 'Los valores provienen del escenario/solver actual. B78 no calcula una nueva presión nodal A/B/C; usa Q, ΔP, H_b y pérdidas ya disponibles.',
    rheologyModel: String(state.rheology?.model || ''),
  });
}

export function formatBernoulliEulerLabValue(value, unit = '', digits = 2) {
  const numeric = finite(value);
  if (numeric === null) return '—';
  const suffix = unit ? ` ${unit}` : '';
  return `${numeric.toFixed(digits)}${suffix}`;
}

