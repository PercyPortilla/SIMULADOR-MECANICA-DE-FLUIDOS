import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getReceptionEarthworkBand, getTerrainHeight } from '../../src/scene/environment/terrainHeight.js';
import {
  attachReceptionEarthworkBlenderOverlay,
  RECEPTION_EARTHWORK_BLENDER_URL,
} from '../../src/scene/integration/blenderTerrainOverlay.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..', '..');
const contractPath = path.join(projectRoot, 'blender', 'generated', 'v21-reception-earthwork-contract.json');
const glbPath = path.join(projectRoot, 'public', RECEPTION_EARTHWORK_BLENDER_URL);

function readGlbJson(filePath) {
  const buffer = fs.readFileSync(filePath);
  expect(buffer.subarray(0, 4).toString()).toBe('glTF');
  expect(buffer.readUInt32LE(4)).toBe(2);
  expect(buffer.readUInt32LE(8)).toBe(buffer.length);
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.readUInt32LE(offset + 4);
    offset += 8;
    const chunk = buffer.subarray(offset, offset + length);
    offset += length;
    if (type === 0x4e4f534a) return JSON.parse(chunk.toString('utf8').replace(/[\u0000\s]+$/g, ''));
  }
  throw new Error('GLB sin JSON chunk.');
}

describe('V21 Blender reception earthwork', () => {
  it('stores a deterministic height contract sampled from the authoritative runtime terrain', () => {
    const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
    expect(contract.assetId).toBe('RECEPTION-EARTHWORK-V21');
    expect(contract.compatibleTerrainRevision).toBe('V22');
    expect(contract.authoritative).toBe(false);
    expect(contract.visualOnly).toBe(true);
    expect(contract.worldUnitsPerMeter).toBe(1);
    expect(contract.sampleStepM).toBe(1);

    const { xValues, zValues, heights, cellBands } = contract.grid;
    expect(xValues.length).toBeGreaterThan(50);
    expect(zValues.length).toBeGreaterThan(50);
    const probes = [
      [0, 0],
      [Math.floor(zValues.length / 2), Math.floor(xValues.length / 2)],
      [zValues.length - 1, xValues.length - 1],
    ];
    probes.forEach(([zi, xi]) => {
      expect(heights[zi][xi]).toBeCloseTo(getTerrainHeight(xValues[xi], zValues[zi]), 6);
    });
    const nonEmptyBands = cellBands.flat().filter(Boolean);
    expect(nonEmptyBands).toContain('crest');
    expect(nonEmptyBands).toContain('upper-slope');
    expect(nonEmptyBands).toContain('berm');
    expect(nonEmptyBands).toContain('toe-slope');
    const sampleZi = Math.min(10, zValues.length - 2);
    const sampleXi = Math.min(10, xValues.length - 2);
    const centerX = (xValues[sampleXi] + xValues[sampleXi + 1]) / 2;
    const centerZ = (zValues[sampleZi] + zValues[sampleZi + 1]) / 2;
    expect(cellBands[sampleZi][sampleXi]).toBe(getReceptionEarthworkBand(centerX, centerZ));
  });

  it('ships a visual-only GLB with semantic earthwork bands and no animations', () => {
    expect(fs.existsSync(glbPath)).toBe(true);
    expect(fs.statSync(glbPath).size).toBeGreaterThan(10_000);
    const doc = readGlbJson(glbPath);
    const names = (doc.nodes ?? []).map((node) => node.name ?? '');
    expect(names).toContain('RECEPTION-EARTHWORK-V21');
    expect(names.some((name) => name.includes('CREST'))).toBe(true);
    expect(names.some((name) => name.includes('UPPER_SLOPE'))).toBe(true);
    expect(names.some((name) => name.includes('BERM'))).toBe(true);
    expect(names.some((name) => name.includes('TOE_SLOPE'))).toBe(true);
    expect(doc.animations ?? []).toHaveLength(0);
  });

  it('loads through GLTFLoader at the authoritative world coordinates and metre scale', async () => {
    const buffer = fs.readFileSync(glbPath);
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const gltf = await new Promise((resolve, reject) => {
      new GLTFLoader().parse(arrayBuffer, '', resolve, reject);
    });
    const bounds = new THREE.Box3().setFromObject(gltf.scene);
    const size = bounds.getSize(new THREE.Vector3());
    expect(bounds.min.x).toBeCloseTo(-159, 4);
    expect(bounds.max.x).toBeCloseTo(-81, 4);
    expect(bounds.min.z).toBeCloseTo(-74, 4);
    expect(bounds.max.z).toBeCloseTo(-6, 4);
    expect(size.x).toBeCloseTo(78, 4);
    expect(size.z).toBeCloseTo(68, 4);
    expect(gltf.animations).toHaveLength(0);
  });

  it('keeps the procedural terrain as the SSR/test fallback instead of replacing height authority', () => {
    const parent = new THREE.Group();
    const handle = attachReceptionEarthworkBlenderOverlay({ parent });
    expect(handle.loaded).toBe(false);
    expect(handle.root.parent).toBe(parent);
    expect(handle.root.userData.visualOnly).toBe(true);
    expect(handle.root.userData.authoritativeTerrain).toBe(false);
    expect(handle.root.userData.terrainRealismRevision).toBe('V22');
    expect(handle.root.userData.blenderVisualStatus).toBe('ssr-procedural-fallback');
    handle.dispose();
    expect(handle.root.parent).toBeNull();
  });
});
