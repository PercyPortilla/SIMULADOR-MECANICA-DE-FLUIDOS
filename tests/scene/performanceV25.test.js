import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { createAssetHandle } from '../../src/equipment/common/assetUtils.js';

function countedMesh(name, lodTier, counter, key) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  mesh.name = name;
  mesh.userData.inspectionRole = 'shell';
  Object.defineProperty(mesh.userData, 'lodTier', {
    configurable: true,
    enumerable: true,
    get() {
      counter[key] += 1;
      return lodTier;
    },
  });
  return mesh;
}

describe('V25 adaptive LOD inner-pass optimization', () => {
  it('caches unchanged LOD state and prunes only hidden Blender fallback subtrees', () => {
    const root = new THREE.Group();
    const counter = { main: 0, fallback: 0 };
    const main = countedMesh('main-shell', 0, counter, 'main');
    const fallback = new THREE.Group();
    fallback.name = 'TEST-PROCEDURAL-FALLBACK';
    fallback.userData.blenderFallback = true;
    fallback.visible = false;
    fallback.add(countedMesh('fallback-shell', 0, counter, 'fallback'));
    root.add(main, fallback);

    const handle = createAssetHandle({
      root,
      id: 'LOD-V25-TEST',
      category: 'test',
      name: 'LOD V25 test',
      referenceClass: 'test',
      dimensions: { length: 1, width: 1, height: 1 },
      lodDistances: [10, 20],
    });
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0, 0, 5);

    handle.updateLOD(camera);
    expect(counter.main).toBe(1);
    expect(counter.fallback).toBe(0);

    handle.updateLOD(camera);
    expect(counter.main).toBe(1);

    camera.position.set(0, 0, 30);
    handle.updateLOD(camera);
    expect(counter.main).toBe(2);
    expect(counter.fallback).toBe(0);

    handle.setInspectionMode('interior');
    handle.updateLOD(camera);
    expect(counter.main).toBe(3);
    expect(main.visible).toBe(false);

    handle.setInspectionMode('normal');
    root.userData.lodContentRevision = 1;
    fallback.visible = true;
    handle.updateLOD(camera);
    expect(counter.main).toBe(4);
    expect(counter.fallback).toBe(1);

    handle.dispose();
  });
});
