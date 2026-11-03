import {describe,it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {
 createEulerFullLabL394,inspectL394Container,classifyL394Animation,
 shouldPlayL394Animation,L394_EULER_NATIVE_CAD,L394_EULER_GLB_URL,
 L394_EULER_GLB_SHA256,
} from '../../src/babylon/assets/l394EulerFullLab.js';

function clip(name='MILL-01_MOVING_acción'){
 return {name,isStarted:true,isPlaying:true,play:vi.fn(function(){this.isPlaying=true;}),
  pause:vi.fn(function(){this.isPlaying=false;}),
  stop:vi.fn(function(){this.isPlaying=false;})};
}
function makeHarness({missingPart=false,missingAnim=false,missingCamera=false,delayed=false,
 v57Enabled=true,loaderFailure=false}={}){
 const originalCamera={name:'V57-original-general'};
 const scene={useRightHandedSystem:true,activeCamera:originalCamera};
 const sourceHost={enabled:v57Enabled,setEnabled:vi.fn(function(on){this.enabled=on}),
   isEnabled(){return this.enabled}};
 const originalGroups=[clip('V57_ORIGINAL_MINE_ANIM')];
 const site={host:sourceHost,animationGroups:originalGroups};
 const gltfMeshes=L394_EULER_NATIVE_CAD.slice(0,missingPart?3:4).map(name=>({
  name,getTotalVertices:()=>500,metadata:{},isVisible:true,
  material:{name:`ORIGINAL_${name}`,alpha:1,clone:vi.fn(function(){
   return {name:this.name+'_CLONED',alpha:this.alpha,dispose:vi.fn()};
  })},
 }));
 const groups=Array.from({length:missingAnim?33:34},(_,i)=>clip(
  i===0?'SLURRY-PUMP-01_MOVING_acción':i<8?'B51_PIPE1_FLOW_00_acción':
  i===8?'MILL-01_MOVING_acción':i===9?'SUMP-01_SLURRY_acción':
  i===10?'V57_MILL_TO_SUMP_MARKER_00_acción':'CLASS-01_CYCLONE_00_SWIRL_PIVOT_acción'));
 const roots=[{name:'L384_real_root',parent:null}];
 const container={meshes:gltfMeshes,animationGroups:groups,
  cameras:Array.from({length:missingCamera?12:13},(_,i)=>({name:'L384_CAM_'+i})),rootNodes:roots,
  inScene:false,addAllToScene:vi.fn(function(){this.inScene=true;scene.activeCamera={name:'GLB imported camera'};}),
  removeAllFromScene:vi.fn(function(){this.inScene=false;}),dispose:vi.fn()};
 let release;
 const barrier=delayed?new Promise(resolve=>release=resolve):Promise.resolve();
 const loadContainer=vi.fn(async()=>{await barrier;if(loaderFailure)throw Error('L394_ASSET_NETWORK_ERROR');return container;});
 const hosts=[];
 const createHost=vi.fn(()=>{
  const host={enabled:true,disposed:false,setEnabled:vi.fn(function(on){this.enabled=on}),
    dispose:vi.fn(function(){this.disposed=true;})};
  hosts.push(host);return host;
 });
 const invalidate=vi.fn();
 const visual=createEulerFullLabL394({scene,v57SiteVisual:site,loadContainer,createHost,invalidate});
 return {visual,container,scene,originalCamera,sourceHost,originalGroups,createHost,loadContainer,
  invalidate,hosts,release:()=>release?.()};
}

describe('L394 exact genuine L384 assets and no-go semantics',()=>{
 it('signed GLB has exact 34 authored actions, 13 Blender cameras and four CAD meshes',()=>{
  const bytes=readFileSync('public/models/euler/L394_L384_EULER_34_ANIM_FULL_LAB.glb');
  expect(bytes.length).toBe(21018796);
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(L394_EULER_GLB_SHA256);
  expect(bytes.toString('ascii',0,4)).toBe('glTF');
  const g=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString('utf8'));
  expect(g.animations).toHaveLength(34);expect(g.cameras).toHaveLength(13);
  const nodes=new Map(g.nodes.map(n=>[n.name,n]));
  expect(L394_EULER_NATIVE_CAD.every(name=>Number.isInteger(nodes.get(name)?.mesh))).toBe(true);
  expect(L394_EULER_GLB_URL).toContain('models/euler/');
 });
 it('requires four renderable signed meshes, 34 animation groups and 13 cameras',()=>{
  const t=makeHarness();
  expect(inspectL394Container(t.container)).toMatchObject({valid:true,nativeCadMeshCount:4,
    animationCount:34,cameraCount:13,sourceB64WetMateCertified:false,physicalSensor:false});
  expect(inspectL394Container(makeHarness({missingPart:true}).container).valid).toBe(false);
  expect(inspectL394Container(makeHarness({missingAnim:true}).container).valid).toBe(false);
  expect(inspectL394Container(makeHarness({missingCamera:true}).container).valid).toBe(false);
 });
 it('does not fabricate qOut, NPSH or pressure; real effective q is mandatory for flow clips',()=>{
  expect(classifyL394Animation('SLURRY-PUMP-01_MOVING_acción')).toBe('pump-rotation');
  expect(shouldPlayL394Animation('CLASS-01_CYCLONE_05_SWIRL_PIVOT_acción',
    {pumpOn:true,rpm:1650,qOutRequestedM3h:120})).toBe(false);
  expect(shouldPlayL394Animation('CLASS-01_CYCLONE_05_SWIRL_PIVOT_acción',
    {pumpOn:true,rpm:1650,qOutActualM3h:75})).toBe(true);
  expect(shouldPlayL394Animation('SLURRY-PUMP-01_MOVING_acción',
    {pumpOn:false,rpm:0,qOutActualM3h:95})).toBe(false);
  expect(shouldPlayL394Animation('MILL-01_MOVING_acción',{pumpOn:false})).toBe(true);
 });
});

describe('L394 actual Babylon AssetContainer lifecycle without duplicate V57',()=>{
 it('lazy-loads ONLY on Euler entry, hides V57 only after asset validation and preserves same camera',async()=>{
  const t=makeHarness();
  expect(t.loadContainer).not.toHaveBeenCalled();
  expect(t.visual.status.active).toBe(false);
  expect(await t.visual.setActive(true)).toBe(true);
  expect(t.loadContainer).toHaveBeenCalledExactlyOnceWith(L394_EULER_GLB_URL,t.scene);
  expect(t.container.inScene).toBe(true);
  expect(t.sourceHost.enabled).toBe(false);
  expect(t.hosts[0].enabled).toBe(true);
  expect(t.scene.activeCamera).toBe(t.originalCamera);
  expect(t.originalGroups[0].pause).toHaveBeenCalledOnce();
  expect(t.visual.status).toMatchObject({active:true,importedNativeCadMeshes:4,
    authoredAnimationGroups:34,importedCameras:13,manufacturerWetMatesCertified:false,
    originalB64CapsOpened:false,solverModified:false,physicalSensor:false,CFD:false});
 });
 it('restores original V57 host/camera/animation and detaches cached L384 on exit',async()=>{
  const t=makeHarness();
  await t.visual.setActive(true);
  expect(await t.visual.setActive(false)).toBe(false);
  expect(t.sourceHost.enabled).toBe(true);
  expect(t.container.removeAllFromScene).toHaveBeenCalledOnce();
  expect(t.container.dispose).not.toHaveBeenCalled();
  expect(t.hosts[0].dispose).toHaveBeenCalledOnce();
  expect(t.scene.activeCamera).toBe(t.originalCamera);
  expect(t.originalGroups[0].play).toHaveBeenCalledOnce();
  expect(t.visual.status.active).toBe(false);
  expect(t.visual.status.originalB64CapsOpened).toBe(false);
 });
 it('does not turn ON an originally hidden V57 host on exit',async()=>{
  const t=makeHarness({v57Enabled:false});
  await t.visual.setActive(true);
  await t.visual.setActive(false);
  expect(t.sourceHost.enabled).toBe(false);
 });
 it('fails CLOSED on any missing CAD, animation or camera while V57 remains visible',async()=>{
  for(const key of ['missingPart','missingAnim','missingCamera']){
   const t=makeHarness({[key]:true});
   expect(await t.visual.setActive(true)).toBe(false);
   expect(t.sourceHost.enabled).toBe(true);
   expect(t.container.addAllToScene).not.toHaveBeenCalled();
   expect(t.container.dispose).toHaveBeenCalledOnce();
   expect(t.visual.status.loadState).toBe('error');
  }
 });
 it('failed network load never hides V57 or creates a second visible scene',async()=>{
  const t=makeHarness({loaderFailure:true});
  expect(await t.visual.setActive(true)).toBe(false);
  expect(t.visual.status.loadError).toContain('NETWORK_ERROR');
  expect(t.sourceHost.enabled).toBe(true);
  expect(t.createHost).not.toHaveBeenCalled();
 });
 it('leave before a delayed GLB finishes prevents late mount and disposes orphan asset',async()=>{
  const t=makeHarness({delayed:true});
  const load=t.visual.setActive(true);
  await Promise.resolve();
  expect(await t.visual.setActive(false)).toBe(false);
  t.release();
  expect(await load).toBe(false);
  expect(t.sourceHost.enabled).toBe(true);
  expect(t.container.addAllToScene).not.toHaveBeenCalled();
  expect(t.container.dispose).toHaveBeenCalledOnce();
 });
 it('re-enter Euler without downloading the 21MB file again; retain original V57 intact',async()=>{
  const t=makeHarness();
  expect(await t.visual.setActive(true)).toBe(true);
  await t.visual.setActive(false);
  expect(await t.visual.setActive(true)).toBe(true);
  expect(t.loadContainer).toHaveBeenCalledTimes(1);
  expect(t.container.addAllToScene).toHaveBeenCalledTimes(2);
  await t.visual.setActive(false);
  expect(t.sourceHost.enabled).toBe(true);
  expect(t.container.dispose).not.toHaveBeenCalled();
  t.visual.dispose();
  expect(t.container.dispose).toHaveBeenCalledOnce();
 });
 it('setPlaying and setScenario animate only physically permitted groups without changing solver',async()=>{
  const t=makeHarness();
  await t.visual.setActive(true);
  const [pump,flow,mill,sump]=[t.container.animationGroups[0],t.container.animationGroups[1],
    t.container.animationGroups[8],t.container.animationGroups[9]];
  expect(pump.pause).toHaveBeenCalled();
  expect(flow.pause).toHaveBeenCalled();
  expect(mill.play).toHaveBeenCalled();
  t.visual.setScenario({pumpOn:true,rpm:1450,qInM3h:80,qOutActualM3h:70,speedRatio:1.4});
  expect(pump.play).toHaveBeenCalled();
  expect(flow.play).toHaveBeenCalled();
  expect(flow.speedRatio).toBe(1.4);
  expect(sump.play).toHaveBeenCalled();
  t.visual.setPlaying(false);
  expect(flow.pause).toHaveBeenCalled();
  t.visual.setPlaying(true);
  expect(flow.play).toHaveBeenCalledTimes(2);
  expect(t.visual.status.manufacturerWetMatesCertified).toBe(false);
 });
 it('dispose cleans the Euler asset, does not destroy original V57 and blocks re-entry',async()=>{
  const t=makeHarness();
  await t.visual.setActive(true);
  t.visual.dispose();
  expect(t.sourceHost.enabled).toBe(true);
  expect(t.container.dispose).toHaveBeenCalledOnce();
  expect(await t.visual.setActive(true)).toBe(false);
 });
 it('transparency changes only cloned material of four CAD meshes and restores originals',async()=>{
  const t=makeHarness();
  await t.visual.setActive(true);
  const original=t.container.meshes.map(m=>m.material);
  expect(t.visual.setTransparency(true)).toBe(4);
  expect(t.visual.status.transparentNativeCadMeshes).toBe(4);
  for(let i=0;i<4;i++){
   const m=t.container.meshes[i];
   expect(m.material).not.toBe(original[i]);
   expect(m.material.alpha).toBe(.34);
   expect(original[i].alpha).toBe(1);
  }
  expect(t.visual.setTransparency(false)).toBe(0);
  expect(t.container.meshes.map(m=>m.material)).toEqual(original);
  t.visual.setTransparency(true);
  await t.visual.setActive(false);
  expect(t.visual.status.transparentNativeCadMeshes).toBe(0);
  expect(t.container.meshes.map(m=>m.material)).toEqual(original);
  expect(t.sourceHost.enabled).toBe(true);
 });
});
