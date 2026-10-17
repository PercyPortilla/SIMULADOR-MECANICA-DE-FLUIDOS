import { describe, expect, it } from 'vitest';
import {
  buildCircuitHydraulicInputs,
  calculateAccessoryCoefficient,
  normalizeCircuitSegments,
} from '../../src/core/hydraulics/circuit.js';

describe('hydraulic circuit segments', () => {
  it('migrates legacy Pipe 1 to one segment without changing geometry inputs', () => {
    const transport = { pipe1: { innerDiameterM: 0.15, lengthM: 100, roughnessM: 0.000046, material: 'Acero', elevationChangeM: 5, minorLossCoefficient: 2.4, accessories: {} }, segments: [] };
    const [segment] = normalizeCircuitSegments(transport);
    expect(segment.id).toBe('Pipe 1');
    expect(segment.innerDiameterM).toBe(0.15);
    expect(segment.lengthM).toBe(100);
  });

  it('adds explicit accessory K values and keeps manual K as other legacy loss', () => {
    const result = calculateAccessoryCoefficient({ valvesCount: 1, valveK: 0.2, elbowsCount: 2, elbowK: 0.9, teesCount: 0, teeK: 1.8, reducersCount: 1, reducerK: 0.4, otherK: 0 }, 0);
    expect(result.totalK).toBeCloseTo(2.4, 12);
  });

  it('conserves flow and changes velocity when segment diameter changes', () => {
    const inputs = buildCircuitHydraulicInputs({
      flowRateM3s: 0.02,
      transport: { segments: [
        { id: 'A', innerDiameterM: 0.2, lengthM: 10, roughnessM: 0, elevationChangeM: 0 },
        { id: 'B', innerDiameterM: 0.1, lengthM: 10, roughnessM: 0, elevationChangeM: 0 },
      ] },
    });
    expect(inputs[1].velocityMps).toBeCloseTo(inputs[0].velocityMps * 4, 10);
  });
});
