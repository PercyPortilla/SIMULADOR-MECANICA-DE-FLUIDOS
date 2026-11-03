"""Material L392: four signed SolidWorks native meshes, no duplicated mine.

The separate, small glTF is loaded ONLY in Bernoulli–Euler. Its standalone
mesh data derives from L370/L358/L364/L374B signed STL; neither original
V57/B64, L59 nor the simulation solver is changed. Educational visual only.
"""
from __future__ import annotations
import hashlib, importlib.util, json, pathlib, struct

REPO = pathlib.Path(__file__).resolve().parents[1]
LAB = REPO.parent / 'ENGINEERING_SKILLS' / 'lab_bernoulli_euler_20261031'
HELPER = LAB/'scope/L382_SURGICAL_SIGNED_GLB_CAD_NATIVE_34ANIM_20261102/build_l382_signed_gltf_cad_fourparts.py'
SOURCE = REPO/'public/models/pulpa-v57/PULPA_LAB_V57_FULL_SITE_FINAL.glb'
OUT = REPO/'public/models/euler/L392_SW2026_FOUR_NATIVE_EDUCATIONAL_CAD_ONLY.glb'
QA = LAB/'scope/L392_L390_EULER_ONLY_NATIVE_OVERLAY_20261103/L392_CAD_ONLY_BINARY_QA.json'
EXPECTED_SOURCE='73826d5cb777ed08cd9f20a9dd3171c1964f1f8de8c570edfb9f4a802538e306'

def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda:f.read(1<<20),b''):
            h.update(b)
    return h.hexdigest()

def main():
    assert not OUT.exists() and not QA.exists(), 'L392_IMMUTABLE_OUTPUT_EXISTS'
    assert sha(SOURCE)==EXPECTED_SOURCE, 'V57_SOURCE_CHANGED'
    spec=importlib.util.spec_from_file_location('l392_l382_stl_helper',HELPER)
    helper=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    gltf={
        'asset':{'version':'2.0','generator':'PULPA LAB L392 signed SW2026 educational CAD only'},
        'scene':0,'scenes':[{'name':'L392_EULER_INSPECTION_ONLY','nodes':[]}],
        'nodes':[],'meshes':[],'materials':[],'accessors':[],'bufferViews':[],
        'buffers':[{'byteLength':0}],
    }
    buffer=bytearray()
    parts=[]
    for name,stl,expected,world_origin,scale,color in helper.SOURCES:
        assert sha(stl)==expected, ('SIGNED_STL_CHANGED',name)
        obj=helper.insert_mesh(gltf,buffer,name,stl,world_origin,scale,color)
        node=gltf['nodes'][obj['node_index']]
        node['name']='SLURRY-PUMP-01_NATIVE_L392_'+name+'_EDU_NO_B64_WET_MATE'
        node['extras']={
            'realNativeSolidWorksPart':True,
            'educationalOnly':True,
            'sourceSignedSTL_SHA256':expected,
            'industrialWetCertified':False,
            'sensor':False,
            'authoritativeB64Replaced':False,
        }
        parts.append(obj)
    helper.align4(buffer)
    gltf['buffers'][0]['byteLength']=len(buffer)
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_bytes(helper.glb_pack(gltf,bytes(buffer)))
    document,binary=helper.glb_decode(OUT.read_bytes())
    assert len(document['meshes'])==4 and len(document['nodes'])==4
    assert len(document.get('animations',[]))==0 and len(document.get('cameras',[]))==0
    assert all(n['name'].startswith('SLURRY-PUMP-01_NATIVE_L392_') for n in document['nodes'])
    assert len(binary)==document['buffers'][0]['byteLength']
    assert sha(SOURCE)==EXPECTED_SOURCE
    result={'block':'L392','status':'PASS_FOUR_SIGNED_SW2026_MESHES_WITHOUT_DUPLICATE_MINE',
        'sourceV57Sha256':EXPECTED_SOURCE,'assetSha256':sha(OUT),
        'assetPath':str(OUT),'bytes':OUT.stat().st_size,
        'nodes':len(document['nodes']),'meshes':len(document['meshes']),
        'animations':0,'cameras':0,'sourceAnim34Untouched':True,
        'parts':parts,'signatures':{n:sha(p) for n,p,*_ in helper.SOURCES},
        'notFullMineDuplicate':True,'originalV57Written':False,
        'originalB64WetMateCertified':False,
        'productionSourceAssetModified':False,
        'solverChanged':False,
    }
    QA.parent.mkdir(parents=True,exist_ok=True)
    QA.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    print(json.dumps({'status':result['status'],'asset':str(OUT),'bytes':OUT.stat().st_size,
        'assetSHA':result['assetSha256'],'nodes':4,'animationsAdded':0,'QA':str(QA)},indent=2))

if __name__=='__main__':main()
