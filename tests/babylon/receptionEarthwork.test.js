import { describe, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Scene } from '@babylonjs/core/scene.js';
import {
  RECEPTION_EARTHWORK_BLENDER_URL,
  attachBabylonReceptionEarthwork,
} from '../../src/babylon/assets/receptionEarthwork.js';

function createContainerStub(scene) {
  const root = new TransformNode('__root__', scene);
  const mesh = new Mesh('RECEPTION-EARTHWORK-V26_TEST', scene);
  mesh.parent = root;
  const addAllToScene = vi.fn();
  const dispose = vi.fn(() => {
    root.dispose(false, true);
  });
  return {
    root,
    mesh,
    container: {
      rootNodes: [root],
      addAllToScene,
      dispose,
    },
  };
}

describe('Babylon reception earthwork Blender overlay', () => {
  it('loads the V26 GLB contract into a visual-only host without becoming terrain authority', async () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    const stub = createContainerStub(scene);
    const loadContainer = vi.fn(async () => stub.container);

    const handle = attachBabylonReceptionEarthwork({ scene, loadContainer });
    await handle.ready;

    expect(loadContainer).toHaveBeenCalledWith(RECEPTION_EARTHWORK_BLENDER_URL, scene);
    expect(stub.container.addAllToScene).toHaveBeenCalledTimes(1);
    expect(handle.loaded).toBe(true);
    expect(stub.root.parent).toBe(handle.host);
    expect(handle.host.metadata.visualOnly).toBe(true);
    expect(handle.host.metadata.authoritativeTerrain).toBe(false);
    expect(handle.host.metadata.importedMeshCount).toBe(1);
    expect(stub.mesh.metadata.blenderImported).toBe(true);
    expect(stub.mesh.metadata.authoritativeTerrain).toBe(false);
    expect(stub.mesh.receiveShadows).toBe(true);
    expect(stub.mesh.isPickable).toBe(false);

    handle.dispose();
    expect(stub.container.dispose).toHaveBeenCalledTimes(1);
    scene.dispose();
    engine.dispose();
  });

  it('keeps the procedural terrain available when the GLB loader fails', async () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const handle = attachBabylonReceptionEarthwork({
      scene,
      loadContainer: vi.fn(async () => { throw new Error('synthetic load failure'); }),
    });

    await handle.ready;
    expect(handle.loaded).toBe(false);
    expect(handle.host.metadata.blenderVisualStatus).toBe('error-procedural-fallback');
    expect(handle.host.metadata.blenderVisualError).toContain('synthetic load failure');
    warning.mockRestore();
    handle.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('rejects loading into a left-handed scene', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    expect(() => attachBabylonReceptionEarthwork({ scene, loadContainer: vi.fn() })).toThrow(/right-handed/);
    scene.dispose();
    engine.dispose();
  });
});
