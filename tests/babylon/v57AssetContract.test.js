import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ASSET_PATH = path.resolve('public/models/pulpa-v57/PULPA_LAB_V57_FULL_SITE_FINAL.glb');

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

describe('Blender V57 final production asset contract', () => {
  it('keeps the complete authored site within the uncompressed web budget', () => {
    const { buffer, gltf } = readGlbJson(ASSET_PATH);
    // B60/B61 add integrated civil earthworks plus the operational mine fleet.
    // Keep enough headroom for the authoritative scene without requiring a
    // runtime mesh-compression extension just to satisfy an obsolete V57 cap.
    expect(buffer.byteLength).toBeLessThan(40 * 1024 * 1024);
    expect(gltf.scenes).toHaveLength(1);
    expect(gltf.nodes.length).toBeGreaterThanOrEqual(5000);
    expect(gltf.meshes.length).toBeGreaterThanOrEqual(1700);
    expect(gltf.materials.length).toBeGreaterThanOrEqual(100);
    // V57 is intentionally exported as one coherent 720-frame scene clip.
    // Per-object clips used to loop on their own local ranges in Babylon,
    // desynchronizing truck dump, ore transfer and mechanical motion.
    expect(gltf.animations).toHaveLength(1);
    expect(gltf.animations[0]?.name).toBe('Scene');
    expect(gltf.animations[0]?.channels.length).toBeGreaterThanOrEqual(1100);
    expect(gltf.animations[0]?.samplers.length).toBe(gltf.animations[0]?.channels.length);
  });

  it('retains the critical V57 equipment hierarchy and terrain', () => {
    const { gltf } = readGlbJson(ASSET_PATH);
    const names = new Set(gltf.nodes.map((node) => node.name));
    [
      'EXCAVATOR-01', 'TRUCK-01', 'TRUCK-02', 'TRUCK-03',
      'ROM-HOPPER_ROOT', 'APRON-FEEDER_ROOT', 'PRIMARY-CRUSHER_ROOT.001',
      'MILL-01_ROOT', 'SUMP-01_ROOT', 'SLURRY-PUMP-01_ROOT', 'PIPE-1_ROOT',
      'CLASS-01_ROOT', 'R-01_ROOT', 'R-02_ROOT', 'R-03_ROOT', 'R-04_ROOT',
      'CIP-ADSORPTION_ROOT', 'ELUTION-SKID_ROOT', 'EW-CELLS_ROOT',
      'SMELTING-FURNACE_ROOT', 'DETOX_ROOT', 'TAILINGS-THICKENER_ROOT',
      'TAILINGS-PUMP_ROOT', 'TSF-CONCEPT_ROOT', 'V57_TERRAIN_INTEGRATED',
    ].forEach((name) => expect(names.has(name), `${name} must remain in V57`).toBe(true));
  });

  it('retains every critical 720-frame animation family', () => {
    const { gltf } = readGlbJson(ASSET_PATH);
    const names = animatedNodeNames(gltf);
    [
      // B61 intentionally stations TRUCK-02 at ROM and TRUCK-03 at the pit.
      // Their operational state is expressed by dump/load subassemblies while
      // TRUCK-01 remains the moving haul-road truck.
      'TRUCK-01', 'TRUCK-02_DUMP_PIVOT', 'TRUCK-02_ORE_LOAD', 'TRUCK-03_ORE_LOAD',
      'EXCAVATOR-01_BOOM_PIVOT', 'EXCAVATOR-01_STICK_PIVOT', 'EXCAVATOR-01_BUCKET_PIVOT',
      'EXCAVATOR-01_BUCKET_ORE', 'STOCKPILE-LOADER-01', 'STOCKPILE-LOADER-01_BUCKET_ORE',
      'APRON-FEEDER_HEAD_SPROCKET_PIVOT', 'PRIMARY-CRUSHER_MOVING_JAW_PIVOT.001',
      'MILL-01_MOVING', 'SLURRY-PUMP-01_MOVING', 'CLASS-01_CYCLONE_00_SWIRL_PIVOT',
      'R-01_MOVING', 'CIP-01_MOVING', 'CARBON-REGEN_MOVING',
      'SMELTING-FURNACE_MOVING', 'DETOX_MOVING',
      'TAILINGS-THICKENER_MOVING', 'TAILINGS-PUMP_MOVING',
    ].forEach((name) => expect(names.has(name), `${name} must remain animated`).toBe(true));
  });

  it('does not revive the superseded V57 carbon or layout helpers', () => {
    const { gltf } = readGlbJson(ASSET_PATH);
    const names = gltf.nodes.map((node) => node.name ?? '');
    [
      'CIP-TO-ELUTION-CARBON',
      'CIP_CARBON_TO_ELUTION_STUB',
      'LAYOUT_',
      'ANCHOR_',
    ].forEach((prefix) => {
      expect(names.some((name) => name.startsWith(prefix)), `${prefix} must not be exported`).toBe(false);
    });
  });
});
