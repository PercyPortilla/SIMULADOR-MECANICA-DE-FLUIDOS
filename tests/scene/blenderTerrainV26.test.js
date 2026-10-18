import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  attachReceptionEarthworkBlenderOverlay,
  RECEPTION_EARTHWORK_BLENDER_URL,
  RECEPTION_EARTHWORK_TERRAIN_REVISION,
} from '../../src/scene/integration/blenderTerrainOverlay.js';
import { TOPOGRAPHIC_ZONES } from '../../src/scene/config/siteDesign.js';
import { getTerrainHeight } from '../../src/scene/environment/terrainHeight.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..', '..');
const contractPath = path.join(projectRoot, 'blender', 'generated', 'v26-reception-earthwork-contract.json');
const glbPath = path.join(projectRoot, 'public', RECEPTION_EARTHWORK_BLENDER_URL);

function readGlbJson(filePath) {
  const buffer = fs.readFileSync(filePath);
  expect(buffer.subarray(0, 4).toString()).toBe('glTF');
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

describe('V26 Blender reception earthwork', () => {
  it('uses the V26 metre-scale visual-only terrain contract at runtime', () => {
    const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
    expect(RECEPTION_EARTHWORK_BLENDER_URL).toMatch(/RECEPTION-EARTHWORK-V26\.glb$/);
    expect(RECEPTION_EARTHWORK_TERRAIN_REVISION).toBe('V26');
    expect(contract.assetId).toBe('RECEPTION-EARTHWORK-V26');
    expect(contract.authoritative).toBe(false);
    expect(contract.visualOnly).toBe(true);
    expect(contract.worldUnitsPerMeter).toBe(1);
    expect(contract.worldPlanar.repeats).toBe(false);
    expect(contract.trafficOverlays).toHaveLength(4);
  });

  it('keeps the exported Blender height contract locked to getTerrainHeight()', () => {
    const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
    const { xValues, zValues, heights } = contract.grid;
    let maximumDeviationM = 0;
    zValues.forEach((z, zi) => {
      xValues.forEach((x, xi) => {
        maximumDeviationM = Math.max(
          maximumDeviationM,
          Math.abs(heights[zi][xi] - getTerrainHeight(x, z)),
        );
      });
    });
    expect(maximumDeviationM).toBeLessThanOrEqual(0.000001);
    expect(contract.visualLiftM).toBeLessThanOrEqual(0.05);
  });

  it('ships semantic PBR bands with non-repeating texture channels and no animations', () => {
    expect(fs.existsSync(glbPath)).toBe(true);
    expect(fs.statSync(glbPath).size).toBeGreaterThan(1_000_000);
    const doc = readGlbJson(glbPath);
    const names = (doc.nodes ?? []).map((node) => node.name ?? '');
    for (const band of ['CREST', 'UPPER_SLOPE', 'BERM', 'TOE_SLOPE']) {
      expect(names.some((name) => name.includes(`RECEPTION-EARTHWORK-V26_${band}`))).toBe(true);
    }
    for (const overlay of ['ROM-DUMP-APRON-WEAR', 'ROM-HOPPER-FINES-STAIN', 'ROM-TIRE-RIBBON-INNER', 'ROM-TIRE-RIBBON-OUTER']) {
      expect(names).toContain(overlay);
    }
    const terrainMaterials = (doc.materials ?? []).filter((material) => material.name?.startsWith('V26_') && material.name?.endsWith('_PBR'));
    expect(terrainMaterials).toHaveLength(4);
    terrainMaterials.forEach((material) => {
      expect(material.pbrMetallicRoughness?.baseColorTexture).toBeTruthy();
      expect(material.pbrMetallicRoughness?.metallicRoughnessTexture).toBeTruthy();
      expect(material.normalTexture).toBeTruthy();
      expect(material.occlusionTexture).toBeTruthy();
    });
    expect(doc.animations ?? []).toHaveLength(0);
  });

  it('stores authoritative world-coordinate bounds on the semantic band accessors', () => {
    const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
    const doc = readGlbJson(glbPath);
    const bandMeshes = (doc.meshes ?? []).filter((mesh) => mesh.name?.startsWith('RECEPTION-EARTHWORK-V26_'));
    const mins = [Infinity, Infinity, Infinity];
    const maxs = [-Infinity, -Infinity, -Infinity];
    bandMeshes.forEach((mesh) => {
      mesh.primitives?.forEach((primitive) => {
        const accessor = doc.accessors?.[primitive.attributes?.POSITION];
        expect(accessor?.min).toBeTruthy();
        expect(accessor?.max).toBeTruthy();
        for (let axis = 0; axis < 3; axis += 1) {
          mins[axis] = Math.min(mins[axis], accessor.min[axis]);
          maxs[axis] = Math.max(maxs[axis], accessor.max[axis]);
        }
      });
    });
    expect(mins[0]).toBeCloseTo(contract.worldPlanar.boundsM.xMin, 2);
    expect(maxs[0]).toBeCloseTo(contract.worldPlanar.boundsM.xMax, 2);
    expect(mins[2]).toBeCloseTo(contract.worldPlanar.boundsM.zMin, 2);
    expect(maxs[2]).toBeCloseTo(contract.worldPlanar.boundsM.zMax, 2);
    expect(maxs[1]).toBeGreaterThan(TOPOGRAPHIC_ZONES.reception.elevation);
  });

  it('keeps procedural getTerrainHeight authority as the SSR fallback', () => {
    const parent = new THREE.Group();
    const handle = attachReceptionEarthworkBlenderOverlay({ parent });
    expect(handle.loaded).toBe(false);
    expect(handle.root.name).toBe('reception-earthwork-v26-overlay');
    expect(handle.root.userData.visualOnly).toBe(true);
    expect(handle.root.userData.authoritativeTerrain).toBe(false);
    expect(handle.root.userData.terrainRealismRevision).toBe('V26');
    expect(handle.root.userData.blenderVisualStatus).toBe('ssr-procedural-fallback');
    handle.dispose();
    expect(handle.root.parent).toBeNull();
  });
});
