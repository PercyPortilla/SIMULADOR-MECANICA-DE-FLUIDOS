import { describe, expect, it } from 'vitest';
import { buildSimulationMemo, simulationMemoToCsv, simulationMemoToPrintableHtml } from '../../src/reporting/simulationMemo.js';

describe('simulation calculation memo', () => {
  it('records equations, substitutions, warnings and applicable references from the same state/results', () => {
    const state = {
      slurry: { solidsMassFraction: 0.35, solidDensityKgM3: 4200, liquidDensityKgM3: 1000 },
      rheology: { model: 'hb' },
      transport: { pipe1: { innerDiameterM: 0.15, lengthM: 100, velocityMps: 1.5, elevationChangeM: 0 } },
      energy: { pumpEfficiency: 0.75, motorEfficiency: 1 },
      leaching: { firstOrderRateConstantPerH: 0.1 },
    };
    const results = {
      slurry: { densityKgM3: 1363.636 },
      transport: { flowRateM3s: 0.0265, distributedPressureDropPa: 89614, minorLossPressurePa: 3682, staticPressurePa: 0, pressureDropPa: 93296, requiredPressurePa: 93296, calculationMode: 'non-newtonian-dodge-metzner-estimate', resultQuality: 'educational-estimate', flowRegime: 'turbulent', settling: { note: 'Orientativo.' } },
      rheology: { wallStressPa: 33.605, fanningFrictionFactor: 0.02 },
      energy: { electricalPowerW: 3300, annualEnergyKwh: 26400 },
    };
    const memo = buildSimulationMemo({ state, results, scenarioName: 'Legacy HB' });
    expect(memo.sections.find((s) => s.id === 'equations').rows.some((r) => r.label === 'Sustitución densidad')).toBe(true);
    expect(memo.sections.find((s) => s.id === 'warnings').rows.length).toBeGreaterThan(0);
    expect(memo.sections.find((s) => s.id === 'references').rows.some((r) => r.value.includes('Dodge'))).toBe(true);
    expect(simulationMemoToCsv(memo)).toContain('Legacy HB');
    expect(simulationMemoToPrintableHtml(memo)).toContain('window.print()');
  });
});
