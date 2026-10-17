import { describe, expect, it, vi } from 'vitest';
import { calculateSimulationResults } from '../../src/controller/simulationController.js';
import {
  getInitialState,
  getState,
  resetState,
  updateState,
} from '../../src/state/simulationState.js';
import { PRESENTATION_STOP_IDS } from '../../src/ui/inspectionGuide.js';
import {
  ACADEMIC_CASES,
  getAcademicCase,
  loadAcademicCase,
} from '../../src/ui/academicCases.js';

function merge(base, patch) {
  const result = structuredClone(base);
  Object.entries(patch ?? {}).forEach(([key, value]) => {
    result[key] = value && typeof value === 'object' && !Array.isArray(value)
      ? merge(result[key], value)
      : structuredClone(value);
  });
  return result;
}

describe('academic guided cases', () => {
  it('ships six unique cases with complete teaching metadata', () => {
    expect(ACADEMIC_CASES).toHaveLength(6);
    expect(new Set(ACADEMIC_CASES.map((item) => item.id)).size).toBe(6);
    ACADEMIC_CASES.forEach((item) => {
      expect(item.name.length).toBeGreaterThan(10);
      expect(item.objective.length).toBeGreaterThan(20);
      expect(item.question.length).toBeGreaterThan(20);
      expect(item.observe.length).toBeGreaterThanOrEqual(4);
      expect(item.caution.length).toBeGreaterThan(20);
      expect(item.presentationStartId).toBeTruthy();
      expect(PRESENTATION_STOP_IDS).toContain(item.presentationStartId);
    });
  });

  it('loads a case only through the normal reset/update state contract', () => {
    const reset = vi.fn();
    const update = vi.fn();
    const selected = loadAcademicCase('high-solids-bingham', update, reset);
    expect(reset).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledOnce();
    expect(update.mock.calls[0][0]).toEqual(selected.inputs);
    expect(selected.inputs.slurry.solidsMassFraction).toBe(0.5);
  });

  it('loads every case through the real validated simulation state', () => {
    ACADEMIC_CASES.forEach((item) => {
      loadAcademicCase(item.id, updateState, resetState);
      const state = getState();
      expect(state.rheology.model).toBe(item.inputs.rheology.model);
      expect(state.transport.pipe1.innerDiameterM).toBe(item.inputs.transport.pipe1.innerDiameterM);
    });
    resetState();
  });

  it('rejects an unknown case before mutating state callbacks', () => {
    const reset = vi.fn();
    const update = vi.fn();
    expect(() => loadAcademicCase('missing-case', update, reset)).toThrow(/no disponible/i);
    expect(reset).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });

  it('keeps every case numerically executable and explicit about result quality', () => {
    ACADEMIC_CASES.forEach((item) => {
      const state = merge(getInitialState(), item.inputs);
      const results = calculateSimulationResults(state);
      expect(results.slurry?.densityKgM3).toBeGreaterThan(0);
      expect(results.transport?.flowRateM3s).toBeGreaterThan(0);
      expect(results.transport?.requiredPressurePa).toBeGreaterThan(0);
      expect(results.energy?.electricalPowerW).toBeGreaterThan(0);
    });
    expect(calculateSimulationResults(merge(getInitialState(), getAcademicCase('herschel-bulkley').inputs)).transport.resultQuality)
      .toBe('validated-laminar');
    expect(calculateSimulationResults(merge(getInitialState(), getAcademicCase('power-law-scope').inputs)).transport.resultQuality)
      .toBe('educational-estimate');
  });

  it('teaches metallurgical decoupling with explicit residence and recovery inputs', () => {
    const results = calculateSimulationResults(merge(getInitialState(), getAcademicCase('metallurgical-scope').inputs));
    expect(results.leaching.residenceTimeH).toBeGreaterThan(9);
    expect(results.leaching.conversion).toBeGreaterThan(0.5);
    expect(results.recovery.overallRecovery).toBeGreaterThan(0.79);
    expect(results.recovery.finalMetalKgH).toBeGreaterThan(7.9);
  });
});
