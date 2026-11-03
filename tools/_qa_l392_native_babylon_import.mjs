/** L392 independent Babylon NullEngine import gate; no GUI, no source writes. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {NullEngine} from '@babylonjs/core/Engines/nullEngine.js';
import {Scene} from '@babylonjs/core/scene.js';
import {loadBabylonAssetContainer} from '../src/babylon/assets/gltfLoader.js';

const cwd=process.cwd();
const glb=path.join(cwd,'public/models/euler/L392_SW2026_FOUR_NATIVE_EDUCATIONAL_CAD_ONLY.glb');
const expected='36a2279ee597f84a909b5ab1caff2c0a1c9acae65cf1ccb91aebd0c26a83fd59';
const bytes=fs.readFileSync(glb),sha=crypto.createHash('sha256').update(bytes).digest('hex');
if(sha!==expected)throw Error('L392_SIGNED_ASSET_CHANGED');
const engine=new NullEngine({renderWidth:1000,renderHeight:700});
const scene=new Scene(engine);scene.useRightHandedSystem=true;
const source='data:model/gltf-binary;base64,'+bytes.toString('base64');
let container;
try{
  container=await loadBabylonAssetContainer(source,scene);
  if(!container)throw Error('L392_CONTAINER_NULL');
  container.addAllToScene();
  const names=['L370_SEG02','L358_SOURCE_ANGLE','L364_SHORT_NECK','L374B_TWO_PORT_VOLUTE'];
  const metas=[];
  for(const part of names){
    const name='SLURRY-PUMP-01_NATIVE_L392_'+part+'_EDU_NO_B64_WET_MATE';
    const mesh=scene.getMeshByName(name);
    if(!mesh)throw Error('L392_MISSING_LOADED_MESH:'+name);
    mesh.computeWorldMatrix(true);
    const box=mesh.getBoundingInfo().boundingBox;
    metas.push({name,triangles:mesh.getTotalIndices()/3,
      bounds:[box.minimumWorld.asArray(),box.maximumWorld.asArray()]});
  }
  if(container.animationGroups.length!==0)throw Error('L392_ADDED_UNEXPECTED_ANIMATION_GROUPS');
  console.log(JSON.stringify({status:'PASS_REAL_BABYLON_NULLENGINE_L392_FOUR_CAD',sha,
    importedMeshes:metas,animationGroups:container.animationGroups.length},null,2));
}finally{
 container?.dispose();scene.dispose();engine.dispose();
}
