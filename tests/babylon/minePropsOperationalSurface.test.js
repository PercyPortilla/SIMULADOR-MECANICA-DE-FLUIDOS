import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer.js';
import { describe, expect, it } from 'vitest';
import { getTerrainHeight } from '../../src/scene/environment/terrainHeight.js';
import { createBabylonMineProps } from '../../src/babylon/environment/mineProps.js';
import { createBabylonOperationalSurfaceDetails } from '../../src/babylon/environment/operationalSurfaceDetails.js';

function makeScene(){const engine=new NullEngine({renderWidth:32,renderHeight:32});const scene=new Scene(engine);scene.useRightHandedSystem=true;return{engine,scene};}

describe('Babylon mine context closure contract', () => {
  it('keeps the validated RH/1m/getTerrainHeight authority and principal mine context', () => {
    const {engine,scene}=makeScene();
    const {root}=createBabylonMineProps({scene});
    expect(root.name).toBe('mine-context-props');
    expect(root.metadata).toMatchObject({coordinateSystem:'right-handed',worldUnitsPerMeter:1,terrainHeightSource:'getTerrainHeight'});
    for(const name of [
      'pit-perimeter-rock-field','pit-exposed-ore-band','pit-loading-platform','pit-drilling-platform',
      'pit-final-wall-rock-instances','north-waste-dump','south-waste-dump','pit-sump-water',
      'control-mcc-building','sparse-mine-shrubs'
    ]) expect(scene.getNodeByName(name)).toBeTruthy();
    expect(scene.getMeshByName('pit-final-wall-rock-instances').thinInstanceCount).toBe(18);
    expect(scene.getMeshByName('sparse-mine-shrubs').thinInstanceCount).toBe(34);
    scene.dispose();engine.dispose();
  });

  it('keeps procedural road/drain surfaces with upward-facing normals and terrain grounding', () => {
    const {engine,scene}=makeScene();
    createBabylonMineProps({scene});
    for(const name of ['pit-drain-channel-west','pit-drain-channel-east','north-waste-dump-access','south-waste-dump-access']){
      const mesh=scene.getMeshByName(name);
      const normals=mesh.getVerticesData(VertexBuffer.NormalKind);
      expect(normals.length).toBeGreaterThan(0);
      for(let index=1;index<normals.length;index+=3) expect(normals[index]).toBeGreaterThan(0);
    }
    const platform=scene.getMeshByName('pit-loading-platform');
    expect(platform.position.y).toBeGreaterThanOrEqual(getTerrainHeight(platform.position.x,platform.position.z)-1);
    scene.dispose();engine.dispose();
  });
});

describe('Babylon operational surface closure contract', () => {
  it('keeps the validated visual-only wear/spill/staging inventory', () => {
    const {engine,scene}=makeScene();
    const {root}=createBabylonOperationalSurfaceDetails({scene});
    expect(root.metadata).toMatchObject({
      visualOnly:true,authoritativeTerrain:false,reusesExistingRoadTracks:true,reusesExistingDrainage:true,
      surfacePatchCount:5,controlledSpillCount:3,romStagingPileCount:1,
    });
    for(const name of ['rom-loader-working-wear','crusher-fines-stain','stockpile-traffic-wear','mill-feed-fines-stain','recovery-service-wear']){
      const mesh=scene.getMeshByName(name);
      expect(mesh).toBeTruthy();
      expect(mesh.position.y).toBeCloseTo(getTerrainHeight(mesh.position.x,mesh.position.z)+0.022,10);
    }
    expect(scene.getTransformNodeByName('ROM-STAGING-PILE')).toBeTruthy();
    for(let id=1;id<=10;id+=1) expect(scene.getMeshByName(`loader-scuff-${id}`)).toBeTruthy();
    scene.dispose();engine.dispose();
  });

  it('keeps mine visual modules free of Three/render-loop coupling', () => {
    const here=path.dirname(fileURLToPath(import.meta.url));
    for(const relative of ['../../src/babylon/environment/mineProps.js','../../src/babylon/environment/operationalSurfaceDetails.js']){
      const source=fs.readFileSync(path.resolve(here,relative),'utf8');
      expect(source).not.toMatch(/from\s+['"]three(?:\/|['"])/i);
      expect(source).not.toMatch(/\bTHREE\b|WebGLRenderer|requestAnimationFrame/);
    }
  });
});
