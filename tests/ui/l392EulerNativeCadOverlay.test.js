import {describe,it,expect,vi} from 'vitest';
import {
 createEulerNativeCadOverlay,L392_CAD_PARTS,L392_CAD_PREFIX,
 L392_ORIGINAL_VISUALS_TO_HIDE,L392_CAD_URL,
} from '../../src/babylon/assets/l392EulerNativeCadOverlay.js';

function createHarness({delay=false,missingPart=false}={}){
 const sourceMeshes=new Map(L392_ORIGINAL_VISUALS_TO_HIDE.map((name,i)=>[
  name,{name,isVisible:i%2===0,visibility:i%3===0?.64:1,metadata:{}},
 ]));
 const meshes=L392_CAD_PARTS.slice(0,missingPart?3:4).map(name=>({
  name:`${L392_CAD_PREFIX}${name}_EDU_NO_B64_WET_MATE`,
  isVisible:true,visibility:1,metadata:{},
 }));
 let inScene=false;
 let release;
 const loading=delay?new Promise(resolve=>{release=resolve;}):Promise.resolve();
 const container={meshes,addAllToScene:vi.fn(()=>{inScene=true;}),
  removeAllFromScene:vi.fn(()=>{inScene=false;}),dispose:vi.fn()};
 const scene={getMeshByName:name=>sourceMeshes.get(name)};
 const loadContainer=vi.fn(async()=>{await loading;return container;});
 const invalidate=vi.fn();
 const overlay=createEulerNativeCadOverlay({scene,loadContainer,invalidate});
 return {overlay,sourceMeshes,meshes,loadContainer,container,release,
  get inScene(){return inScene;}};
}

describe('L392 authentic SolidWorks Euler-only visual overlay',()=>{
 it('loads four genuine CAD meshes without loading the mine twice',async()=>{
  const t=createHarness();
  expect(await t.overlay.setActive(true)).toBe(true);
  expect(t.loadContainer).toHaveBeenCalledExactlyOnceWith(L392_CAD_URL,expect.anything());
  expect(t.overlay.status.importedNativeCadMeshes).toBe(4);
  expect(t.overlay.status.sourceB64WetMateCertified).toBe(false);
  expect(t.overlay.status.pressureRated).toBe(false);
  for(const mesh of t.meshes){
   expect(mesh.metadata.realNativeSolidWorksCAD).toBe(true);
   expect(mesh.metadata.notAPhysicalSensor).toBe(true);
   expect(mesh.isPickable).toBe(false);
  }
 });
 it('restores every original source isVisible and visibility on exit',async()=>{
  const t=createHarness();
  const before=[...t.sourceMeshes.values()].map(m=>[m.isVisible,m.visibility]);
  await t.overlay.setActive(true);
  expect([...t.sourceMeshes.values()].every(m=>m.isVisible===false)).toBe(true);
  expect(await t.overlay.setActive(false)).toBe(false);
  expect(t.inScene).toBe(false);
  expect([...t.sourceMeshes.values()].map(m=>[m.isVisible,m.visibility])).toEqual(before);
  expect(t.overlay.status.importedNativeCadMeshes).toBe(0);
  expect(await t.overlay.setActive(true)).toBe(true);
  expect(t.loadContainer).toHaveBeenCalledTimes(1);
 });
 it('keeps source caps hidden after a visibility-only Euler scope reapplies',async()=>{
  const t=createHarness();
  await t.overlay.setActive(true);
  for(const m of t.sourceMeshes.values())m.isVisible=true;
  expect(t.overlay.reapplyVisibility()).toBe(true);
  expect([...t.sourceMeshes.values()].every(m=>!m.isVisible)).toBe(true);
  expect(t.overlay.status.originalPumpVisualMeshesTemporarilyHidden).toBe(9);
  await t.overlay.setActive(false);
  expect(t.overlay.reapplyVisibility()).toBe(false);
 });
 it('does not add meshes if the user leaves before GLB loading completes',async()=>{
  const t=createHarness({delay:true});
  const load=t.overlay.setActive(true);
  await Promise.resolve();
  expect(await t.overlay.setActive(false)).toBe(false);
  t.release();
  expect(await load).toBe(false);
  expect(t.container.addAllToScene).not.toHaveBeenCalled();
  expect(t.overlay.status.sourceV57Edited).toBe(false);
 });
 it('rejects incomplete CAD instead of falsely claiming the bore is connected',async()=>{
  const t=createHarness({missingPart:true});
  expect(await t.overlay.setActive(true)).toBe(false);
  expect(t.overlay.status.loadState).toBe('error');
  expect(t.overlay.status.sourceB64WetMateCertified).toBe(false);
  expect(t.overlay.status.importedNativeCadMeshes).toBe(0);
 });
 it('restores source and disposes the additional geometry cleanly',async()=>{
  const t=createHarness();
  await t.overlay.setActive(true);
  t.overlay.dispose();
  expect(t.container.dispose).toHaveBeenCalledOnce();
  expect(t.overlay.status.active).toBe(false);
  expect([...t.sourceMeshes.values()].some(m=>m.isVisible)).toBe(true);
  expect(await t.overlay.setActive(true)).toBe(false);
 });
});
