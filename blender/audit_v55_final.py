import bpy, math
from mathutils import Vector

s=bpy.context.scene
deps=bpy.context.evaluated_depsgraph_get()

ROOTS=[
 'ROM-HOPPER','APRON-FEEDER','PRIMARY-CRUSHER','STOCKPILE-RECLAIM','MILL-01','SUMP-01','SLURRY-PUMP-01','CLASS-01',
 'R-01','R-02','R-03','R-04','PUMP-01','CIP-ADSORPTION','ELUTION-SKID','EW-CELLS','SMELTING-FURNACE',
 'TRUCK-01','TRUCK-02','TRUCK-03','EXCAVATOR-01','V53_PIT_EXCAVATOR','V53_PIT_TRUCK_A','V53_PIT_TRUCK_B'
]

REQUIRED=[
 'V55_PIT_TERRAIN_ENVELOPE','V55_HAUL_RAMP_TIE_9M','V55_PAD_DRILLING','V55_PAD_LOADING','V55_PAD_MANEUVER',
 'V55_WASTE_DUMP_A','V55_WASTE_DUMP_B','V55_LOW_GRADE_ORE_A','V55_LOW_GRADE_ORE_B',
 'V55_UPGRADIENT_DIVERSION_DITCH','V55_RAMP_HIGHWALL_DITCH','V55_PIT_MAIN_SUMP','V55_RAMP_TOE_BASIN'
]

LEGACY_HIDDEN=[
 'V54_PIT_OUTER_TERRAIN_BLEND','V54_EXISTING_SITE_TO_PIT_BLEND','V54_HAUL_PORTAL_APPROACH','V54_HAUL_PORTAL_APRON',
 'V54_WASTE_DUMP_MAIN','V54_WASTE_DUMP_SECONDARY','V54_LOW_GRADE_ORE_STOCK','V53_PIT_RAMP_TIE_TO_MAIN_HAUL',
 'V53_PAD_DRILLING','V53_PAD_DRILLING_FILL','V53_PAD_LOADING','V53_PAD_LOADING_FILL','V53_PAD_MANEUVER'
]

FLOW=[
 ('ROM-HOPPER','APRON-FEEDER'),('APRON-FEEDER','PRIMARY-CRUSHER'),('PRIMARY-CRUSHER','CV-02'),
 ('STOCKPILE-RECLAIM','CV-03'),('MILL-01','SUMP-01'),('SUMP-01','SLURRY-PUMP-01'),('SLURRY-PUMP-01','CLASS-01'),
 ('R-01','R-02'),('R-02','R-03'),('R-03','R-04'),('R-04','PUMP-01'),('PUMP-01','CIP-ADSORPTION'),
 ('CIP-ADSORPTION','ELUTION-SKID'),('ELUTION-SKID','EW-CELLS'),('EW-CELLS','SMELTING-FURNACE')
]

ANIM_PROBES=[
 'TRUCK-01','TRUCK-02','TRUCK-03','APRON-FEEDER_PANS_GROUP','PRIMARY-CRUSHER_MOVING_JAW',
 'V49_CV02_ORE_01','V49_CV03_ORE_01','MILL-01_TRUNNION_01','SLURRY-PUMP-01_SHAFT',
 'V43_CLASS_SWIRL_ROOT_01','R-01_ROTATING_GROUP','R-04_ROTATING_GROUP','PUMP-01_SHAFT',
 'V40_ELUTION_PIVOT_01','EW-CELLS_CATHODE_1_1','V39_EW_SMELT_CART'
]

def fmt(v):return tuple(round(float(x),4) for x in v)

def hierarchy_bounds(root):
    pts=[]
    for o in [root]+list(root.children_recursive):
        if o.type!='MESH' or o.hide_render:continue
        ev=o.evaluated_get(deps);me=ev.to_mesh();mw=ev.matrix_world
        pts.extend(mw@v.co for v in me.vertices);ev.to_mesh_clear()
    if not pts:return None
    mn=Vector((min(p.x for p in pts),min(p.y for p in pts),min(p.z for p in pts)))
    mx=Vector((max(p.x for p in pts),max(p.y for p in pts),max(p.z for p in pts)))
    return mn,mx

print('VERSION',s.get('PULPA_LAB_MASTER_VERSION'),'FRAME_RANGE',s.frame_start,s.frame_end,'OBJECTS',len(s.objects),'ACTIONS',len(bpy.data.actions))
print('MISSING_ROOTS',[n for n in ROOTS if not bpy.data.objects.get(n)])
print('MISSING_REQUIRED',[n for n in REQUIRED if not bpy.data.objects.get(n)])
print('LEGACY_NOT_HIDDEN',[n for n in LEGACY_HIDDEN if not bpy.data.objects.get(n) or not (bpy.data.objects[n].hide_render and bpy.data.objects[n].hide_viewport)])

flow_errors=[]
for up,dn in FLOW:
    o=bpy.data.objects.get(up)
    if not o:flow_errors.append((up,'missing'));continue
    actual=o.get('downstream')
    if actual!=dn:flow_errors.append((up,actual,dn))
print('FLOW_ERRORS',flow_errors)
klass=bpy.data.objects.get('CLASS-01')
print('CLASS_BRANCHES',klass.get('overflow_downstream') if klass else None,klass.get('underflow_downstream') if klass else None,klass.get('underflow_pump') if klass else None)

# Grounding of final static pit fleet against final pad tops.
s.frame_set(1);bpy.context.view_layer.update()
grounds={
 'V53_PIT_EXCAVATOR':-9.76,
 'V53_PIT_TRUCK_A':-15.76,
 'V53_PIT_TRUCK_B':-15.76,
}
ground_errors=[]
for n,top in grounds.items():
    o=bpy.data.objects.get(n);b=hierarchy_bounds(o) if o else None
    if not b:
        ground_errors.append((n,'missing'));continue
    err=float(b[0].z-top)
    print('GROUND',n,'MINZ',round(float(b[0].z),4),'PAD_TOP',top,'DELTA',round(err,4))
    if abs(err)>.08:ground_errors.append((n,err))
print('GROUND_ERRORS',ground_errors)

# Sample the full timeline at representative early/mid/late frames.
frames=(1,48,300,720,1500,2500,2890)
samples={}
for f in frames:
    s.frame_set(f);bpy.context.view_layer.update()
    for n in ANIM_PROBES:
        o=bpy.data.objects.get(n)
        if o:
            samples.setdefault(n,[]).append((f,o.matrix_world.translation.copy(),o.matrix_world.to_quaternion().copy()))

anim_errors=[]
for n,vals in samples.items():
    p0,q0=vals[0][1],vals[0][2]
    moved=False
    for _,p,q in vals[1:]:
        if (p-p0).length>1e-4 or q.rotation_difference(q0).angle>1e-4:
            moved=True;break
    print('ANIM',n,'SAMPLES',len(vals),'MOVED',moved)
    if not moved:anim_errors.append(n)
missing_anim=[n for n in ANIM_PROBES if n not in samples]
print('MISSING_ANIM_PROBES',missing_anim)
print('ANIM_ERRORS',anim_errors)

# Major process lines that must remain visible.
AUTH=[
 'V52_PIPE_MILL_TO_SUMP','V52_PIPE_SUMP_TO_SLURRY_PUMP','V52_PIPE_SLURRY_PUMP_TO_CLASS',
 'V52_PIPE_CLASS_OVERFLOW_TO_R01','V52_PIPE_CLASS_UNDERFLOW_TO_MILL',
 'V39_PIPE_R01_TO_R02','V39_PIPE_R02_TO_R03','V39_PIPE_R03_TO_R04','V37_PIPE_R04_TO_PUMP',
 'V52_PIPE_PUMP_TO_CIP','V52_PIPE_CIP_TO_ELUTION','V52_PIPE_ELUTION_TO_EW','V39_EW_SMELT_CART'
]
auth_errors=[n for n in AUTH if not bpy.data.objects.get(n) or bpy.data.objects[n].hide_render]
print('AUTH_ERRORS',auth_errors)

pass_final=(
    s.get('PULPA_LAB_MASTER_VERSION')=='V55'
    and s.frame_end>=2890
    and not [n for n in ROOTS if not bpy.data.objects.get(n)]
    and not [n for n in REQUIRED if not bpy.data.objects.get(n)]
    and not [n for n in LEGACY_HIDDEN if not bpy.data.objects.get(n) or not (bpy.data.objects[n].hide_render and bpy.data.objects[n].hide_viewport)]
    and not flow_errors and not ground_errors and not missing_anim and not anim_errors and not auth_errors
)
print('PASS_FINAL',pass_final)
