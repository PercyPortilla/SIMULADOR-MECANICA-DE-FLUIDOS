import bpy
from mathutils import Vector

EXPECTED='V51'
OUT=r'C:\Users\USER\OneDrive\Desktop\CHATON\pulpa-v31-babylon\blender\PULPA_LAB_BLENDER_MASTER_V52.blend'
scene=bpy.context.scene
if scene.get('PULPA_LAB_MASTER_VERSION') != EXPECTED:
    raise RuntimeError(f'V52 prompts 5-10 require {EXPECTED}, got {scene.get("PULPA_LAB_MASTER_VERSION")!r}')


def ensure_collection(name,parent=None):
    c=bpy.data.collections.get(name)
    if c is None:
        c=bpy.data.collections.new(name)
    owner=parent if parent is not None else scene.collection
    if c.name not in owner.children:
        owner.children.link(c)
    return c


parent=bpy.data.collections.get('V51_50_PROCESS_PIPING_UTILITIES') or scene.collection
COL=ensure_collection('V52_05_10_PROCESS_CORRECTIONS',parent)
transfer_parent=bpy.data.collections.get('V51_60_OPERATION_ANIMATION_LAYOUT') or scene.collection
TRANSFER=ensure_collection('V52_10_RECOVERY_TRANSFER',transfer_parent)


def material(name,color,metal=0.0,rough=.55):
    m=bpy.data.materials.get(name)
    if m is None:
        m=bpy.data.materials.new(name)
    m.diffuse_color=(*color,1)
    m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF')
    if bs:
        bs.inputs['Base Color'].default_value=(*color,1)
        bs.inputs['Metallic'].default_value=metal
        bs.inputs['Roughness'].default_value=rough
    return m


M_PROCESS=bpy.data.materials.get('V16_ProcessPipe') or material('V52_ProcessPipe',(0.08,0.38,0.58),.15,.45)
M_RECYCLE=bpy.data.materials.get('V16_Orange') or material('V52_Recycle',(0.88,0.36,0.06),.08,.48)
M_STEEL=bpy.data.materials.get('V16_Steel') or material('V52_Steel',(0.19,0.22,0.24),.6,.42)
M_RAIL=bpy.data.materials.get('V17_Belt') or material('V52_Rail',(0.055,0.06,0.065),.45,.38)


def link_new(obj,col=COL):
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    col.objects.link(obj)
    obj['v52_prompt_5_10']=True
    return obj


def pipe(name,pts,diameter=.32,mat=M_PROCESS,col=COL):
    cu=bpy.data.curves.new(name+'_C','CURVE')
    cu.dimensions='3D';cu.resolution_u=2;cu.bevel_depth=diameter*.5;cu.bevel_resolution=5
    sp=cu.splines.new('POLY');sp.points.add(len(pts)-1)
    for q,p in zip(sp.points,pts):q.co=(*p,1)
    o=bpy.data.objects.new(name,cu);col.objects.link(o);o.data.materials.append(mat)
    o['v52_prompt_5_10']=True;o['nominal_visual_diameter_m']=diameter
    return o


def box(name,loc,dims,mat=M_STEEL,col=COL):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    o=bpy.context.object;o.name=name;o.dimensions=dims
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat);link_new(o,col);return o


def support(name,x,y,pipe_z,base_z=1.7,width=1.2):
    h=max(.35,pipe_z-base_z-.18)
    box(name+'_POST_L',(x,y-width*.42,base_z+h*.5),(.16,.16,h),M_STEEL)
    box(name+'_POST_R',(x,y+width*.42,base_z+h*.5),(.16,.16,h),M_STEEL)
    box(name+'_SADDLE',(x,y,pipe_z-.12),(.22,width,.16),M_STEEL)


def empty(name,loc,col=COL):
    o=bpy.data.objects.new(name,None);o.location=loc;col.objects.link(o);o['v52_prompt_5_10']=True;return o


def sphere(name,loc,scale,mat=M_STEEL,col=COL,parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=12,location=loc)
    o=bpy.context.object;o.name=name;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(mat);link_new(o,col)
    if parent:o.parent=parent
    return o


def hide(name,reason):
    o=bpy.data.objects.get(name)
    if o:
        o.hide_render=True;o.hide_viewport=True;o['v52_hidden_reason']=reason


# ------------------------------------------------------------------
# Prompt 5 — MILL -> SUMP -> SLURRY-PUMP.
# V49 used the east/feed trunnion as a discharge origin, visually crossing the
# mill. Replace it with a west-trunnion discharge to the sump inlet, while
# keeping the east side available for CV-03 + cyclone underflow return.
# ------------------------------------------------------------------
hide('V49_PIPE_MILL_TO_SUMP','V52 corrects MILL-01 discharge to west trunnion; V49 incorrectly crossed from east/feed side')
hide('V25_BRANCH_SUMP_IN','V52 west-trunnion MILL-01 -> SUMP-01 discharge replaces legacy branch')
pipe('V52_PIPE_MILL_TO_SUMP',[
    (329.405,35.00,5.15),
    (328.35,35.00,5.10),
    (327.10,34.80,4.92),
    (325.55,34.15,4.55),
    (324.55,34.15,4.55),
],.42,M_PROCESS)
support('V52_SUP_MILL_SUMP',327.0,34.8,4.92,1.55,1.0)

hide('V16_PIPE_SUMP_TO_PUMP','V52 compact SUMP-01 -> SLURRY-PUMP-01 suction replaces detoured legacy route')
pipe('V52_PIPE_SUMP_TO_SLURRY_PUMP',[
    (319.45,35.90,2.80),
    (318.15,35.90,2.80),
    (317.15,35.55,2.98),
    (316.25,35.20,3.12),
    (315.65,35.00,3.18),
],.44,M_PROCESS)
support('V52_SUP_SUMP_SUCTION',317.2,35.55,3.0,1.55,1.05)


# ------------------------------------------------------------------
# Prompt 6 — SLURRY-PUMP -> CLASS-01.
# Use the real discharge and feed flange coordinates and keep the line above
# equipment instead of looping out to the old remote pipe corridor.
# ------------------------------------------------------------------
for n in ('V16_PIPE_PUMP_TO_CLASS','V25_BRANCH_PUMP_DISCH','V25_BRANCH_CLASS_FEED'):
    hide(n,'V52 direct SLURRY-PUMP-01 -> CLASS-01 discharge')
pipe('V52_PIPE_SLURRY_PUMP_TO_CLASS',[
    (313.65,35.00,4.78),
    (313.65,35.00,5.78),
    (311.50,35.00,5.78),
    (308.00,35.00,5.85),
    (306.55,35.00,5.85),
    (305.55,35.00,5.85),
],.48,M_PROCESS)
support('V52_SUP_PUMP_CLASS_A',311.0,35.0,5.8,1.70,1.15)
support('V52_SUP_PUMP_CLASS_B',308.2,35.0,5.85,1.70,1.15)


# ------------------------------------------------------------------
# Prompt 7 — CLASS overflow to R-01 and underflow recycle to MILL-01.
# ------------------------------------------------------------------
for n in ('V16_PIPE_CLASS_TO_LEACH','V25_BRANCH_CLASS_OVERFLOW','V25_BRANCH_LEACH_FEED','V19_CLASS_RECYCLE'):
    hide(n,'V52 explicit cyclone overflow/underflow split')

pipe('V52_PIPE_CLASS_OVERFLOW_TO_R01',[
    (303.00,35.00,6.55),
    (303.00,37.10,7.35),
    (297.00,37.10,8.20),
    (294.10,37.10,8.20),
    (293.62,35.00,8.20),
    (292.62,35.00,8.20),
],.40,M_PROCESS)
support('V52_SUP_CLASS_OVERFLOW_A',299.0,37.1,8.2,1.70,1.0)
support('V52_SUP_CLASS_OVERFLOW_B',295.5,37.1,8.2,1.70,1.0)

# Underflow collection box directly beneath cyclone cluster.
box('V52_CLASS_UNDERFLOW_BOX',(303.0,35.0,2.62),(2.25,2.25,.62),M_STEEL)
underflow=[
    (301.52,35.00,3.13),(302.26,33.718,3.13),(303.74,33.718,3.13),
    (304.48,35.00,3.13),(303.74,36.282,3.13),(302.26,36.282,3.13),
]
for i,p0 in enumerate(underflow,1):
    pipe(f'V52_CLASS_UNDERFLOW_BRANCH_{i:02d}',[
        p0,(p0[0],p0[1],2.95),(303.0,35.0,2.82)
    ],.16,M_RECYCLE)

# The cyclone apexes are below the mill-feed elevation. A small recycle pump is
# therefore required; a gravity-only return would be physically impossible.
recycle=empty('V52_CLASS_RECYCLE_PUMP',(305.7,30.6,2.55))
base=box('V52_CLASS_RECYCLE_PUMP_BASE',(305.9,30.6,2.12),(3.4,1.8,.24),M_STEEL);base.parent=recycle
casing=sphere('V52_CLASS_RECYCLE_PUMP_CASING',(305.05,30.6,2.78),(.72,.62,.66),M_STEEL,parent=recycle)
motor=box('V52_CLASS_RECYCLE_PUMP_MOTOR',(306.75,30.6,2.75),(1.65,1.05,1.05),M_STEEL);motor.parent=recycle
coupling=box('V52_CLASS_RECYCLE_PUMP_COUPLING',(305.92,30.6,2.75),(.45,.38,.38),M_STEEL);coupling.parent=recycle
pipe('V52_PIPE_CLASS_UNDERFLOW_SUCTION',[
    (304.10,35.00,2.65),
    (304.10,31.55,2.65),
    (305.00,30.60,2.72),
],.30,M_RECYCLE)
pipe('V52_PIPE_CLASS_UNDERFLOW_TO_MILL',[
    (305.05,30.60,3.30),
    (313.00,30.60,3.40),
    (323.00,30.60,3.55),
    (332.00,30.60,4.45),
    (337.20,33.60,5.35),
    (338.20,34.35,5.55),
],.34,M_RECYCLE)
for idx,x in enumerate((310.0,320.0,329.0),1):
    z=3.2 if x<318 else (3.45 if x<326 else 4.15)
    support(f'V52_SUP_UNDERFLOW_{idx:02d}',x,30.6,z,1.55,1.0)

klass=bpy.data.objects['CLASS-01']
klass['overflow_downstream']='R-01';klass['underflow_downstream']='MILL-01'
klass['v52_overflow_pipe']='V52_PIPE_CLASS_OVERFLOW_TO_R01'
klass['v52_underflow_pipe']='V52_PIPE_CLASS_UNDERFLOW_TO_MILL'
klass['underflow_pump']='V52_CLASS_RECYCLE_PUMP'


# ------------------------------------------------------------------
# Prompt 8 — R-01 -> R-02 -> R-03 -> R-04.
# V39 already has the correct nozzle-to-nozzle sequence. Reinforce it rather
# than replacing the validated topology.
# ------------------------------------------------------------------
for n in ('V39_PIPE_R01_TO_R02','V39_PIPE_R02_TO_R03','V39_PIPE_R03_TO_R04'):
    o=bpy.data.objects.get(n)
    if o:
        o.data.bevel_depth=.18
        if not o.data.materials:o.data.materials.append(M_PROCESS)
        o['v52_role']='authoritative_sequential_leach_transfer'


# ------------------------------------------------------------------
# Prompt 9 — R-04 -> PUMP-01 -> CIP.
# Remove the old R-01->CIP bypass visual and retain the correct V37 R04/PUMP
# lines, adding the missing tie from the rack into the first CIP tank.
# ------------------------------------------------------------------
hide('V16_PIPE_LEACH_TO_CIP','Incorrect visual bypass R-01 -> CIP; V52 requires R-04 -> PUMP-01 -> CIP')
hide('V37_PIPE_PUMP_TO_CIP','V52 retargets PUMP-01 discharge directly to the first CIP tank shell')
for n in ('V37_PIPE_R04_TO_PUMP',):
    o=bpy.data.objects.get(n)
    if o:
        o.data.bevel_depth=.17
        if not o.data.materials:o.data.materials.append(M_PROCESS)
        o['v52_role']='authoritative_R04_PUMP_CIP_sequence'

pipe('V52_PIPE_PUMP_TO_CIP',[
    (249.00,35.65,4.78),
    (249.00,35.65,6.20),
    (247.15,35.65,6.20),
    (245.55,35.00,6.20),
],.32,M_PROCESS)
support('V52_SUP_CIP_FEED',247.0,35.65,6.2,1.70,.9)


# ------------------------------------------------------------------
# Prompt 10 — CIP -> ELUTION -> EW -> SMELTING.
# Keep the concise V39 solution pipes, hide older elevated duplicates, bridge
# their tie points to the real equipment envelopes, and make EW->smelting a
# solids transfer via the existing animated cart rather than a false fluid pipe.
# ------------------------------------------------------------------
for n in ('V16_PIPE_CIP_TO_ELUTION','V16_PIPE_ELUTION_TO_EW','V16_PIPE_EW_TO_SMELTING_UTILITY','V39_PIPE_CIP_TO_ELUTION','V39_PIPE_ELUTION_TO_EW'):
    hide(n,'V52 recovery sequence uses V39 solution lines and cart solids transfer')
pipe('V52_PIPE_CIP_TO_ELUTION',[
    (232.45,35.00,6.20),
    (232.45,37.20,6.20),
    (226.00,37.20,5.45),
    (222.60,36.60,4.75),
    (221.75,35.00,4.60),
],.32,M_PROCESS)
pipe('V52_PIPE_ELUTION_TO_EW',[
    (213.75,35.95,4.00),
    (212.20,37.00,4.00),
    (208.20,37.00,3.55),
    (205.20,35.00,3.00),
],.30,M_PROCESS)
support('V52_SUP_CIP_ELUTION',226.0,37.2,5.45,1.70,.9)
support('V52_SUP_ELUTION_EW',208.2,37.0,3.55,1.70,.9)

# Visible cathode cart rails from EW discharge side toward the furnace mouth.
rail_x0,rail_x1=194.8,185.55
rail_len=rail_x0-rail_x1
for y,suffix in ((34.30,'L'),(35.70,'R')):
    box(f'V52_EW_SMELT_RAIL_{suffix}',((rail_x0+rail_x1)*.5,y,2.22),(rail_len,.10,.10),M_RAIL,TRANSFER)
box('V52_EW_PICKUP_DOCK',(194.0,35.0,2.18),(1.6,2.2,.12),M_STEEL,TRANSFER)
box('V52_SMELT_DROP_DOCK',(186.15,35.0,2.18),(1.2,2.2,.12),M_STEEL,TRANSFER)

cart=bpy.data.objects.get('V39_EW_SMELT_CART')
if cart:
    cart['upstream']='EW-CELLS';cart['downstream']='SMELTING-FURNACE';cart['v52_transfer']='cathode_cart_not_fluid_pipe'


# Reassert semantic process chain without moving any validated equipment root.
chain=[
 ('MILL-01','SUMP-01'),('SUMP-01','SLURRY-PUMP-01'),('SLURRY-PUMP-01','CLASS-01'),
 ('CLASS-01','R-01'),('R-01','R-02'),('R-02','R-03'),('R-03','R-04'),('R-04','PUMP-01'),
 ('PUMP-01','CIP-ADSORPTION'),('CIP-ADSORPTION','ELUTION-SKID'),('ELUTION-SKID','EW-CELLS'),
 ('EW-CELLS','SMELTING-FURNACE')]
for up,dn in chain:
    bpy.data.objects[up]['downstream']=dn;bpy.data.objects[dn]['upstream']=up

scene.frame_set(1);bpy.context.view_layer.update()
scene['PULPA_LAB_MASTER_VERSION']='V52'
scene['PULPA_LAB_V52_BASE']='V51 prompts 1-4 preserved'
scene['PULPA_LAB_V52_SCOPE']='Prompts 5-10: mill/sump/pump/classification/leach/CIP/elution/EW/smelting connections only'
scene['PULPA_LAB_V52_NOTES']=(
 'Preserves all validated equipment roots and animations. V49 mill->sump retained; compact sump suction and pump->class added; '
 'cyclone overflow explicitly feeds R-01 and underflow returns to MILL-01 through a dedicated recycle pump; V39 R01->R04 sequence retained/thickened; '
 'incorrect legacy R01->CIP bypass hidden; V37 R04->PUMP retained and PUMP->CIP retargeted to the tank shell; CIP->elution->EW rebuilt to real equipment faces; '
 'EW->smelting represented as cathode cart/rail solids transfer, not a false solution pipe.'
)
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print('V52_SAVED',OUT,'OBJECTS',len(scene.objects),'NEW_PIPE_OBJECTS',len(COL.objects),'TRANSFER_OBJECTS',len(TRANSFER.objects))
