import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer.js';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { describe, expect, it } from 'vitest';
import { ROAD_CIVIL_DETAIL, ROAD_DEFINITIONS, SERVICE_ROAD_VERTICAL_PROFILE } from '../../src/scene/config/siteDesign.js';
import { createBabylonRoadNetwork } from '../../src/babylon/environment/roadNetwork.js';
import { getBabylonRoadCutFillTransitionWidth, getBabylonRoadSafetyBermHeight } from '../../src/babylon/environment/roadVisualDetails.js';

const ROAD_IDS = Object.freeze(['ROAD-01', 'ROAD-02', 'ROAD-03', 'ROAD-04']);
function expectedDetailNames(roadId) {
  const names=[`${roadId}-left-shoulder`,`${roadId}-right-shoulder`,`${roadId}-left-cut-fill-transition`,`${roadId}-right-cut-fill-transition`];
  if (roadId !== 'ROAD-01') names.push(`${roadId}-left-drainage-swale`,`${roadId}-right-drainage-swale`);
  const bermCount=roadId==='ROAD-01'?2:1;
  for(let i=1;i<=bermCount;i+=1) names.push(`${roadId}-continuous-safety-berm-${i}`);
  if(roadId==='ROAD-01') names.push('primary-haul-wheel-track-1','primary-haul-wheel-track-2');
  return names;
}

describe('Babylon road visual closure contract', () => {
  it('keeps validated cut/fill and continuous-berm design values', () => {
    expect(getBabylonRoadCutFillTransitionWidth('ROAD-01', 0)).toBeCloseTo(ROAD_CIVIL_DETAIL.primaryTransitionWidthM, 12);
    expect(getBabylonRoadCutFillTransitionWidth('ROAD-01', 1))
      .toBeCloseTo(ROAD_CIVIL_DETAIL.primaryTransitionWidthM + ROAD_CIVIL_DETAIL.primaryTieInFlareM, 12);
    expect(getBabylonRoadSafetyBermHeight('ROAD-01', 0)).toBeCloseTo(ROAD_CIVIL_DETAIL.primaryBermHeightM, 12);
    expect(getBabylonRoadSafetyBermHeight('ROAD-01', 1)).toBe(0);
    for (const roadId of ['ROAD-02','ROAD-03','ROAD-04']) {
      expect(getBabylonRoadCutFillTransitionWidth(roadId, 0.5)).toBe(SERVICE_ROAD_VERTICAL_PROFILE.minimumTransitionWidthM);
      expect(getBabylonRoadSafetyBermHeight(roadId, 0.5)).toBe(0.48);
    }
  });

  it('creates the exact 29 validated road-detail meshes without changing road widths', () => {
    const engine=new NullEngine({renderWidth:32,renderHeight:32}); const scene=new Scene(engine); scene.useRightHandedSystem=true;
    const network=createBabylonRoadNetwork({scene});
    expect(ROAD_IDS.flatMap(expectedDetailNames)).toHaveLength(29);
    ROAD_IDS.forEach((roadId)=>{
      const meshes=network.visualDetails[roadId].meshes;
      expect(meshes.map((mesh)=>mesh.name)).toEqual(expectedDetailNames(roadId));
      expect(network.roads[roadId].mesh.metadata.widthM).toBe(ROAD_DEFINITIONS[roadId].widthM);
      meshes.forEach((mesh)=>{
        const positions=mesh.getVerticesData(VertexBuffer.PositionKind);
        expect(positions.length).toBeGreaterThan(0);
        expect(positions.every(Number.isFinite)).toBe(true);
        expect(mesh.getTotalIndices()).toBeGreaterThan(0);
        expect(mesh.parent).toBe(network.root);
      });
    });
    scene.dispose(); engine.dispose();
  });

  it('keeps Babylon road visual code renderer-local', () => {
    const here=path.dirname(fileURLToPath(import.meta.url));
    const source=fs.readFileSync(path.resolve(here,'../../src/babylon/environment/roadVisualDetails.js'),'utf8');
    expect(source).not.toMatch(/from\s+['"]three(?:\/|['"])/i);
    expect(source).not.toMatch(/\bTHREE\b|WebGLRenderer|requestAnimationFrame/);
  });
});
