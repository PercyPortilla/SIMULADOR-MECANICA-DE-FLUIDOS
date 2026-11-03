/**
 * L394: real L384 four-CAD / 34-animation Euler lab, as an ISOLATED Babylon
 * AssetContainer in the existing V57 scene. NO second scene/canvas/solver.
 *
 * V57 stays loaded and unchanged on disk; its host is disabled only AFTER
 * the authentic L384 asset is fully validated, and restored when leaving.
 * Source B64 pump hub, SEG02 and discharge remain CLOSED/industrial NO-GO.
 */
import {TransformNode} from '@babylonjs/core/Meshes/transformNode.js';
import {loadBabylonAssetContainer} from './gltfLoader.js';

export const L394_EULER_GLB_URL='models/euler/L394_L384_EULER_34_ANIM_FULL_LAB.glb';
export const L394_EULER_GLB_SHA256='3ea34050240b310a6fe8663d6b66c8f1f07b69b23c4e2473f93819ead33fcf3e';
export const L394_EULER_NATIVE_CAD=Object.freeze([
 'L375_L370_REAL_NATIVE_OPEN_SEG02_NOT_B64_MATED',
 'L382_NATIVE_SW2026_L358_SOURCE_ANGLE_VISUAL_STAGING_NO_B64_WET_GO',
 'L382_NATIVE_SW2026_L364_SHORT_NECK_VISUAL_STAGING_NO_B64_WET_GO',
 'L378_REAL_SW2026_L374B_TWO_PORT_VOLUTE_VERTICAL_RISER_NOT_B64_MATED',
]);

const finiteOrNull=value => value===null||value===undefined||value==='' ? null :
 (Number.isFinite(Number(value)) ? Number(value) : null);

export function classifyL394Animation(name=''){
 const n=String(name).toUpperCase();
 if(n.includes('SLURRY-PUMP-01_MOVING'))return 'pump-rotation';
 if(n.startsWith('CLASS-01_CYCLONE_')||n.startsWith('B51_PIPE1_FLOW_')||
    n.startsWith('PIPE-1_FLOW_MARKER_'))return 'pump-delivery';
 if(n.startsWith('SUMP-01_SLURRY_'))return 'sump-level';
 if(n.startsWith('MILL-01_SLURRY_CHARGE_')||n.startsWith('V57_MILL_TO_SUMP_MARKER_'))return 'mill-feed';
 return 'independent-mechanical';
}

/** No invented flow: an absent qOutActualM3h does NOT imply the requested
 * slider flow or a sensor value. Downstream markers pause until Q is known.
 */
export function shouldPlayL394Animation(name,{playing=true,pumpOn=null,rpm=null,
 qInM3h=null,qOutActualM3h=null}={}){
 if(!playing)return false;
 const pump=Boolean(pumpOn)&&finiteOrNull(rpm)>0;
 const qOut=finiteOrNull(qOutActualM3h);
 const delivery=pump&&qOut!==null&&qOut>.01;
 switch(classifyL394Animation(name)){
  case 'pump-rotation':return pump;
  case 'pump-delivery':return delivery;
  case 'mill-feed':return finiteOrNull(qInM3h)>0.01;
  case 'sump-level':return finiteOrNull(qInM3h)>0.01||delivery;
  default:return true;
 }
}

export function inspectL394Container(container){
 const meshes=container?.meshes??[];
 const groups=container?.animationGroups??[];
 const cameras=container?.cameras??[];
 const genuine=L394_EULER_NATIVE_CAD.filter(name=>
  meshes.some(mesh=>mesh?.name===name&&mesh?.getTotalVertices?.()>0));
 return {
  valid:genuine.length===4&&groups.length===34&&cameras.length===13,
  nativeCadMeshCount:genuine.length,animationCount:groups.length,
  cameraCount:cameras.length,missingNativeCad:L394_EULER_NATIVE_CAD.filter(n=>!genuine.includes(n)),
  sourceB64WetMateCertified:false,physicalSensor:false,pressureRated:false,
 };
}

const defaultHostFactory=(scene)=>new TransformNode('PULPA_L394_EULER_L384_FOUR_CAD_34_ANIM',scene);

/** Public wiring contract used by the UI caller:
 * const euler=createEulerFullLabL394({scene:environment.scene,
 *   v57SiteVisual:environment.v57SiteVisual});
 * await euler.setActive(true);    // only upon Euler entry
 * euler.setScenario({pumpOn,rpm,qOutActualM3h,qInM3h}); // actual known values
 * euler.setPlaying(enabled);      // existing animation toggle
 * await euler.setActive(false);   // restore SAME original V57 host on exit
 *
 * Prime owns integration into industrialV57Presentation.js. This module
 * never changes a physical solver, signed mesh, numerical endpoint or UI.
 */
export function createEulerFullLabL394({
 scene,v57SiteVisual,v57Host=v57SiteVisual?.host,
 url=L394_EULER_GLB_URL,loadContainer=loadBabylonAssetContainer,
 createHost=defaultHostFactory,invalidate=()=>{},
}={}){
 if(!scene)throw new TypeError('L394_EXISTING_BABYLON_SCENE_REQUIRED');
 if(scene.useRightHandedSystem!==true)throw Error('L394_REQUIRES_V57_RIGHT_HANDED_SCENE');
 if(!v57Host||typeof v57Host.setEnabled!=='function')throw Error('L394_REAL_V57_HOST_REQUIRED');
 if(typeof loadContainer!=='function')throw Error('L394_ASSET_CONTAINER_LOADER_REQUIRED');

 let container=null,pending=null,eulerHost=null;
 let requested=false,inScene=false,disposed=false,serial=0;
 let loadState='idle',loadError=null;
 let enabledBefore=null,cameraBefore=null,v57AnimationBefore=null;
 let playing=true,scenario={pumpOn:null,rpm:null,qInM3h:null,qOutActualM3h:null,speedRatio:1};
 const clipState=new Map();
 let transparencyRequested=false;
 const transparentMaterials=new Map();
 const v57Groups=()=>v57SiteVisual?.animationGroups??[];
 const reRender=()=>invalidate(240);

 // The FULL L384 GLB still includes other pump and lab machinery. ONLY
 // these four signed educational CAD surfaces may become transparent; use
 // independent material clones so legacy B64 shells never change alpha.
 function restoreCadMaterial(){
  for(const [mesh,{original,clone}] of transparentMaterials){
   mesh.material=original;
   clone?.dispose?.();
  }
  transparentMaterials.clear();
 }
 function applyCadTransparency(){
  if(!inScene||!transparencyRequested||!container)return 0;
  for(const name of L394_EULER_NATIVE_CAD){
   const mesh=container.meshes.find(item=>item?.name===name&&item.getTotalVertices?.()>0);
   if(!mesh||transparentMaterials.has(mesh)||typeof mesh.material?.clone!=='function')continue;
   const original=mesh.material;
   const clone=original.clone(`${original.name??name}_L394_EULER_TRANSPARENCY_ONLY`);
   if(!clone)continue;
   clone.alpha=Math.min(Number.isFinite(original.alpha)?original.alpha:1,0.34);
   mesh.material=clone;
   transparentMaterials.set(mesh,{original,clone});
  }
  return transparentMaterials.size;
 }

 function sourceEnabled(){return typeof v57Host.isEnabled==='function'?Boolean(v57Host.isEnabled()):true;}
 function pauseOriginalAnimations(){
  v57AnimationBefore=v57Groups().map(group=>({group,
   running:typeof group.isPlaying==='boolean'?group.isPlaying:Boolean(group.isStarted)}));
  v57AnimationBefore.forEach(({group,running})=>{if(running)group.pause?.();});
 }
 function restoreOriginal(){
  if(enabledBefore!==null)v57Host.setEnabled(enabledBefore);
  enabledBefore=null;
  if(v57AnimationBefore){
   v57AnimationBefore.forEach(({group,running})=>{if(running)group.play?.(true);});
   v57AnimationBefore=null;
  }
  if(cameraBefore){scene.activeCamera=cameraBefore;cameraBefore=null;}
 }

 function syncClips(){
  if(!container||!inScene)return 0;
  let active=0;
  for(const group of container.animationGroups){
   const should=shouldPlayL394Animation(group.name,{...scenario,playing});
   group.speedRatio=finiteOrNull(scenario.speedRatio)??1;
   if(should)active++;
   if(clipState.get(group)===should)continue;
   if(should){
    if(group.isStarted===false)group.start?.(true);
    else group.play?.(true);
   }else group.pause?.();
   clipState.set(group,should);
  }
  return active;
 }

 function remove(){
  restoreCadMaterial();
  if(inScene){
   for(const group of container?.animationGroups??[])group.stop?.();
   eulerHost?.setEnabled(false);
   // Babylon AssetContainer.removeAllFromScene expects every parent to be
   // inside the container. The temporary Euler-only host is external, so
   // detach the genuine GLB roots BEFORE removing. Otherwise Babylon logs
   // "Node __root__ has a parent that is not in the container" and may
   // retain stale hierarchy state across repeated entries.
   for(const root of container?.rootNodes??[])if(root?.parent===eulerHost)root.parent=null;
   container?.removeAllFromScene?.();
   inScene=false;
  }
  clipState.clear();
  if(eulerHost){
   // Detach the imported roots before destroying only our auxiliary host.
   // This never disposes the original V57 host or any V57 mesh.
   for(const root of container?.rootNodes??[])if(root?.parent===eulerHost)root.parent=null;
   eulerHost.dispose?.();
   eulerHost=null;
  }
  restoreOriginal();
  reRender();
 }
 function discard(){
  remove();
  container?.dispose?.();container=null;
  if(!disposed&&loadState!=='error')loadState='idle';
 }
 async function ensureContainer(){
  if(container)return container;
  if(pending)return pending;
  loadState='loading';loadError=null;
  pending=Promise.resolve().then(()=>loadContainer(url,scene)).then(asset=>{
   if(!asset)throw Error('L394_EMPTY_REAL_ASSET_CONTAINER');
   if(disposed||!requested){asset.dispose?.();loadState='idle';return null;}
   const check=inspectL394Container(asset);
   if(!check.valid){
    asset.dispose?.();
    throw Error('L394_FULL_GLTF_INTEGRITY_GATE_'+check.nativeCadMeshCount+'_CAD_'+
      check.animationCount+'_ANIM_'+check.cameraCount+'_CAM');
   }
   container=asset;loadState='ready';return asset;
  }).catch(error=>{
   loadState='error';loadError=String(error?.message??error);
   return null;
  }).finally(()=>{pending=null;reRender();});
  return pending;
 }

 function attach(){
  if(!container||inScene||!requested||disposed)return false;
  let added=false;
  const originalCamera=scene.activeCamera??null;
  try{
   eulerHost=createHost(scene);
   if(typeof eulerHost?.setEnabled!=='function')throw Error('L394_EULER_CONTAINER_HOST_REQUIRED');
   eulerHost.setEnabled(false);
   container.addAllToScene();added=true;
   for(const root of container.rootNodes??[])root.parent=eulerHost;
   for(const mesh of container.meshes??[]){
    mesh.metadata={...(mesh.metadata??{}),
      visualOnly:true,eulerL394StudyOnly:true,sourceB64WetMateCertified:false,
      physicalSensor:false,originalV57MeshUnchanged:true};
   }
   // Important order: validate and add L384 fully while hidden; THEN hide
   // V57 and reveal the Euler asset, never render two full sites at once.
   enabledBefore=sourceEnabled();
   cameraBefore=originalCamera;
   pauseOriginalAnimations();
   v57Host.setEnabled(false);
   eulerHost.setEnabled(true);
   scene.activeCamera=originalCamera;
   inScene=true;
   syncClips();
   applyCadTransparency();
   loadError=null;loadState='ready';reRender();
   return true;
  }catch(error){
   if(added){
    restoreCadMaterial();
    for(const root of container?.rootNodes??[])if(root?.parent===eulerHost)root.parent=null;
    container.removeAllFromScene?.();
   }
   inScene=false;
   restoreOriginal();
   eulerHost?.setEnabled?.(false);
   for(const root of container?.rootNodes??[])if(root?.parent===eulerHost)root.parent=null;
   eulerHost?.dispose?.();eulerHost=null;
   loadState='error';loadError=String(error?.message??error);
   reRender();return false;
  }
 }

 return {
  async setActive(on){
   if(disposed)return false;
   const entry=++serial;
   requested=Boolean(on);
   // Leaving Euler should NOT refetch the 21 MB signed GLB on each return.
   // Keep its Babylon AssetContainer detached/cached, without showing a
   // second scene. Only explicit dispose() permanently frees those bytes.
   // A still-pending load finishing after exit is disposed by ensureContainer.
   if(!requested){remove();return false;}
   if(!container)await ensureContainer();
   // Leave/re-enter racing the async network load cannot insert a stale GLB.
   if(!requested||entry!==serial||disposed||!container)return false;
   if(inScene)return true;
   return attach();
  },
  setPlaying(value){playing=Boolean(value);syncClips();return playing;},
  setTransparency(on){
   transparencyRequested=Boolean(on);
   if(transparencyRequested)applyCadTransparency();
   else restoreCadMaterial();
   reRender();
   return transparentMaterials.size;
  },
  setScenario(values={}){
   if(!values||typeof values!=='object')return this.status;
   // Never synthesize qOut from the requested flow slider, velocity or a
   // guessed pipe ID. Only accept an explicitly available effective qOut.
   for(const key of ['pumpOn','rpm','qInM3h','qOutActualM3h','speedRatio']){
    if(Object.prototype.hasOwnProperty.call(values,key))scenario[key]=values[key];
   }
   syncClips();return this.status;
  },
  get status(){return {
   active:inScene,requested,loadState,loadError,
   url,expectedSignedSourceSHA256:L394_EULER_GLB_SHA256,
   importedNativeCadMeshes:inScene?4:0,
   authoredAnimationGroups:container?.animationGroups?.length??0,
   importedCameras:container?.cameras?.length??0,
   animationGroupsPlaying:inScene?[...clipState.values()].filter(Boolean).length:0,
   nativeCadTransparencyRequested:transparencyRequested,
   transparentNativeCadMeshes:transparentMaterials.size,
   scope:'Euler only; entire V57 restored on exit',
   visualOnly:true,sourceV57Edited:false,solverModified:false,
   manufacturerWetMatesCertified:false,originalB64CapsOpened:false,
   pressureRated:false,physicalSensor:false,CFD:false,
   };},
  dispose(){
   if(disposed)return;
   ++serial;requested=false;
   discard();disposed=true;
  },
 };
}
