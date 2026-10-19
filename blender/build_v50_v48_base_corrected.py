import bpy
import math
from mathutils import Vector, Matrix

EXPECTED='V48'
OUT=r'C:\Users\USER\OneDrive\Desktop\CHATON\pulpa-v31-babylon\blender\PULPA_LAB_BLENDER_MASTER_V50.blend'
scene=bpy.context.scene
if scene.get('PULPA_LAB_MASTER_VERSION') != EXPECTED:
    raise RuntimeError(f'V49 builder requires {EXPECTED}, got {scene.get("PULPA_LAB_MASTER_VERSION")!r}')

for cname in ('V50_LAYOUT','V50_CONVEYORS','V50_CIVIL'):
    c=bpy.data.collections.get(cname)
    if c:
        for o in list(c.objects):
            bpy.data.objects.remove(o,do_unlink=True)
        bpy.data.collections.remove(c)

LAYOUT=bpy.data.collections.new('V50_LAYOUT');scene.collection.children.link(LAYOUT)
CONV=bpy.data.collections.new('V50_CONVEYORS');scene.collection.children.link(CONV)
CIVIL=bpy.data.collections.new('V50_CIVIL');scene.collection.children.link(CIVIL)

def mat(name,color,metal=0.0,rough=.65):
    m=bpy.data.materials.get(name)
    if not m:
        m=bpy.data.materials.new(name)
    m.diffuse_color=(*color,1)
    m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF')
    if bs:
        bs.inputs['Base Color'].default_value=(*color,1)
        bs.inputs['Metallic'].default_value=metal
        bs.inputs['Roughness'].default_value=rough
    return m

M_STEEL=bpy.data.materials.get('V16_Steel') or mat('V16_Steel',(0.18,0.21,0.23),.6,.45)
M_ORANGE=bpy.data.materials.get('V16_Orange') or mat('V49_Orange',(0.82,0.25,0.035),.1,.55)
M_BELT=bpy.data.materials.get('V17_Belt') or mat('V49_Belt',(0.035,0.04,0.045),.0,.88)
M_CONC=bpy.data.materials.get('V16_Concrete') or bpy.data.materials.get('MAT_Concrete') or mat('V49_Concrete',(0.31,0.33,0.34),.0,.82)
M_ROAD=bpy.data.materials.get('V16_Road') or mat('V49_Road',(0.09,0.085,0.075),.0,.95)
M_ORE=bpy.data.materials.get('V35_AnimatedOre') or mat('V49_AnimatedOre',(0.18,0.105,0.035),0,.95)

def move_collection(o,c):
    for old in list(o.users_collection):
        old.objects.unlink(o)
    c.objects.link(o)

def box(name,loc,dims,ma,c=CIVIL):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    o=bpy.context.object;o.name=name;o.dimensions=dims
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(ma);move_collection(o,c)
    return o

def beam_between(name,a,b,width,height,ma,c=CONV):
    a=Vector(a);b=Vector(b);d=b-a;L=d.length
    if L < 1e-6: raise RuntimeError(f'Zero-length beam {name}')
    bpy.ops.mesh.primitive_cube_add(size=1,location=(a+b)*.5)
    o=bpy.context.object;o.name=name;o.dimensions=(L,width,height)
    o.rotation_mode='QUATERNION';o.rotation_quaternion=Vector((1,0,0)).rotation_difference(d.normalized())
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    o.data.materials.append(ma);move_collection(o,c)
    return o

def curve_path(name,pts,c=CONV,hidden=True):
    cu=bpy.data.curves.new(name+'_C','CURVE');cu.dimensions='3D';cu.path_duration=180
    sp=cu.splines.new('POLY');sp.points.add(len(pts)-1)
    for q,p in zip(sp.points,pts):q.co=(*p,1)
    o=bpy.data.objects.new(name,cu);c.objects.link(o)
    o.hide_render=hidden;o.hide_viewport=hidden
    return o

def conveyor(name,pts,width=1.9,ore_count=7):
    for i,(a,b) in enumerate(zip(pts[:-1],pts[1:]),1):
        beam_between(f'{name}_BELT_{i:02d}',a,b,width,.16,M_BELT)
        av=Vector(a);bv=Vector(b);d=bv-av
        side=Vector((-d.y,d.x,0.0))
        if side.length < 1e-6: side=Vector((0,1,0))
        side.normalize();off=side*(width*.52)
        za=av+Vector((0,0,.46));zb=bv+Vector((0,0,.46))
        beam_between(f'{name}_RAIL_L_{i:02d}',za+off,zb+off,.07,.07,M_ORANGE)
        beam_between(f'{name}_RAIL_R_{i:02d}',za-off,zb-off,.07,.07,M_ORANGE)
    # Trestles at interior path nodes down to a conservative local base.
    for i,p in enumerate(pts[1:-1],1):
        x,y,z=p;base=0.0 if x < 300 or y < 25 else 1.55
        h=max(.4,z-base-.15)
        box(f'{name}_TRESTLE_{i:02d}',(x,y,base+h*.5),(.22,2.5,h),M_STEEL,CONV)
    path=curve_path(f'{name}_PATH',pts,CONV,True)
    for j in range(ore_count):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.24,location=(0,0,0))
        ore=bpy.context.object;ore.name=f'{name}_ORE_{j+1:02d}';ore.scale=(1.7,1.0,.55);ore.data.materials.append(M_ORE);move_collection(ore,CONV)
        con=ore.constraints.new('FOLLOW_PATH');con.name='V49_BeltTravel';con.target=path;con.use_fixed_location=True;con.forward_axis='FORWARD_X';con.up_axis='UP_Z'
        drv=con.driver_add('offset_factor').driver;phase=int(j*180/ore_count)
        drv.expression=f'((frame+{phase})%180)/180.0'
    return path

# ------------------------------------------------------------------
# 1) Keep validated ROM/stockpile/truck geography. Move only front-end units.
# ------------------------------------------------------------------
apron=bpy.data.objects.get('APRON-FEEDER');crusher=bpy.data.objects.get('PRIMARY-CRUSHER')
if not apron or not crusher:raise RuntimeError('Missing APRON-FEEDER / PRIMARY-CRUSHER')
apron.location=(190.0,0.0,0.0)
crusher.location=(204.0,0.0,0.0)

# ------------------------------------------------------------------
# 2) Rigidly relocate the entire downstream process island. This exact frame
# preserves every local hierarchy, action, driver and intra-process connector.
# Mapping: (x,y,z) -> (334-x, 35-y, z+2).
# ------------------------------------------------------------------
frame=bpy.data.objects.new('V49_PROCESS_LAYOUT_FRAME',None);LAYOUT.objects.link(frame)
frame.location=(334.0,35.0,2.0);frame.rotation_mode='XYZ';frame.rotation_euler=(0,0,math.pi)
frame['layout_transform']='world = Rz(180deg)*legacy + (334,35,2)'

process_roots=['MILL-01','SUMP-01','SLURRY-PUMP-01','CLASS-01','R-01','R-02','R-03','R-04','PUMP-01','CIP-ADSORPTION','ELUTION-SKID','EW-CELLS','SMELTING-FURNACE']
for n in process_roots:
    o=bpy.data.objects.get(n)
    if not o:raise RuntimeError(f'Missing process root {n}')
    if o.parent is not None:raise RuntimeError(f'Unexpected parent on {n}: {o.parent.name}')
    o.parent=frame;o.matrix_parent_inverse=Matrix.Identity(4)

follow_collections=['V16_PIPING','V19_PIPE_DETAIL','V21_PIPE_BRIDGES','V23_PIPE_FIX','V25_PIPE_FINAL','V37_RECOVERY_PIPING','V39_PROCESS_CONNECTIONS','V39_RECOVERY_TRANSFER']
for cname in follow_collections:
    c=bpy.data.collections.get(cname)
    if not c:continue
    for o in list(c.objects):
        if o.parent is None:
            o.parent=frame;o.matrix_parent_inverse=Matrix.Identity(4)

# Pipe-rack corridor only; old roads/ROM/stock guards remain anchored to V48 civil layout.
infra=bpy.data.collections.get('V16_INFRA')
if infra:
    for o in list(infra.objects):
        if o.parent is None and (o.name.startswith('V16_RACK_') or o.name.startswith('V16_SHORT_RACK_')):
            o.parent=frame;o.matrix_parent_inverse=Matrix.Identity(4)

# Process animation proxies that were authored directly in world space.
for cname,prefixes in (
    ('V35_ANIMATION_VISUALS',('V35_ELUTION_','V35_EW_')),
    ('V40_ANIMATION_FIX',('V40_ELUTION_','V40_EW_')),
    ('V43_STRICT_ANIMATION_FIX',('V43_CLASS_SWIRL_',)),
):
    c=bpy.data.collections.get(cname)
    if not c:continue
    for o in list(c.objects):
        if o.parent is None and o.name.startswith(prefixes):
            o.parent=frame;o.matrix_parent_inverse=Matrix.Identity(4)

# ------------------------------------------------------------------
# 3) Remove obsolete bypass belts from the rendered layout and rebuild the
# logical solid-flow sequence ROM -> APRON -> CRUSHER -> CV-02 -> STOCKPILE
# -> CV-03 -> MILL.
# ------------------------------------------------------------------
legacy_prefixes=('V17_CONV_ROM_TO_STOCK','V17_CONV_STOCK_RECLAIM','V20_STACKER_FEED_CONV','V20_STACKER_BOOM')
for o in scene.objects:
    if o.name.startswith(legacy_prefixes) or o.name.startswith(('V35_CV-01_','V35_CV-02_','V35_CV-03_')):
        o.hide_render=True;o.hide_viewport=True

# ROM throat -> apron entry: gravity chute.
beam_between('V49_ROM_TO_APRON_CHUTE',(180.2,0,2.05),(185.75,0,1.42),1.85,.62,M_STEEL)

# Apron -> primary crusher: compact inclined transfer belt.
apron_crusher=[(194.2,0,1.38),(197.0,0,1.95),(200.2,0,2.85),(203.65,0,4.12)]
conveyor('V49_APRON_TO_CRUSHER',apron_crusher,1.55,5)

# Crusher discharge -> stockpile west/central pile.
cv2_pts=[(204.45,0,1.0),(214.0,.4,2.0),(225.5,.8,3.6),(237.0,1.0,5.2),(248.0,.5,6.8)]
cv2_path=conveyor('V49_CV02',cv2_pts,2.0,8)

# Stockpile reclaim hopper/feeder -> mill feed side on the new north row.
# Leave the reclaim feeder to the north before turning east.  The truck yard
# parks/loops around X~300,Y~8, so keeping the first leg west of X291 removes
# the haul-truck/conveyor conflict while preserving the reclaim discharge.
cv3_pts=[(287.1,10.2,1.25),(289.5,18.0,4.5),(294.0,25.0,6.4),(306.0,29.0,6.8),(321.0,32.0,6.5),(338.0,35.0,6.0)]
cv3_path=conveyor('V49_CV03',cv3_pts,2.0,9)

# Semantic conveyor controllers follow the actual V49 physical belts.
cv1=bpy.data.objects.get('CV-01');cv2=bpy.data.objects.get('CV-02');cv3=bpy.data.objects.get('CV-03')
if cv1:
    cv1['operational_component']=False;cv1['role']='legacy_bypass_disabled_v49';cv1['downstream']='APRON-FEEDER'
if cv2:
    cv2.location=(226.0,.8,3.7);cv2['belt_object']='V49_CV02_BELT_02';cv2['upstream']='PRIMARY-CRUSHER';cv2['downstream']='STOCKPILE-RECLAIM';cv2['animation']='V49_moving_ore_follow_path'
if cv3:
    cv3.location=(314.0,21.0,4.6);cv3['belt_object']='V49_CV03_BELT_03';cv3['upstream']='STOCKPILE-RECLAIM';cv3['downstream']='MILL-01';cv3['animation']='V49_moving_ore_follow_path'

# Explicit metadata for solid-flow nodes.
bpy.data.objects['ROM-HOPPER']['downstream']='APRON-FEEDER'
apron['upstream']='ROM-HOPPER';apron['downstream']='PRIMARY-CRUSHER'
crusher['upstream']='APRON-FEEDER';crusher['downstream']='CV-02'
bpy.data.objects['STOCKPILE-RECLAIM']['upstream']='CV-02';bpy.data.objects['STOCKPILE-RECLAIM']['downstream']='CV-03'
bpy.data.objects['MILL-01']['upstream']='CV-03';bpy.data.objects['MILL-01']['downstream']='SUMP-01'
for up,dn in (
    ('MILL-01','SUMP-01'),('SUMP-01','SLURRY-PUMP-01'),('SLURRY-PUMP-01','CLASS-01'),
    ('CLASS-01','R-01'),('R-01','R-02'),('R-02','R-03'),('R-03','R-04'),('R-04','PUMP-01'),
    ('PUMP-01','CIP-ADSORPTION'),('CIP-ADSORPTION','ELUTION-SKID'),
    ('ELUTION-SKID','EW-CELLS'),('EW-CELLS','SMELTING-FURNACE')
):
    bpy.data.objects[up]['downstream']=dn
    bpy.data.objects[dn]['upstream']=up

# Mill discharge -> sump inlet, at the transformed positions.
def xf(p):return (334.0-p[0],35.0-p[1],2.0+p[2])
mill_out=xf((-3.97,0.0,3.15))
sump_in=xf((9.45,.85,2.55))
cu=bpy.data.curves.new('V49_PIPE_MILL_TO_SUMP_C','CURVE');cu.dimensions='3D';cu.bevel_depth=.18;cu.bevel_resolution=4
sp=cu.splines.new('POLY');pts=[mill_out,(331.0,35.0,5.1),(327.0,35.4,4.8),sump_in];sp.points.add(len(pts)-1)
for q,p in zip(sp.points,pts):q.co=(*p,1)
pipe=bpy.data.objects.new('V49_PIPE_MILL_TO_SUMP',cu);CONV.objects.link(pipe);pipe.data.materials.append(bpy.data.materials.get('V16_ProcessPipe') or M_ORANGE)

# ------------------------------------------------------------------
# 4) Civil support for the relocated row. Three contiguous pads cover the
# equipment footprints; the access road runs outside the process/pipe-rack line.
# ------------------------------------------------------------------
box('V49_PAD_RECOVERY',(201.0,35.0,1.72),(51.0,11.0,.56),M_CONC)
box('V49_PAD_LEACH_CIP',(263.0,35.0,1.72),(70.0,11.0,.56),M_CONC)
# The mill's evaluated shell/trunnion envelope dips below its root plane while
# rotating (validated V48 behavior).  Use stepped equipment foundations so its
# moving envelope stays clear instead of burying it in one high slab.
box('V49_PAD_CLASS_PUMP',(306.5,35.0,1.72),(21.0,11.0,.56),M_CONC)
box('V49_PAD_SUMP',(322.0,35.0,1.25),(8.0,7.0,.40),M_CONC)
box('V49_PAD_MILL',(334.0,35.0,1.15),(11.5,8.5,.40),M_CONC)
box('V49_PROCESS_ACCESS_ROAD',(258.0,47.0,1.58),(174.0,5.6,.20),M_ROAD)

# Remove only loose decorative rocks that would poke through the new pads/road.
hidden_rocks=[]
for o in scene.objects:
    if not o.name.startswith('V26_BACK_CLUSTER_'):continue
    p=o.matrix_world.translation
    if 174.0 <= p.x <= 342.0 and 28.5 <= p.y <= 50.0:
        o.hide_render=True;o.hide_viewport=True;hidden_rocks.append(o.name)

scene.frame_set(1);bpy.context.view_layer.update()
scene['PULPA_LAB_MASTER_VERSION']='V50'
scene['PULPA_LAB_V50_BASE']='V48 preserved environment/topography/civil/animations'
scene['PULPA_LAB_V50_NOTES']='V48-base circuit position correction only: all validated terrain/topography/embankment/road/drain/civil collections are preserved in place; ROM/stockpile/trucks retained; APRON moved to X190 and PRIMARY to X204; MILL->SMELTING process island rigidly rotated 180deg into north row via compatibility node V49_PROCESS_LAYOUT_FRAME (334,35,2), preserving hierarchy/animation/connectivity. Only obsolete bypass conveyors are hidden and corrected circuit transfers/pads/access road are added.'
scene['PULPA_LAB_V50_HIDDEN_ROCKS']=len(hidden_rocks)
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print('V50_SAVED',OUT,'OBJECTS',len(scene.objects),'HIDDEN_ROCKS',len(hidden_rocks))
print('FRAME',tuple(round(float(v),3) for v in frame.location),tuple(round(float(v),3) for v in frame.rotation_euler))
