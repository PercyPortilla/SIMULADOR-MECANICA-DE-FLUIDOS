import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ASSET_PATH = path.resolve('public/models/pulpa-v55/PULPA_LAB_V55_FULL_SITE.glb');

function readGlbJson(filePath) {
  const buffer = fs.readFileSync(filePath);
  expect(buffer.toString('utf8', 0, 4)).toBe('glTF');
  const jsonLength = buffer.readUInt32LE(12);
  const json = buffer.subarray(20, 20 + jsonLength).toString('utf8').replace(/\0+$/, '').trimEnd();
  return { buffer, gltf: JSON.parse(json) };
}

function animatedNodeNames(gltf) {
  return new Set((gltf.animations ?? []).flatMap((animation) => (
    animation.channels.map((channel) => gltf.nodes[channel.target.node]?.name)
  )));
}

describe('Blender V55 production asset contract', () => {
  it('keeps the final full site compact and structurally intact', () => {
    const { buffer, gltf } = readGlbJson(ASSET_PATH);
    expect(buffer.byteLength).toBeLessThan(6 * 1024 * 1024);
    expect(gltf.scenes).toHaveLength(1);
    expect(gltf.nodes.length).toBeGreaterThan(4500);
    expect(gltf.meshes.length).toBeGreaterThan(950);
    expect(gltf.materials.length).toBeGreaterThanOrEqual(70);
    expect(gltf.animations.length).toBeGreaterThan(400);
    expect(gltf.animations.reduce((sum, animation) => sum + animation.channels.length, 0)).toBeGreaterThanOrEqual(450);
  });

  it('retains every critical animation family after split export and resampling', () => {
    const { gltf } = readGlbJson(ASSET_PATH);
    const names = animatedNodeNames(gltf);
    [
      'TRUCK-01', 'TRUCK-02', 'TRUCK-03',
      'APRON-FEEDER_PANS_GROUP', 'PRIMARY-CRUSHER_MOVING_JAW',
      'V49_CV02_ORE_01', 'V49_CV03_ORE_01',
      'MILL-01_TRUNNION_01', 'SLURRY-PUMP-01_SHAFT',
      'V43_CLASS_SWIRL_ROOT_01', 'R-01_ROTATING_GROUP', 'R-04_ROTATING_GROUP',
      'PUMP-01_SHAFT', 'V40_ELUTION_PIVOT_01', 'EW-CELLS_CATHODE_1_1',
      'V39_EW_SMELT_CART',
    ].forEach((name) => expect(names.has(name), `${name} must remain animated`).toBe(true));
  });

  it('contains the final pit, road, drainage and corrected process geometry', () => {
    const { gltf } = readGlbJson(ASSET_PATH);
    const names = new Set(gltf.nodes.map((node) => node.name));
    [
      'V53_PIT_FACE_01', 'V53_PIT_RAMP_9M', 'V55_PIT_TERRAIN_ENVELOPE',
      'V55_HAUL_RAMP_TIE_9M', 'V55_PIT_MAIN_SUMP', 'V55_WASTE_DUMP_A',
      'V51_ROM_TO_APRON_CHUTE_BOTTOM', 'V52_PIPE_MILL_TO_SUMP',
      'V52_PIPE_CLASS_UNDERFLOW_TO_MILL', 'V52_PIPE_PUMP_TO_CIP',
      'V52_PIPE_CIP_TO_ELUTION', 'V52_PIPE_ELUTION_TO_EW', 'V39_EW_SMELT_CART',
    ].forEach((name) => expect(names.has(name), `${name} must remain in V55`).toBe(true));
  });

  it('exports authored Blender colours instead of white defaults', () => {
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
