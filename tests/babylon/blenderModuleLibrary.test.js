import { describe, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Scene } from '@babylonjs/core/scene.js';
import { attachBabylonBlenderModule, BLENDER_MODULE_URLS } from '../../src/babylon/assets/moduleLibrary.js';

describe('Babylon hybrid Blender module library', () => {
  it('uses the same renderer-neutral module URLs and preserves host transform', async () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    const parent = new TransformNode('parent', scene);
    const sourceRoot = new TransformNode('source', scene);
    const mesh = new Mesh('mesh', scene);
    mesh.parent = sourceRoot;
    const instanceRoot = new TransformNode('instance', scene);
    const loadContainer = vi.fn(async () => ({
      instantiateModelsToScene: vi.fn(() => ({ rootNodes: [instanceRoot], animationGroups: [] })),
    }));
    const handle = attachBabylonBlenderModule({
      scene,
      parent,
      url: BLENDER_MODULE_URLS.pipeFlange,
      name: 'flange-test',
      position: [1, 2, 3],
      scale: [2, 2, 2],
      loadContainer,
    });
    await handle.ready;
    expect(handle.loaded).toBe(true);
    expect(handle.host.position.asArray()).toEqual([1, 2, 3]);
    expect(handle.host.scaling.asArray()).toEqual([2, 2, 2]);
    expect(handle.host.metadata.blenderModuleUrl).toBe(BLENDER_MODULE_URLS.pipeFlange);
    expect(instanceRoot.parent).toBe(handle.host);
    handle.dispose();
    engine.dispose();
  });
});
