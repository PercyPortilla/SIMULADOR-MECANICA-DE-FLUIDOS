import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  CreateBox,
  Matrix,
  NullEngine,
  Quaternion,
  Scene,
  TransformNode,
  Vector3,
} from '@babylonjs/core';
import {
  B81_CONTINUITY_SPECS,
  applyB81ProcessContinuityVisual,
  closestPointsBetweenB81Bounds,
  getB81WorldBounds,
} from '../../src/babylon/assets/b81ProcessContinuityVisual.js';

const PRODUCTION_ASSET = path.resolve('public/models/pulpa-v57/PULPA_LAB_V57_FULL_SITE_FINAL.glb');

function readProductionJson() {
  const buffer = fs.readFileSync(PRODUCTION_ASSET);
  const jsonLength = buffer.readUInt32LE(12);
  return JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8').replace(/\0+$/g, '').trim());
}

function nodeWorldMatrices(gltf) {
  const parent = new Map();
  gltf.nodes.forEach((node, index) => {
    (node.children ?? []).forEach((child) => parent.set(child, index));
  });
  const cache = new Map();
  const local = (node) => {
    if (node.matrix) return Matrix.FromArray(node.matrix);
    return Matrix.Compose(
      Vector3.FromArray(node.scale ?? [1, 1, 1]),
      node.rotation ? Quaternion.FromArray(node.rotation) : Quaternion.Identity(),
      Vector3.FromArray(node.translation ?? [0, 0, 0]),
    );
  };
  const world = (index) => {
    if (cache.has(index)) return cache.get(index);
    let matrix = local(gltf.nodes[index]);
    const parentIndex = parent.get(index);
    if (parentIndex !== undefined) matrix = matrix.multiply(world(parentIndex));
    cache.set(index, matrix);
    return matrix;
  };
  return world;
}

function productionNodeBounds(gltf, nodeName) {
  const nodeIndex = gltf.nodes.findIndex((node) => node.name === nodeName);
  expect(nodeIndex, `${nodeName} must remain in production V57`).toBeGreaterThanOrEqual(0);
  const node = gltf.nodes[nodeIndex];
  expect(node.mesh, `${nodeName} must retain mesh geometry`).toBeTypeOf('number');
  const matrix = nodeWorldMatrices(gltf)(nodeIndex);
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);
  gltf.meshes[node.mesh].primitives.forEach((primitive) => {
    const accessor = gltf.accessors[primitive.attributes.POSITION];
    expect(accessor?.min).toHaveLength(3);
    expect(accessor?.max).toHaveLength(3);
    for (const x of [accessor.min[0], accessor.max[0]]) {
      for (const y of [accessor.min[1], accessor.max[1]]) {
        for (const z of [accessor.min[2], accessor.max[2]]) {
          const point = Vector3.TransformCoordinates(new Vector3(x, y, z), matrix);
          min.minimizeInPlace(point);
          max.maximizeInPlace(point);
        }
      }
    }
  });
  return { min, max, center: Vector3.Center(min, max) };
}

describe('B81 process continuity closure', () => {
  it('computes the exact shortest gap between two authored bounds', () => {
    const result = closestPointsBetweenB81Bounds({
      min: new Vector3(0, 0, 0),
      max: new Vector3(2, 2, 2),
    }, {
      min: new Vector3(5, 1, 1),
      max: new Vector3(7, 3, 3),
    });
    expect(result.source.asArray()).toEqual([2, 1.5, 1.5]);
    expect(result.target.asArray()).toEqual([5, 1.5, 1.5]);
    expect(result.gapM).toBeCloseTo(3, 8);
  });

  it('creates only bounded local bridges and fails closed for a runaway gap', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    const host = new TransformNode('site-host', scene);
    const imported = new TransformNode('imported', scene);
    imported.parent = host;

    const source = CreateBox('SOURCE', { size: 2 }, scene);
    source.position.set(0, 2, 0);
    source.parent = imported;
    const target = CreateBox('TARGET', { size: 2 }, scene);
    target.position.set(5, 2, 0);
    target.parent = imported;
    const far = CreateBox('FAR', { size: 2 }, scene);
    far.position.set(100, 2, 0);
    far.parent = imported;

    const visual = applyB81ProcessContinuityVisual({
      scene,
      rootNodes: [imported],
      host,
      specs: [
        {
          id: 'LOCAL',
          sourceName: 'SOURCE',
          targetName: 'TARGET',
          kind: 'pipe-straight',
          minGapM: 0.2,
          maxGapM: 6,
          diameterM: 0.5,
        },
        {
          id: 'RUNAWAY',
          sourceName: 'SOURCE',
          targetName: 'FAR',
          kind: 'pipe-straight',
          minGapM: 0.2,
          maxGapM: 6,
          diameterM: 0.5,
        },
      ],
    });
    expect(visual.bridges.has('LOCAL')).toBe(true);
    expect(visual.bridges.get('LOCAL').meshes.every((mesh) => mesh.metadata.b81ProcessContinuity)).toBe(true);
    expect(visual.bridges.get('LOCAL').meshes.every((mesh) => mesh.isPickable === false)).toBe(true);
    expect(visual.bridges.has('RUNAWAY')).toBe(false);
    expect(visual.blockers).toContainEqual(expect.objectContaining({ id: 'RUNAWAY', reason: 'gap-out-of-contract' }));
    visual.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('skips geometry when authored meshes already touch', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    const host = new TransformNode('site-host', scene);
    const imported = new TransformNode('imported', scene);
    imported.parent = host;
    const source = CreateBox('SOURCE', { size: 2 }, scene);
    source.parent = imported;
    const target = CreateBox('TARGET', { size: 2 }, scene);
    target.position.x = 1.8;
    target.parent = imported;
    const bounds = getB81WorldBounds(source);
    expect(bounds).toBeTruthy();
    const visual = applyB81ProcessContinuityVisual({
      scene,
      rootNodes: [imported],
      host,
      specs: [{
        id: 'TOUCHING',
        sourceName: 'SOURCE',
        targetName: 'TARGET',
        kind: 'ore-chute',
        minGapM: 0.25,
        maxGapM: 3,
        widthM: 1,
      }],
    });
    expect(visual.bridges.size).toBe(0);
    expect(visual.skipped).toContainEqual(expect.objectContaining({ id: 'TOUCHING', reason: 'already-continuous' }));
    visual.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('keeps every production V57 continuity gap inside its guarded B81 contract', () => {
    const gltf = readProductionJson();
    expect(B81_CONTINUITY_SPECS).toHaveLength(10);
    B81_CONTINUITY_SPECS.forEach((spec) => {
      const endpoints = closestPointsBetweenB81Bounds(
        productionNodeBounds(gltf, spec.sourceName),
        productionNodeBounds(gltf, spec.targetName),
      );
      expect(endpoints.gapM, `${spec.id} must still need a local closure`).toBeGreaterThanOrEqual(spec.minGapM);
      expect(endpoints.gapM, `${spec.id} must not exceed its safe local closure envelope`).toBeLessThanOrEqual(spec.maxGapM);
    });
  });

  it('hides the superseded stockpile transfer tower instead of moving it into the active route', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    const host = new TransformNode('site-host', scene);
    const imported = new TransformNode('imported', scene);
    imported.parent = host;
    const staleTower = new TransformNode('TRANSFER-TOWER-STOCKPILE_ROOT', scene);
    staleTower.parent = imported;
    const staleChute = CreateBox('TRANSFER-TOWER-STOCKPILE_CHUTE', { size: 2 }, scene);
    staleChute.parent = staleTower;

    const visual = applyB81ProcessContinuityVisual({
      scene,
      rootNodes: [imported],
      host,
      specs: [],
    });
    expect(staleTower.isEnabled()).toBe(false);
    expect(staleTower.metadata.b81SupersededTransferGeometry).toBe(true);
    expect(visual.hiddenSupersededRoots).toEqual(['TRANSFER-TOWER-STOCKPILE_ROOT']);
    visual.dispose();
    scene.dispose();
    engine.dispose();
  });
});
