import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer.js';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  BABYLON_TERRAIN_SEGMENTS,
  buildBabylonTerrainVertexData,
  createBabylonMineTerrain,
  terrainVertexIndex,
} from '../../src/babylon/terrain/mineTerrain.js';
import { getTerrainHeight, TERRAIN_EXTENT } from '../../src/scene/environment/terrainHeight.js';

function vertexAt(data, ix, iz) {
  const index = terrainVertexIndex(ix, iz, { x: data.segmentsX, z: data.segmentsZ });
  const offset = index * 3;
  return {
    x: data.positions[offset],
    y: data.positions[offset + 1],
    z: data.positions[offset + 2],
  };
}

function nearestGridVertex(data, x, z) {
  const ix = Math.max(0, Math.min(data.segmentsX, Math.round(((x + data.width / 2) / data.width) * data.segmentsX)));
  const iz = Math.max(0, Math.min(data.segmentsZ, Math.round(((z + data.depth / 2) / data.depth) * data.segmentsZ)));
  return vertexAt(data, ix, iz);
}

describe('Babylon V31 terrain', () => {
  let data;

  beforeAll(() => {
    data = buildBabylonTerrainVertexData();
  }, 30000);

  it('matches the V30 860x560 domain and 240x156 subdivision density', () => {
    expect(data.width).toBe(860);
    expect(data.depth).toBe(560);
    expect(data.width).toBe(TERRAIN_EXTENT.width);
    expect(data.depth).toBe(TERRAIN_EXTENT.depth);
    expect(data.segmentsX).toBe(240);
    expect(data.segmentsZ).toBe(156);
    expect(BABYLON_TERRAIN_SEGMENTS).toEqual({ x: 240, z: 156 });
    expect(data.vertexCount).toBe((240 + 1) * (156 + 1));
    expect(data.indices).toHaveLength(240 * 156 * 6);
    expect(data.colors).toHaveLength(data.vertexCount * 4);
    expect(data.normals).toHaveLength(data.vertexCount * 3);
  });

  it('samples getTerrainHeight exactly at corners, center and representative mine/process zones', () => {
    const samples = [
      vertexAt(data, 0, 0),
      vertexAt(data, data.segmentsX, 0),
      vertexAt(data, 0, data.segmentsZ),
      vertexAt(data, data.segmentsX, data.segmentsZ),
      vertexAt(data, data.segmentsX / 2, data.segmentsZ / 2),
      nearestGridVertex(data, -265, 78),
      nearestGridVertex(data, -110, -30),
      nearestGridVertex(data, -82, -30),
      nearestGridVertex(data, 8, -38),
      nearestGridVertex(data, 195, 26),
      nearestGridVertex(data, 210, -90),
    ];
    for (const sample of samples) {
      expect(sample.y).toBe(getTerrainHeight(sample.x, sample.z));
    }
  });

  it('generates finite upward-facing normals and opaque vertex colors', () => {
    const sampleIndices = [
      terrainVertexIndex(0, 0, { x: data.segmentsX, z: data.segmentsZ }),
      terrainVertexIndex(data.segmentsX, 0, { x: data.segmentsX, z: data.segmentsZ }),
      terrainVertexIndex(data.segmentsX / 2, data.segmentsZ / 2, { x: data.segmentsX, z: data.segmentsZ }),
      terrainVertexIndex(0, data.segmentsZ, { x: data.segmentsX, z: data.segmentsZ }),
      terrainVertexIndex(data.segmentsX, data.segmentsZ, { x: data.segmentsX, z: data.segmentsZ }),
    ];
    sampleIndices.forEach((index) => {
      expect(data.normals.slice(index * 3, index * 3 + 3).every(Number.isFinite)).toBe(true);
      expect(data.colors.slice(index * 4, index * 4 + 4).every(Number.isFinite)).toBe(true);
      expect(data.colors[index * 4 + 3]).toBe(1);
    });
    const centerIndex = terrainVertexIndex(data.segmentsX / 2, data.segmentsZ / 2, {
      x: data.segmentsX,
      z: data.segmentsZ,
    });
    expect(data.normals[centerIndex * 3 + 1]).toBeGreaterThan(0);
  });

  it('builds a Babylon mesh only in a right-handed scene and keeps terrain metadata explicit', () => {
    const engine = new NullEngine({ renderWidth: 32, renderHeight: 32 });
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    const terrain = createBabylonMineTerrain({ scene });
    expect(terrain.name).toBe('base-ground');
    expect(terrain.metadata.coordinateSystem).toBe('right-handed');
    expect(terrain.metadata.terrainHeightSource).toBe('getTerrainHeight');
    expect(terrain.getTotalVertices()).toBe((240 + 1) * (156 + 1));
    expect(terrain.isVerticesDataPresent(VertexBuffer.PositionKind)).toBe(true);
    expect(terrain.isVerticesDataPresent(VertexBuffer.NormalKind)).toBe(true);
    expect(terrain.isVerticesDataPresent(VertexBuffer.ColorKind)).toBe(true);
    scene.dispose();
    engine.dispose();

    const leftEngine = new NullEngine({ renderWidth: 16, renderHeight: 16 });
    const leftScene = new Scene(leftEngine);
    expect(() => createBabylonMineTerrain({ scene: leftScene })).toThrow(/useRightHandedSystem/);
    leftScene.dispose();
    leftEngine.dispose();
  });

  it('has no Three, fog, engine-loop or renderer coupling in the Babylon terrain module', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.resolve(here, '../../src/babylon/terrain/mineTerrain.js'), 'utf8');
    expect(source).not.toMatch(/from\s+['"]three(?:\/|['"])/i);
    expect(source).not.toMatch(/\bTHREE\b/);
    expect(source).not.toMatch(/\bfog\b/i);
    expect(source).not.toMatch(/\bWebGLRenderer\b/);
    expect(source).not.toMatch(/\brequestAnimationFrame\b/);
    expect(source).not.toMatch(/\bEngine\b/);
  });
});
