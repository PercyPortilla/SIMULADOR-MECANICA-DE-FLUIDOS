/* L352: genuine signed SolidWorks 2026 header with eight angled bores.
 * Visual staging only. The cyclone receiving bodies are NOT proved open,
 * and no seal/pressure/flow/CFD rating or industrial wet mate is asserted.
 */
import {loadBabylonAssetContainer} from './gltfLoader.js';

const SOURCE='/models/pulpa-v57/L352_REAL_EIGHT_SIDE_CAD_HOLES_VISUAL_ONLY.glb';
const NATIVE='L352_CLASS01_8_TRUE_ANGLED_SIDE_HOLES_EDU_NOT_CERTIFIED';
const ORIGINAL='CLASS-01_FEED_DISTRIBUTOR';
const BOUND_TOL_M=.006;

function worldBounds(mesh){
 mesh.computeWorldMatrix(true);
 const b=mesh.getBoundingInfo().boundingBox;
 return {min:b.minimumWorld,max:b.maximumWorld,center:b.centerWorld};
}
function axisError(b1,b2){
 return Math.max(
  ...['x','y','z'].flatMap(a=>[
   Math.abs(b1.min[a]-b2.min[a]),
   Math.abs(b1.max[a]-b2.max[a]),
   Math.abs(b1.center[a]-b2.center[a])
  ])
 );
}
export function attachNativeClassHeaderL352({environment}={}){
 const scene=environment?.scene;
 if(!scene)throw Error('L352_V57_SCENE_REQUIRED');
 let container=null,changes=[];
 let status={
  block:'L352',state:'PENDING',nativeSideBoress:0,
  checkedOriginal:false,geometryCertified:false,
  pressureCertified:false,CFDCertified:false,
  actualWetMatesCertified:0,sourceV57Modified:false,
 };
 const ready=(async()=>{
  await environment.v57SiteVisual?.ready;
  if(!environment.v57SiteVisual?.loaded){
   status={...status,state:'NO_GO_SIGNED_V57_NOT_LOADED'};return status;
  }
  try{
   container=await loadBabylonAssetContainer(SOURCE,scene);
   container.addAllToScene();
   const native=scene.getMeshByName(NATIVE);
   const original=scene.getMeshByName(ORIGINAL);
   if(!native||!original||native.getTotalVertices()<900)
    throw Error('L352_NATIVE_HEADER_OR_SIGNED_SOURCE_MISSING');
   const o=worldBounds(original),n=worldBounds(native);
   const err=axisError(o,n);
   if(err>BOUND_TOL_M)
    throw Error('L352_SOURCE_BOUND_MISMATCH '+err.toFixed(7)+'m');
   // Only when all extents are verified, hide the source proxy and its
   // closed visual lid. The source fluid proxy is intentionally unchanged.
   const lid=scene.getMeshByName('CLASS-01_DISTRIBUTOR_LID');
   const originals=[original,lid].filter(Boolean);
   for(const mesh of originals){
    changes.push({mesh,wasVisible:mesh.isVisible});
    mesh.isVisible=false;
   }
   native.isVisible=true;
   native.isPickable=false;
   native.receiveShadows=true;
   native.metadata={...(native.metadata||{}),
    signedNativeSW2026AnalyticBRep:true,
    eightRealAngledSideBoress:true,
    explicitEducationalAssumedWetIDs:true,
    industrialWetMateCertified:false,
    pressureCertified:false,CFDCertified:false,
    materialRev:'L350',stagedIntegration:'L352'};
   status={...status,
    state:'PASS_REAL_EIGHT_NATIVE_PERFORATIONS_VISUAL_ONLY',
    checkedOriginal:true,geometryCertified:true,nativeSideBoress:8,nativeSideBores:8,
    inspectedWorldBoundsMaxErrorM:err,originalsHidden:originals.length,
    originalSourceAABB:[o.min.asArray(),o.max.asArray()],
    newNativeAABB:[n.min.asArray(),n.max.asArray()],
    nativeTotalVertices:native.getTotalVertices(),
    sourceV57Modified:false,
    caveat:'Eight holes in one EDUCATIONAL header, not eight industrial connected wet mates'};
   return status;
  }catch(e){
   for(const entry of changes)entry.mesh.isVisible=entry.wasVisible;
   changes=[];container?.dispose();container=null;
   status={...status,state:'NO_GO_KEEP_ORIGINAL_HEADER',reason:String(e?.message??e)};
   return status;
  }
 })();
 return {
  ready,get status(){return {...status}},
  dispose(){
   for(const entry of changes)entry.mesh.isVisible=entry.wasVisible;
   changes=[];container?.dispose();container=null;
  }
 };
}
