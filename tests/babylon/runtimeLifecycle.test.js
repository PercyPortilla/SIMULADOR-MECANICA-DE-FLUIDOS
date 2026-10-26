import { describe, expect, it, vi } from 'vitest';
import { NullEngine, Vector3 } from '@babylonjs/core';
import {
  captureBabylonOrbitCameraState,
  createBabylonRuntime,
  createBaseEnvironment,
  restoreBabylonOrbitCameraState,
} from '../../src/babylon/runtime/baseEnvironment.js';

describe('Babylon runtime lifecycle', () => {
  it('captures and restores the shared Inspection orbit camera exactly around Lab use', () => {
    const engine = new NullEngine({ renderWidth: 800, renderHeight: 500 });
    const canvas = { addEventListener() {}, removeEventListener() {} };
    const runtime = createBabylonRuntime({ canvas, engineFactory: () => engine });
    const camera = runtime.cameras.inspection;
    camera.setTarget(new Vector3(201, 26, -94));
    camera.setPosition(new Vector3(175, 49, -52));
    camera.lowerRadiusLimit = 2.25;
    camera.upperRadiusLimit = 310;
    camera.minZ = 0.17;
    const snapshot = captureBabylonOrbitCameraState(camera);
    camera.setTarget(new Vector3(0, 0, 0));
    camera.setPosition(new Vector3(1, 2, 3));
    camera.lowerRadiusLimit = 8;
    camera.upperRadiusLimit = 90;
    camera.minZ = 1;
    expect(restoreBabylonOrbitCameraState(camera, snapshot)).toBe(true);
    expect(camera.target.asArray()).toEqual(snapshot.target);
    expect(camera.position.asArray()).toEqual(snapshot.position);
    expect(camera.lowerRadiusLimit).toBeCloseTo(2.25, 8);
    expect(camera.upperRadiusLimit).toBeCloseTo(310, 8);
    expect(camera.minZ).toBeCloseTo(0.17, 8);
    runtime.dispose();
  }, 30000);

  it('attaches controls only for Inspection and exposes resize/render/dispose lifecycle', () => {
    const engine = new NullEngine({ renderWidth: 1096, renderHeight: 520 });
    const canvas = { addEventListener() {}, removeEventListener() {} };
    const runtime = createBabylonRuntime({ canvas, engineFactory: () => engine });
    const inspection = runtime.cameras.inspection;
    const attachSpy = vi.spyOn(inspection, 'attachControl').mockImplementation(() => {});
    const detachSpy = vi.spyOn(inspection, 'detachControl').mockImplementation(() => {});
    const resizeSpy = vi.spyOn(engine, 'resize').mockImplementation(() => {});
    const renderSpy = vi.spyOn(runtime.scene, 'render').mockImplementation(() => {});
    const sceneDisposeSpy = vi.spyOn(runtime.scene, 'dispose');
    const engineDisposeSpy = vi.spyOn(engine, 'dispose');
    expect(runtime.activeCamera).toBe('general');
    expect(runtime.inspectionControlsAttached).toBe(false);
    expect(runtime.animationsEnabled).toBe(true);
    expect(runtime.setAnimationsEnabled(false)).toBe(false);
    expect(runtime.animationsEnabled).toBe(false);
    expect(runtime.setAnimationsEnabled(true)).toBe(true);
    runtime.setCamera('recovery');
    expect(attachSpy).not.toHaveBeenCalled();
    runtime.setCamera('inspection');
    expect(runtime.activeCamera).toBe('inspection');
    expect(runtime.scene.activeCamera).toBe(inspection);
    expect(runtime.inspectionControlsAttached).toBe(true);
    expect(attachSpy).toHaveBeenCalledTimes(1);
    runtime.setCamera('general');
    expect(runtime.inspectionControlsAttached).toBe(false);
    expect(detachSpy).toHaveBeenCalledTimes(1);
    expect(runtime.resize()).toBe(true);
    expect(resizeSpy).toHaveBeenCalledTimes(1);
    expect(runtime.render()).toBe(true);
    expect(renderSpy).toHaveBeenCalledTimes(1);
    runtime.dispose();
    expect(runtime.disposed).toBe(true);
    expect(sceneDisposeSpy).toHaveBeenCalledTimes(1);
    expect(engineDisposeSpy).toHaveBeenCalledTimes(1);
    expect(runtime.resize()).toBe(false);
    expect(runtime.render()).toBe(false);
  }, 30000);

  it('provides the production createBaseEnvironment adapter with one render loop and ResizeObserver lifecycle', () => {
    const engine = new NullEngine({ renderWidth: 390, renderHeight: 520 });
    const parentElement = {};
    const canvas = { parentElement, addEventListener() {}, removeEventListener() {} };
    const resizeSpy = vi.spyOn(engine, 'resize').mockImplementation(() => {});
    const runLoopSpy = vi.spyOn(engine, 'runRenderLoop').mockImplementation(() => {});
    const stopLoopSpy = vi.spyOn(engine, 'stopRenderLoop').mockImplementation(() => {});
    const observe = vi.fn();
    const disconnect = vi.fn();
    const OriginalResizeObserver = globalThis.ResizeObserver;
    globalThis.ResizeObserver = class {
      constructor(callback) { this.callback = callback; }
      observe = observe;
      disconnect = disconnect;
    };
    const runtime = createBaseEnvironment({ canvas, engineFactory: () => engine });
    expect(resizeSpy).toHaveBeenCalledTimes(1);
    expect(runLoopSpy).toHaveBeenCalledTimes(1);
    expect(observe).toHaveBeenCalledWith(parentElement);
    expect(runtime.renderLoopRunning).toBe(true);
    runtime.dispose();
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(stopLoopSpy).toHaveBeenCalled();
    globalThis.ResizeObserver = OriginalResizeObserver;
  }, 30000);
});
