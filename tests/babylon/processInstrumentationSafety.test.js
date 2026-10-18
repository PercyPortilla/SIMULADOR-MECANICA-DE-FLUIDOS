import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Scene } from '@babylonjs/core/scene.js';
import { describe, expect, it, vi } from 'vitest';
import { getTerrainHeight } from '../../src/scene/environment/terrainHeight.js';
import { createBabylonProcessEquipmentSystem } from '../../src/babylon/equipment/processEquipmentSystem.js';
import { createBabylonProcessInstrumentation, INSTRUMENT_SPECS } from '../../src/babylon/infrastructure/processInstrumentation.js';
import { createBabylonIndustrialSafety } from '../../src/babylon/infrastructure/industrialSafety.js';

function makeScene(){const engine=new NullEngine({renderWidth:32,renderHeight:32});const scene=new Scene(engine);scene.useRightHandedSystem=true;return{engine,scene};}
function loadContainer(scene){return async(url)=>{const root=new TransformNode(`root-${url}`,scene);const mesh=new Mesh(`mesh-${url}`,scene);mesh.parent=root;return{rootNodes:[root],animationGroups:[],addAllToScene:vi.fn(),dispose:vi.fn()};};}

describe('Babylon process instrumentation closure contract', () => {
  it('keeps the validated 12 tag/port specifications and anchors each instrument to the Babylon equipment registry', async () => {
    expect(INSTRUMENT_SPECS).toHaveLength(12);
    expect(new Set(INSTRUMENT_SPECS.map((spec)=>spec.tag)).size).toBe(12);
    const {engine,scene}=makeScene();
    const equipmentSystem=createBabylonProcessEquipmentSystem({scene,loadContainer:loadContainer(scene)});
    await equipmentSystem.ready;
    const instrumentation=createBabylonProcessInstrumentation({scene,equipmentSystem});
    expect(instrumentation.root.metadata).toMatchObject({instrumentCount:12,visualOnly:true,educationalInstrumentation:true,solverCoupled:false});
    instrumentation.instruments.forEach((instrument,index)=>{
      const spec=INSTRUMENT_SPECS[index];
      const anchor=equipmentSystem.getPortWorldPosition(spec.equipmentId,spec.portId);
      expect(instrument.metadata.instrumentTag).toBe(spec.tag);
      expect(instrument.metadata.anchorPoint).toEqual(anchor.asArray());
      expect(instrument.metadata.offset).toEqual([...spec.offset]);
      expect(instrument.metadata.solverCoupled).toBe(false);
    });
    equipmentSystem.dispose();scene.dispose();engine.dispose();
  }, 30000);
});

describe('Babylon industrial safety closure contract', () => {
  it('keeps the validated safety inventory and terrain-grounded assets', () => {
    const {engine,scene}=makeScene();
    const safety=createBabylonIndustrialSafety({scene});
    expect(safety.root.metadata).toMatchObject({
      visualOnly:true,v24IndustrialSafety:true,signCount:8,extinguisherCount:6,
      hasEyewash:true,hasRestrictedFence:true,hasPedestrianPath:true,pedestrianMarkerCount:18,
    });
    expect(safety.signs).toHaveLength(8);
    expect(safety.extinguishers).toHaveLength(6);
    expect(safety.pedestrianMarkers.getChildMeshes(false)).toHaveLength(18);
    for(const node of [...safety.signs,...safety.extinguishers,safety.eyewash,safety.gate]){
      expect(node.position.y).toBeCloseTo(getTerrainHeight(node.position.x,node.position.z),10);
    }
    expect(safety.fenceWest.metadata.safetyRole).toBe('restricted-area-fence');
    expect(safety.fenceEast.metadata.safetyRole).toBe('restricted-area-fence');
    scene.dispose();engine.dispose();
  });

  it('keeps safety and instrumentation modules renderer-local', () => {
    const here=path.dirname(fileURLToPath(import.meta.url));
    for(const relative of ['../../src/babylon/infrastructure/processInstrumentation.js','../../src/babylon/infrastructure/industrialSafety.js']){
      const source=fs.readFileSync(path.resolve(here,relative),'utf8');
      expect(source).not.toMatch(/from\s+['"]three(?:\/|['"])/i);
      expect(source).not.toMatch(/\bTHREE\b|WebGLRenderer|requestAnimationFrame/);
    }
  });
});
