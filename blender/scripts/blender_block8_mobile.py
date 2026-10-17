import bpy
import math
import os
from mathutils import Vector

col = bpy.data.collections.get("MINE_EQUIPMENT")
if col is None:
    raise RuntimeError("MINE_EQUIPMENT collection missing.")

PREFIXES = ("HAUL-TRUCK", "MINING-SHOVEL", "WHEEL-LOADER")
for obj in list(bpy.data.objects):
    if any(obj.name == p or obj.name.startswith(p + "_") for p in PREFIXES):
        bpy.data.objects.remove(obj, do_unlink=True)
for action in list(bpy.data.actions):
    if any(action.name.startswith(p.replace("-", "_")) for p in PREFIXES):
        bpy.data.actions.remove(action)

def ensure_mat(name, color, metallic=0.0, roughness=.5):
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes=True
    bsdf=next((n for n in m.node_tree.nodes if n.type=="BSDF_PRINCIPLED"),None)
    if bsdf:
        for s in bsdf.inputs:
            if s.name=="Base Color": s.default_value=(*color,1)
            elif s.name=="Metallic": s.default_value=metallic
            elif s.name=="Roughness": s.default_value=roughness
    return m

YELLOW=ensure_mat("MAT_Mining_Yellow",(.78,.43,.045),.36,.42)
DARK=ensure_mat("MAT_Mobile_Dark",(.07,.085,.09),.64,.42)
TIRE=ensure_mat("MAT_Mining_Tire",(.018,.022,.024),.02,.92)
RIM=ensure_mat("MAT_Wheel_Rim",(.34,.37,.38),.76,.30)
GLASS=ensure_mat("MAT_Cab_Glass",(.055,.18,.22),.08,.18)
STEEL=bpy.data.materials["MAT_Steel_Dark"]
LIGHT=bpy.data.materials["MAT_Steel_Light"]
ORANGE=bpy.data.materials["MAT_Safety_Orange"]
ORE=bpy.data.materials.get("MAT_ROM_Ore") or bpy.data.materials["MAT_Slurry"]

def move(o):
    for c in list(o.users_collection): c.objects.unlink(o)
    col.objects.link(o)
def setmat(o,m):
    if hasattr(o.data,"materials"):
        o.data.materials.clear();o.data.materials.append(m)
def box(name,loc,dims,m,rot=(0,0,0),bw=.04):
    bpy.ops.mesh.primitive_cube_add(location=loc,rotation=rot)
    o=bpy.context.object;o.name=name;o.dimensions=dims
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bw:
        mod=o.modifiers.new("EdgeSoftening","BEVEL");mod.width=bw;mod.segments=2
    setmat(o,m);move(o);return o
def cyl(name,loc,r,d,m,axis="Z",verts=36):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=d,location=loc)
    o=bpy.context.object;o.name=name
    if axis=="X":o.rotation_euler[1]=math.pi/2
    elif axis=="Y":o.rotation_euler[0]=math.pi/2
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    setmat(o,m);move(o);return o
def torus(name,loc,major,minor,m,axis="Y"):
    bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=36,minor_segments=12,location=loc)
    o=bpy.context.object;o.name=name
    if axis=="X":o.rotation_euler[1]=math.pi/2
    elif axis=="Y":o.rotation_euler[0]=math.pi/2
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    setmat(o,m);move(o);return o
def pipe(name,a,b,r,m):
    a,b=Vector(a),Vector(b);v=b-a;mid=(a+b)*.5
    bpy.ops.mesh.primitive_cylinder_add(vertices=18,radius=r,depth=v.length,location=mid)
    o=bpy.context.object;o.name=name;o.rotation_mode="QUATERNION";o.rotation_quaternion=v.to_track_quat("Z","Y")
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    setmat(o,m);move(o);return o
def parent(o,r):
    bpy.context.view_layer.update()
    mw=o.matrix_world.copy();o.parent=r;o.matrix_world=mw
    bpy.context.view_layer.update()
def empty(name,loc,parent_obj=None):
    o=bpy.data.objects.new(name,None);col.objects.link(o);o.location=loc;o.empty_display_type="PLAIN_AXES"
    if parent_obj: parent(o,parent_obj)
    return o
def root(name,loc,dims):
    o=empty(name,loc);o["dimensions_m"]=dims;o["web_asset"]=True;return o
def wheel(name,center,radius,width,parent_obj):
    spin=empty(name,center,parent_obj)
    tire=cyl(name+"_TIRE",center,radius,width,TIRE,axis="Y",verts=40);parent(tire,spin)
    hub=cyl(name+"_HUB",center,radius*.38,width*1.04,RIM,axis="Y",verts=28);parent(hub,spin)
    # tread blocks, sparse enough for web use
    for i in range(16):
        a=i/16*math.tau
        x=center[0]+math.cos(a)*radius
        z=center[2]+math.sin(a)*radius
        # Radial thickness is deliberately small; the older dimensions placed the
        # long tread axis radially and buried the tyre ~0.18 m below the datum.
        tread=box(f"{name}_TREAD_{i+1:02d}",(x,center[1],z),(.06,width*1.06,radius*.24),TIRE,rot=(0,-a,0),bw=.012);parent(tread,spin)
    return spin
def export_root(r,filename):
    old=r.matrix_world.copy();r.location=(0,0,0);bpy.context.view_layer.update()
    bpy.ops.object.select_all(action="DESELECT");r.select_set(True)
    for c in r.children_recursive:c.select_set(True)
    bpy.context.view_layer.objects.active=r
    outdir=os.path.join(os.path.expanduser("~"),"OneDrive","Desktop","CHATON","PULPA_LAB_GLBS");os.makedirs(outdir,exist_ok=True)
    path=os.path.join(outdir,filename)
    bpy.ops.export_scene.gltf(filepath=path,export_format="GLB",use_selection=True,export_cameras=False,export_lights=False,
        export_extras=True,export_animations=True,export_animation_mode="ACTIVE_ACTIONS",export_yup=True,export_apply=False,
        export_force_sampling=False,
        export_optimize_animation_size=True)
    r.matrix_world=old;bpy.context.view_layer.update();return path

# ===========================================================================
# HAUL TRUCK 90–100 t — semantic joints controlled by Three.js route logic.
# ===========================================================================
truck=root("HAUL-TRUCK",(300,0,0),"10.0 x 5.25 x 5.05")
truck["semantic_control"]="Three.js drives dump, steering and wheel rotation"
tx=300

chassis=box("HAUL-TRUCK_CHASSIS",(tx,0,1.50),(8.6,4.5,.62),DARK,bw=.08);parent(chassis,truck)
engine=box("HAUL-TRUCK_ENGINE_DECK",(tx+3.0,0,2.35),(2.65,4.15,1.35),YELLOW,bw=.12);parent(engine,truck)
grille=box("HAUL-TRUCK_RADIATOR",(tx+4.34,0,2.35),(.18,3.45,1.02),DARK,bw=.03);parent(grille,truck)
cab=box("HAUL-TRUCK_CAB",(tx+2.35,-1.38,3.45),(2.05,1.75,2.35),YELLOW,bw=.12);parent(cab,truck)
wind=box("HAUL-TRUCK_WINDSHIELD",(tx+3.40,-1.38,3.65),(.08,1.45,1.25),GLASS,rot=(0,math.radians(-5),0),bw=.02);parent(wind,truck)
deck=box("HAUL-TRUCK_FRONT_DECK",(tx+3.25,0,4.05),(2.45,4.75,.12),STEEL,bw=.02);parent(deck,truck)

# Dump body pivot at rear hinge. The node name is used by Three.js semantic adapter.
dump=empty("HAUL-TRUCK_DUMP_PIVOT",(tx-2.70,0,2.48),truck)
floor=box("HAUL-TRUCK_DUMP_FLOOR",(tx-.95,0,2.80),(5.85,4.85,.34),YELLOW,rot=(0,math.radians(-3),0),bw=.06);parent(floor,dump)
for side in (-1,1):
    wall=box(f"HAUL-TRUCK_DUMP_WALL_{'L' if side<0 else 'R'}",(tx-.95,side*2.42,3.60),(5.95,.28,1.95),YELLOW,rot=(0,math.radians(-5),side*math.radians(4)),bw=.05);parent(wall,dump)
front=box("HAUL-TRUCK_DUMP_FRONT",(tx+1.88,0,3.75),(.30,4.95,2.05),YELLOW,rot=(0,math.radians(-6),0),bw=.05);parent(front,dump)
ore=box("HAUL-TRUCK_ORE_LOAD",(tx-.90,0,3.55),(4.65,4.35,.76),ORE,bw=.16);parent(ore,dump)
for i in range(6):
    x=tx-3.0+i*.90
    rib=box(f"HAUL-TRUCK_DUMP_RIB_{i+1:02d}",(x,-2.58,3.48),(.10,.12,1.4),DARK,bw=.01);parent(rib,dump)
    rib2=box(f"HAUL-TRUCK_DUMP_RIB_R_{i+1:02d}",(x,2.58,3.48),(.10,.12,1.4),DARK,bw=.01);parent(rib2,dump)

# Hydraulic hoists.
for side in (-1,1):
    h=pipe(f"HAUL-TRUCK_HOIST_{side}",(tx-.6,side*1.05,1.85),(tx-2.0,side*1.05,3.15),.16,LIGHT);parent(h,truck)

# Six wheel positions. Front wheels have steer parents; all have spin children.
wheel_specs=[
    ("FL",(tx+2.85,-2.26,1.42),True,.78),
    ("FR",(tx+2.85, 2.26,1.42),True,.78),
    ("RL1",(tx-2.35,-2.08,1.42),False,.56),
    ("RL2",(tx-2.35,-2.57,1.42),False,.56),
    ("RR1",(tx-2.35, 2.08,1.42),False,.56),
    ("RR2",(tx-2.35, 2.57,1.42),False,.56),
]
for code,center,is_front,width in wheel_specs:
    if is_front:
        steer=empty(f"HAUL-TRUCK_WHEEL_STEER_{code}",center,truck)
        spin=wheel(f"HAUL-TRUCK_WHEEL_SPIN_{code}",center,1.42,width,steer)
    else:
        spin=wheel(f"HAUL-TRUCK_WHEEL_SPIN_{code}",center,1.42,width,truck)

# Handrails/exhaust.
for y in (-2.25,2.25):
    rail=pipe(f"HAUL-TRUCK_RAIL_{y}",(tx+2.2,y,4.75),(tx+4.25,y,4.75),.035,ORANGE);parent(rail,truck)
exhaust=pipe("HAUL-TRUCK_EXHAUST",(tx+1.25,1.58,2.8),(tx+1.25,1.58,4.55),.10,STEEL);parent(exhaust,truck)

# ===========================================================================
# MINING SHOVEL — baked 20 s mechanical cycle.
# ===========================================================================
shovel=root("MINING-SHOVEL",(0,0,0),"9.9 x 8.0 x 8.1")
sx=0

for side,y in (("L",-3.15),("R",3.15)):
    frame=box(f"MINING-SHOVEL_TRACK_FRAME_{side}",(sx, y,.75),(6.9,1.35,1.10),DARK,bw=.08);parent(frame,shovel)
    for i in range(14):
        shoe=box(f"MINING-SHOVEL_TRACK_SHOE_{side}_{i+1:02d}",(sx-3.15+i*.485,y,.15),(.42,1.46,.14),STEEL,bw=.012);parent(shoe,shovel)
    for i in range(7):
        roll=cyl(f"MINING-SHOVEL_ROLLER_{side}_{i+1:02d}",(sx-2.65+i*.88,y,.62),.26,1.42,STEEL,axis="Y",verts=20);parent(roll,shovel)

carbody=box("MINING-SHOVEL_CARBODY",(sx-.25,0,1.60),(5.6,5.8,.8),DARK,bw=.08);parent(carbody,shovel)
slew=cyl("MINING-SHOVEL_SLEW_RING",(sx-.35,0,2.15),1.75,.50,STEEL,verts=36);parent(slew,shovel)

upper=empty("MINING-SHOVEL_UPPER",(sx-.35,0,2.35),shovel)
house=box("MINING-SHOVEL_HOUSE",(sx-1.40,0,3.80),(4.8,4.8,2.55),YELLOW,bw=.14);parent(house,upper)
counter=box("MINING-SHOVEL_COUNTERWEIGHT",(sx-3.30,0,3.75),(2.2,4.95,2.2),YELLOW,bw=.18);parent(counter,upper)
cab=box("MINING-SHOVEL_CAB",(sx+.65,-2.40,4.70),(1.55,1.65,2.0),YELLOW,bw=.10);parent(cab,upper)
glass=box("MINING-SHOVEL_WINDSHIELD",(sx+1.45,-2.40,4.80),(.06,1.30,1.2),GLASS,bw=.015);parent(glass,upper)

boom=empty("MINING-SHOVEL_BOOM_PIVOT",(sx+1.10,0,3.75),upper)
boom_mesh=box("MINING-SHOVEL_BOOM",(sx+3.65,0,3.75),(5.4,1.05,.70),YELLOW,bw=.08);parent(boom_mesh,boom)
for y in (-.52,.52):
    web=pipe(f"MINING-SHOVEL_BOOM_WEB_{y}",(sx+1.2,y,3.47),(sx+6.1,y,4.03),.07,DARK);parent(web,boom)
stick=empty("MINING-SHOVEL_STICK_PIVOT",(sx+6.20,0,3.75),boom)
stick_mesh=box("MINING-SHOVEL_STICK",(sx+8.03,0,3.75),(3.9,.86,.58),YELLOW,bw=.07);parent(stick_mesh,stick)
bucket=empty("MINING-SHOVEL_BUCKET_PIVOT",(sx+9.85,0,3.75),stick)
bucket_body=box("MINING-SHOVEL_BUCKET",(sx+10.65,0,3.10),(2.25,4.25,1.85),LINER if 'LINER' in globals() else STEEL,rot=(0,math.radians(-15),0),bw=.10);parent(bucket_body,bucket)
bore=box("MINING-SHOVEL_BUCKET_ORE",(sx+10.55,0,3.55),(1.45,3.6,.70),ORE,bw=.12);parent(bore,bucket)
boomc=pipe("MINING-SHOVEL_BOOM_CYL",(sx+1.3,-.70,4.0),(sx+3.8,-.70,5.05),.16,LIGHT);parent(boomc,boom)
stickc=pipe("MINING-SHOVEL_STICK_CYL",(sx+3.8,.58,4.2),(sx+7.0,.58,4.0),.13,LIGHT);parent(stickc,boom)

# Baked motions: one 20 s cycle at 30 fps.
frames=[1,150,300,450,600]
upper_vals=[math.radians(-26),math.radians(12),math.radians(35),math.radians(5),math.radians(-26)]
boom_vals=[math.radians(-22),math.radians(-35),math.radians(-28),math.radians(-18),math.radians(-22)]
stick_vals=[math.radians(48),math.radians(30),math.radians(22),math.radians(42),math.radians(48)]
bucket_vals=[math.radians(22),math.radians(-20),math.radians(-36),math.radians(8),math.radians(22)]
for f,v in zip(frames,upper_vals):
    upper.rotation_euler.z=v;upper.keyframe_insert(data_path="rotation_euler",frame=f,index=2)
for f,v in zip(frames,boom_vals):
    boom.rotation_euler.y=v;boom.keyframe_insert(data_path="rotation_euler",frame=f,index=1)
for f,v in zip(frames,stick_vals):
    stick.rotation_euler.y=v;stick.keyframe_insert(data_path="rotation_euler",frame=f,index=1)
for f,v in zip(frames,bucket_vals):
    bucket.rotation_euler.y=v;bucket.keyframe_insert(data_path="rotation_euler",frame=f,index=1)
for obj,name in [(upper,"MINING_SHOVEL_Slew"),(boom,"MINING_SHOVEL_Boom"),(stick,"MINING_SHOVEL_Stick"),(bucket,"MINING_SHOVEL_Bucket")]:
    if obj.animation_data and obj.animation_data.action: obj.animation_data.action.name=name

# ===========================================================================
# WHEEL LOADER — baked 32 s mechanical cycle.
# ===========================================================================
loader=root("WHEEL-LOADER",(0,0,0),"12.0 x 3.75 x 4.25")
lx=0
rear=empty("WHEEL-LOADER_REAR",(lx-2.5,0,0),loader)
rearbody=box("WHEEL-LOADER_REAR_BODY",(lx-2.85,0,2.05),(4.8,3.1,2.15),YELLOW,bw=.14);parent(rearbody,rear)
hood=box("WHEEL-LOADER_ENGINE_HOOD",(lx-4.65,0,2.65),(1.5,3.18,1.30),DARK,bw=.08);parent(hood,rear)
lcab=box("WHEEL-LOADER_CAB",(lx-1.15,0,3.0),(2.0,2.45,2.1),YELLOW,bw=.12);parent(lcab,rear)
lglass=box("WHEEL-LOADER_GLASS",(lx-.10,0,3.15),(.08,2.05,1.35),GLASS,bw=.015);parent(lglass,rear)

art=empty("WHEEL-LOADER_ARTICULATION",(lx,0,1.35),loader)
frontframe=box("WHEEL-LOADER_FRONT_FRAME",(lx+1.75,0,1.35),(4.1,2.6,.82),DARK,bw=.08);parent(frontframe,art)
arm=empty("WHEEL-LOADER_ARM_PIVOT",(lx+1.15,0,1.65),art)
for y in (-1.05,1.05):
    a=box(f"WHEEL-LOADER_LIFT_ARM_{y}",(lx+3.20,y,2.0),(4.15,.26,.36),YELLOW,rot=(0,math.radians(-5),0),bw=.05);parent(a,arm)
bucketp=empty("WHEEL-LOADER_BUCKET_PIVOT",(lx+5.20,0,1.70),arm)
bucket=box("WHEEL-LOADER_BUCKET",(lx+5.90,0,1.30),(1.75,3.6,1.45),STEEL,rot=(0,math.radians(-12),0),bw=.09);parent(bucket,bucketp)
lore=box("WHEEL-LOADER_BUCKET_ORE",(lx+5.75,0,1.75),(1.25,3.0,.55),ORE,bw=.10);parent(lore,bucketp)

# Four wheels; front pair belongs to articulation.
for code,center,is_front in [
    ("RL",(lx-3.4,-1.65,1.25),False),("RR",(lx-3.4,1.65,1.25),False),
    ("FL",(lx+1.9,-1.65,1.25),True),("FR",(lx+1.9,1.65,1.25),True),
]:
    parent_obj=art if is_front else loader
    spin=wheel(f"WHEEL-LOADER_WHEEL_{code}",center,1.25,.66,parent_obj)
    spin.rotation_mode="XYZ"
    # Endpoints 0 -> N*360 deg collapse to equivalent quaternions in glTF.
    # Quarter-turn keys preserve the intended eight visible wheel revolutions.
    quarter_turns=32
    for step in range(quarter_turns + 1):
        frame=1+round(step*(959/quarter_turns))
        spin.rotation_euler.y=-step*(math.pi/2)
        spin.keyframe_insert(data_path="rotation_euler",frame=frame,index=1)
    if spin.animation_data and spin.animation_data.action:spin.animation_data.action.name=f"WHEEL_LOADER_Wheel_{code}"

# 32 s cycle mirrors the simulator phases.
keyframes=[1,210,480,630,960]
art_vals=[math.radians(-4),0,math.radians(2),math.radians(-2),math.radians(-4)]
arm_vals=[math.radians(-5),math.radians(-13),math.radians(-13),math.radians(-32),math.radians(-8)]
bucket_vals=[math.radians(-10),math.radians(18),math.radians(18),math.radians(-34),math.radians(8)]
for f,v in zip(keyframes,art_vals):
    art.rotation_euler.z=v;art.keyframe_insert(data_path="rotation_euler",frame=f,index=2)
for f,v in zip(keyframes,arm_vals):
    arm.rotation_euler.y=v;arm.keyframe_insert(data_path="rotation_euler",frame=f,index=1)
for f,v in zip(keyframes,bucket_vals):
    bucketp.rotation_euler.y=v;bucketp.keyframe_insert(data_path="rotation_euler",frame=f,index=1)
for obj,name in [(art,"WHEEL_LOADER_Articulation"),(arm,"WHEEL_LOADER_Arms"),(bucketp,"WHEEL_LOADER_Bucket")]:
    if obj.animation_data and obj.animation_data.action:obj.animation_data.action.name=name

# Export.
exports={}
for r,fn in [(truck,"HAUL-TRUCK.glb"),(shovel,"MINING-SHOVEL.glb"),(loader,"WHEEL-LOADER.glb")]:
    p=export_root(r,fn)
    exports[r.name]={"path":p,"bytes":os.path.getsize(p),"objects":1+len(r.children_recursive)}

checkpoint=os.path.join(os.path.expanduser("~"),"OneDrive","Desktop","CHATON","PULPA_LAB_BLENDER_CHECKPOINT_B8_MOBILE.blend")
bpy.ops.wm.save_as_mainfile(filepath=checkpoint)
result={
    "checkpoint":checkpoint,
    "exports":exports,
    "actions":[a.name for a in bpy.data.actions if a.name.startswith("MINING_SHOVEL") or a.name.startswith("WHEEL_LOADER")],
}
