import { describe, expect, it } from 'vitest';
import { NullEngine } from '@babylonjs/core';
import { getState } from '../../src/state/simulationState.js';
import { createBabylonRuntime } from '../../src/babylon/runtime/baseEnvironment.js';

describe('Babylon runtime state invariance', () => {
  it('keeps solver/state data unchanged when only visual Babylon APIs are exercised', () => {
    const before = getState();
    const engine = new NullEngine({ renderWidth: 320, renderHeight: 240 });
    const canvas = { addEventListener() {}, removeEventListener() {} };
    const runtime = createBabylonRuntime({ canvas, engineFactory: () => engine });
    runtime.setProcessMetrics({ flowRateM3s: 0.06, pressurePa: 180000 });
    runtime.setScenePalette({ terrain: 0x887766, road: 0x665544, pipeSteel: 0x334455, pipeHdpe: 0x111111 });
    runtime.setAnimationsEnabled(false);
    runtime.setLabelsVisible(false);
    runtime.setCamera('top');
    runtime.setCamera('inspection');
    runtime.setPresentationMode(true);
    expect(getState()).toEqual(before);
    runtime.dispose();
  }, 30000);
});
