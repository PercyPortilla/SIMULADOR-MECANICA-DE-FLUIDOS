import bpy
import math
import os
from mathutils import Vector

col = bpy.data.collections.get("PROCESS_PLANT")
if col is None:
    raise RuntimeError("PROCESS_PLANT collection missing.")

PREFIXES = ("CIP-ADSORPTION", "ELUTION-SKID", "EW-CELLS", "SMELTING-FURNACE")
for obj in list(bpy.data.objects):
    if any(obj.name == p or obj.name.startswith(p + "_") for p in PREFIXES):
        bpy.data.objects.remove(obj, do_unlink=True)
for action in list(bpy.data.actions):
    if any(action.name.startswith(p.replace("-", "_")) for p in PREFIXES) or action.name == "CIP_Agitators":
        bpy.data.actions.remove(action)

def mkmat(name, color, metallic=0.0, roughness=.5, emission=None):
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes=True
    bsdf=next((n for n in m.node_tree.nodes if n.type=="BSDF_PRINCIPLED"),None)
    for s in bsdf.inputs:
        if s.name=="Base Color": s.default_value=(*color,1)
        elif s.name=="Metallic": s.default_value=metallic
        elif s.name=="Roughness": s.default_value=roughness
        elif emission and s.name in ("Emission Color","Emission"): s.default_value=(*emission,1)
        elif emission and s.name=="Emission Strength": s.default_value=2.0
    return m

STEEL=bpy.data.materials["MAT_Steel_Dark"]
LIGHT=bpy.data.materials["MAT_Steel_Light"]
BLUE=bpy.data.materials["MAT_Industrial_Blue"]
ORANGE=bpy.data.materials["MAT_Safety_Orange"]
SLURRY=bpy.data.materials["MAT_Slurry"]
STAINLESS=mkmat("MAT_Stainless",(0.55,.60,.63),.82,.22)
COPPER=mkmat("MAT_Copper",(.58,.22,.08),.78,.28)
REFRACTORY=mkmat("MAT_Refractory",(.20,.13,.09),.05,.90)
GOLD=mkmat("MAT_Molten_Gold",(1.0,.34,.03),.38,.22,(1.0,.12,.01))
ELECTROLYTE=mkmat("MAT_Electrolyte",(.08,.36,.23),.05,.42)

def move(o):
    for c in list(o.users_collection): c.objects.unlink(o)
    col.objects.link(o)
def setmat(o,m):
    if hasattr(o.data,"materials"): o.data.materials.append(m)
def box(name, loc, dims, m):
    bpy.ops.mesh.primitive_cube_add(location=loc); o=bpy.context.object; o.name=name; o.dimensions=dims
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); setmat(o,m); move(o); return o
def cyl(name, loc, r, d, m, axis="Z", verts=36):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=d,location=loc); o=bpy.context.object; o.name=name
    if axis=="X": o.rotation_euler[1]=math.pi/2
    elif axis=="Y": o.rotation_euler[0]=math.pi/2
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True); setmat(o,m); move(o); return o
def cone(name,loc,r1,r2,d,m,verts=36):
    bpy.ops.mesh.primitive_cone_add(vertices=verts,radius1=r1,radius2=r2,depth=d,location=loc)
    o=bpy.context.object;o.name=name;setmat(o,m);move(o);return o
def pipe(name,a,b,r,m):
    a,b=Vector(a),Vector(b);v=b-a;mid=(a+b)*.5
    bpy.ops.mesh.primitive_cylinder_add(vertices=20,radius=r,depth=v.length,location=mid)
    o=bpy.context.object;o.name=name;o.rotation_mode="QUATERNION";o.rotation_quaternion=v.to_track_quat("Z","Y")
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True);setmat(o,m);move(o);return o
def parent(o,r):
    bpy.context.view_layer.update()
    mw=o.matrix_world.copy();o.parent=r;o.matrix_world=mw
    bpy.context.view_layer.update()
def root(name,loc,dims):
    o=bpy.data.objects.new(name,None);col.objects.link(o);o.location=loc;o["dimensions_m"]=dims;o["web_asset"]=True;return o
def export_root(r, filename, clip_mode="ACTIVE_ACTIONS"):
    old=r.matrix_world.copy();r.location=(0,0,0);bpy.context.view_layer.update()
    bpy.ops.object.select_all(action="DESELECT");r.select_set(True)
    for c in r.children_recursive:c.select_set(True)
    bpy.context.view_layer.objects.active=r
    outdir=os.path.join(os.path.expanduser("~"),"OneDrive","Desktop","CHATON","PULPA_LAB_GLBS");os.makedirs(outdir,exist_ok=True)
    path=os.path.join(outdir,filename)
    bpy.ops.export_scene.gltf(filepath=path,export_format="GLB",use_selection=True,export_cameras=False,export_lights=False,
        export_extras=True,export_animations=True,export_animation_mode=clip_mode,export_yup=True,export_apply=False,
        export_force_sampling=False,
        export_optimize_animation_size=True)
    r.matrix_world=old;bpy.context.view_layer.update();return path

# ---------- CIP ----------
cip=root("CIP-ADSORPTION",(95,0,0),"13.8 x 7.4 x 6.9")
for agitator_index,xloc in enumerate((-5.0,-1.67,1.67,5.0),1):
    x=95+xloc
    tank=cyl(f"CIP-ADSORPTION_TANK_{xloc:+.2f}",(x,0,2.5),1.55,4.9,LIGHT,verts=48);parent(tank,cip)
    liquid=cyl(f"CIP-ADSORPTION_SLURRY_{xloc:+.2f}",(x,0,2.1),1.43,4.05,SLURRY,verts=48);parent(liquid,cip)
    rot=bpy.data.objects.new(f"CIP-ADSORPTION_ROTATING_{xloc:+.2f}",None);col.objects.link(rot);rot.location=(x,0,0);parent(rot,cip)
    shaft=cyl(f"CIP-ADSORPTION_SHAFT_{xloc:+.2f}",(x,0,3.1),.055,4.65,STAINLESS,verts=18);parent(shaft,rot)
    motor=cyl(f"CIP-ADSORPTION_MOTOR_{xloc:+.2f}",(x,0,5.48),.31,.85,BLUE,axis="X",verts=32);parent(motor,cip)
    screen=cyl(f"CIP-ADSORPTION_SCREEN_{xloc:+.2f}",(x+1.08,0,4.2),.32,1.2,STAINLESS,verts=26);parent(screen,cip)
    for i in range(4):
        a=i*math.pi/2
        bl=box(f"CIP-ADSORPTION_BLADE_{xloc:+.2f}_{i}",(x+math.cos(a)*.7,math.sin(a)*.7,1.25),(1.5,.10,.24),STAINLESS)
        bl.rotation_euler[2]=a;parent(bl,rot)
    # Each agitator needs its own Action. Reusing one Action datablock across
    # several objects makes Blender's glTF exporter emit only one target channel,
    # so three of the four CIP agitators were visually static in V15.
    rot.rotation_mode="XYZ"
    for frame, angle in ((1,0),(20,math.pi/2),(38,math.pi),(57,math.pi*1.5),(75,math.tau)):
        rot.rotation_euler.z=angle
        rot.keyframe_insert(data_path="rotation_euler",frame=frame,index=2)
    if rot.animation_data and rot.animation_data.action:
        rot.animation_data.action.name=f"CIP_ADSORPTION_Agitator_{agitator_index:02d}"
platform=box("CIP-ADSORPTION_PLATFORM",(95,0,4.88),(13.2,6.0,.16),STEEL);parent(platform,cip)
for xloc in (89.2,93.05,96.95,100.8):
    for y in (-2.55,2.55):
        leg=box(f"CIP-ADSORPTION_LEG_{xloc}_{y}",(xloc,y,2.42),(.18,.18,4.85),STEEL);parent(leg,cip)
for y in (-2.95,2.95):
    for xloc in (89.0,91.0,93.0,95.0,97.0,99.0,101.0):
        p=pipe(f"CIP-ADSORPTION_RAIL_POST_{xloc}_{y}",(xloc,y,4.96),(xloc,y,5.86),.03,ORANGE);parent(p,cip)
    p=pipe(f"CIP-ADSORPTION_RAIL_{y}",(88.8,y,5.80),(101.2,y,5.80),.03,ORANGE);parent(p,cip)
for i,(a,b) in enumerate([((89.5,-1,4.0),(92.0,-1,4.0)),((92.8,-1,4.0),(95.4,-1,4.0)),((96.2,-1,4.0),(98.8,-1,4.0))],1):
    p=pipe(f"CIP-ADSORPTION_TRANSFER_{i}",a,b,.12,LIGHT);parent(p,cip)
cip["animation"]="CIP_Agitators"

# ---------- ELUTION ----------
elu=root("ELUTION-SKID",(116,0,0),"9.4 x 5.6 x 6.4")
skid=box("ELUTION-SKID_BASE",(116,0,.12),(9.0,5.1,.24),STEEL);parent(skid,elu)
column=cyl("ELUTION-SKID_COLUMN",(113.2,0,2.6),.95,4.9,STAINLESS,verts=48);parent(column,elu)
tank=cyl("ELUTION-SKID_SOLUTION_TANK",(116.1,1.15,1.42),1.35,2.6,LIGHT,verts=48);parent(tank,elu)
hx=cyl("ELUTION-SKID_HEAT_EXCHANGER",(118.75,-.95,2.0),.65,3.0,ORANGE,axis="X",verts=36);parent(hx,elu)
for y in (-.35,0,.35):
    tube=cyl(f"ELUTION-SKID_HX_TUBE_{y}",(118.75,-.95+y,2.0),.035,2.75,COPPER,axis="X",verts=12);parent(tube,elu)
for px in (118.2,119.5):
    body=cyl(f"ELUTION-SKID_PUMP_{px}",(px,1.25,.75),.42,.55,BLUE,axis="X",verts=32);parent(body,elu)
    motor=cyl(f"ELUTION-SKID_PUMP_MOTOR_{px}",(px+.75,1.25,.75),.26,.8,BLUE,axis="X",verts=28);parent(motor,elu)
deck=box("ELUTION-SKID_PLATFORM",(114.0,0,4.45),(4.0,2.0,.12),STEEL);parent(deck,elu)
for x in (112.35,115.65):
    leg=box(f"ELUTION-SKID_PLATFORM_LEG_{x}",(x,.82,2.22),(.16,.16,4.45),STEEL);parent(leg,elu)
for y in (-1.0,1.0):
    p=pipe(f"ELUTION-SKID_RAIL_{y}",(112.1,y,5.35),(115.9,y,5.35),.03,ORANGE);parent(p,elu)
pipe1=pipe("ELUTION-SKID_PROCESS_A",(113.2,0,.8),(116.1,1.15,.8),.09,LIGHT);parent(pipe1,elu)
pipe2=pipe("ELUTION-SKID_PROCESS_B",(116.1,1.15,2.4),(118.75,-.95,2.0),.09,LIGHT);parent(pipe2,elu)

# ---------- EW ----------
ew=root("EW-CELLS",(134,0,0),"10.8 x 5.8 x 3.8")
base=box("EW-CELLS_BASE",(134,0,.12),(10.4,5.4,.18),STEEL);parent(base,ew)
for c in range(4):
    x=130.1+c*2.6
    cell=box(f"EW-CELLS_CELL_{c+1}",(x,0,.9),(2.15,3.7,1.35),LIGHT);parent(cell,ew)
    electrolyte=box(f"EW-CELLS_ELECTROLYTE_{c+1}",(x,0,1.0),(1.9,3.45,.92),ELECTROLYTE);parent(electrolyte,ew)
    for i in range(11):
        y=-1.45+i*.29
        cath=box(f"EW-CELLS_CATHODE_{c+1}_{i+1}",(x,y,1.35),(1.72,.035,1.05),STAINLESS if i%2==0 else COPPER);parent(cath,ew)
bus1=box("EW-CELLS_BUSBAR_POS",(134,-2.05,2.12),(10.1,.16,.13),COPPER);parent(bus1,ew)
bus2=box("EW-CELLS_BUSBAR_NEG",(134,2.05,2.12),(10.1,.16,.13),COPPER);parent(bus2,ew)
cab=box("EW-CELLS_RECTIFIER",(138.3,-2.15,1.25),(1.7,1.05,2.25),BLUE);parent(cab,ew)
for y in (-2.5,2.5):
    walk=box(f"EW-CELLS_WALKWAY_{y}",(134,y,1.68),(10.2,.85,.12),STEEL);parent(walk,ew)
    rail=pipe(f"EW-CELLS_RAIL_{y}",(129.1,y + (.4 if y>0 else -.4),2.6),(138.9,y + (.4 if y>0 else -.4),2.6),.03,ORANGE);parent(rail,ew)

# ---------- SMELTING ----------
sm=root("SMELTING-FURNACE",(152,0,0),"7.4 x 5.8 x 8.9")
base=box("SMELTING-FURNACE_BASE",(152,0,.12),(7.1,5.4,.24),bpy.data.materials["MAT_Concrete"]);parent(base,sm)
pivot=bpy.data.objects.new("SMELTING-FURNACE_TILT_PIVOT",None);col.objects.link(pivot);pivot.location=(151.4,0,2.25);parent(pivot,sm)
shell=cyl("SMELTING-FURNACE_SHELL",(151.4,0,2.25),1.48,3.55,LIGHT,axis="X",verts=48);parent(shell,pivot)
refr=cyl("SMELTING-FURNACE_REFRACTORY",(151.4,0,2.25),1.22,3.05,REFRACTORY,axis="X",verts=48);parent(refr,pivot)
melt=cyl("SMELTING-FURNACE_MELT",(151.4,0,1.92),.82,2.15,GOLD,axis="X",verts=36);parent(melt,pivot)
mouth=cyl("SMELTING-FURNACE_MOUTH",(153.28,0,2.25),.72,.42,STEEL,axis="X",verts=36);parent(mouth,pivot)
for y in (-2.0,2.0):
    sup=box(f"SMELTING-FURNACE_SUPPORT_{y}",(151.4,y,1.95),(.45,.72,3.5),STEEL);parent(sup,sm)
hood=box("SMELTING-FURNACE_HOOD",(152.2,0,4.65),(3.8,3.2,.35),LIGHT);parent(hood,sm)
duct=pipe("SMELTING-FURNACE_DUCT",(153.65,0,4.65),(155.0,0,6.2),.38,STEEL);parent(duct,sm)
stack=pipe("SMELTING-FURNACE_STACK",(155.0,0,6.2),(155.0,0,8.6),.42,STEEL);parent(stack,sm)
cruc=cyl("SMELTING-FURNACE_CRUCIBLE",(154.25,0,.70),.68,1.10,REFRACTORY,verts=36);parent(cruc,sm)
glow=cyl("SMELTING-FURNACE_CRUCIBLE_GLOW",(154.25,0,.92),.56,.70,GOLD,verts=36);parent(glow,sm)
pivot.rotation_mode="XYZ";pivot.rotation_euler.y=0;pivot.keyframe_insert(data_path="rotation_euler",frame=1,index=1)
pivot.rotation_euler.y=math.radians(-32);pivot.keyframe_insert(data_path="rotation_euler",frame=90,index=1)
pivot.rotation_euler.y=0;pivot.keyframe_insert(data_path="rotation_euler",frame=150,index=1)
if pivot.animation_data and pivot.animation_data.action:pivot.animation_data.action.name="SMELTING_FURNACE_Tilt"

exports={}
for r,fn in [(cip,"CIP-ADSORPTION.glb"),(elu,"ELUTION-SKID.glb"),(ew,"EW-CELLS.glb"),(sm,"SMELTING-FURNACE.glb")]:
    p=export_root(r,fn);exports[r.name]={"path":p,"bytes":os.path.getsize(p),"objects":1+len(r.children_recursive)}

checkpoint=os.path.join(os.path.expanduser("~"),"OneDrive","Desktop","CHATON","PULPA_LAB_BLENDER_CHECKPOINT_B5_RECOVERY.blend")
bpy.ops.wm.save_as_mainfile(filepath=checkpoint)
result={"checkpoint":checkpoint,"exports":exports}
