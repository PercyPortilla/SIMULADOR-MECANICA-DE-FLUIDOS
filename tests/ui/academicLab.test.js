import { describe, expect, it } from 'vitest';
import { compareAcademicCases } from '../../src/ui/academicComparison.js';
import {
  ACADEMIC_LAB_EXPERIMENTS,
  ACADEMIC_PREDICTION_OPTIONS,
  buildAcademicCausalConclusion,
  classifyAcademicDelta,
  evaluateAcademicHypotheses,
  getAcademicExperiment,
} from '../../src/ui/academicLab.js';

describe('V20 academic laboratory core', () => {
  it('defines five guided experiments from existing academic cases and valid comparison metrics', () => {
    expect(ACADEMIC_LAB_EXPERIMENTS).toHaveLength(5);
    expect(new Set(ACADEMIC_LAB_EXPERIMENTS.map((item) => item.id)).size).toBe(5);
    ACADEMIC_LAB_EXPERIMENTS.forEach((experiment) => {
      expect(experiment.name.length).toBeGreaterThan(15);
      expect(experiment.objective.length).toBeGreaterThan(30);
      expect(experiment.question.length).toBeGreaterThan(30);
      expect(experiment.baseCase.id).toBe(experiment.baseCaseId);
      expect(experiment.interventionCase.id).toBe(experiment.interventionCaseId);
      expect(experiment.predictions.length).toBeGreaterThanOrEqual(4);
      experiment.predictions.forEach((prediction) => {
        expect(prediction.options).toBe(ACADEMIC_PREDICTION_OPTIONS);
        expect(prediction.options).toEqual(['sube', 'baja', 'igual', 'no-se']);
      });
    });
  });

  it('classifies real deltas as up, down, equal or unknown with numerical tolerance', () => {
    expect(classifyAcademicDelta({ left: 10, right: 12, delta: 2 })).toBe('sube');
    expect(classifyAcademicDelta({ left: 10, right: 8, delta: -2 })).toBe('baja');
    expect(classifyAcademicDelta({ left: 10, right: 10 + 1e-11, delta: 1e-11 })).toBe('igual');
    expect(classifyAcademicDelta({ left: null, right: 4, delta: null })).toBe('no-se');
  });

  it('evaluates hypotheses against compareAcademicCases deltas for the static-head experiment', () => {
    const evaluation = evaluateAcademicHypotheses('static-head-energy', {
      flow: 'igual',
      pressure: 'sube',
      head: 'sube',
      power: 'sube',
      annualEnergy: 'sube',
    });

    expect(evaluation.score).toEqual({ answered: 5, correct: 5, incorrect: 0, unanswered: 0 });
    expect(evaluation.evaluations.find((item) => item.key === 'flow').delta).toBeCloseTo(0, 12);
    expect(evaluation.evaluations.find((item) => item.key === 'pressure').delta).toBeGreaterThan(0);
    expect(evaluation.comparison.leftCase.id).toBe('newtonian-reference');
    expect(evaluation.comparison.rightCase.id).toBe('static-head-energy');
  });

  it('preserves resultQuality and explicit scope when crossing the applicability boundary', () => {
    const evaluation = evaluateAcademicHypotheses('model-scope-boundary', {
      pressure: 'no-se',
    });

    expect(evaluation.resultQuality.base.resultQuality).toBe('validated-laminar');
    expect(evaluation.resultQuality.intervention.resultQuality).toBe('educational-estimate');
    expect(evaluation.scope.limited).toBe(true);
    expect(evaluation.scope.insight?.key).toBe('scope');
    expect(evaluation.conclusion.insightKeys).toContain('scope');
    expect(evaluation.score.answered).toBe(1);
    expect(evaluation.evaluations.find((item) => item.key === 'pressure').matches).toBe(false);
  });

  it('builds compact conclusions only from comparison insights', () => {
    const comparison = compareAcademicCases('newtonian-reference', 'high-solids-bingham');
    const conclusion = buildAcademicCausalConclusion(comparison, { maxCausalInsights: 2 });
    const availableKeys = new Set(comparison.insights.map((item) => item.key));
    conclusion.insightKeys.forEach((key) => expect(availableKeys.has(key)).toBe(true));
    conclusion.insightKeys.forEach((key) => {
      const insight = comparison.insights.find((item) => item.key === key);
      expect(conclusion.text).toContain(insight.title);
      expect(conclusion.text).toContain(insight.explanation);
    });
    expect(conclusion.insightKeys.length).toBeLessThanOrEqual(2);
  });

  it('keeps unanswered hypotheses neutral and rejects invalid experiment inputs', () => {
    const evaluation = evaluateAcademicHypotheses('bingham-vs-hb', {});
    expect(evaluation.score.answered).toBe(0);
    expect(evaluation.score.unanswered).toBe(evaluation.evaluations.length);
    expect(evaluation.evaluations.every((item) => item.matches === null)).toBe(true);
    expect(getAcademicExperiment('missing')).toBeNull();
    expect(() => evaluateAcademicHypotheses('missing', {})).toThrow(/no disponible/i);
    expect(() => evaluateAcademicHypotheses('static-head-energy', { pressure: 'tal-vez' })).toThrow(/predicción inválida/i);
    expect(() => evaluateAcademicHypotheses('static-head-energy', { recovery: 'sube' })).toThrow(/no pertenece/i);
  });
});
