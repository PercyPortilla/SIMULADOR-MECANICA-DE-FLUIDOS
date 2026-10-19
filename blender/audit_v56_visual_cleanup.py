import bpy
from mathutils import Vector

scene=bpy.context.scene
scene.frame_set(1)
bpy.context.view_layer.update()

EXPECTED_HIDDEN = (
    [f'V24_CABLE_DROP_{i:02d}' for i in range(1, 7)]
    + ['V19_CABLE_TRAY_L', 'V19_CABLE_TRAY_R']
    + [f'V19_CABLE_TRAY_RUNG_{i:02d}' for i in range(1, 37)]
)

AUTH = [
    'V52_PIPE_MILL_TO_SUMP', 'V52_PIPE_SUMP_TO_SLURRY_PUMP',
    'V52_PIPE_SLURRY_PUMP_TO_CLASS', 'V52_PIPE_CLASS_OVERFLOW_TO_R01',
    'V52_PIPE_CLASS_UNDERFLOW_TO_MILL', 'V39_PIPE_R01_TO_R02',
    'V39_PIPE_R02_TO_R03', 'V39_PIPE_R03_TO_R04', 'V37_PIPE_R04_TO_PUMP',
    'V52_PIPE_PUMP_TO_CIP', 'V52_PIPE_CIP_TO_ELUTION', 'V52_PIPE_ELUTION_TO_EW',
    'V39_EW_SMELT_CART',
]

ANIM = [
    'TRUCK-01', 'TRUCK-02', 'TRUCK-03', 'APRON-FEEDER_PANS_GROUP',
    'PRIMARY-CRUSHER_MOVING_JAW', 'V49_CV02_ORE_01', 'V49_CV03_ORE_01',
    'MILL-01_TRUNNION_01', 'SLURRY-PUMP-01_SHAFT', 'V43_CLASS_SWIRL_ROOT_01',
    'R-01_ROTATING_GROUP', 'R-04_ROTATING_GROUP', 'PUMP-01_SHAFT',
    'V40_ELUTION_PIVOT_01', 'EW-CELLS_CATHODE_1_1', 'V39_EW_SMELT_CART',
]

print('VERSION', scene.get('PULPA_LAB_MASTER_VERSION'))
print('VISIBLE_OBJECTS', sum(1 for o in scene.objects if not o.hide_render))
print('CABLES_NOT_HIDDEN', [n for n in EXPECTED_HIDDEN if not bpy.data.objects.get(n) or not bpy.data.objects[n].hide_render])

proto=bpy.data.collections.get('V15_HYBRID_MODULES')
print('VISIBLE_PROTOTYPES', [o.name for o in proto.objects if not o.hide_render] if proto else ['MISSING_COLLECTION'])
print('VISIBLE_V16_DUP_RACK', [o.name for o in scene.objects if (o.name.startswith('V16_RACK_') or o.name.startswith('V16_SHORT_RACK_')) and not o.hide_render])
print('VISIBLE_ORPHAN_GANTRY', [o.name for o in scene.objects if o.name.startswith('V21_GANTRY_116') and not o.hide_render])
v20=bpy.data.collections.get('V20_UTILITIES')
visible_v20=[o.name for o in v20.objects if not o.hide_render] if v20 else []
print('VISIBLE_V20_UTILITIES_COUNT', len(visible_v20))
new_tray=[o.name for o in scene.objects if o.name.startswith('V56_CABLE_TRAY_') and not o.hide_render]
print('NEW_SUPPORTED_CABLE_TRAY_COUNT', len(new_tray))
print('AUTH_HIDDEN', [n for n in AUTH if not bpy.data.objects.get(n) or bpy.data.objects[n].hide_render])

def hierarchy_min_z(root):
    pts=[]
    for obj in [root]+list(root.children_recursive):
        if obj.type!='MESH' or obj.hide_render:
            continue
        pts.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    return min((p.z for p in pts), default=None)

loader=bpy.data.objects.get('LOADER-01')
loader_min=hierarchy_min_z(loader) if loader else None
pickup_meshes=[o for o in scene.objects if o.name.startswith('V24_SERVICE_PICKUP_') and o.type=='MESH' and not o.hide_render]
pickup_min=min((min((o.matrix_world@Vector(c)).z for c in o.bound_box) for o in pickup_meshes), default=None)
print('GROUND_LOADER_MINZ', round(loader_min,4) if loader_min is not None else None)
print('GROUND_SERVICE_PICKUP_MINZ', round(pickup_min,4) if pickup_min is not None else None)

samples={}
for f in (1,48,300,720,1500,2500,2890):
    scene.frame_set(f); bpy.context.view_layer.update()
    for n in ANIM:
        o=bpy.data.objects.get(n)
        if o:
            samples.setdefault(n,[]).append((o.matrix_world.translation.copy(),o.matrix_world.to_quaternion().copy()))
anim_errors=[]
for n,vals in samples.items():
    p0,q0=vals[0]
    moved=any((p-p0).length>1e-4 or q.rotation_difference(q0).angle>1e-4 for p,q in vals[1:])
    print('ANIM',n,'MOVED',moved)
    if not moved: anim_errors.append(n)
print('ANIM_ERRORS',anim_errors)

for n in ('V16_WaterPipe','V16_AirPipe','V19_ChemPipe','V16_ProcessPipe','V52_Recycle'):
    m=bpy.data.materials.get(n)
    print('MAT',n,tuple(round(float(x),3) for x in m.diffuse_color[:3]) if m else None)

required_caps = [
    'V19_HEADER_AIR', 'V19_HEADER_CHEM', 'V19_HEADER_PROCESS', 'V19_HEADER_WATER',
    'V16_UTILITY_WASH_WATER', 'V21_PROCESS_EXPANSION_LOOP', 'V21_FIREWATER_RING',
]
uncapped = []
for n in required_caps:
    o = bpy.data.objects.get(n)
    if not o or o.type != 'CURVE' or not getattr(o.data, 'use_fill_caps', False):
        uncapped.append(n)
print('UNCAPPED_REQUIRED_CURVES', uncapped)

pass_basic=(
    scene.get('PULPA_LAB_MASTER_VERSION')=='V56'
    and not [n for n in EXPECTED_HIDDEN if not bpy.data.objects.get(n) or not bpy.data.objects[n].hide_render]
    and not ([o.name for o in proto.objects if not o.hide_render] if proto else ['missing'])
    and not [o.name for o in scene.objects if (o.name.startswith('V16_RACK_') or o.name.startswith('V16_SHORT_RACK_')) and not o.hide_render]
    and not [o.name for o in scene.objects if o.name.startswith('V21_GANTRY_116') and not o.hide_render]
    and v20 is not None and len(visible_v20) >= 100
    and bpy.data.objects.get('V20_STOCK_SPRAY_RAIL') is not None and not bpy.data.objects['V20_STOCK_SPRAY_RAIL'].hide_render
    and len(new_tray) >= 50
    and bpy.data.objects.get('V56_CABLE_TRAY_MAIN_RAIL_A') is not None
    and bpy.data.objects.get('V56_CABLE_TRAY_SUPPORT_01') is not None
    and not [n for n in AUTH if not bpy.data.objects.get(n) or bpy.data.objects[n].hide_render]
    and not uncapped
    and not anim_errors
    and loader_min is not None and abs(loader_min - (-0.12)) < 0.08
    and pickup_min is not None and abs(pickup_min - (-2.19)) < 0.08
)
print('PASS_BASIC',pass_basic)
