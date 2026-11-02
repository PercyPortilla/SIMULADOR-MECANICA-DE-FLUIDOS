import {describe,it,expect} from 'vitest';
import {NullEngine,Scene,MeshBuilder,StandardMaterial} from '@babylonjs/core';
import {P3P4_SIGNED_GATE,segmentFromFluidMesh,createPumpP3P4Inspection}
  from '../../src/ui/pumpP3P4Inspection.js';

describe('P3-P4 source-mesh fluid inspection, zero fake wet mates',()=>{
 it('documents signed physical discontinuity rather than claiming a completed connection',()=>{
  expect(P3P4_SIGNED_GATE.measuredGapM).toBeCloseTo(1.5139007568359375);
  expect(P3P4_SIGNED_GATE.eyeOpen).toBe(false);
  expect(P3P4_SIGNED_GATE.dischargeOpen).toBe(false);
  expect(P3P4_SIGNED_GATE.fluidVolumeConnected).toBe(false);
 });
 it('reveals source fluid mesh, not a new joining pipe, and restores source exactly',()=>{
  const engine=new NullEngine({renderWidth:500,renderHeight:300});
  const scene=new Scene(engine);
  const fluid=MeshBuilder.CreateCylinder('SLURRY-PUMP-01_SUCTION_FLUID_SEG02',{
   height:9.8,diameter:.75,tessellation:20},scene);
  fluid.rotation.z=Math.PI/2;
  fluid.isVisible=false;
  const original=new StandardMaterial('ORIGINAL_FLUID',scene);
  fluid.material=original;
  const shell=MeshBuilder.CreateCylinder('SLURRY-PUMP-01_SUCTION_SEG02',{
   height:9.8,diameter:1.1,tessellation:20},scene);
  shell.rotation.z=Math.PI/2;shell.visibility=.86;
  const bridge=MeshBuilder.CreateCylinder('B71_sump-to-pump_SEAM_BRIDGE',{
   height:1.5,diameter:1.1},scene);
  let inspection;
  try{
   const straight=segmentFromFluidMesh(fluid);
   expect(straight?.length).toBeGreaterThan(5);
   inspection=createPumpP3P4Inspection({scene,getVelocity:()=>1.2});
   expect(inspection.status.authoredFluidMeshesFound).toBe(1);
   expect(inspection.status.straightFluidSegmentsAnimated).toBe(1);
   expect(inspection.status.certifiedWetMate).toBe(false);
   inspection.setActive(true);
   expect(fluid.isVisible).toBe(true);
   expect(fluid.material).not.toBe(original);
   expect(shell.visibility).toBeLessThan(.86);
   expect(bridge.isVisible).toBe(false);
   expect(scene.meshes.filter(x=>x.name.includes('P3P4_EDU_GAP_DASH')).length).toBe(7);
   inspection.setActive(false);
   expect(fluid.isVisible).toBe(false);
   expect(fluid.material).toBe(original);
   expect(shell.visibility).toBe(.86);
   expect(bridge.isVisible).toBe(true);
   expect(inspection.status.geometryMoved).toBe(false);
   expect(inspection.status.sourceCadModified).toBe(false);
  }finally{inspection?.dispose();scene.dispose();engine.dispose();}
 });
});
