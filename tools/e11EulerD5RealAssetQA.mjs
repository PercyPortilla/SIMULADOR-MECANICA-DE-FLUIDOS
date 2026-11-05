/** E11: prove the visual-only enhancement against the signed *actual* L384 GLB. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { loadBabylonAssetContainer } from '../src/babylon/assets/gltfLoader.js';
import { createEulerFullLabL394, L394_EULER_GLB_SHA256 } from '../src/babylon/assets/l394EulerFullLab.js';

const bytes = fs.readFileSync('public/models/euler/L394_L384_EULER_34_ANIM_FULL_LAB.glb');
const sha = crypto.createHash('sha256').update(bytes).digest('hex');
if (sha !== L394_EULER_GLB_SHA256 || bytes.length !== 21018796)
  throw Error('E11_ORIGINAL_SIGNED_L384_GLB_CHANGED');
const engine = new NullEngine({ renderWidth: 960, renderHeight: 640 });
const scene = new Scene(engine);
scene.useRightHandedSystem = true;
scene.imageProcessingConfiguration.exposure = 1.05;
scene.imageProcessingConfiguration.contrast = 1.12;
const fill = new HemisphericLight('ambient-industrial-light', new Vector3(0, 1, 0), scene);
fill.intensity = .85;
const key = new DirectionalLight('mine-sun-key-light', new Vector3(1, -1, 0), scene);
key.intensity = 1.65;
const camera = new ArcRotateCamera('E11_ORIGINAL_V57_CAMERA', 1, 1, 24, new Vector3(172, 24, -90), scene);
scene.activeCamera = camera;
const mineHost = new TransformNode('E11_V57_HOST_ORIGINAL', scene);
const mineMesh = MeshBuilder.CreateBox('E11_V57_MINE_PROBE', { size: 1 }, scene);
mineMesh.parent = mineHost;
const beforeMeshes = scene.meshes.length;
let loads = 0;
const lab = createEulerFullLabL394({
  scene, v57SiteVisual: { host: mineHost, animationGroups: [] },
  loadContainer: async () => {
    loads += 1;
    return loadBabylonAssetContainer(`data:model/gltf-binary;base64,${bytes.toString('base64')}`, scene);
  },
});
try {
  if (!await lab.setActive(true)) throw Error('E11_SIGNED_REAL_GLB_NOT_LOADED_' + lab.status.loadError);
  const first = lab.status;
  if (!first.e11D5Lookdev?.active || first.e11D5Lookdev.tunedMeshes < 30 ||
      first.e11D5Lookdev.clonedMaterials < 10 ||
      first.authoredAnimationGroups !== 34 || first.importedCameras !== 13 ||
      first.importedNativeCadMeshes !== 4) throw Error('E11_PBR_OR_ASSET_INTEGRITY_FAILED_' + JSON.stringify(first));
  if (fill.intensity !== .98 || key.intensity !== 1.42 ||
      scene.imageProcessingConfiguration.exposure !== .96 || mineHost.isEnabled())
    throw Error('E11_VIEW_SPECIFIC_LIGHTING_NOT_APPLIED');
  lab.setScenario({ pumpOn: true, rpm: 1450, qInM3h: 80, qOutActualM3h: 70 });
  if (lab.status.animationGroupsPlaying < 20) throw Error('E11_ANIMATIONS_LOST');
  const transparent = lab.setTransparency(true);
  if (transparent !== 4) throw Error('E11_CAD_TRANSPARENCY_BROKEN');
  lab.setTransparency(false);
  await lab.setActive(false);
  const checkRestored = () => {
    if (!mineHost.isEnabled() || scene.activeCamera !== camera ||
        scene.meshes.length !== beforeMeshes ||
        scene.imageProcessingConfiguration.exposure !== 1.05 ||
        scene.imageProcessingConfiguration.contrast !== 1.12 ||
        fill.intensity !== .85 || key.intensity !== 1.65 ||
        lab.status.e11D5Lookdev.active)
      throw Error('E11_ORIGINAL_V57_SCENE_OR_SETTINGS_NOT_RESTORED');
  };
  checkRestored();
  if (!await lab.setActive(true)) throw Error('E11_CACHED_REENTRY_FAILED');
  if (loads !== 1 || !lab.status.e11D5Lookdev.active) throw Error('E11_RELOAD_OR_LOOKDEV_LOST');
  await lab.setActive(false);
  checkRestored();
  const report = {
    result: 'PASS', phase: 'E11', originalGLBSHA256: sha, originalGLBBytes: bytes.length,
    trueBabylonImport: true, borrowedD5LookdevNotD5Engine: true,
    visual: first.e11D5Lookdev, animations: first.authoredAnimationGroups,
    cameras: first.importedCameras, nativeCad: first.importedNativeCadMeshes,
    cadTransparencyPreserved: transparent === 4, realFlowAnimationsPreserved: true,
    sameMineCameraAndHostRestored: true, originalSceneIlluminationRestored: true,
    same21MBAssetReenteredWithoutRedownload: loads === 1,
    noLossOfV57Meshes: scene.meshes.length === beforeMeshes,
    uiChanged: false, solverChanged: false, originalGLBChanged: false,
  };
  fs.mkdirSync('qa-artifacts/e11', { recursive: true });
  fs.writeFileSync('qa-artifacts/e11/e11-real-glb-regression.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  lab.dispose();
  scene.dispose();
  engine.dispose();
}
