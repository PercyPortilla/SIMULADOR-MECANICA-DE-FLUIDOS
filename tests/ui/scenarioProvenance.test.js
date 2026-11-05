import { describe, expect, it } from 'vitest';
import { resolveMemoryScenarioProvenance } from '../../src/ui/scenarioProvenance.js';

describe('report provenance vs selected saved scenarios', () => {
  const saved = {
    id: 'stored-A', name: 'Ensayo A',
    inputs: { transport: { pipe1: { velocityMps: 2 } }, slurry: { concentration: 0.4 } },
  };
  it('uses saved name only when the active data exactly matches the selected stored data', () => {
    const result = resolveMemoryScenarioProvenance(saved, saved.inputs);
    expect(result.matchesSaved).toBe(true);
    expect(result.scenarioName).toBe('Ensayo A');
  });
  it('does not mislabel a changed or never-loaded scenario as the stored scenario', () => {
    const result = resolveMemoryScenarioProvenance(saved, {
      transport: { pipe1: { velocityMps: 4 } },
      slurry: { concentration: 0.4 },
    });
    expect(result.matchesSaved).toBe(false);
    expect(result.scenarioName).not.toContain('Ensayo A');
    expect(result.notice).toContain('NO coinciden');
  });
  it('uses neutral attribution without a library selection', () => {
    const result = resolveMemoryScenarioProvenance(null, saved.inputs);
    expect(result.scenarioName).toBe('Escenario actual');
    expect(result.notice).toBe('');
  });
});
