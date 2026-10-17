import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  attachBlenderModule,
  cloneBlenderModuleSource,
  optimizeStaticModuleScene,
  resetBlenderModuleCacheForTests,
} from '../../src/scene/integration/blenderModuleLibrary.js';

afterEach(() => {
  vi.restoreAllMocks();
  resetBlenderModuleCacheForTests();
  delete globalThis.window;
});

describe('static Blender module optimization', () => {
  it('merges static meshes that share a material', () => {
    const source = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial();
    const accent = new THREE.MeshStandardMaterial();
    const a = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), steel);
    const b = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), steel);
    const c = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), accent);
    b.position.x = 2;
    c.position.x = 4;
    source.add(a, b, c);

    const optimized = optimizeStaticModuleScene(source);
    const meshes = optimized.children.filter((object) => object.isMesh);
    expect(meshes).toHaveLength(2);
    expect(meshes.some((mesh) => mesh.material === steel)).toBe(true);
    expect(meshes.some((mesh) => mesh.material === accent)).toBe(true);
  });

  it('shares immutable geometry and materials across repeated module clones', () => {
    const source = new THREE.Group();
    const material = new THREE.MeshStandardMaterial();
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const pivot = new THREE.Group();
    pivot.name = 'module-pivot';
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'module-mesh';
    pivot.add(mesh);
    source.add(pivot);
    const first = cloneBlenderModuleSource(source);
    const second = cloneBlenderModuleSource(source);

    const firstPivot = first.getObjectByName('module-pivot');
    const secondPivot = second.getObjectByName('module-pivot');
    const firstMesh = first.getObjectByName('module-mesh');
    const secondMesh = second.getObjectByName('module-mesh');

    firstPivot.rotation.x = 0.73;
    firstPivot.position.set(4, 2, -1);
    expect(secondPivot.rotation.x).toBeCloseTo(0, 10);
    expect(secondPivot.position.toArray()).toEqual([0, 0, 0]);
    expect(firstMesh.geometry).toBe(geometry);
    expect(secondMesh.geometry).toBe(geometry);
    expect(firstMesh.material).toBe(material);
    expect(secondMesh.material).toBe(material);

    geometry.dispose();
    material.dispose();
  });

  it('allows inspection-style material cloning on one hierarchy without mutating siblings', () => {
    const source = new THREE.Group();
    const material = new THREE.MeshStandardMaterial({ opacity: 1, transparent: false });
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'inspection-shell';
    source.add(mesh);

    const first = cloneBlenderModuleSource(source);
    const second = cloneBlenderModuleSource(source);
    const firstMesh = first.getObjectByName('inspection-shell');
    const secondMesh = second.getObjectByName('inspection-shell');

    const inspectionMaterial = firstMesh.material.clone();
    firstMesh.material = inspectionMaterial;
    inspectionMaterial.transparent = true;
    inspectionMaterial.opacity = 0.25;

    expect(firstMesh.material).not.toBe(secondMesh.material);
    expect(secondMesh.material).toBe(material);
    expect(secondMesh.material.transparent).toBe(false);
    expect(secondMesh.material.opacity).toBe(1);

    inspectionMaterial.dispose();
    geometry.dispose();
    material.dispose();
  });

  it('detaches one loaded module without disposing resources shared by another instance', async () => {
    const source = new THREE.Group();
    const material = new THREE.MeshStandardMaterial();
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'shared-loaded-mesh';
    source.add(mesh);

    globalThis.window = {};
    vi.spyOn(GLTFLoader.prototype, 'load').mockImplementation((url, onLoad) => {
      onLoad({ scene: source, animations: [] });
      return undefined;
    });

    const parent = new THREE.Group();
    let firstImported = null;
    let secondImported = null;
    const first = attachBlenderModule({
      parent,
      url: 'models/test/shared-module.glb',
      name: 'first-module',
      onReady: ({ imported }) => { firstImported = imported; },
    });
    const second = attachBlenderModule({
      parent,
      url: 'models/test/shared-module.glb',
      name: 'second-module',
      onReady: ({ imported }) => { secondImported = imported; },
    });

    await vi.waitFor(() => {
      expect(first.loaded).toBe(true);
      expect(second.loaded).toBe(true);
    });

    const firstMesh = firstImported.children.find((object) => object.isMesh);
    const secondMesh = secondImported.children.find((object) => object.isMesh);
    expect(firstMesh).toBeTruthy();
    expect(secondMesh).toBeTruthy();
    expect(firstMesh.geometry).toBe(secondMesh.geometry);
    expect(firstMesh.material).toBe(secondMesh.material);

    const sharedGeometry = firstMesh.geometry;
    const sharedMaterial = firstMesh.material;
    const geometryDispose = vi.spyOn(sharedGeometry, 'dispose');
    const materialDispose = vi.spyOn(sharedMaterial, 'dispose');

    first.dispose();
    expect(first.host.parent).toBeNull();
    expect(second.host.parent).toBe(parent);
    expect(secondMesh.geometry).toBe(sharedGeometry);
    expect(secondMesh.material).toBe(sharedMaterial);
    expect(geometryDispose).not.toHaveBeenCalled();
    expect(materialDispose).not.toHaveBeenCalled();

    second.dispose();
    expect(second.host.parent).toBeNull();
    expect(geometryDispose).not.toHaveBeenCalled();
    expect(materialDispose).not.toHaveBeenCalled();

    sharedGeometry.dispose();
    sharedMaterial.dispose();
  });
});
