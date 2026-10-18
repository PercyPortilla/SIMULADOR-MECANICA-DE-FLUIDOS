import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { describe, expect, it } from 'vitest';
import { getTerrainHeight, getTerrainZone, getZoneElevation } from '../../src/scene/environment/terrainHeight.js';
import { getPlantZone } from '../../src/scene/layout/plantLayout.js';
import {
  BABYLON_EMBEDDED_FOUNDATION_COVER_M,
  BABYLON_EMBEDDED_FOUNDATION_THICKNESS_M,
  BABYLON_EMBEDDED_FOUNDATION_ZONE_IDS,
  BABYLON_INDUSTRIAL_PAD_THICKNESS,
  createBabylonIndustrialPads,
  createBabylonPlantFoundations,
  getBabylonEmbeddedFoundationDefinition,
  getBabylonIndustrialPad,
} from '../../src/babylon/environment/industrialPads.js';
import { createBabylonCivilInfrastructure } from '../../src/babylon/environment/civilInfrastructure.js';

function makeScene(){const engine=new NullEngine({renderWidth:32,renderHeight:32});const scene=new Scene(engine);scene.useRightHandedSystem=true;return{engine,scene};}

describe('Babylon industrial pads and civil closure contract', () => {
  it('keeps the validated reception/crushing pad definitions', () => {
    expect(BABYLON_INDUSTRIAL_PAD_THICKNESS).toBe(0.18);
    expect(getBabylonIndustrialPad('reception')).toMatchObject({name:'rom-hopper-local-pad',center:[-110,-30],width:12.5,depth:14});
    expect(getBabylonIndustrialPad('reception').elevation).toBe(getZoneElevation('reception'));
    expect(getBabylonIndustrialPad('crushing')).toMatchObject({name:'crusher-local-pad',center:[-88,-30],width:8.5,depth:9.5});
    expect(getBabylonIndustrialPad('crushing').elevation).toBe(getTerrainHeight(-88,-30));
  });

  it('builds pads and Z4/Z5 foundations at the renderer-neutral engineering datums', () => {
    const {engine,scene}=makeScene();
    const pads=createBabylonIndustrialPads({scene});
    expect(Object.keys(pads.pads)).toEqual(['reception','crushing']);
    expect(pads.expansionJoints).toHaveLength(4);
    expect(BABYLON_EMBEDDED_FOUNDATION_ZONE_IDS).toEqual(['Z4','Z5']);
    expect(BABYLON_EMBEDDED_FOUNDATION_THICKNESS_M).toBe(0.35);
    expect(BABYLON_EMBEDDED_FOUNDATION_COVER_M).toBe(0.08);
    const foundations=createBabylonPlantFoundations({scene});
    BABYLON_EMBEDDED_FOUNDATION_ZONE_IDS.forEach((zoneId)=>{
      const zone=getPlantZone(zoneId);
      const contract=getBabylonEmbeddedFoundationDefinition(zoneId);
      const mesh=foundations.foundations[zoneId];
      expect(contract.foundationTopY).toBe(zone.elevation-0.08);
      expect(mesh.metadata.engineeringDatumY).toBe(zone.elevation);
      expect(mesh.metadata.embeddedFoundation).toBe(true);
    });
    scene.dispose();engine.dispose();
  });

  it('keeps reception civil works, drains and safety nodes at terrain-governed coordinates', () => {
    const {engine,scene}=makeScene();
    createBabylonCivilInfrastructure({scene});
    const reception=getTerrainZone('reception');
    const apron=scene.getMeshByName('reception-turning-apron');
    expect(apron.metadata.dimensionsM).toEqual([32,0.14,26]);
    expect(apron.position.y).toBeCloseTo(getZoneElevation('reception')+0.07,12);
    for(let index=1;index<=3;index+=1) expect(scene.getMeshByName(`reception-safety-berm-${index}`).metadata.designHeightM).toBe(1.4);
    for(const [name,length,width] of [['reception-lined-drain-south-east',20,0.56],['reception-lined-drain-north',31,0.50]]){
      const bed=scene.getMeshByName(`${name}-bed`);
      expect(bed.metadata.dimensionsM).toEqual([length,0.08,width]);
      expect(bed.position.y).toBeCloseTo(getTerrainHeight(bed.position.x,bed.position.z)+0.02,12);
    }
    expect(scene.getTransformNodeByName('reception-riprap-outlet')).toBeTruthy();
    expect(reception.center).toBeTruthy();
    scene.dispose();engine.dispose();
  });

  it('keeps new Babylon civil modules free of Three/render-loop coupling', () => {
    const here=path.dirname(fileURLToPath(import.meta.url));
    for(const relative of ['../../src/babylon/environment/industrialPads.js','../../src/babylon/environment/civilInfrastructure.js']){
      const source=fs.readFileSync(path.resolve(here,relative),'utf8');
      expect(source).not.toMatch(/from\s+['"]three(?:\/|['"])/i);
      expect(source).not.toMatch(/\bTHREE\b|WebGLRenderer|requestAnimationFrame/);
    }
  });
});
