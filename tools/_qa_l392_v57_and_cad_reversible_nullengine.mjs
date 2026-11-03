/** L392 real, independent Babylon NullEngine V57+CAD overlay, no GUI/solver edits. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {Scene} from '@babylonjs/core/scene.js';
import {ArcRotateCamera} from '@babylonjs/core/Cameras/arcRotateCamera.js';
import {Vector3} from '@babylonjs/core/Maths/math.vector.js';
import {loadBabylonAssetContainer} from '../src/babylon/assets/gltfLoader.js';
import {createBernoulliEulerScope} from '../src/ui/bernoulliEulerScope.js';
import {
  createEulerNativeCadOverlay,L392_CAD_PARTS,L392_CAD_PREFIX,
  L392_ORIGINAL_VISUALS_TO_HIDE,
} from '../src/babylon/assets/l392EulerNativeCadOverlay.js';

const root=process.cwd();
const sourcePath=path.join(root,'public/models/pulpa-v57/PULPA_LAB_V57_FULL_SITE_FINAL.glb');
const cadPath=path.join(root,'public/models/euler/L392_SW2026_FOUR_NATIVE_EDUCATIONAL_CAD_ONLY.glb');
const expectedV57='73826d5cb777ed08cd9f20a9dd3171c1964f1f8de8c570edfb9f4a802538e306';
const expectedCAD='36a2279ee597f84a909b5ab1caff2c0a1c9acae65cf1ccb91aebd0c26a83fd59';
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
if(sha(sourcePath)!==expectedV57||sha(cadPath)!==expectedCAD)throw Error('SIGNED_SOURCE_CHANGED');
const data=p=>'data:model/gltf-binary;base64,'+fs.readFileSync(p).toString('base64');
const engine=new NullEngine({renderWidth:1280,renderHeight:720});
const scene=new Scene(engine);scene.useRightHandedSystem=true;
let original,overlay;
try{
  original=await loadBabylonAssetContainer(data(sourcePath),scene);
  original.addAllToScene();
  const originalVisibilityAll=new Map(original.meshes.map(m=>[m,m.isVisible]));
  const inspection=new ArcRotateCamera('L392_REAL_NULL_INSPECTION',1.1,1.1,55,new Vector3(204,22,-90),scene);
  scene.activeCamera=inspection;
  const env={scene,cameras:{inspection},setCamera:()=>{scene.activeCamera=inspection;},
    invalidateRender:()=>{},equipmentInspection:{contextOverlay:{setEnabled:()=>{}}}};
  const scope=createBernoulliEulerScope(env);
  scope.enter();
  const matched=L392_ORIGINAL_VISUALS_TO_HIDE.map(n=>scene.getMeshByName(n));
  if(matched.length!==9||matched.some(x=>!x))throw Error('SIGNED_V57_SOURCE_PUMP_MESH_MISSING');
  const before=matched.map(m=>({name:m.name,isVisible:m.isVisible,visibility:m.visibility}));
  const sourceNodes=original.meshes.length;
  const sourceGroups=original.animationGroups.length;
  overlay=createEulerNativeCadOverlay({scene,
    loadContainer:()=>loadBabylonAssetContainer(data(cadPath),scene)});
  if(await overlay.setActive(true)!==true)throw Error('EULER_CAD_NOT_ACTIVE');
  scope.reapply();overlay.reapplyVisibility();
  if(matched.some(m=>m.isVisible))throw Error('ORIGINAL_CAPPED_PUMP_NOT_HIDDEN');
  if(overlay.status.importedNativeCadMeshes!==4)throw Error('NOT_FOUR_NATIVE_SW2026_MESHES');
  const native=L392_CAD_PARTS.map(p=>scene.getMeshByName(`${L392_CAD_PREFIX}${p}_EDU_NO_B64_WET_MATE`));
  if(native.some(x=>!x||x.getTotalVertices()<=0))throw Error('NATIVE_MESH_INVISIBLE_OR_MISSING');
  const afterAdd={sourceMeshCount:sourceNodes,sourceAnimations:sourceGroups,
    totalMeshesDuringOverlay:scene.meshes.length};
  await overlay.setActive(false);
  scope.leave();
  if([...originalVisibilityAll].some(([mesh,old])=>mesh.isVisible!==old))
    throw Error('L392_EXIT_EULER_SCOPE_DID_NOT_RESTORE_ORIGINAL_FULL_MINE');
  if(matched.some((m,i)=>m.isVisible!==before[i].isVisible||m.visibility!==before[i].visibility))
    throw Error('L392_SOURCE_ORIGINAL_VISIBILITY_NOT_RESTORED');
  if(original.meshes.length!==sourceNodes||original.animationGroups.length!==sourceGroups)
    throw Error('L392_SOURCE_ORIGINAL_ANIMATIONS_OR_NODES_CHANGED');
  if(native.some(x=>scene.meshes.includes(x)))throw Error('L392_NATIVE_CAD_NOT_REMOVED_ON_MINE_RETURN');
  scope.enter();
  if(await overlay.setActive(true)!==true)throw Error('L392_REENTER_FAILED');
  scope.reapply();overlay.reapplyVisibility();
  await overlay.setActive(false);
  scope.leave();
  if([...originalVisibilityAll].some(([mesh,old])=>mesh.isVisible!==old))
    throw Error('L392_SECOND_EXIT_DID_NOT_RESTORE_ORIGINAL_FULL_MINE');
  const result={status:'PASS_REAL_V57_B64_PLUS_FOUR_SW2026_CAD_REVERSIBLE_BABYLON_NULLENGINE',
    actualV57SourceSHA256:sha(sourcePath),actualL392SourceSHA256:sha(cadPath),
    originalPumpMeshesHiddenOnlyDuringEuler:matched.map(x=>x.name),
    nativeMeshesImported:L392_CAD_PARTS.length,
    ...afterAdd,sourceMeshCountAfter:original.meshes.length,
    sourceAnimationsAfter:original.animationGroups.length,
    repeatedEulerEntryExitPass:true,sourceMeshVisibilityRestored:true,
    originalV57Entire5576MeshVisibilityRestoredAfterEulerScope:true,
    signedV57B64GeometryModified:false,solverModified:false,
    physicalSourceHydraulicWetMateCertified:false,manufacturerIDKnown:false};
  console.log(JSON.stringify(result,null,2));
}finally{
  overlay?.dispose();original?.dispose();scene.dispose();engine.dispose();
}
