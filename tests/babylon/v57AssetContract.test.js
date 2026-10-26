import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { B73_FOUNDATION_SPECS } from '../../src/babylon/assets/b73FoundationVisual.js';
import { B80_CIVIL_MATERIAL_PROFILES } from '../../src/babylon/assets/b80TerrainCivilVisual.js';
import { B81_CONTINUITY_SPECS } from '../../src/babylon/assets/b81ProcessContinuityVisual.js';
import { INSPECTION_FOCUS_PROFILES } from '../../src/scene/inspection/inspectionContracts.js';

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
      'EXCAVATOR-01', 'TRUCK-01', 'TRUCK-02', 'TRUCK-03', 'STOCKPILE-LOADER-01',
      'ROM-HOPPER_ROOT', 'APRON-FEEDER_ROOT', 'PRIMARY-CRUSHER_ROOT.001',
      'MILL-01_ROOT', 'SUMP-01_ROOT', 'SLURRY-PUMP-01_ROOT', 'PIPE-1_ROOT',
      'CLASS-01_ROOT', 'R-01_ROOT', 'R-02_ROOT', 'R-03_ROOT', 'R-04_ROOT', 'PUMP-01_ROOT',
      'CIP-ADSORPTION_ROOT', 'ELUTION-SKID_ROOT', 'EW-CELLS_ROOT',
      'SMELTING-FURNACE_ROOT', 'DETOX_ROOT', 'TAILINGS-THICKENER_ROOT',
      'TAILINGS-PUMP_ROOT', 'TSF-CONCEPT_ROOT', 'V57_TERRAIN_INTEGRATED',
    ].forEach((name) => expect(names.has(name), `${name} must remain in V57`).toBe(true));
  });

  it('embeds the B64 terrain texture in the optimized production GLB', () => {
    const { gltf } = readGlbJson(ASSET_PATH);
    const terrainNode = gltf.nodes.find((node) => node.name === 'V57_TERRAIN_INTEGRATED');
    expect(terrainNode?.mesh).toBeTypeOf('number');
    const terrainMesh = gltf.meshes[terrainNode.mesh];
    expect(terrainMesh.primitives).toHaveLength(1);
    const terrainMaterial = gltf.materials[terrainMesh.primitives[0].material];
    expect(terrainMaterial.name).toBe('MAT_B64_TERRAIN_EARTH_EMBEDDED');
    const baseColorTexture = terrainMaterial.pbrMetallicRoughness?.baseColorTexture;
    expect(baseColorTexture?.index).toBeTypeOf('number');
    expect(baseColorTexture?.extensions?.KHR_texture_transform?.scale).toEqual([32, 32]);
    const texture = gltf.textures[baseColorTexture.index];
    expect(gltf.images[texture.source]?.mimeType).toBe('image/jpeg');
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

  it('retains the authored V57 nodes used by B79 Inspection focus profiles', () => {
    const { gltf } = readGlbJson(ASSET_PATH);
    const names = gltf.nodes.map((node) => node.name ?? '');
    ['EXCAVATOR-01', 'STOCKPILE-RECLAIM', 'CLASS-01'].forEach((id) => {
      const profile = INSPECTION_FOCUS_PROFILES[id];
      expect(profile, `${id} must keep a B79 focus profile`).toBeTruthy();
      (profile.focusObjectNames ?? []).forEach((name) => {
        expect(names.includes(name), `${id} focus node ${name} must remain in V57`).toBe(true);
      });
      (profile.focusObjectPrefixes ?? []).forEach((prefix) => {
        expect(names.some((name) => name.startsWith(prefix)), `${id} focus prefix ${prefix} must remain in V57`).toBe(true);
      });
    });
  });

  it('retains every B80 load-bearing focus/reuse selector used for local foundations', () => {
    const { gltf } = readGlbJson(ASSET_PATH);
    const names = gltf.nodes.map((node) => node.name ?? '');
    B73_FOUNDATION_SPECS.forEach((spec) => {
      (spec.focusNames ?? []).forEach((name) => {
        expect(names.includes(name), `${spec.id} B80 foundation focus ${name} must remain in V57`).toBe(true);
      });
      (spec.focusPrefixes ?? []).forEach((prefix) => {
        expect(names.some((name) => name.startsWith(prefix)), `${spec.id} B80 foundation prefix ${prefix} must remain in V57`).toBe(true);
      });
      (spec.instances ?? []).forEach((instance) => {
        (instance.focusNames ?? []).forEach((name) => {
          expect(names.includes(name), `${spec.id}/${instance.key} B80 foundation focus ${name} must remain in V57`).toBe(true);
        });
        (instance.focusPrefixes ?? []).forEach((prefix) => {
          expect(names.some((name) => name.startsWith(prefix)), `${spec.id}/${instance.key} B80 foundation prefix ${prefix} must remain in V57`).toBe(true);
        });
      });
      if (spec.reuseFoundationName) {
        expect(names.includes(spec.reuseFoundationName), `${spec.id} authored foundation ${spec.reuseFoundationName} must remain in V57`).toBe(true);
      }
    });
  });

  it('retains the B80 civil material names and representative authored pad bindings', () => {
    const { gltf } = readGlbJson(ASSET_PATH);
    const materialNames = new Set(gltf.materials.map((material) => material.name ?? ''));
    Object.keys(B80_CIVIL_MATERIAL_PROFILES).forEach((name) => {
      expect(materialNames.has(name), `${name} must remain available for B80 runtime repair`).toBe(true);
    });

    const materialNamesForNode = (nodeName) => {
      const node = gltf.nodes.find((entry) => entry.name === nodeName);
      expect(node?.mesh, `${nodeName} must remain a mesh node`).toBeTypeOf('number');
      return new Set(
        gltf.meshes[node.mesh].primitives
          .map((primitive) => gltf.materials[primitive.material]?.name)
          .filter(Boolean),
      );
    };
    expect(materialNamesForNode('CIV_GRINDING_PAD').has('MAT_V57_CIVIL_COMPACTED_FILL')).toBe(true);
    expect(materialNamesForNode('CIV_CRUSHER_FOUNDATION').has('MAT_V57_CIVIL_CONCRETE')).toBe(true);
    expect(materialNamesForNode('V57_ROM_ENGINEERED_MANEUVER_PAD').has('MAT_V57_HAUL_ROAD_PBR')).toBe(true);
  });

  it('retains every V57 authored endpoint used by the B81 process continuity closure', () => {
    const { gltf } = readGlbJson(ASSET_PATH);
    const names = new Set(gltf.nodes.map((node) => node.name ?? ''));
    B81_CONTINUITY_SPECS.forEach((spec) => {
      expect(names.has(spec.sourceName), `${spec.id} source ${spec.sourceName} must remain in V57`).toBe(true);
      expect(names.has(spec.targetName), `${spec.id} target ${spec.targetName} must remain in V57`).toBe(true);
    });
  });

  it('keeps legacy dry-route duplicates out of the production V57 asset', () => {
    const { gltf } = readGlbJson(ASSET_PATH);
    const names = gltf.nodes.map((node) => node.name ?? '');
    [
      'V49_APRON_TO_CRUSHER_',
      'V49_CV02_',
      'V49_CV03_',
      'V51_ROM_TO_APRON_CHUTE_BOTTOM',
    ].forEach((prefix) => {
      expect(names.some((name) => name.startsWith(prefix)), `${prefix} must stay absent from production V57`).toBe(false);
    });
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
