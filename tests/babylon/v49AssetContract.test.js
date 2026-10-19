import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ASSET_PATH = path.resolve('public/models/pulpa-v49/PULPA_LAB_V49_FULL_SITE.glb');

function readGlbJson(filePath) {
  const buffer = fs.readFileSync(filePath);
  expect(buffer.toString('utf8', 0, 4)).toBe('glTF');
  const jsonLength = buffer.readUInt32LE(12);
  const json = buffer.subarray(20, 20 + jsonLength).toString('utf8').replace(/\0+$/, '');
  return { buffer, gltf: JSON.parse(json) };
}

describe('Blender V49 production asset contract', () => {
  it('keeps the authoritative full site compact and structurally intact', () => {
    const { buffer, gltf } = readGlbJson(ASSET_PATH);
    expect(buffer.byteLength).toBeLessThan(6 * 1024 * 1024);
    expect(gltf.nodes.length).toBeGreaterThan(4000);
    expect(gltf.meshes.length).toBeGreaterThan(3500);
    expect(gltf.materials.length).toBeGreaterThanOrEqual(70);
    expect(gltf.animations).toHaveLength(1);
    expect(gltf.animations[0].channels.length).toBeGreaterThanOrEqual(450);
  });

  it('retains every critical V49 animation family after resampling', () => {
    const { gltf } = readGlbJson(ASSET_PATH);
    const animation = gltf.animations[0];
    const animatedNames = new Set(animation.channels.map((channel) => gltf.nodes[channel.target.node]?.name));
    [
      'TRUCK-01',
      'TRUCK-02',
      'TRUCK-03',
      'MILL-01_SHELL',
      'APRON-FEEDER_PANS_GROUP',
      'LOADER-01_ARM_PIVOT',
      'LOADER-01_BUCKET_PIVOT',
      'V49_CV02_ORE_01',
      'V49_CV03_ORE_01',
      'V43_CLASS_SWIRL_ROOT_01',
      'V43_CLASS_SWIRL_ROOT_06',
      'V39_EW_SMELT_CART',
    ].forEach((name) => expect(animatedNames.has(name), `${name} must remain animated`).toBe(true));
  });

  it('exports authored Blender colours instead of white legacy material defaults', () => {
    const { gltf } = readGlbJson(ASSET_PATH);
    const material = (name) => gltf.materials.find((entry) => entry.name === name);
    const expectRgb = (name, expected) => {
      const rgb = material(name)?.pbrMetallicRoughness?.baseColorFactor?.slice(0, 3);
      expect(rgb).toHaveLength(3);
      expected.forEach((value, index) => expect(rgb[index]).toBeCloseTo(value, 3));
    };
    expectRgb('V16_Earth', [0.16, 0.09, 0.045]);
    expectRgb('V16_Road', [0.055, 0.052, 0.047]);
    expectRgb('V16_Concrete', [0.24, 0.26, 0.27]);
  });
});
