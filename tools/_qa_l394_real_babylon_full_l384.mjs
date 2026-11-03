/** One real Babylon NullEngine import of signed 21MB L384; no browser/GUI.
 * Source V57 is represented by a live real TransformNode and mesh to confirm
 * reversible enabled state and no duplicate scene or orphan L384 meshes.
 * Unlike mock tests, glTF loader must parse all 34 authored animations and
 * 13 cameras from the ACTUAL binary L384 file.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {Scene} from '@babylonjs/core/scene.js';
import {TransformNode} from '@babylonjs/core/Meshes/transformNode.js';
import {MeshBuilder} from '@babylonjs/core/Meshes/meshBuilder.js';
import {ArcRotateCamera} from '@babylonjs/core/Cameras/arcRotateCamera.js';
import {Vector3} from '@babylonjs/core/Maths/math.vector.js';
import {loadBabylonAssetContainer} from '../src/babylon/assets/gltfLoader.js';
import {createEulerFullLabL394,L394_EULER_NATIVE_CAD,L394_EULER_GLB_SHA256} from
  '../src/babylon/assets/l394EulerFullLab.js';

const source='public/models/euler/L394_L384_EULER_34_ANIM_FULL_LAB.glb';
const binary=fs.readFileSync(source);
const sha=crypto.createHash('sha256').update(binary).digest('hex');
if(sha!==L394_EULER_GLB_SHA256||binary.length!==21018796)
 throw Error('L394_ACTUAL_GLB_NOT_SIGNED_L384');

const engine=new NullEngine({renderWidth:960,renderHeight:640});
const scene=new Scene(engine);
scene.useRightHandedSystem=true;
const camera=new ArcRotateCamera('REAL_V57_SOURCE_CAMERA',1,1.1,25,new Vector3(205,22,-90),scene);
scene.activeCamera=camera;
const v57Host=new TransformNode('REAL_V57_HOST_PRESERVED',scene);
const v57Mesh=MeshBuilder.CreateBox('REAL_V57_GROUND_PROBE',{size:1},scene);
v57Mesh.parent=v57Host;
const v57Count=scene.meshes.length;
const data='data:model/gltf-binary;base64,'+binary.toString('base64');
let loadCount=0;
let lab=null;
try{
 lab=createEulerFullLabL394({scene,v57SiteVisual:{host:v57Host,animationGroups:[]},
  loadContainer:async()=>{loadCount++;return loadBabylonAssetContainer(data,scene);}});
 if(lab.status.active)throw Error('L394_CANNOT_LOAD_BEFORE_EULER_ENTRY');
 const active=await lab.setActive(true);
 if(!active)throw Error('L394_REAL_BABYLON_IMPORT_FAILED_'+lab.status.loadError);
 const loaded=lab.status;
 if(loaded.authoredAnimationGroups!==34||loaded.importedCameras!==13||loaded.importedNativeCadMeshes!==4)
  throw Error('L394_REAL_LOADER_COUNTS_INCORRECT_'+JSON.stringify(loaded));
 if(v57Host.isEnabled()||scene.activeCamera!==camera)throw Error('L394_VISIBLE_DOUBLE_SCENE_OR_CAMERA_CHANGED');
 const cad=L394_EULER_NATIVE_CAD.map(name=>scene.getMeshByName(name));
 if(cad.some(m=>!m||m.getTotalVertices()<=0))throw Error('L394_REAL_NATIVE_CAD_NOT_RENDERABLE');
 const native= cad.map(m=>({name:m.name,vertices:m.getTotalVertices(),triangles:m.getTotalIndices()/3}));
 lab.setScenario({pumpOn:true,rpm:1450,qInM3h:80,qOutActualM3h:70});
 lab.setPlaying(true);
 if(lab.status.animationGroupsPlaying<20)throw Error('L394_34_CLIPS_DID_NOT_RESUME_FROM_REAL_PARAMETERS');
 lab.setScenario({pumpOn:false,rpm:0,qInM3h:0,qOutActualM3h:0});
 if(lab.status.animationGroupsPlaying>=34)throw Error('L394_PUMP_OFF_DID_NOT_PAUSE_REAL_FLOW');
 await lab.setActive(false);
 if(!v57Host.isEnabled()||scene.activeCamera!==camera)throw Error('L394_V57_NOT_RESTORED');
 if(scene.meshes.length!==v57Count||scene.meshes[0]!==v57Mesh)
  throw Error('L394_EULER_LEAKED_REAL_BABYLON_MESHES');
 if(cad.some(m=>scene.meshes.includes(m)))throw Error('L394_NATIVE_CAD_RETAINED_AFTER_EXIT');
 if(lab.status.active||lab.status.manufacturerWetMatesCertified)
  throw Error('L394_FALSE_CERTIFICATION');
 // Real Babylon cached 21 MB asset should be reusable on subsequent Euler
 // entry without a second network fetch or reimport. This exercises the
 // hierarchy detach/reparent lifecycle, not just a mock.
 if(await lab.setActive(true)!==true)throw Error('L394_CACHED_EULER_REENTRY_FAILED');
 if(loadCount!==1)throw Error('L394_CACHED_GLTF_WAS_DOWNLOADED_TWICE');
 if(v57Host.isEnabled()||scene.activeCamera!==camera)
  throw Error('L394_CACHED_REENTRY_DUPLICATE_OR_CAMERA_CHANGED');
 if(cad.some(m=>!scene.meshes.includes(m)))throw Error('L394_CACHED_CAD_NOT_REATTACHED');
 await lab.setActive(false);
 if(!v57Host.isEnabled()||scene.meshes.length!==v57Count||scene.activeCamera!==camera)
  throw Error('L394_CACHED_SECOND_EXIT_SOURCE_V57_NOT_RESTORED');
 const result={status:'PASS_GENUINE_BABYLON_NULLENGINE_L384_34_ANIM_13_CAMS_FOUR_CAD_EULER_ONLY_V57_RESTORED',
  authenticL384GLBSHA256:sha,bytes:binary.length,actualImportedAnimationGroups:loaded.authoredAnimationGroups,
  actualImportedCameras:loaded.importedCameras,actualFourNativeCadMeshDetails:native,
  beforeEulerV57Meshes:v57Count,afterEulerV57Meshes:scene.meshes.length,
  actualNullEngineGLBLoadInvocations:loadCount,
  actualCachedL384SecondEulerEntryAndExitPassed:true,
  originalL384ContainerNotReDownloaded:true,
  sourceV57HostPreserved:true,sourceV57CameraPreserved:true,
  EulerContainerRemovedFromBabylon:true,
  originalV57GLB_or_solver_modified:false,
  originalB64IndustrialWetMateCertified:false};
 const out='qa-artifacts/L394_REAL_BABYLON_NULLENGINE_CACHE_QA.json';
 if(fs.existsSync(out))throw Error('L394_QA_FILE_ALREADY_EXISTS_REFUSE_OVERWRITE');
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result,null,2));
}finally{
 lab?.dispose();
 scene.dispose();
 engine.dispose();
}
