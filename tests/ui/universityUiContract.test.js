import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PARAMETER_SECTIONS } from '../../src/ui/parameterSchema.js';

const mainSource = readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');
const resultsSource = readFileSync(new URL('../../src/ui/resultsPanel.js', import.meta.url), 'utf8');
const memoSource = readFileSync(new URL('../../src/reporting/simulationMemo.js', import.meta.url), 'utf8');

describe('University fluid-mechanics UI contract', () => {
  it('separates the primary parameter domains used by the engineering workflow', () => {
    const ids = PARAMETER_SECTIONS.map((section) => section.id);
    expect(ids).toEqual(expect.arrayContaining(['slurry', 'rheology', 'transport', 'losses', 'energy', 'leaching', 'recovery', 'process']));
    expect(PARAMETER_SECTIONS.find((section) => section.id === 'transport')?.title).toContain('Tubería');
    expect(PARAMETER_SECTIONS.find((section) => section.id === 'losses')?.title).toContain('Pérdidas');
    expect(PARAMETER_SECTIONS.find((section) => section.id === 'energy')?.title).toContain('Bomba');
  });

  it('prioritizes the eight principal hydraulic KPIs and explicit validity states', () => {
    ['kpi-flow', 'kpi-velocity', 'kpi-reynolds', 'kpi-friction-factor', 'kpi-dp', 'kpi-head', 'kpi-power', 'kpi-npsh']
      .forEach((id) => expect(mainSource).toContain(`id="${id}"`));
    ['validity-hydraulic', 'validity-rheology', 'validity-pump', 'validity-process']
      .forEach((id) => expect(mainSource).toContain(`id="${id}"`));
    expect(resultsSource).toContain('resultado educativo');
    expect(resultsSource).toContain('no calculable');
  });

  it('keeps equations, scenario comparison and technical exports visible in the workflow', () => {
    expect(mainSource).toContain('Ecuaciones / Supuestos');
    expect(mainSource).toContain('engineering-comparison');
    expect(mainSource).toContain('Comparación A/B');
    expect(memoSource).toContain('NPSH disponible');
    expect(memoSource).toContain('Darcy–Weisbach');
  });
});
