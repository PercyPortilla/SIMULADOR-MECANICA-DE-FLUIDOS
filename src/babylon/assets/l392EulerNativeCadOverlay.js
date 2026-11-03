/**
 * L392: optional authentic SW2026 CAD overlay, exclusively in Euler.
 *
 * The authoritative V57/B64 mine and original pump meshes stay untouched on
 * disk. On entry this adds only four small signed-CAD geometries and hides nine
 * obstructing ORIGINAL SOURCE VISUAL meshes in the live scene. Every change is
 * reversible when leaving Euler or opening source P3→P4 inspection.
 *
 * This visual two-port study is NOT a manufacturer-approved pump, pressure
 * rating, sensor, complete wet mate or CFD. The original B64 hub/caps remain
 * physically NO-GO and must never be reported as repaired in production.
 */
import {loadBabylonAssetContainer} from './gltfLoader.js';

export const L392_CAD_URL='models/euler/L392_SW2026_FOUR_NATIVE_EDUCATIONAL_CAD_ONLY.glb';
export const L392_CAD_PREFIX='SLURRY-PUMP-01_NATIVE_L392_';
export const L392_CAD_PARTS=Object.freeze([
 'L370_SEG02','L358_SOURCE_ANGLE','L364_SHORT_NECK','L374B_TWO_PORT_VOLUTE',
]);
export const L392_ORIGINAL_VISUALS_TO_HIDE=Object.freeze([
 'SLURRY-PUMP-01_SUCTION_SEG02',
 'SLURRY-PUMP-01_SUCTION_FLUID_SEG02',
 'SLURRY-PUMP-01_CASING_HUB',
 'SLURRY-PUMP-01_HUB_TRANS',
 'SLURRY-PUMP-01_VOLUTE',
 'SLURRY-PUMP-01_FLUID_VOLUTE',
 'SLURRY-PUMP-01_VOLUTE_TRANS',
 'SLURRY-PUMP-01_DISCHARGE_PIPE',
 'SLURRY-PUMP-01_DISCHARGE_FLUID',
]);

const expectedName=part=>`${L392_CAD_PREFIX}${part}_EDU_NO_B64_WET_MATE`;

export function createEulerNativeCadOverlay({
 scene,url=L392_CAD_URL,loadContainer=loadBabylonAssetContainer,
 invalidate=()=>{},
}={}){
 if(!scene)throw Error('L392_REQUIRES_V57_SCENE');
 let active=false,disposed=false,container=null,pending=null,inScene=false;
 let loadState='idle',loadError=null;
 const original=new Map();
 let inserted=[];

 const publish=()=>invalidate(240);
 const remove=()=>{
  // The original visibility states are observed only in the live scene.
  for(const [mesh,state] of original){
   if(mesh.isDisposed?.())continue;
   mesh.isVisible=state.isVisible;
   mesh.visibility=state.visibility;
  }
  original.clear();
  if(inScene){container?.removeAllFromScene?.();inScene=false;}
  publish();
 };
 const add=()=>{
  if(disposed||!active||!container||inScene)return false;
  container.addAllToScene();
  inScene=true;
  inserted=container.meshes.filter(mesh=>
   mesh.name?.startsWith(L392_CAD_PREFIX)&&L392_CAD_PARTS.some(x=>mesh.name===expectedName(x)));
  if(inserted.length!==L392_CAD_PARTS.length){
   remove();
   loadState='error';loadError='L392_EXPECTED_FOUR_AUTHENTIC_CAD_MESHES';
   return false;
  }
  for(const name of L392_ORIGINAL_VISUALS_TO_HIDE){
   const mesh=scene.getMeshByName(name);
   if(!mesh||original.has(mesh))continue;
   original.set(mesh,{isVisible:mesh.isVisible,visibility:mesh.visibility});
   mesh.isVisible=false;
  }
  for(const mesh of inserted){
   mesh.isVisible=true;
   mesh.metadata={...(mesh.metadata??{}),
    visualOnly:true,realNativeSolidWorksCAD:true,educationalOnly:true,
    certifiedWetMate:false,sourceB64Modified:false,notAPhysicalSensor:true};
   mesh.isPickable=false;
  }
  loadState='ready';loadError=null;publish();
  return true;
 };
 const load=()=>{
  if(pending)return pending;
  loadState='loading';
  pending=Promise.resolve().then(()=>loadContainer(url,scene)).then(result=>{
   if(disposed){result?.dispose?.();return null;}
   container=result;
   if(active)add();
   return result;
  }).catch(error=>{
   loadState='error';loadError=String(error?.message??error);
   pending=null;
   publish();
   return null;
  });
  return pending;
 };
 return {
  async setActive(on){
   if(disposed)return false;
   active=Boolean(on);
   if(!active){remove();return false;}
   if(container)return add()||inScene;
   await load();
   // May have left the laboratory before asynchronous GLB loading finished.
   return active&&inScene;
  },
  reapplyVisibility(){
   if(!inScene)return false;
   for(const mesh of original.keys()){
    if(!mesh.isDisposed?.())mesh.isVisible=false;
   }
   for(const mesh of inserted){
    if(!mesh.isDisposed?.())mesh.isVisible=true;
   }
   publish();
   return true;
  },
  get status(){return {
   active:active&&inScene,requested:active,loadState,loadError,
   importedNativeCadMeshes:inScene?inserted.length:0,
   originalPumpVisualMeshesTemporarilyHidden:original.size,
   scope:'Euler only',reversible:true,sourceV57Edited:false,
   solverModified:false,sourceB64WetMateCertified:false,
   actualCadSource:'L370/L358/L364/L374B genuine signed SW2026',
   visualOnly:true,pressureRated:false,physicalSensor:false,
  };},
  dispose(){
   if(disposed)return;
   active=false;remove();disposed=true;
   container?.dispose?.();container=null;inserted=[];
  },
 };
}
