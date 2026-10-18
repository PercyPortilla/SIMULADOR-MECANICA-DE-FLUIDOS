import { describe, expect, it, vi } from 'vitest';
import { NullEngine, Scene } from '@babylonjs/core';
import { createBabylonBaseScene } from '../../src/babylon/runtime/baseEnvironment.js';

describe('Babylon base scene', () => {
  it('creates a 1 m, right-handed, fog-free scene with nine cameras and industrial lights', () => {
    const engine = new NullEngine({ renderWidth: 1096, renderHeight: 520 });
    const base = createBabylonBaseScene(engine);
    expect(base.scene.useRightHandedSystem).toBe(true);
    expect(base.scene.fogMode).toBe(Scene.FOGMODE_NONE);
    expect(base.scene.metadata.worldUnitsPerMeter).toBe(1);
    expect(base.scene.metadata.coordinateSystem).toBe('right-handed');
    expect(Object.keys(base.cameras)).toHaveLength(9);
    expect(base.scene.activeCamera).toBe(base.cameras.general);
    expect(base.sky.infiniteDistance).toBe(true);
    expect(base.sky.metadata.atmosphereProfile).toBe('clear-highland-blue');
    expect(base.sky.metadata.v30ShaderParity).toBe(true);
    expect(base.terrainMaterial.metadata.surfaceProfile).toBe('v30-compacted-weathered-rock');
    expect(Object.keys(base.lights)).toEqual(['hemisphere', 'sun', 'fill', 'bounce']);
    expect(Object.keys(base.roadNetwork.roads)).toEqual(['ROAD-01', 'ROAD-02', 'ROAD-03', 'ROAD-04']);
    engine.dispose();
  }, 30000);

  it('renders on demand without installing an unconditional render loop', () => {
    const engine = new NullEngine({ renderWidth: 390, renderHeight: 520 });
    const base = createBabylonBaseScene(engine);
    const renderSpy = vi.spyOn(base.scene, 'render').mockImplementation(() => {});
    expect(renderSpy).not.toHaveBeenCalled();
    base.scene.render();
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(engine._activeRenderLoops?.length ?? 0).toBe(0);
    engine.dispose();
  }, 30000);
});
