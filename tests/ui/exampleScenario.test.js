import { describe, expect, it, vi } from 'vitest';
import { EXAMPLE_SIMULATION_INPUTS, loadExampleSimulation } from '../../src/ui/exampleScenario.js';

describe('example simulation inputs', () => {
  it('ships a non-zero coherent demonstration case', () => {
    expect(EXAMPLE_SIMULATION_INPUTS.slurry.solidsMassFraction).toBeGreaterThan(0);
    expect(EXAMPLE_SIMULATION_INPUTS.rheology.model).toBe('bingham');
    expect(EXAMPLE_SIMULATION_INPUTS.transport.pipe1.innerDiameterM).toBeGreaterThan(0);
    expect(EXAMPLE_SIMULATION_INPUTS.transport.pipe1.velocityMps).toBeGreaterThan(0);
    expect(EXAMPLE_SIMULATION_INPUTS.energy.pumpEfficiency).toBeGreaterThan(0);
    expect(EXAMPLE_SIMULATION_INPUTS.leaching.totalUsefulVolumeM3).toBeGreaterThan(0);
    expect(EXAMPLE_SIMULATION_INPUTS.recovery.feedGoldKgH).toBeGreaterThan(0);
  });

  it('can restore the example through the normal state update contract', () => {
    const reset = vi.fn();
    const update = vi.fn((patch) => patch);
    const result = loadExampleSimulation(update, reset);
    expect(reset).toHaveBeenCalledOnce();
    expect(update).toHaveBeenCalledWith(EXAMPLE_SIMULATION_INPUTS);
    expect(result.rheology.model).toBe('bingham');
  });
});
