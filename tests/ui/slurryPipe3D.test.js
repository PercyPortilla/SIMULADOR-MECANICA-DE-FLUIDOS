import {describe,it,expect} from 'vitest';
import {NullEngine} from '@babylonjs/core';
import {createSlurryPipe3DScene,radialVelocityFactor} from '../../src/ui/slurryPipe3D.js';

describe('3D didactic slurry cutaway (isolated from signed CAD)',()=>{
  it('creates a real hollow-section mesh and 410 GPU-instanced particles',()=>{
    const canvas={getBoundingClientRect:()=>({width:960,height:210})};
    const viewer=createSlurryPipe3DScene({
      canvas,engineFactory:()=>new NullEngine({renderWidth:960,renderHeight:210}),
    });
    try{
      viewer.render({nextModel:{velocity:1.2,solidsMass:.35,d50mm:.4,
        bed:.22,wearExposureVisual:.4},bedLevel:.2,dt:.016,tab:'flow'});
      expect(viewer.status.geo3D).toBe(true);
      expect(viewer.status.particles).toBe(410);
      expect(viewer.scene.getMeshByName('EDU_PIPE_3D_OUTER_SHELL')?.getTotalVertices()).toBeGreaterThan(100);
      expect(viewer.scene.getMeshByName('EDU_PIPE_3D_INNER_LINER')?.getTotalVertices()).toBeGreaterThan(100);
      expect(viewer.scene.getMeshByName('EDU_PIPE_3D_VOLUME_DEPOSITO')?.isEnabled()).toBe(true);
      viewer.render({nextModel:{velocity:3,solidsMass:.55,d50mm:.8,
        bed:.0,wearExposureVisual:.9},bedLevel:0,dt:.016,tab:'wear'});
      expect(viewer.scene.getMeshByName('EDU_PIPE_3D_WEAR_HOTSPOT')?.isEnabled()).toBe(true);
      expect(viewer.scene.getMeshByName('EDU_PIPE_3D_VOLUME_DEPOSITO')?.isEnabled()).toBe(false);
      expect(viewer.status.cfd).toBe(false);
      expect(viewer.status.sourceCadModified).toBe(false);
    }finally{
      viewer.dispose();
    }
    expect(viewer.status.disposed).toBe(true);
  });
  it('makes center particles faster and near-wall particles slower using the solver profile',()=>{
    const profile={radiusM:[0,.04,.08],velocityMps:[1.7,1.4,0]};
    expect(radialVelocityFactor(profile,0,1.2)).toBeCloseTo(1.7/1.2);
    expect(radialVelocityFactor(profile,1,1.2)).toBe(0);
    expect(radialVelocityFactor(null,.6,1.2)).toBe(1);
  });
});
