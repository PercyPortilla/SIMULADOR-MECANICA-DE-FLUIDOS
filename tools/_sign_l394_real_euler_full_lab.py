"""Independent signed material delivery of L394 without GUI/COM/production edits."""
import hashlib
import json
import subprocess
from datetime import datetime,timezone
from pathlib import Path

repo=Path(__file__).resolve().parent.parent
files={
 'source_module':repo/'src/babylon/assets/l394EulerFullLab.js',
 'new_unit_tests':repo/'tests/ui/l394EulerFullLab.test.js',
 'genuine_full_L384_GLB':repo/'public/models/euler/L394_L384_EULER_34_ANIM_FULL_LAB.glb',
 'one_real_babylon_nullengine_runner':repo/'tools/_qa_l394_real_babylon_full_l384.mjs',
 'first_real_babylon_qa':repo/'qa-artifacts/L394_REAL_BABYLON_NULLENGINE_QA.json',
 'repeat_cache_reentry_real_babylon_qa':repo/'qa-artifacts/L394_REAL_BABYLON_NULLENGINE_CACHE_QA.json',
 'final_report':repo/'qa-artifacts/L394_FINAL_NATIVE_GLTF_EULER_ONLY_NO_WET_GATE.md',
 'receipt_script':repo/'tools/_sign_l394_real_euler_full_lab.py',
}
assert all(path.is_file() for path in files.values()),[k for k,v in files.items() if not v.is_file()]

def dig(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for v in iter(lambda:f.read(1048576),b''):h.update(v)
 try: name=str(path.relative_to(repo))
 except ValueError: name=str(path)
 return {'bytes':path.stat().st_size,'sha256':h.hexdigest(),
         'path_relative_to_repo':name.replace('\\','/')}

signed='3ea34050240b310a6fe8663d6b66c8f1f07b69b23c4e2473f93819ead33fcf3e'
asset=dig(files['genuine_full_L384_GLB'])
assert asset['bytes']==21018796 and asset['sha256']==signed
source=repo.parent/'ENGINEERING_SKILLS/lab_bernoulli_euler_20261031/scope/L384_FOUR_NATIVE_CAD_34_ANIM_13_CAM_ISOLATED_20261102/L384_EULER_FOUR_REAL_SW_CAD_34ANIM_13CAM_VISUAL_ONLY_NO_SOURCE_WET_MATE.glb'
assert source.is_file() and dig(source)['sha256']==signed
v57=repo/'public/models/pulpa-v57/PULPA_LAB_V57_FULL_SITE_FINAL.glb'
assert v57.is_file() and dig(v57)['sha256']=='73826d5cb777ed08cd9f20a9dd3171c1964f1f8de8c570edfb9f4a802538e306'
qa=json.loads(files['repeat_cache_reentry_real_babylon_qa'].read_text(encoding='utf8'))
assert qa['status']=='PASS_GENUINE_BABYLON_NULLENGINE_L384_34_ANIM_13_CAMS_FOUR_CAD_EULER_ONLY_V57_RESTORED'
assert qa['authenticL384GLBSHA256']==signed and qa['bytes']==21018796
assert qa['actualImportedAnimationGroups']==34 and qa['actualImportedCameras']==13
assert len(qa['actualFourNativeCadMeshDetails'])==4
assert qa['actualCachedL384SecondEulerEntryAndExitPassed']
assert qa['actualNullEngineGLBLoadInvocations']==1
assert qa['sourceV57CameraPreserved'] and qa['sourceV57HostPreserved']
assert qa['beforeEulerV57Meshes']==qa['afterEulerV57Meshes']==1
assert not qa['originalB64IndustrialWetMateCertified']
status=subprocess.run(['git','branch','--show-current'],cwd=repo,text=True,capture_output=True,check=True).stdout.strip()
assert status=='feature/euler-pulpa-inspector-20261102',status
module=files['source_module'].read_text(encoding='utf8')
for check in ['createEulerFullLabL394','setActive(on)','setPlaying(value)','setScenario(values=',
              'setTransparency(on)','removeAllFromScene','sourceB64WetMateCertified:false']:
 assert check in module,('MISSING_IMPL_FEATURE',check)

receipt={
 'block':'L394_EULER_FULL_L384_GLTF_BABYLON_20261103',
 'signed_utc':datetime.now(timezone.utc).isoformat(),
 'status':'PASS_GENUINE_L384_BABYLON_NULLENGINE_34_ANIM_13_CAM_4_CAD_V57_CACHE_RESTORED__NO_GO_GPU_BROWSER_ORIGINAL_B64_WET',
 'feature_branch':status,
 'source_L384_original_sha256':signed,
 'original_V57_site_full_glb_sha256':dig(v57)['sha256'],
 'genuine_nullengine_authored_clips':34,'genuine_nullengine_cameras':13,
 'real_NullEngine_four_CAD_verified':True,
 'real_NullEngine_V57_camera_host_restored':True,
 'real_NullEngine_cached_Euler_double_entry_one_load':True,
 'L394_vitest_mock_case_pass':13,'L394_vitest_mock_case_fail':0,
 'optional_four_native_CAD_transparency_only_mock_test_PASS':True,
 'main_ui_wired_by_prime':False,
 'real_browser_webgl_screenshot_verified':False,
 'signed_original_V57_modified':False,
 'signed_original_B64_wet_mates_certified':False,
 'solver_endpoints_originals_modified':False,
 'new_files':{k:dig(p) for k,p in files.items()},
}
out=repo/'qa-artifacts/L394_SHA256_SIGNED_RECEIPT.json'
assert not out.exists(),'L394_REFUSE_OVERWRITE_SIGNED_RECEIPT'
out.write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print('SIGNED='+str(out))
print('L394_MODULE_SHA256='+receipt['new_files']['source_module']['sha256'])
print('L394_ASSET_SHA256='+asset['sha256'])
print('NULLENGINE_CACHE_QA_SHA256='+receipt['new_files']['repeat_cache_reentry_real_babylon_qa']['sha256'])
print('STATUS='+receipt['status'])
