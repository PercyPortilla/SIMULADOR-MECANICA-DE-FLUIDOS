import {
  ACADEMIC_COMPARISON_METRICS,
  compareAcademicCases,
} from './academicComparison.js';
import { getAcademicCase } from './academicCases.js';

export const ACADEMIC_PREDICTION_OPTIONS = Object.freeze(['sube', 'baja', 'igual', 'no-se']);

const METRIC_BY_KEY = new Map(ACADEMIC_COMPARISON_METRICS.map((metric) => [metric.key, metric]));

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

function predictionMetric(key) {
  const metric = METRIC_BY_KEY.get(key);
  if (!metric) throw new RangeError(`Métrica académica no disponible: ${key}.`);
  return Object.freeze({
    key,
    label: metric.label,
    unit: metric.unit,
    options: ACADEMIC_PREDICTION_OPTIONS,
  });
}

function academicExperiment({
  id,
  name,
  objective,
  question,
  baseCaseId,
  interventionCaseId,
  metricKeys,
}) {
  const baseCase = getAcademicCase(baseCaseId);
  const interventionCase = getAcademicCase(interventionCaseId);
  if (!baseCase || !interventionCase) throw new RangeError(`Experimento académico ${id} referencia un caso inexistente.`);
  return deepFreeze({
    id,
    name,
    objective,
    question,
    baseCaseId,
    interventionCaseId,
    baseCase,
    interventionCase,
    predictions: metricKeys.map(predictionMetric),
  });
}

export const ACADEMIC_LAB_EXPERIMENTS = Object.freeze([
  academicExperiment({
    id: 'static-head-energy',
    name: 'Experimento 1 · Carga estática y energía',
    objective: 'Aislar el efecto de mayor longitud hidráulica y desnivel sobre la demanda de bombeo manteniendo la referencia Newtoniana.',
    question: 'Si el caudal permanece igual pero aumentan L y Δz, ¿qué ocurrirá con presión, carga y energía?',
    baseCaseId: 'newtonian-reference',
    interventionCaseId: 'static-head-energy',
    metricKeys: ['flow', 'pressure', 'head', 'power', 'annualEnergy'],
  }),
  academicExperiment({
    id: 'solids-rheology-demand',
    name: 'Experimento 2 · Sólidos, reología y bombeo',
    objective: 'Contrastar una referencia Newtoniana con una pulpa Bingham de mayor concentración sin atribuir la reología únicamente al porcentaje de sólidos.',
    question: '¿Cómo cambian densidad, caudal y demanda hidráulica cuando cambian simultáneamente Cw, reología y velocidad?',
    baseCaseId: 'newtonian-reference',
    interventionCaseId: 'high-solids-bingham',
    metricKeys: ['density', 'flow', 'reynolds', 'pressure', 'power'],
  }),
  academicExperiment({
    id: 'bingham-vs-hb',
    name: 'Experimento 3 · Bingham vs Herschel–Bulkley',
    objective: 'Comparar dos pulpas no Newtonianas en rama laminar validada y separar cambios de composición de cambios en la ley constitutiva.',
    question: 'Con la misma velocidad nominal, ¿qué métricas permanecen y cuáles responden a la nueva composición y reología?',
    baseCaseId: 'high-solids-bingham',
    interventionCaseId: 'herschel-bulkley',
    metricKeys: ['density', 'flow', 'reynolds', 'pressure', 'power'],
  }),
  academicExperiment({
    id: 'model-scope-boundary',
    name: 'Experimento 4 · Dominio validado vs estimación',
    objective: 'Practicar la lectura de resultQuality y modelStatus cuando una comparación cruza el límite de aplicabilidad validado.',
    question: '¿Qué conclusiones numéricas deben tratarse con cautela cuando la intervención pasa a educational-estimate?',
    baseCaseId: 'herschel-bulkley',
    interventionCaseId: 'power-law-scope',
    metricKeys: ['density', 'flow', 'reynolds', 'pressure', 'power'],
  }),
  academicExperiment({
    id: 'metallurgical-scope',
    name: 'Experimento 5 · Residencia y recuperación explícita',
    objective: 'Relacionar volumen útil y eficiencias de recuperación con sus resultados sin inventar un acoplamiento metalúrgico que el solver no contiene.',
    question: '¿Qué cambia en residencia, conversión y metal final, y qué causas explícitas reconoce realmente el comparador?',
    baseCaseId: 'newtonian-reference',
    interventionCaseId: 'metallurgical-scope',
    metricKeys: ['flow', 'residence', 'leachConversion', 'recovery', 'gold'],
  }),
]);

export function getAcademicExperiment(id) {
  return ACADEMIC_LAB_EXPERIMENTS.find((experiment) => experiment.id === id) ?? null;
}

export function classifyAcademicDelta(metric, {
  relativeTolerance = 1e-9,
  absoluteTolerance = 1e-9,
} = {}) {
  if (!metric || !Number.isFinite(metric.delta) || !Number.isFinite(metric.left) || !Number.isFinite(metric.right)) return 'no-se';
  const scale = Math.max(1, Math.abs(metric.left), Math.abs(metric.right));
  const tolerance = Math.max(absoluteTolerance, scale * relativeTolerance);
  if (Math.abs(metric.delta) <= tolerance) return 'igual';
  return metric.delta > 0 ? 'sube' : 'baja';
}

function resultQualitySnapshot(results) {
  const transport = results?.transport ?? {};
  return Object.freeze({
    resultQuality: transport.resultQuality ?? 'validated',
    modelStatus: transport.modelStatus ?? null,
    flowRegime: transport.flowRegime ?? null,
    calculationMode: transport.calculationMode ?? null,
  });
}

function selectConclusionInsights(comparison, maxCausalInsights = 2) {
  const insights = Array.isArray(comparison?.insights) ? comparison.insights : [];
  const causal = insights.filter((item) => item?.key !== 'scope').slice(0, Math.max(1, maxCausalInsights));
  const scope = insights.find((item) => item?.key === 'scope');
  return scope ? [...causal, scope] : causal;
}

export function buildAcademicCausalConclusion(comparison, { maxCausalInsights = 2 } = {}) {
  const selected = selectConclusionInsights(comparison, maxCausalInsights);
  return Object.freeze({
    insightKeys: Object.freeze(selected.map((item) => item.key)),
    text: selected.map((item) => `${item.title}: ${item.explanation}`).join(' '),
  });
}

export function evaluateAcademicHypotheses(experimentId, hypotheses = {}) {
  const experiment = getAcademicExperiment(experimentId);
  if (!experiment) throw new RangeError(`Experimento académico no disponible: ${experimentId}.`);
  if (!hypotheses || typeof hypotheses !== 'object' || Array.isArray(hypotheses)) {
    throw new TypeError('Las hipótesis deben enviarse como un objeto métrica → predicción.');
  }

  const comparison = compareAcademicCases(experiment.baseCaseId, experiment.interventionCaseId);
  const configuredKeys = new Set(experiment.predictions.map((item) => item.key));
  Object.entries(hypotheses).forEach(([key, prediction]) => {
    if (!configuredKeys.has(key)) throw new RangeError(`La métrica ${key} no pertenece al experimento ${experimentId}.`);
    if (!ACADEMIC_PREDICTION_OPTIONS.includes(prediction)) {
      throw new RangeError(`Predicción inválida para ${key}: ${prediction}.`);
    }
  });

  const evaluations = experiment.predictions.map((definition) => {
    const metric = comparison.metrics.find((item) => item.key === definition.key);
    const predicted = Object.hasOwn(hypotheses, definition.key) ? hypotheses[definition.key] : null;
    const actual = classifyAcademicDelta(metric);
    return Object.freeze({
      key: definition.key,
      label: definition.label,
      unit: definition.unit,
      predicted,
      actual,
      answered: predicted !== null,
      matches: predicted === null ? null : predicted === actual,
      left: metric?.left ?? null,
      right: metric?.right ?? null,
      delta: metric?.delta ?? null,
      percentDelta: metric?.percentDelta ?? null,
    });
  });

  const answered = evaluations.filter((item) => item.answered);
  const scopeInsight = comparison.insights.find((item) => item.key === 'scope') ?? null;
  return Object.freeze({
    experiment,
    comparison,
    evaluations: Object.freeze(evaluations),
    score: Object.freeze({
      answered: answered.length,
      correct: answered.filter((item) => item.matches).length,
      incorrect: answered.filter((item) => item.matches === false).length,
      unanswered: evaluations.length - answered.length,
    }),
    resultQuality: Object.freeze({
      base: resultQualitySnapshot(comparison.leftResults),
      intervention: resultQualitySnapshot(comparison.rightResults),
    }),
    scope: Object.freeze({
      limited: Boolean(scopeInsight),
      insight: scopeInsight,
    }),
    conclusion: buildAcademicCausalConclusion(comparison),
  });
}
