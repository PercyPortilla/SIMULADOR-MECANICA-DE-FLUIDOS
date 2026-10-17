import { describe, expect, it } from 'vitest';
import {
  SCENARIO_LIBRARY_KEY,
  SCENARIO_STORAGE_KEY,
  clearScenario,
  compareScenarios,
  deleteNamedScenario,
  exportScenarioCsv,
  exportScenarioJson,
  extractScenario,
  listScenarios,
  loadScenario,
  loadNamedScenario,
  saveNamedScenario,
  saveScenario,
} from '../../src/ui/scenarios.js';

function createStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
}

const state = {
  study: {},
  slurry: { solidsMassFraction: 0.35, solidDensityKgM3: 2650, liquidDensityKgM3: 1000 },
  rheology: { model: 'bingham', yieldStressPa: 4, consistencyIndex: 0, flowIndex: 0, plasticViscosityPaS: 0.05, newtonianViscosityPaS: 0 },
  transport: { pipe1: { innerDiameterM: 0.15, lengthM: 100, roughnessM: 0, material: 'Acero', velocityMps: 1.5 } },
  energy: { pumpEfficiency: 0.8, motorEfficiency: 0.9, operatingHoursPerYear: 8000, electricityPricePerKwh: 0.1 },
  leaching: { kineticModel: '', totalUsefulVolumeM3: 0, reactorCount: 4, firstOrderRateConstantPerH: 0 },
  recovery: { model: '', feedGoldKgH: 0, adsorptionEfficiency: 0, elutionEfficiency: 0, electrowinningEfficiency: 0, smeltingEfficiency: 0 },
  process: {},
};

describe('simulation scenarios', () => {
  it('stores only physical input sections, not UI preferences or derived results', () => {
    expect(Object.keys(extractScenario(state))).toEqual(['slurry', 'rheology', 'transport', 'energy', 'leaching', 'recovery', 'process']);
    expect(extractScenario(state).transport.pipe1.material).toBeUndefined();
  });

  it('saves, loads and clears one local scenario', () => {
    const storage = createStorage();
    saveScenario(state, storage);
    expect(storage.getItem(SCENARIO_STORAGE_KEY)).toContain('bingham');
    expect(loadScenario(storage).transport.pipe1.lengthM).toBe(100);
    clearScenario(storage);
    expect(loadScenario(storage)).toBeNull();
  });

  it('stores multiple named scenarios, compares them and exports portable data', () => {
    const storage = createStorage();
    const first = saveNamedScenario({ name: 'Caso A', state, id: 'a' }, storage);
    const modified = structuredClone(state);
    modified.transport.pipe1.lengthM = 200;
    const second = saveNamedScenario({ name: 'Caso B', state: modified, id: 'b' }, storage);
    expect(JSON.parse(storage.getItem(SCENARIO_LIBRARY_KEY))).toHaveLength(2);
    expect(listScenarios(storage)).toHaveLength(2);
    expect(loadNamedScenario('a', storage).name).toBe('Caso A');
    expect(compareScenarios(first, second)).toContainEqual({ key: 'transport.pipe1.lengthM', left: 100, right: 200 });
    expect(exportScenarioJson('Caso A', state)).toContain('Caso A');
    expect(exportScenarioCsv('Caso A', state)).toContain('transport.pipe1.lengthM');
    deleteNamedScenario('a', storage);
    expect(listScenarios(storage)).toHaveLength(1);
  });

  it('persists segmented transport and compares arrays by content instead of reference', () => {
    const segmented = structuredClone(state);
    segmented.transport.segments = [{
      id: 'S1',
      innerDiameterM: 0.2,
      lengthM: 10,
      roughnessM: 0.00005,
      material: 'Acero',
      elevationChangeM: 0,
      minorLossCoefficient: 0,
      accessories: { valvesCount: 0, valveK: 0.2, elbowsCount: 0, elbowK: 0.9, teesCount: 0, teeK: 1.8, reducersCount: 0, reducerK: 0.4, otherK: 0 },
    }];
    segmented.transport.settlingFactorFl = 1.34;
    const extracted = extractScenario(segmented);
    expect(extracted.transport.segments).toHaveLength(1);
    expect(extracted.transport.settlingFactorFl).toBe(1.34);
    expect(compareScenarios({ inputs: extracted }, { inputs: structuredClone(extracted) })).toHaveLength(0);
  });

  it('ignores the visual Pipe 1 material when comparing a saved scenario against live state', () => {
    const storage = createStorage();
    const saved = saveNamedScenario({ name: 'Visual', state, id: 'visual' }, storage);
    const live = structuredClone(state);
    live.transport.pipe1.material = 'HDPE visual';
    expect(compareScenarios(saved, live)).toHaveLength(0);
  });
});
