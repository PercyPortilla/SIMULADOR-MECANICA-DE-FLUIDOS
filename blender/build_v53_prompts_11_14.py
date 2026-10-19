import bpy, math
from mathutils import Vector

EXPECTED='V52'
OUT=r'C:\Users\USER\OneDrive\Desktop\CHATON\pulpa-v31-babylon\blender\PULPA_LAB_BLENDER_MASTER_V53.blend'
scene=bpy.context.scene
if scene.get('PULPA_LAB_MASTER_VERSION') != EXPECTED:
    raise RuntimeError(f'V53 requires {EXPECTED}, got {scene.get("PULPA_LAB_MASTER_VERSION")!r}')


def ensure_collection(name,parent=None):
    c=bpy.data.collections.get(name)
    if c is None: c=bpy.data.collections.new(name)
    owner=parent if parent is not None else scene.collection
    if c.name not in owner.children: owner.children.link(c)
    return c


org=bpy.data.collections.get('V51_ORGANIZED') or scene.collection
pit_root=bpy.data.collections.get('V51_02_OPEN_PIT_TODO')
if pit_root:
    pit_root.name='V53_12_OPEN_PIT'
else:
    pit_root=ensure_collection('V53_12_OPEN_PIT',org)

COL_CLEAN=ensure_collection('V53_11_PIPING_CLEANUP',bpy.data.collections.get('V51_50_PROCESS_PIPING_UTILITIES') or org)
COL_PIT=ensure_collection('V53_12_PIT_GEOMETRY',pit_root)
COL_RAMP=ensure_collection('V53_13_PIT_RAMP',pit_root)
COL_OPS=ensure_collection('V53_14_PIT_OPERATIONS',pit_root)


def mat(name,color,metal=0.0,rough=.8):
    m=bpy.data.materials.get(name)
    if m is None:
        m=bpy.data.materials.new(name); m.use_nodes=True
        bs=m.node_tree.nodes.get('Principled BSDF')
        if bs:
            bs.inputs['Base Color'].default_value=(*color,1)
            bs.inputs['Metallic'].default_value=metal
            bs.inputs['Roughness'].default_value=rough
    return m


M_EARTH=bpy.data.materials.get('V16_Earth') or mat('V53_Earth',(0.24,.12,.055),0,.95)
M_ROCK=bpy.data.materials.get('V22_Rock') or mat('V53_Rock',(.18,.14,.11),0,.98)
M_ROAD=bpy.data.materials.get('V16_Road') or mat('V53_Road',(.075,.07,.065),0,.94)
M_FILL=bpy.data.materials.get('V28_RoadFill') or mat('V53_RoadFill',(.19,.14,.095),0,.95)
M_ORE=bpy.data.materials.get('MAT_ROM_Ore') or mat('V53_Ore',(.15,.085,.035),0,.98)
M_STEEL=bpy.data.materials.get('V16_Steel') or mat('V53_Steel',(.18,.20,.22),.55,.45)


def hide(name,reason):
    o=bpy.data.objects.get(name)
    if o:
        o.hide_render=True; o.hide_viewport=True; o['v53_hidden_reason']=reason


# ---------------------------------------------------------------------------
# Prompt 11 — piping cleanup.
# Keep V19/V25/V52 as the visual authority and hide exact older duplicates or
# ambiguous legacy branches. Nothing is deleted, so rollback remains possible.
# ---------------------------------------------------------------------------
for n in ('V16_UTILITY_AIR_HEADER','V16_UTILITY_WATER_HEADER'):
    hide(n,'Superseded by longer V19 utility headers in the same corridor')
wash=bpy.data.objects.get('V16_UTILITY_WASH_WATER')
if wash: wash['v53_role']='distinct_wash_water_utility_retained'
for n in ('V23_UTILITY_DROP_01','V23_UTILITY_DROP_02','V23_UTILITY_DROP_03','V23_UTILITY_DROP_04'):
    hide(n,'Exact duplicate of V25 utility drop retained as authoritative')
hide('V25_BRANCH_LEACH_OVERFLOW','Ambiguous legacy branch at R-01 overflow; V39 sequential reactor transfer is authoritative')
for n in ('V19_HEADER_AIR','V19_HEADER_CHEM','V19_HEADER_PROCESS','V19_HEADER_WATER',
          'V25_UTILITY_DROP_01','V25_UTILITY_DROP_02','V25_UTILITY_DROP_03','V25_UTILITY_DROP_04'):
    o=bpy.data.objects.get(n)
    if o: o['v53_role']='authoritative_utility_header_or_drop'
for n in ('V52_PIPE_MILL_TO_SUMP','V52_PIPE_SUMP_TO_SLURRY_PUMP','V52_PIPE_SLURRY_PUMP_TO_CLASS',
          'V52_PIPE_CLASS_OVERFLOW_TO_R01','V52_PIPE_CLASS_UNDERFLOW_TO_MILL','V39_PIPE_R01_TO_R02',
          'V39_PIPE_R02_TO_R03','V39_PIPE_R03_TO_R04','V37_PIPE_R04_TO_PUMP','V52_PIPE_PUMP_TO_CIP',
          'V52_PIPE_CIP_TO_ELUTION','V52_PIPE_ELUTION_TO_EW'):
    o=bpy.data.objects.get(n)
    if o: o['v53_role']='authoritative_main_process_line'


# ---------------------------------------------------------------------------
# Prompt 12 — open-pit base. The pit is placed south-east of the plant, tied to
# the existing haul road end around x~365/y~-30, without moving V52 equipment.
# ---------------------------------------------------------------------------
CX,CY=355.0,-78.0
N=72

def irregular_xy(rx,ry,a,phase=0.0):
    f=1.0 + .028*math.sin(3*a+phase) + .016*math.sin(7*a-.4) + .010*math.sin(11*a+.7)
    return CX+rx*f*math.sin(a), CY+ry*f*math.cos(a)

def band(name,outer,inner,material,col=COL_PIT,phase=.0):
    rox,roy,zo=outer; rix,riy,zi=inner
    verts=[]
    for i in range(N):
        a=2*math.pi*i/N
        x,y=irregular_xy(rox,roy,a,phase); verts.append((x,y,zo))
    for i in range(N):
        a=2*math.pi*i/N
        x,y=irregular_xy(rix,riy,a,phase+.11); verts.append((x,y,zi))
    faces=[]
    for i in range(N):
        j=(i+1)%N
        faces.append((i,j,N+j,N+i))
    me=bpy.data.meshes.new(name+'_M'); me.from_pydata(verts,[],faces); me.update()
    o=bpy.data.objects.new(name,me); col.objects.link(o); o.data.materials.append(material); o['v53_open_pit']=True
    return o

def floor_disk(name,rx,ry,z,material,col=COL_PIT):
    verts=[(CX,CY,z-.05)]
    for i in range(N):
        a=2*math.pi*i/N; x,y=irregular_xy(rx,ry,a,.23); verts.append((x,y,z))
    faces=[]
    for i in range(N): faces.append((0,1+i,1+((i+1)%N)))
    me=bpy.data.meshes.new(name+'_M');me.from_pydata(verts,[],faces);me.update()
    o=bpy.data.objects.new(name,me);col.objects.link(o);o.data.materials.append(material);o['v53_open_pit']=True;return o

# Surrounding collar + alternating slope/berm rings.
bands=[
    ('V53_PIT_COLLAR',(68,58,-1.00),(58,48,-1.15),M_FILL),
    ('V53_PIT_FACE_01',(58,48,-1.15),(52,42,-4.00),M_ROCK),
    ('V53_PIT_BERM_01',(52,42,-4.00),(47,37,-4.00),M_EARTH),
    ('V53_PIT_FACE_02',(47,37,-4.00),(42,32,-7.00),M_ROCK),
    ('V53_PIT_BERM_02',(42,32,-7.00),(37,27,-7.00),M_EARTH),
    ('V53_PIT_FACE_03',(37,27,-7.00),(32,22,-10.00),M_ROCK),
    ('V53_PIT_BERM_03',(32,22,-10.00),(27,18,-10.00),M_EARTH),
    ('V53_PIT_FACE_04',(27,18,-10.00),(22,14,-13.00),M_ROCK),
    ('V53_PIT_BERM_04',(22,14,-13.00),(18,12,-13.00),M_EARTH),
    ('V53_PIT_FACE_05',(18,12,-13.00),(15,9,-16.00),M_ROCK),
]
for idx,(name,o,i,m) in enumerate(bands): band(name,o,i,m,phase=.08*idx)
floor_disk('V53_PIT_BOTTOM',15,9,-16.0,M_EARTH)

# Toe/brow visual markers make benches readable in web view.
def loop_curve(name,rx,ry,z,material,bevel=.09,col=COL_PIT,phase=0.0):
    cu=bpy.data.curves.new(name+'_C','CURVE');cu.dimensions='3D';cu.bevel_depth=bevel;cu.bevel_resolution=2
    sp=cu.splines.new('POLY');sp.points.add(N)
    for i in range(N):
        a=2*math.pi*i/N;x,y=irregular_xy(rx,ry,a,phase);sp.points[i].co=(x,y,z,1)
    x,y=irregular_xy(rx,ry,0,phase);sp.points[N].co=(x,y,z,1);sp.use_cyclic_u=False
    o=bpy.data.objects.new(name,cu);col.objects.link(o);o.data.materials.append(material);o['v53_open_pit']=True;return o
for k,(rx,ry,z) in enumerate(((58,48,-1.02),(52,42,-3.92),(42,32,-6.92),(32,22,-9.92),(22,14,-12.92)),1):
    loop_curve(f'V53_PIT_BROW_{k:02d}',rx,ry,z,M_EARTH,.10,phase=.05*k)


# ---------------------------------------------------------------------------
# Prompt 13 — continuous 9 m haul ramp. Spiral descends ~15 m over >250 m,
# giving a plausible operating grade while visually following pit walls.
# ---------------------------------------------------------------------------
def ramp_center(t):
    # 1.25 turns, starting near existing main haul road east end.
    a=.18 + t*(2.48*math.pi)
    rx=54.0-(54.0-14.0)*t
    ry=45.0-(45.0-8.0)*t
    x=CX+rx*math.sin(a);y=CY+ry*math.cos(a);z=-1.18-14.55*t
    return Vector((x,y,z))

RPTS=58; halfw=4.5
centers=[ramp_center(i/(RPTS-1)) for i in range(RPTS)]
verts=[]
for i,p in enumerate(centers):
    p0=centers[max(0,i-1)];p1=centers[min(RPTS-1,i+1)]
    t=(p1-p0); lateral=Vector((-t.y,t.x,0)); lateral.normalize()
    verts.append(tuple(p+lateral*halfw));verts.append(tuple(p-lateral*halfw))
faces=[(2*i,2*i+2,2*i+3,2*i+1) for i in range(RPTS-1)]
me=bpy.data.meshes.new('V53_PIT_RAMP_M');me.from_pydata(verts,[],faces);me.update()
ramp=bpy.data.objects.new('V53_PIT_RAMP_9M',me);COL_RAMP.objects.link(ramp);ramp.data.materials.append(M_ROAD)
ramp['width_m']=9.0;ramp['v53_open_pit']=True;ramp['start_tie']='V16_MAIN_HAUL_ROAD east end'

def polyline(name,pts,matl,bevel,col=COL_RAMP):
    cu=bpy.data.curves.new(name+'_C','CURVE');cu.dimensions='3D';cu.bevel_depth=bevel;cu.bevel_resolution=2
    sp=cu.splines.new('POLY');sp.points.add(len(pts)-1)
    for q,p in zip(sp.points,pts):q.co=(*p,1)
    o=bpy.data.objects.new(name,cu);col.objects.link(o);o.data.materials.append(matl);return o

left=[];right=[]
for i,p in enumerate(centers):
    p0=centers[max(0,i-1)];p1=centers[min(RPTS-1,i+1)];t=p1-p0;lat=Vector((-t.y,t.x,0));lat.normalize()
    left.append(p+lat*(halfw-.25)+Vector((0,0,.16)));right.append(p-lat*(halfw-.25)+Vector((0,0,.16)))
polyline('V53_PIT_RAMP_BERM_L',left,M_FILL,.16)
polyline('V53_PIT_RAMP_BERM_R',right,M_FILL,.16)

# Tie road from existing haul route endpoint to ramp mouth.
tie=[Vector((365.0,-29.0,-1.18)),Vector((366.0,-31.5,-1.18)),centers[0]]
verts=[]
for i,p in enumerate(tie):
    p0=tie[max(0,i-1)];p1=tie[min(len(tie)-1,i+1)];t=p1-p0;lat=Vector((-t.y,t.x,0));lat.normalize()
    verts.extend([tuple(p+lat*4.5),tuple(p-lat*4.5)])
faces=[(0,2,3,1),(2,4,5,3)]
me=bpy.data.meshes.new('V53_PIT_RAMP_TIE_M');me.from_pydata(verts,[],faces);me.update()
tie_o=bpy.data.objects.new('V53_PIT_RAMP_TIE_TO_MAIN_HAUL',me);COL_RAMP.objects.link(tie_o);tie_o.data.materials.append(M_ROAD)


# ---------------------------------------------------------------------------
# Prompt 14 — operating pads + static mine equipment copies.
# ---------------------------------------------------------------------------
def box(name,loc,dims,material,col=COL_OPS):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=dims
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for c in list(o.users_collection):c.objects.unlink(o)
    col.objects.link(o);o.data.materials.append(material);o['v53_open_pit']=True;return o

def pad_fill(name,loc,top_dims,top_z,bottom_z,material=M_EARTH):
    # Trapezoidal earth support: platforms read as widened mine benches rather
    # than unsupported slabs cantilevering into the pit.
    x,y=loc;tx,ty=top_dims;dz=top_z-bottom_z
    bx,by=tx+2.0*dz*.65,ty+2.0*dz*.65
    verts=[
        (x-tx/2,y-ty/2,top_z),(x+tx/2,y-ty/2,top_z),(x+tx/2,y+ty/2,top_z),(x-tx/2,y+ty/2,top_z),
        (x-bx/2,y-by/2,bottom_z),(x+bx/2,y-by/2,bottom_z),(x+bx/2,y+by/2,bottom_z),(x-bx/2,y+by/2,bottom_z),
    ]
    faces=[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)]
    me=bpy.data.meshes.new(name+'_M');me.from_pydata(verts,[],faces);me.update()
    o=bpy.data.objects.new(name,me);COL_OPS.objects.link(o);o.data.materials.append(material);o['v53_open_pit']=True;return o

# Pads deliberately sit on/near bench elevations and widen working areas.
pad_fill('V53_PAD_DRILLING_FILL',(384.0,-56.0),(24.0,14.0),-3.99,-6.75)
pad_fill('V53_PAD_LOADING_FILL',(329.0,-78.0),(24.0,16.0),-9.99,-12.75)
box('V53_PAD_DRILLING',(384.0,-56.0,-3.88),(24.0,14.0,.22),M_FILL)
box('V53_PAD_LOADING',(329.0,-78.0,-9.88),(24.0,16.0,.24),M_FILL)
box('V53_PAD_MANEUVER',(355.0,-82.0,-15.88),(24.0,14.0,.24),M_FILL)

# Safety berms on exposed pad edges.
for name,loc,dims in [
 ('V53_PAD_DRILL_BERM',(384,-63.0,-3.48),(24,.65,.75)),
 ('V53_PAD_LOAD_BERM',(317.0,-78.0,-9.48),(.70,16,.75)),
 ('V53_PAD_MAN_BERM',(355,-89.0,-15.48),(24,.65,.75)),
]: box(name,loc,dims,M_EARTH)

# Drill-hole collar pattern (visual training cue).
for ix in range(4):
    for iy in range(3):
        x=378.5+ix*3.6;y=-60.0+iy*3.6
        bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=.18,depth=.10,location=(x,y,-3.70))
        o=bpy.context.object;o.name=f'V53_DRILL_COLLAR_{ix+1}_{iy+1}'
        for c in list(o.users_collection):c.objects.unlink(o)
        COL_OPS.objects.link(o);o.data.materials.append(M_ROCK);o['v53_open_pit']=True

def duplicate_hierarchy(root_name,new_prefix,new_location,zrot=0.0):
    root=bpy.data.objects.get(root_name)
    if root is None:return None
    originals=[root]+list(root.children_recursive)
    mapping={}
    for old in originals:
        new=old.copy();new.data=old.data
        new.name=new_prefix+old.name[len(root_name):]
        if new.animation_data:new.animation_data_clear()
        COL_OPS.objects.link(new);mapping[old]=new
    for old,new in mapping.items():
        if old.parent in mapping:new.parent=mapping[old.parent]
        else:new.parent=None
        new.matrix_parent_inverse=old.matrix_parent_inverse.copy();new.matrix_basis=old.matrix_basis.copy()
        new.hide_render=False;new.hide_viewport=False;new['v53_static_pit_copy']=True
    nr=mapping[root];nr.location=new_location;nr.rotation_euler.z+=zrot
    return nr

# Preserve original animated fleet; add static operating copies for the new pit.
duplicate_hierarchy('EXCAVATOR-01','V53_PIT_EXCAVATOR',(329.0,-78.0,-10.06),math.radians(105))
duplicate_hierarchy('TRUCK-02','V53_PIT_TRUCK_A',(341.0,-82.0,-16.05),math.radians(15))
duplicate_hierarchy('TRUCK-03','V53_PIT_TRUCK_B',(362.0,-82.0,-16.05),math.radians(195))

# Small ore windrow at loading pad.
for i,(dx,dy,s) in enumerate(((-3,4,1.2),(0,4.5,1.5),(3.2,3.7,1.0)),1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1.0,location=(329+dx,-78+dy,-9.15))
    o=bpy.context.object;o.name=f'V53_LOADING_ORE_PILE_{i:02d}';o.scale=(2.4*s,1.7*s,.8*s)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for c in list(o.users_collection):c.objects.unlink(o)
    COL_OPS.objects.link(o);o.data.materials.append(M_ORE);o['v53_open_pit']=True


scene['PULPA_LAB_MASTER_VERSION']='V53'
scene['PULPA_LAB_V53_BASE']='V52 prompts 5-10 preserved'
scene['PULPA_LAB_V53_SCOPE']='Prompts 11-14: piping cleanup + open pit + 9m ramp + operating pads/equipment'
scene['PULPA_LAB_V53_PIT_CENTER']=(CX,CY)
scene['PULPA_LAB_V53_PIT_DEPTH_M']=15.0
scene['PULPA_LAB_V53_NOTES']=(
 'Legacy duplicate headers/drops are hidden, not deleted. Main process piping from V52 is untouched. '
 'Open pit added south-east of plant with five slope faces, four berm levels, bottom floor and irregular geometry. '
 'Continuous 9 m spiral ramp ties to east end of existing haul road. Drilling/loading/maneuver pads plus static linked copies of excavator and two trucks added; original animated fleet remains unchanged.'
)
scene.frame_set(1);bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print('V53_SAVED',OUT,'OBJECTS',len(scene.objects),'PIT',len(COL_PIT.objects),'RAMP',len(COL_RAMP.objects),'OPS',len(COL_OPS.objects))
