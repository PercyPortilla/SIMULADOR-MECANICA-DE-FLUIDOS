import { calculateSimulationResults } from '../controller/simulationController.js';
import { getInitialState } from '../state/simulationState.js';
import { getAcademicCase } from './academicCases.js';

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function merge(base, patch) {
  const result = structuredClone(base);
  Object.entries(patch ?? {}).forEach(([key, value]) => {
    result[key] = isPlainObject(value) && isPlainObject(result[key])
      ? merge(result[key], value)
      : structuredClone(value);
  });
  return result;
}

function changed(a, b, tolerance = 1e-12) {
  if (typeof a === 'number' && typeof b === 'number') return Math.abs(a - b) > tolerance;
  return a !== b;
}

export const ACADEMIC_COMPARISON_METRICS = Object.freeze([
  Object.freeze({ key: 'density', label: 'Densidad de pulpa', unit: 'kg/m³', read: (r) => r.slurry?.densityKgM3 }),
  Object.freeze({ key: 'flow', label: 'Caudal', unit: 'm³/s', read: (r) => r.transport?.flowRateM3s }),
  Object.freeze({ key: 'reynolds', label: 'Re / Re*', unit: '', read: (r) => r.transport?.reynoldsNumber }),
  Object.freeze({ key: 'pressure', label: 'ΔP requerida', unit: 'kPa', scale: 0.001, read: (r) => r.transport?.requiredPressurePa }),
  Object.freeze({ key: 'head', label: 'Carga total', unit: 'm', read: (r) => r.transport?.totalHeadM }),
  Object.freeze({ key: 'power', label: 'Potencia eléctrica', unit: 'kW', scale: 0.001, read: (r) => r.energy?.electricalPowerW }),
  Object.freeze({ key: 'annualEnergy', label: 'Energía anual', unit: 'MWh/año', scale: 0.001, read: (r) => r.energy?.annualEnergyKwh }),
  Object.freeze({ key: 'residence', label: 'Residencia lixiviación', unit: 'h', read: (r) => r.leaching?.residenceTimeH }),
  Object.freeze({ key: 'leachConversion', label: 'Conversión CSTR', unit: '%', scale: 100, read: (r) => r.leaching?.conversion }),
  Object.freeze({ key: 'recovery', label: 'Recuperación global', unit: '%', scale: 100, read: (r) => r.recovery?.overallRecovery }),
  Object.freeze({ key: 'gold', label: 'Oro final', unit: 'kg/h', read: (r) => r.recovery?.finalMetalKgH }),
]);

function addInsight(items, key, title, explanation) {
  if (!items.some((item) => item.key === key)) items.push(Object.freeze({ key, title, explanation }));
}

export function explainAcademicCaseDifferences(leftState, rightState, leftResults, rightResults) {
  const insights = [];
  const ls = leftState.slurry;
  const rs = rightState.slurry;
  const lr = leftState.rheology;
  const rr = rightState.rheology;
  const lp = leftState.transport.pipe1;
  const rp = rightState.transport.pipe1;
  const le = leftState.energy;
  const re = rightState.energy;
  const ll = leftState.leaching;
  const rl = rightState.leaching;
  const lrec = leftState.recovery;
  const rrec = rightState.recovery;

  if (changed(ls.solidsMassFraction, rs.solidsMassFraction)
    || changed(ls.solidDensityKgM3, rs.solidDensityKgM3)
    || changed(ls.liquidDensityKgM3, rs.liquidDensityKgM3)) {
    addInsight(
      insights,
      'slurry-density',
      'Constitución de la pulpa',
      'La composición cambia la densidad de mezcla. PULPA LAB no infiere automáticamente τ₀, K, n o μp desde Cw; cualquier cambio reológico adicional proviene de entradas explícitas.',
    );
  }

  if (changed(lr.model, rr.model)
    || changed(lr.yieldStressPa, rr.yieldStressPa)
    || changed(lr.plasticViscosityPaS, rr.plasticViscosityPaS)
    || changed(lr.consistencyIndex, rr.consistencyIndex)
    || changed(lr.flowIndex, rr.flowIndex)
    || changed(lr.newtonianViscosityPaS, rr.newtonianViscosityPaS)
    || changed(lr.cassonViscosityPaS, rr.cassonViscosityPaS)) {
    addInsight(
      insights,
      'rheology',
      'Ley constitutiva',
      'Cambió el modelo o sus parámetros reológicos, por lo que cambia la relación entre esfuerzo y tasa de corte y, con ella, la pérdida distribuida calculada.',
    );
  }

  if (changed(lp.velocityMps, rp.velocityMps)) {
    addInsight(
      insights,
      'velocity',
      'Velocidad y caudal',
      'Con diámetro fijo, Q = V·πD²/4. Cambiar V modifica directamente el caudal, los términos dinámicos de pérdida y el tiempo de residencia aguas abajo.',
    );
  }

  if (changed(lp.innerDiameterM, rp.innerDiameterM)) {
    addInsight(
      insights,
      'diameter',
      'Diámetro de tubería',
      'El diámetro modifica simultáneamente el área de flujo, el caudal para una velocidad dada y la intensidad de las pérdidas hidráulicas. Es una variable física, no sólo visual.',
    );
  }

  if (changed(lp.lengthM, rp.lengthM)) {
    addInsight(
      insights,
      'length',
      'Longitud hidráulica',
      'La pérdida distribuida aumenta con la longitud hidráulica del tramo. En el simulador, L es una entrada de cálculo y no desplaza físicamente los equipos 3D.',
    );
  }

  if (changed(lp.elevationChangeM, rp.elevationChangeM)) {
    addInsight(
      insights,
      'elevation',
      'Carga estática',
      'El desnivel cambia la componente estática ρgΔz y, por tanto, la presión requerida, la carga total y la potencia de bombeo.',
    );
  }

  if (changed(lp.roughnessM, rp.roughnessM) && (lr.model === 'newtonian' || rr.model === 'newtonian')) {
    addInsight(
      insights,
      'roughness',
      'Rugosidad',
      'En la rama Newtoniana, ε/D interviene en el factor de fricción turbulento. No se atribuye este efecto a la rama no Newtoniana laminar.',
    );
  }

  if (changed(lp.minorLossCoefficient, rp.minorLossCoefficient)) {
    addInsight(
      insights,
      'minor-losses',
      'Pérdidas locales',
      'El coeficiente K adicional modifica las pérdidas locales proporcionales a la energía cinética del flujo.',
    );
  }

  if (changed(le.pumpEfficiency, re.pumpEfficiency) || changed(le.motorEfficiency, re.motorEfficiency)) {
    addInsight(
      insights,
      'efficiency',
      'Eficiencias',
      'La potencia eléctrica se obtiene de la potencia hidráulica dividida entre ηbomba·ηmotor; menor eficiencia incrementa la demanda eléctrica sin cambiar la hidráulica requerida.',
    );
  }

  if (changed(ll.totalUsefulVolumeM3, rl.totalUsefulVolumeM3)) {
    addInsight(
      insights,
      'leach-volume',
      'Volumen y residencia',
      'Con el mismo caudal, aumentar el volumen útil incrementa τ = V/Q y puede elevar la conversión del modelo CSTR en serie.',
    );
  }

  if (changed(ll.firstOrderRateConstantPerH, rl.firstOrderRateConstantPerH) || changed(ll.reactorCount, rl.reactorCount)) {
    addInsight(
      insights,
      'leach-kinetics',
      'Cinética de lixiviación',
      'Cambiar k o el número de reactores modifica directamente la conversión CSTR. k sigue siendo una entrada que requiere prueba o calibración.',
    );
  }

  const recoveryKeys = ['adsorptionEfficiency', 'elutionEfficiency', 'electrowinningEfficiency', 'smeltingEfficiency'];
  if (recoveryKeys.some((key) => changed(lrec[key], rrec[key]))) {
    addInsight(
      insights,
      'recovery',
      'Recuperación por etapas',
      'La recuperación global es el producto de las eficiencias explícitas de adsorción, elución, EW y fundición; mejorar una etapa eleva el metal final manteniendo las demás constantes.',
    );
  }

  if (changed(lrec.feedGoldKgH, rrec.feedGoldKgH)) {
    addInsight(
      insights,
      'gold-feed',
      'Alimentación de oro',
      'feedGoldKgH es una entrada independiente del bloque de lixiviación; el metal final escala con esa alimentación y las eficiencias de recuperación.',
    );
  }

  if (leftResults.transport?.resultQuality === 'educational-estimate'
    || rightResults.transport?.resultQuality === 'educational-estimate') {
    addInsight(
      insights,
      'scope',
      'Límite de aplicabilidad',
      'Al menos uno de los casos está fuera de la rama no Newtoniana laminar validada. Prioriza modelStatus y resultQuality sobre el valor numérico de ΔP.',
    );
  }

  if (!insights.length) {
    addInsight(insights, 'same', 'Sin cambios causales', 'Los dos casos tienen las mismas entradas físicas relevantes para el motor de cálculo.');
  }
  return Object.freeze(insights);
}

export function compareAcademicCases(leftId, rightId) {
  const leftCase = getAcademicCase(leftId);
  const rightCase = getAcademicCase(rightId);
  if (!leftCase || !rightCase) throw new RangeError('Selecciona dos casos académicos válidos.');

  const leftState = merge(getInitialState(), leftCase.inputs);
  const rightState = merge(getInitialState(), rightCase.inputs);
  const leftResults = calculateSimulationResults(leftState);
  const rightResults = calculateSimulationResults(rightState);

  const metrics = ACADEMIC_COMPARISON_METRICS.map((metric) => {
    const scale = metric.scale ?? 1;
    const left = metric.read(leftResults);
    const right = metric.read(rightResults);
    const leftScaled = typeof left === 'number' ? left * scale : left;
    const rightScaled = typeof right === 'number' ? right * scale : right;
    return Object.freeze({
      key: metric.key,
      label: metric.label,
      unit: metric.unit,
      left: leftScaled,
      right: rightScaled,
      delta: typeof leftScaled === 'number' && typeof rightScaled === 'number'
        ? rightScaled - leftScaled
        : null,
      percentDelta: typeof leftScaled === 'number' && typeof rightScaled === 'number' && Math.abs(leftScaled) > 1e-12
        ? (rightScaled - leftScaled) / Math.abs(leftScaled) * 100
        : null,
    });
  });

  return Object.freeze({
    leftCase,
    rightCase,
    leftState,
    rightState,
    leftResults,
    rightResults,
    metrics: Object.freeze(metrics),
    insights: explainAcademicCaseDifferences(leftState, rightState, leftResults, rightResults),
  });
}
