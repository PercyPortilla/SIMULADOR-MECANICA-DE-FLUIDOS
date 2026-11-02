/* L349 integrates real signed L36 native SolidWorks-derived meshes into the
 * isolated V57 full-mine viewer, never its source GLB. Visual-only upgrade:
 * NOT a verified wet hydraulic mating or industrial pressure rating.
 */
import {loadBabylonAssetContainer} from './gltfLoader.js';

const PATH='/models/pulpa-v57/L349_CLASS01_NATIVE_FEED_EDU.glb';
const replaceNames=[
 ...Array.from({length:4},(_,i)=>'CLASS-01_FEED_LINE_ELBOW_0'+(i+1)),
 ...Array.from({length:5},(_,i)=>'CLASS-01_FEED_LINE_SEG0'+(i+1)),
 ...Array.from({length:4},(_,i)=>'CLASS-01_FEED_LINE_ELBOW_FLUID_0'+(i+1)),
 ...Array.from({length:5},(_,i)=>'CLASS-01_FEED_LINE_FLUID_SEG0'+(i+1))
];
export function attachNativeClassFeedL349({environment}={}){
 const scene=environment?.scene;
 if(!scene)throw Error('L349_REQUIRES_V57_SCENE');
 let container=null,modifications=[],status={
  block:'L349',state:'PENDING',
  testedReplacements:0,replacedOriginals:0,
  signedSource:'LAB_L36_CLASS_VALVE_ALL_SUPPORTS_NATIVE_VISUAL_ONLY.blend',
  sourceBlenderV57GLBModified:false,
  pressureCertified:false,wetMatesCertified:0
 };
 const ready=(async()=>{
  await environment.v57SiteVisual?.ready;
  if(!environment.v57SiteVisual?.loaded){
   status={...status,state:'NO_GO_V57_SOURCE_NOT_LOADED'};return status;
  }
  try{
   container=await loadBabylonAssetContainer(PATH,scene);
   container.addAllToScene();
   const newMeshes=container.meshes.filter(m=>m.name.endsWith('_NATIVE_L349')&&m.getTotalVertices?.()>0);
   const pairs=replaceNames.map(name=>({
    original:scene.getMeshByName(name),
    replacement:newMeshes.find(m=>m.name===name+'_NATIVE_L349'),name
   }));
   const missing=pairs.filter(pair=>!pair.original||!pair.replacement).map(p=>p.name);
   if(missing.length||newMeshes.length!==19)
    throw Error('MISSING_REPLACEMENTS '+JSON.stringify({missing,newMeshes:newMeshes.length}));
   // Independent world-space origin check: source L36 and target V57 share the
   // signed B64 datums. Large unproven offsets are a hard no-swap.
   const deviations=pairs.map(pair=>{
    pair.original.computeWorldMatrix(true);pair.replacement.computeWorldMatrix(true);
    return {name:pair.name,originDifferenceM:
      pair.original.getAbsolutePosition().subtract(pair.replacement.getAbsolutePosition()).length()};
   });
   const displaced=deviations.filter(d=>d.originDifferenceM>.005);
   if(displaced.length)throw Error('L349_WORLD_DATUM_MISMATCH '+JSON.stringify(displaced));
   for(const item of pairs){
    modifications.push({original:item.original,visible:item.original.isVisible,
      replacement:item.replacement});
    item.replacement.isVisible=item.original.isVisible;
    item.replacement.isPickable=false;
    item.replacement.receiveShadows=true;
    item.replacement.metadata={...(item.replacement.metadata??{}),
      isolatedNativeCADVisual:true,labRevision:'L36',integration:'L349',
      pressureCertified:false,wetMatesCertified:false};
    item.original.isVisible=false;
   }
   const additional=newMeshes.find(m=>m.name.startsWith('CLASS-01_FEED_LINE_SEG04_DOWNSTREAM_L33_'));
   if(additional){additional.isPickable=false;additional.receiveShadows=true;}
   status={...status,state:'PASS_NATIVE_SHELLS_VISUAL_ONLY',
    testedReplacements:pairs.length,replacedOriginals:pairs.length,
    additionalSpools:Number(Boolean(additional)),originalDatumsMaximumDeltaM:Math.max(...deviations.map(d=>d.originDifferenceM)),
    totalAddonMeshes:newMeshes.length,nativeElbows:4,nativeTrimmedSegments:5,
    visualFluidMeshes:9,originsValidated:true};
   return status;
  }catch(e){
   modifications.forEach(item=>{item.original.isVisible=item.visible;});
   modifications=[];
   container?.dispose();container=null;
   status={...status,state:'NO_GO_RETAIN_ORIGINAL_VISUAL',reason:String(e?.message??e)};
   return status;
  }
 })();
 return {
  ready,get status(){return {...status}},
  dispose(){
   modifications.forEach(item=>{item.original.isVisible=item.visible;});
   modifications=[];container?.dispose();container=null;
  }
 };
}
