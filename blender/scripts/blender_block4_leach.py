import bpy
import math
import os

core = bpy.data.collections.get("PROCESS_PLANT")
if core is None:
    raise RuntimeError("PROCESS_PLANT collection missing. Run Block 1 first.")

for name in list(bpy.data.objects.keys()):
    if name == "LEACH-REACTOR" or name.startswith("LEACH-REACTOR_"):
        bpy.data.objects.remove(bpy.data.objects[name], do_unlink=True)
for action in list(bpy.data.actions):
    if action.name.startswith("LEACH_REACTOR"):
        bpy.data.actions.remove(action)

MAT_STEEL = bpy.data.materials.get("MAT_Steel_Dark")
MAT_LIGHT = bpy.data.materials.get("MAT_Steel_Light")
MAT_BLUE = bpy.data.materials.get("MAT_Industrial_Blue")
MAT_ORANGE = bpy.data.materials.get("MAT_Safety_Orange")
MAT_SLURRY = bpy.data.materials.get("MAT_Slurry")
if not all([MAT_STEEL, MAT_LIGHT, MAT_BLUE, MAT_ORANGE, MAT_SLURRY]):
    raise RuntimeError("Core materials missing.")

def move(o):
    for c in list(o.users_collection):
        c.objects.unlink(o)
    core.objects.link(o)

def mat(o, m):
    if hasattr(o.data, "materials"):
        o.data.materials.clear()
        o.data.materials.append(m)

def bevel(o, w=.04):
    mod=o.modifiers.new("EdgeSoftening","BEVEL"); mod.width=w; mod.segments=2

def box(name, loc, dims, m, bw=.04):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o=bpy.context.object; o.name=name; o.dimensions=dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bw: bevel(o,bw)
    mat(o,m); move(o); return o

def cyl(name, loc, radius, depth, m, axis="Z", verts=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc)
    o=bpy.context.object; o.name=name
    if axis=="X": o.rotation_euler[1]=math.radians(90)
    elif axis=="Y": o.rotation_euler[0]=math.radians(90)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    mat(o,m); move(o); return o

def pipe(name,a,b,r,m):
    from mathutils import Vector
    a,b=Vector(a),Vector(b); v=b-a; mid=(a+b)*.5
    bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=r,depth=v.length,location=mid)
    o=bpy.context.object; o.name=name; o.rotation_mode="QUATERNION"
    o.rotation_quaternion=v.to_track_quat("Z","Y")
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    mat(o,m); move(o); return o

def parent(child, root):
    bpy.context.view_layer.update()
    mw=child.matrix_world.copy(); child.parent=root; child.matrix_world=mw
    bpy.context.view_layer.update()

root=bpy.data.objects.new("LEACH-REACTOR",None); core.objects.link(root)
root.location=(45,0,0); root.empty_display_type="PLAIN_AXES"
root["equipment_class"]="7 m mechanically agitated leach reactor"
root["dimensions_m"]="7.6 x 7.6 x 8.8"
root["web_asset"]=True

base_x=45

shell=cyl("LEACH-REACTOR_SHELL",(base_x,0,3.65),3.5,7.2,MAT_LIGHT,verts=64); parent(shell,root)
shell["inspection_role"]="shell"

slurry=cyl("LEACH-REACTOR_SLURRY",(base_x,0,3.0),3.30,5.85,MAT_SLURRY,verts=64); parent(slurry,root)
slurry["inspection_role"]="interior"

# Four internal baffles.
for i,a in enumerate((0,math.pi/2,math.pi,3*math.pi/2),1):
    x=base_x+math.cos(a)*3.02; y=math.sin(a)*3.02
    b=box(f"LEACH-REACTOR_BAFFLE_{i:02d}",(x,y,3.25),(0.14,0.55,5.4),MAT_STEEL,.02)
    b.rotation_euler[2]=a; parent(b,root)

# Bridge, gearbox and motor.
bridge=box("LEACH-REACTOR_TOP_BRIDGE",(base_x,0,7.52),(7.35,1.25,.28),MAT_STEEL,.05); parent(bridge,root)
gear=box("LEACH-REACTOR_GEARBOX",(base_x,0,7.92),(.95,.9,.72),MAT_STEEL,.09); parent(gear,root)
motor=cyl("LEACH-REACTOR_MOTOR",(base_x,0,8.42),.42,1.22,MAT_BLUE,axis="X",verts=40); parent(motor,root)
for i,x in enumerate((44.55,44.8,45.05,45.3,45.55),1):
    ring=cyl(f"LEACH-REACTOR_MOTOR_FIN_{i:02d}",(x,0,8.42),.45,.035,MAT_STEEL,axis="X",verts=36); parent(ring,root)

# Rotating agitator group.
agit=bpy.data.objects.new("LEACH-REACTOR_ROTATING_GROUP",None); core.objects.link(agit); agit.location=(base_x,0,0); parent(agit,root)
shaft=cyl("LEACH-REACTOR_SHAFT",(base_x,0,4.25),.09,6.35,MAT_LIGHT,verts=28); parent(shaft,agit)
for level,z in enumerate((1.65,3.05),1):
    hub=cyl(f"LEACH-REACTOR_IMPELLER_HUB_{level}",(base_x,0,z),.22,.28,MAT_LIGHT,verts=24); parent(hub,agit)
    for i in range(4):
        angle=i*math.pi/2
        blade=box(f"LEACH-REACTOR_IMPELLER_{level}_{i+1}",(base_x+math.cos(angle)*1.0,math.sin(angle)*1.0,z),(2.15,.16,.34),MAT_LIGHT,.025)
        blade.rotation_euler[2]=angle; parent(blade,agit)

agit.rotation_mode="XYZ"
for frame, angle in ((1,0),(23,math.pi/2),(46,math.pi),(68,math.pi*1.5),(90,math.tau)):
    agit.rotation_euler.z=angle
    agit.keyframe_insert(data_path="rotation_euler",frame=frame,index=2)
if agit.animation_data and agit.animation_data.action:
    agit.animation_data.action.name="LEACH_REACTOR_Agitator"

# Platform and railings.
deck=box("LEACH-REACTOR_WALKWAY",(base_x,-3.18,7.55),(6.5,1.05,.14),MAT_STEEL,.02); parent(deck,root)
for x in (base_x-3.0,base_x-1.5,base_x,base_x+1.5,base_x+3.0):
    p=pipe(f"LEACH-REACTOR_RAIL_POST_{x:.1f}",(x,-3.70,7.60),(x,-3.70,8.50),.035,MAT_ORANGE); parent(p,root)
for z in (8.10,8.48):
    p=pipe(f"LEACH-REACTOR_RAIL_{z:.2f}",(base_x-3.1,-3.70,z),(base_x+3.1,-3.70,z),.035,MAT_ORANGE); parent(p,root)

# Ladder on west side.
for y in (-.34,.34):
    p=pipe("LEACH-REACTOR_LADDER_SIDE_A" if y<0 else "LEACH-REACTOR_LADDER_SIDE_B",
           (base_x-3.62,y,.25),(base_x-3.62,y,7.45),.032,MAT_LIGHT); parent(p,root)
for i,z in enumerate([.55,1.0,1.45,1.9,2.35,2.8,3.25,3.7,4.15,4.6,5.05,5.5,5.95,6.4,6.85,7.3],1):
    p=pipe(f"LEACH-REACTOR_LADDER_RUNG_{i:02d}",(base_x-3.62,-.34,z),(base_x-3.62,.34,z),.026,MAT_LIGHT); parent(p,root)

# Process nozzles aligned with current Three.js port elevations.
feed=cyl("LEACH-REACTOR_FEED_NOZZLE",(base_x-3.62,0,6.20),.14,.80,MAT_STEEL,axis="X",verts=28); parent(feed,root)
out=cyl("LEACH-REACTOR_OVERFLOW_NOZZLE",(base_x+3.62,0,5.70),.14,.80,MAT_STEEL,axis="X",verts=28); parent(out,root)

# Export generic asset at datum, then restore authoring position.
old=root.matrix_world.copy(); root.location=(0,0,0); bpy.context.view_layer.update()
bpy.ops.object.select_all(action="DESELECT"); root.select_set(True)
for c in root.children_recursive: c.select_set(True)
bpy.context.view_layer.objects.active=root
outdir=os.path.join(os.path.expanduser("~"),"OneDrive","Desktop","CHATON","PULPA_LAB_GLBS")
os.makedirs(outdir,exist_ok=True)
filepath=os.path.join(outdir,"LEACH-REACTOR.glb")
bpy.ops.export_scene.gltf(
    filepath=filepath, export_format="GLB", use_selection=True,
    export_cameras=False, export_lights=False, export_extras=True,
    export_animations=True, export_animation_mode="ACTIVE_ACTIONS",
    export_force_sampling=False,
    export_yup=True, export_apply=False, export_optimize_animation_size=True,
)
root.matrix_world=old; bpy.context.view_layer.update()

checkpoint=os.path.join(os.path.expanduser("~"),"OneDrive","Desktop","CHATON","PULPA_LAB_BLENDER_CHECKPOINT_B4_LEACH.blend")
bpy.ops.wm.save_as_mainfile(filepath=checkpoint)
result={
    "checkpoint":checkpoint,
    "glb":filepath,
    "bytes":os.path.getsize(filepath),
    "objects":1+len(root.children_recursive),
    "animation": agit.animation_data.action.name if agit.animation_data and agit.animation_data.action else None,
}
