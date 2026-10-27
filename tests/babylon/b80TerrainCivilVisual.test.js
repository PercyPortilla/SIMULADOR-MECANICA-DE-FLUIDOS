import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  CreateBox,
  CreateGround,
  NullEngine,
  PBRMaterial,
  Scene,
  TransformNode,
} from '@babylonjs/core';
import { Matrix } from '@babylonjs/core/Maths/math.vector.js';
import {
  applyB80TerrainCivilVisual,
  B80_SUPERSEDED_OVERSIZED_PADS,
  buildB80TerrainApronVertexData,
  collectB80BoundaryEdges,
  selectB80OuterBoundaryEdges,
} from '../../src/babylon/assets/b80TerrainCivilVisual.js';

const PRODUCTION_ASSET = path.resolve('public/models/pulpa-v57/PULPA_LAB_V57_FULL_SITE_FINAL.glb');

function readProductionGlb() {
  const buffer = fs.readFileSync(PRODUCTION_ASSET);
  const jsonLength = buffer.readUInt32LE(12);
  const json = JSON.parse(buffer.subarray(20, 20 + jsonLength).toString('utf8').replace(/\0+$/g, '').trim());
  const binHeader = 20 + jsonLength;
  const binLength = buffer.readUInt32LE(binHeader);
  const binStart = binHeader + 8;
  return { buffer, json, binStart, binLength };
}

function readAccessor(glb, accessorIndex) {
  const accessor = glb.json.accessors[accessorIndex];
  const view = glb.json.bufferViews[accessor.bufferView];
  const components = accessor.type === 'VEC3' ? 3 : 1;
  const bytesByType = { 5121: 1, 5123: 2, 5125: 4, 5126: 4 };
  const componentBytes = bytesByType[accessor.componentType];
  const stride = view.byteStride ?? componentBytes * components;
  const start = glb.binStart + (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const data = [];
  for (let item = 0; item < accessor.count; item += 1) {
    const row = start + item * stride;
    for (let component = 0; component < components; component += 1) {
      const offset = row + component * componentBytes;
      if (accessor.componentType === 5121) data.push(glb.buffer.readUInt8(offset));
      else if (accessor.componentType === 5123) data.push(glb.buffer.readUInt16LE(offset));
      else if (accessor.componentType === 5125) data.push(glb.buffer.readUInt32LE(offset));
      else if (accessor.componentType === 5126) data.push(glb.buffer.readFloatLE(offset));
      else throw new Error(`Unsupported accessor component type ${accessor.componentType}`);
    }
  }
  return data;
}

describe('B80 terrain and civil closure', () => {
  it('identifies only the exterior edges of a triangulated surface', () => {
    const edges = collectB80BoundaryEdges([0, 1, 2, 0, 2, 3]);
    expect(edges).toHaveLength(4);
    expect(edges.some(({ a, b }) => new Set([a, b]).has(0) && new Set([a, b]).has(2))).toBe(false);
  });

  it('selects only the largest connected boundary loop and ignores internal cuts', () => {
    const edges = [
      ...collectB80BoundaryEdges([0, 1, 2, 0, 2, 3]),
      ...collectB80BoundaryEdges([10, 11, 12]),
    ];
    const selected = selectB80OuterBoundaryEdges(edges);
    expect(selected).toHaveLength(4);
    expect(selected.every(({ a, b }) => a < 10 && b < 10)).toBe(true);
  });

  it('uses only the 850-edge production outer terrain loop and excludes the 83 internal cut edges', () => {
    const glb = readProductionGlb();
    const terrainNode = glb.json.nodes.find((node) => node.name === 'V57_TERRAIN_INTEGRATED');
    expect(terrainNode?.mesh).toBeTypeOf('number');
    const primitive = glb.json.meshes[terrainNode.mesh].primitives[0];
    const indices = readAccessor(glb, primitive.indices);
    const positions = readAccessor(glb, primitive.attributes.POSITION);
    const allEdges = collectB80BoundaryEdges(indices);
    const outerEdges = selectB80OuterBoundaryEdges(allEdges);
    expect(allEdges).toHaveLength(933);
    expect(outerEdges).toHaveLength(850);
    expect(allEdges.length - outerEdges.length).toBe(83);
    const degree = new Map();
    outerEdges.forEach(({ a, b }) => {
      degree.set(a, (degree.get(a) ?? 0) + 1);
      degree.set(b, (degree.get(b) ?? 0) + 1);
    });
    expect([...degree.values()].every((value) => value === 2)).toBe(true);
    expect(degree.size).toBe(850);
    const apron = buildB80TerrainApronVertexData({ positions, indices });
    expect(apron.boundaryEdgeCount).toBe(850);
    expect(apron.excludedInternalBoundaryEdgeCount).toBe(83);
    const zValues = apron.positions.filter((_, index) => index % 3 === 2);
    expect(Math.max(...zValues)).toBeGreaterThan(430);
  });

  it('builds a sloped continuation plus an outer curtain instead of a plant-wide slab', () => {
    const data = buildB80TerrainApronVertexData({
      positions: [
        -5, 3, -5,
        5, 4, -5,
        5, 5, 5,
        -5, 4, 5,
      ],
      indices: [0, 1, 2, 0, 2, 3],
      transform: Matrix.Identity(),
      outsetM: 30,
      outerDropM: 4,
      curtainDepthM: 12,
    });
    expect(data.boundaryEdgeCount).toBe(4);
    expect(data.positions).toHaveLength(4 * 8 * 3);
    expect(data.indices).toHaveLength(4 * 12);
    expect(data.curtainBottomY).toBeLessThan(0);
    const xs = data.positions.filter((_, index) => index % 3 === 0);
    expect(Math.max(...xs)).toBeGreaterThan(5);
    expect(Math.min(...xs)).toBeLessThan(-5);
  });

  it('hides redundant broad process pads while retaining local structural foundations', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    scene.useRightHandedSystem = true;
    const host = new TransformNode('site-host', scene);
    const imported = new TransformNode('imported-root', scene);
    imported.parent = host;
    const terrain = CreateGround('V57_TERRAIN_INTEGRATED', { width: 30, height: 20, subdivisions: 2 }, scene);
    terrain.parent = imported;
    const broadPad = CreateBox('CIV_ROM_MANEUVER_PAD', { width: 20, height: 0.3, depth: 12 }, scene);
    broadPad.parent = imported;
    const earthPad = CreateBox('CIV_GRINDING_PAD', { width: 20, height: 0.3, depth: 12 }, scene);
    earthPad.parent = imported;
    const fill = new PBRMaterial('MAT_V57_CIVIL_COMPACTED_FILL', scene);
    earthPad.material = fill;
    const localFoundation = CreateBox('CIV_CRUSHER_FOUNDATION', { width: 8, height: 1, depth: 6 }, scene);
    localFoundation.parent = imported;
    const concrete = new PBRMaterial('MAT_V57_CIVIL_CONCRETE', scene);
    localFoundation.material = concrete;

    const visual = applyB80TerrainCivilVisual({ scene, rootNodes: [imported], host });
    expect(B80_SUPERSEDED_OVERSIZED_PADS).toEqual(['CIV_ROM_MANEUVER_PAD']);
    expect(broadPad.isEnabled()).toBe(false);
    expect(earthPad.isEnabled()).toBe(true);
    expect(localFoundation.isEnabled()).toBe(true);
    expect(visual.hiddenOversizedPads).toContain('CIV_ROM_MANEUVER_PAD');
    expect(fill.albedoColor.asArray()).not.toEqual([1, 1, 1]);
    expect(fill.metadata.b80CivilRole).toBe('compacted-earth');
    expect(concrete.albedoColor.asArray()).not.toEqual([1, 1, 1]);
    expect(concrete.metadata.b80CivilRole).toBe('industrial-concrete');
    expect(visual.repairedCivilMaterials).toHaveLength(2);
    expect(visual.aprons).toHaveLength(1);
    expect(visual.aprons[0].metadata.b80TerrainEdgeContinuation).toBe(true);
    visual.dispose();
    scene.dispose();
    engine.dispose();
  });
});
