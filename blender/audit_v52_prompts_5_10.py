import bpy

scene=bpy.context.scene
scene.frame_set(1);bpy.context.view_layer.update()

REQ=[
 'V52_PIPE_MILL_TO_SUMP','V52_PIPE_SUMP_TO_SLURRY_PUMP','V52_PIPE_SLURRY_PUMP_TO_CLASS',
 'V52_PIPE_CLASS_OVERFLOW_TO_R01','V52_CLASS_UNDERFLOW_BOX','V52_CLASS_RECYCLE_PUMP',
 'V52_PIPE_CLASS_UNDERFLOW_SUCTION','V52_PIPE_CLASS_UNDERFLOW_TO_MILL',
 'V52_PIPE_PUMP_TO_CIP','V52_PIPE_CIP_TO_ELUTION','V52_PIPE_ELUTION_TO_EW',
 'V52_EW_SMELT_RAIL_L','V52_EW_SMELT_RAIL_R','V52_EW_PICKUP_DOCK','V52_SMELT_DROP_DOCK'
]
HIDDEN=[
 'V49_PIPE_MILL_TO_SUMP','V25_BRANCH_SUMP_IN','V16_PIPE_SUMP_TO_PUMP','V16_PIPE_PUMP_TO_CLASS','V25_BRANCH_PUMP_DISCH','V25_BRANCH_CLASS_FEED',
 'V16_PIPE_CLASS_TO_LEACH','V25_BRANCH_CLASS_OVERFLOW','V25_BRANCH_LEACH_FEED','V19_CLASS_RECYCLE','V16_PIPE_LEACH_TO_CIP',
 'V37_PIPE_PUMP_TO_CIP','V16_PIPE_CIP_TO_ELUTION','V16_PIPE_ELUTION_TO_EW','V16_PIPE_EW_TO_SMELTING_UTILITY',
 'V39_PIPE_CIP_TO_ELUTION','V39_PIPE_ELUTION_TO_EW'
]
ROOTS=['MILL-01','SUMP-01','SLURRY-PUMP-01','CLASS-01','R-01','R-02','R-03','R-04','PUMP-01','CIP-ADSORPTION','ELUTION-SKID','EW-CELLS','SMELTING-FURNACE']

print('VERSION',scene.get('PULPA_LAB_MASTER_VERSION'),'OBJECTS',len(scene.objects))
print('MISSING_NEW',[n for n in REQ if not bpy.data.objects.get(n)])
print('LEGACY_NOT_HIDDEN',[n for n in HIDDEN if not bpy.data.objects.get(n) or not (bpy.data.objects[n].hide_render and bpy.data.objects[n].hide_viewport)])

for n in ROOTS:
    o=bpy.data.objects[n]
    print('FLOW',n,'UP',o.get('upstream'),'DOWN',o.get('downstream'),'WORLD',tuple(round(float(v),3) for v in o.matrix_world.translation))
print('CLASS_BRANCHES',bpy.data.objects['CLASS-01'].get('overflow_downstream'),bpy.data.objects['CLASS-01'].get('underflow_downstream'))

for n in ('V39_PIPE_R01_TO_R02','V39_PIPE_R02_TO_R03','V39_PIPE_R03_TO_R04','V37_PIPE_R04_TO_PUMP'):
    o=bpy.data.objects.get(n)
    print('AUTH',n,'VISIBLE',bool(o and not o.hide_render),'BEVEL',round(float(o.data.bevel_depth),3) if o and o.type=='CURVE' else None,'ROLE',o.get('v52_role') if o else None)
for n in ('V52_PIPE_PUMP_TO_CIP','V52_PIPE_CIP_TO_ELUTION','V52_PIPE_ELUTION_TO_EW'):
    o=bpy.data.objects.get(n)
    print('AUTH',n,'VISIBLE',bool(o and not o.hide_render),'BEVEL',round(float(o.data.bevel_depth),3) if o and o.type=='CURVE' else None)

cart=bpy.data.objects.get('V39_EW_SMELT_CART')
print('EW_CART',cart.get('upstream') if cart else None,cart.get('downstream') if cart else None,cart.get('v52_transfer') if cart else None)

probes=['MILL-01_TRUNNION_01','SLURRY-PUMP-01_SHAFT','V43_CLASS_SWIRL_ROOT_01','R-01_ROTATING_GROUP','R-04_ROTATING_GROUP','PUMP-01_SHAFT','V40_ELUTION_PIVOT_01','EW-CELLS_CATHODE_1_1','V39_EW_SMELT_CART']
samples={}
for f in (1,48,300,720):
    scene.frame_set(f);bpy.context.view_layer.update()
    for n in probes:
        o=bpy.data.objects.get(n)
        if o:
            samples.setdefault(n,[]).append((f,o.matrix_world.translation.copy(),o.rotation_euler.copy()))
for n,vals in samples.items():
    p0,r0=vals[0][1],vals[0][2]
    moved=any((p-p0).length>1e-5 or sum(abs(float(a-b)) for a,b in zip(r,r0))>1e-5 for _,p,r in vals[1:])
    print('ANIM',n,'MOVED',moved)

pass_basic=(scene.get('PULPA_LAB_MASTER_VERSION')=='V52' and not [n for n in REQ if not bpy.data.objects.get(n)] and not [n for n in HIDDEN if not bpy.data.objects.get(n) or not (bpy.data.objects[n].hide_render and bpy.data.objects[n].hide_viewport)])
print('PASS_BASIC',pass_basic)
