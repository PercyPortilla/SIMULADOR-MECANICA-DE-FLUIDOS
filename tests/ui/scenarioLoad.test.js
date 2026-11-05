import { afterEach, describe, expect, it } from 'vitest';
import { getInitialState, getState, resetState, updateState } from '../../src/state/simulationState.js';
import { prepareScenarioState } from '../../src/ui/scenarioLoad.js';

afterEach(() => resetState());

describe('atomic loading of saved physical scenarios', () => {
  it('normalizes incomplete legacy saves with defaults without mutating the active state', () => {
    updateState({ slurry: { solidsMassFraction: 0.43 } });
    const before = getState();
    const candidate = prepareScenarioState(getInitialState(), { transport: { pipe1: { velocityMps: 1.8 } } });
    expect(candidate.slurry.solidsMassFraction).toBe(0);
    expect(candidate.transport.pipe1.velocityMps).toBe(1.8);
    expect(getState()).toEqual(before);
    updateState(candidate);
    expect(getState().slurry.solidsMassFraction).toBe(0);
    expect(getState().transport.pipe1.velocityMps).toBe(1.8);
  });

  it('does not erase current values when a malicious or invalid save fails validation', () => {
    updateState({ transport: { pipe1: { velocityMps: 1.75 } } });
    const before = getState();
    const invalid = prepareScenarioState(getInitialState(), { slurry: { solidsMassFraction: 9 } });
    expect(() => updateState(invalid)).toThrow(/entre 0 y 1/);
    expect(getState()).toEqual(before);
    expect(() => prepareScenarioState(getInitialState(), { attacker: { injected: true } }))
      .toThrow(/no pertenece al estado/);
    expect(getState()).toEqual(before);
  });
});
