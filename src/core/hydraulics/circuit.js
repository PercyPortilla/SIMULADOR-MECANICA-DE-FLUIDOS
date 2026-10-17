import { assertNonNegativeNumber, assertPositiveNumber } from '../validation.js';

const DEFAULT_ACCESSORIES = Object.freeze({
  valvesCount: 0,
  valveK: 0,
  elbowsCount: 0,
  elbowK: 0,
  teesCount: 0,
  teeK: 0,
  reducersCount: 0,
  reducerK: 0,
  otherK: 0,
});

export function calculateAccessoryCoefficient(accessories = {}, legacyAdditionalK = 0) {
  assertNonNegativeNumber(legacyAdditionalK, 'legacyAdditionalK');
  const values = { ...DEFAULT_ACCESSORIES, ...(accessories ?? {}) };
  const pairs = [
    ['valvesCount', 'valveK'],
    ['elbowsCount', 'elbowK'],
    ['teesCount', 'teeK'],
    ['reducersCount', 'reducerK'],
  ];
  let coefficient = legacyAdditionalK;
  const breakdown = [];
  for (const [countKey, kKey] of pairs) {
    const count = Number(values[countKey] ?? 0);
    const k = Number(values[kKey] ?? 0);
    assertNonNegativeNumber(count, countKey);
    assertNonNegativeNumber(k, kKey);
    const subtotal = count * k;
    coefficient += subtotal;
    breakdown.push({ type: countKey.replace('Count', ''), count, k, subtotal });
  }
  assertNonNegativeNumber(Number(values.otherK ?? 0), 'otherK');
  coefficient += Number(values.otherK ?? 0);
  breakdown.push({ type: 'other', count: 1, k: Number(values.otherK ?? 0), subtotal: Number(values.otherK ?? 0) });
  if (legacyAdditionalK > 0) breakdown.push({ type: 'legacy-manual', count: 1, k: legacyAdditionalK, subtotal: legacyAdditionalK });
  return { totalK: coefficient, breakdown };
}

export function normalizeCircuitSegments(transport) {
  const explicit = Array.isArray(transport?.segments) ? transport.segments.filter(Boolean) : [];
  if (explicit.length) return explicit.map((segment, index) => ({
    id: String(segment.id || `S${index + 1}`),
    innerDiameterM: Number(segment.innerDiameterM ?? 0),
    lengthM: Number(segment.lengthM ?? 0),
    roughnessM: Number(segment.roughnessM ?? 0),
    material: String(segment.material ?? ''),
    elevationChangeM: Number(segment.elevationChangeM ?? 0),
    minorLossCoefficient: Number(segment.minorLossCoefficient ?? 0),
    accessories: { ...DEFAULT_ACCESSORIES, ...(segment.accessories ?? {}) },
  }));
  const pipe = transport?.pipe1 ?? {};
  return [{
    id: 'Pipe 1',
    innerDiameterM: Number(pipe.innerDiameterM ?? 0),
    lengthM: Number(pipe.lengthM ?? 0),
    roughnessM: Number(pipe.roughnessM ?? 0),
    material: String(pipe.material ?? ''),
    elevationChangeM: Number(pipe.elevationChangeM ?? 0),
    minorLossCoefficient: Number(pipe.minorLossCoefficient ?? 0),
    accessories: { ...DEFAULT_ACCESSORIES, ...(pipe.accessories ?? {}) },
  }];
}

export function calculateVelocityFromFlowRate({ flowRateM3s, innerDiameterM }) {
  assertNonNegativeNumber(flowRateM3s, 'flowRateM3s');
  assertPositiveNumber(innerDiameterM, 'innerDiameterM');
  return flowRateM3s / (Math.PI * innerDiameterM ** 2 / 4);
}

export function buildCircuitHydraulicInputs({ transport, flowRateM3s }) {
  assertNonNegativeNumber(flowRateM3s, 'flowRateM3s');
  return normalizeCircuitSegments(transport).map((segment) => {
    if (!(segment.innerDiameterM > 0)) throw new RangeError(`${segment.id}: diámetro debe ser > 0.`);
    if (!(segment.lengthM >= 0)) throw new RangeError(`${segment.id}: longitud inválida.`);
    const accessories = calculateAccessoryCoefficient(segment.accessories, segment.minorLossCoefficient);
    return {
      ...segment,
      velocityMps: calculateVelocityFromFlowRate({ flowRateM3s, innerDiameterM: segment.innerDiameterM }),
      totalK: accessories.totalK,
      accessoryBreakdown: accessories.breakdown,
    };
  });
}
