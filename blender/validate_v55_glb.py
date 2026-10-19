import json, struct, os, sys

path=r'C:\Users\USER\OneDrive\Desktop\CHATON\pulpa-v31-babylon\public\models\pulpa-v55\PULPA_LAB_V55_FULL_SITE.glb'
with open(path,'rb') as f:
    magic,version,length=struct.unpack('<4sII',f.read(12))
    if magic!=b'glTF' or version!=2 or length!=os.path.getsize(path):
        raise RuntimeError((magic,version,length,os.path.getsize(path)))
    chunk_len,chunk_type=struct.unpack('<II',f.read(8))
    if chunk_type!=0x4E4F534A:
        raise RuntimeError('First chunk is not JSON')
    data=json.loads(f.read(chunk_len).decode('utf-8').rstrip('\x00 '))

nodes=data.get('nodes',[])
node_names=[n.get('name','') for n in nodes]
name_to_idx={n:i for i,n in enumerate(node_names)}
anims=data.get('animations',[])

animated_nodes=set()
channel_count=0
duration=0.0
accessors=data.get('accessors',[])
for anim in anims:
    for ch in anim.get('channels',[]):
        channel_count+=1
        target=ch.get('target',{}).get('node')
        if target is not None:animated_nodes.add(target)
        sampler_index=ch.get('sampler')
        if sampler_index is not None:
            sampler=anim.get('samplers',[])[sampler_index]
            input_acc=sampler.get('input')
            if input_acc is not None:
                mx=accessors[input_acc].get('max')
                if mx:duration=max(duration,float(mx[0]))

critical_nodes=[
    'ROM-HOPPER','APRON-FEEDER','PRIMARY-CRUSHER','STOCKPILE-RECLAIM','MILL-01','SUMP-01',
    'SLURRY-PUMP-01','CLASS-01','R-01','R-04','PUMP-01','CIP-ADSORPTION','ELUTION-SKID','EW-CELLS','SMELTING-FURNACE',
    'V53_PIT_FACE_01','V53_PIT_RAMP_9M','V55_PIT_TERRAIN_ENVELOPE','V55_HAUL_RAMP_TIE_9M',
    'V52_PIPE_CLASS_UNDERFLOW_TO_MILL','V55_WASTE_DUMP_A','V55_PIT_MAIN_SUMP'
]
missing_nodes=[n for n in critical_nodes if n not in name_to_idx]

critical_anim=[
    'TRUCK-01','TRUCK-02','TRUCK-03','APRON-FEEDER_PANS_GROUP','PRIMARY-CRUSHER_MOVING_JAW',
    'V49_CV02_ORE_01','V49_CV03_ORE_01','MILL-01_TRUNNION_01','SLURRY-PUMP-01_SHAFT',
    'V43_CLASS_SWIRL_ROOT_01','R-01_ROTATING_GROUP','R-04_ROTATING_GROUP','PUMP-01_SHAFT',
    'V40_ELUTION_PIVOT_01','EW-CELLS_CATHODE_1_1','V39_EW_SMELT_CART'
]
animated_names={node_names[i] for i in animated_nodes if 0<=i<len(node_names)}
missing_anim=[n for n in critical_anim if n not in animated_names]

print('GLB_BYTES',os.path.getsize(path))
print('SCENES',len(data.get('scenes',[])))
print('NODES',len(nodes),'MESHES',len(data.get('meshes',[])),'MATERIALS',len(data.get('materials',[])))
print('ANIMATIONS',len(anims),'CHANNELS',channel_count,'ANIMATED_NODES',len(animated_nodes),'MAX_DURATION_SEC',round(duration,3))
print('MISSING_CRITICAL_NODES',missing_nodes)
print('MISSING_CRITICAL_ANIMATED_NODES',missing_anim)
print('PASS_GLB',bool(len(data.get('scenes',[]))==1 and anims and duration>90 and not missing_nodes and not missing_anim))
