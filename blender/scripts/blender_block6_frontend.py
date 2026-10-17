import bpy
import math
import os
from mathutils import Vector

col = bpy.data.collections.get("PROCESS_PLANT")
if col is None:
    raise RuntimeError("PROCESS_PLANT collection missing.")

PREFIXES = ("ROM-HOPPER", "APRON-FEEDER", "PRIMARY-CRUSHER")
for obj in list(bpy.data.objects):
    if any(obj.name == p or obj.name.startswith(p + "_") for p in PREFIXES):
        bpy.data.objects.remove(obj, do_unlink=True)
for action in list(bpy.data.actions):
    if any(action.name.startswith(p.replace("-", "_")) for p in PREFIXES):
        bpy.data.actions.remove(action)

STEEL = bpy.data.materials["MAT_Steel_Dark"]
LIGHT = bpy.data.materials["MAT_Steel_Light"]
BLUE = bpy.data.materials["MAT_Industrial_Blue"]
ORANGE = bpy.data.materials["MAT_Safety_Orange"]
CONCRETE = bpy.data.materials["MAT_Concrete"]

def ensure_mat(name, color, metallic=0.0, roughness=0.5):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf:
        for s in bsdf.inputs:
            if s.name == "Base Color":
                s.default_value = (*color, 1)
            elif s.name == "Metallic":
                s.default_value = metallic
            elif s.name == "Roughness":
                s.default_value = roughness
    return mat

LINER = ensure_mat("MAT_Wear_Liner", (.09, .095, .10), .35, .62)
ORE = ensure_mat("MAT_ROM_Ore", (.24, .17, .105), .02, .96)
CRUSHED = ensure_mat("MAT_Crushed_Ore", (.31, .22, .135), .02, .94)

def move(o):
    for c in list(o.users_collection):
        c.objects.unlink(o)
    col.objects.link(o)

def setmat(o, m):
    if hasattr(o.data, "materials"):
        o.data.materials.clear()
        o.data.materials.append(m)

def bevel(o, width=.04, segments=2):
    mod = o.modifiers.new("EdgeSoftening", "BEVEL")
    mod.width = width
    mod.segments = segments

def box(name, loc, dims, m, rot=(0,0,0), bw=.035):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bw:
        bevel(o, bw, 2)
    setmat(o, m)
    move(o)
    return o

def cyl(name, loc, radius, depth, m, axis="Z", verts=36):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc)
    o = bpy.context.object
    o.name = name
    if axis == "X":
        o.rotation_euler[1] = math.pi / 2
    elif axis == "Y":
        o.rotation_euler[0] = math.pi / 2
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    setmat(o, m)
    move(o)
    return o

def torus(name, loc, major, minor, m, axis="Z"):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major,
        minor_radius=minor,
        major_segments=40,
        minor_segments=10,
        location=loc,
    )
    o = bpy.context.object
    o.name = name
    if axis == "X":
        o.rotation_euler[1] = math.pi / 2
    elif axis == "Y":
        o.rotation_euler[0] = math.pi / 2
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    setmat(o, m)
    move(o)
    return o

def pipe(name, a, b, radius, m):
    a, b = Vector(a), Vector(b)
    v = b - a
    mid = (a + b) * .5
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=radius, depth=v.length, location=mid)
    o = bpy.context.object
    o.name = name
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = v.to_track_quat("Z", "Y")
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    setmat(o, m)
    move(o)
    return o

def parent(o, r):
    bpy.context.view_layer.update()
    mw = o.matrix_world.copy()
    o.parent = r
    o.matrix_world = mw
    bpy.context.view_layer.update()

def root(name, loc, dims):
    o = bpy.data.objects.new(name, None)
    col.objects.link(o)
    o.location = loc
    o.empty_display_type = "PLAIN_AXES"
    o["dimensions_m"] = dims
    o["web_asset"] = True
    return o

def export_root(r, filename):
    old = r.matrix_world.copy()
    r.location = (0,0,0)
    bpy.context.view_layer.update()
    bpy.ops.object.select_all(action="DESELECT")
    r.select_set(True)
    for c in r.children_recursive:
        c.select_set(True)
    bpy.context.view_layer.objects.active = r
    outdir = os.path.join(os.path.expanduser("~"), "OneDrive", "Desktop", "CHATON", "PULPA_LAB_GLBS")
    os.makedirs(outdir, exist_ok=True)
    path = os.path.join(outdir, filename)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_animations=True,
        export_animation_mode="ACTIVE_ACTIONS",
        export_force_sampling=False,
        export_yup=True,
        export_apply=False,
        export_optimize_animation_size=True,
    )
    r.matrix_world = old
    bpy.context.view_layer.update()
    return path

# ---------------------------------------------------------------------------
# ROM HOPPER — 11.5 x 9.2 x 7.6 m, truck-dump hopper with grizzly.
# ---------------------------------------------------------------------------
rom = root("ROM-HOPPER", (180, 0, 0), "11.5 x 9.2 x 7.6")
rom["reference_class"] = "truck dump ROM hopper with grizzly"
cx = 180

# Heavy support frame and footings.
for x in (cx - 4.35, cx + 4.35):
    for y in (-3.55, 3.55):
        leg = box(f"ROM-HOPPER_LEG_{x:.2f}_{y:.2f}", (x, y, 2.1), (.38, .38, 4.2), STEEL, bw=.045)
        foot = box(f"ROM-HOPPER_FOOT_{x:.2f}_{y:.2f}", (x, y, .12), (1.0, 1.0, .24), CONCRETE, bw=.035)
        parent(leg, rom); parent(foot, rom)

# Hopper shell: four inclined heavy plate walls around a smaller throat.
wall_specs = [
    ("WEST", (cx-2.05,0,4.95), (.24,8.4,5.55), (0, math.radians(-31), 0)),
    ("EAST", (cx+2.05,0,4.95), (.24,8.4,5.55), (0, math.radians(31), 0)),
    ("SOUTH", (cx, -3.20,4.95), (6.9,.24,5.55), (math.radians(31),0,0)),
    ("NORTH", (cx, 3.20,4.95), (6.9,.24,5.55), (math.radians(-31),0,0)),
]
for name, loc, dims, rot in wall_specs:
    wall = box(f"ROM-HOPPER_WALL_{name}", loc, dims, LIGHT, rot=rot, bw=.055)
    parent(wall, rom)

# Interior liner plates, slightly inset.
liner_specs = [
    ("WEST", (cx-1.88,0,4.88), (.12,7.85,5.05), (0, math.radians(-31),0)),
    ("EAST", (cx+1.88,0,4.88), (.12,7.85,5.05), (0, math.radians(31),0)),
    ("SOUTH", (cx,-2.97,4.88), (6.35,.12,5.05), (math.radians(31),0,0)),
    ("NORTH", (cx,2.97,4.88), (6.35,.12,5.05), (math.radians(-31),0,0)),
]
for name, loc, dims, rot in liner_specs:
    liner = box(f"ROM-HOPPER_LINER_{name}", loc, dims, LINER, rot=rot, bw=.02)
    parent(liner, rom)

# Grizzly bars at dump elevation.
for i in range(-5, 6):
    y = i * .72
    bar = pipe(f"ROM-HOPPER_GRIZZLY_{i+6:02d}", (cx-4.5,y,7.15), (cx+4.5,y,7.15), .09, STEEL)
    parent(bar, rom)

# Cross-frame bracing.
for y in (-3.55, 3.55):
    brace1 = pipe(f"ROM-HOPPER_BRACE_A_{y}", (cx-4.35,y,.8), (cx+4.35,y,4.0), .10, STEEL)
    brace2 = pipe(f"ROM-HOPPER_BRACE_B_{y}", (cx+4.35,y,.8), (cx-4.35,y,4.0), .10, STEEL)
    parent(brace1,rom); parent(brace2,rom)

# Ore mound.
bpy.ops.mesh.primitive_cone_add(vertices=48, radius1=3.45, radius2=.75, depth=3.8, location=(cx,0,5.0))
ore = bpy.context.object; ore.name="ROM-HOPPER_ORE"; setmat(ore,ORE); move(ore); parent(ore,rom)

# Service deck + rail.
deck = box("ROM-HOPPER_SERVICE_DECK", (cx,-4.05,5.68), (10.2,1.20,.14), STEEL, bw=.02); parent(deck,rom)
for x in (cx-4.6,cx-2.3,cx,cx+2.3,cx+4.6):
    p=pipe(f"ROM-HOPPER_RAIL_POST_{x:.1f}", (x,-4.58,5.75), (x,-4.58,6.65), .035, ORANGE); parent(p,rom)
for z in (6.18,6.62):
    p=pipe(f"ROM-HOPPER_RAIL_{z:.2f}", (cx-4.75,-4.58,z), (cx+4.75,-4.58,z), .035, ORANGE); parent(p,rom)

# Access ladder.
for y in (-4.48,-3.78):
    side=pipe(f"ROM-HOPPER_LADDER_SIDE_{y}", (cx-4.88,y,.25), (cx-4.88,y,5.75), .035, LIGHT); parent(side,rom)
for i,z in enumerate([.55,1.0,1.45,1.9,2.35,2.8,3.25,3.7,4.15,4.6,5.05,5.5],1):
    rung=pipe(f"ROM-HOPPER_LADDER_RUNG_{i:02d}", (cx-4.88,-4.48,z), (cx-4.88,-3.78,z), .028, LIGHT); parent(rung,rom)

# Lower throat so the visual discharge aligns with current logical port ~1.95 m.
throat = box("ROM-HOPPER_DISCHARGE_THROAT", (cx,0,2.05), (2.6,2.2,1.2), LINER, bw=.06); parent(throat,rom)

# ---------------------------------------------------------------------------
# APRON FEEDER — 8.4 x 2.8 x 1.85 m.
# ---------------------------------------------------------------------------
feed = root("APRON-FEEDER", (0,0,0), "8.4 x 2.8 x 1.85")
feed["reference_class"] = "heavy duty apron feeder"
fx = 0

left = box("APRON-FEEDER_FRAME_LEFT",(fx, -1.23,.58),(8.4,.26,.32),STEEL); parent(left,feed)
right = box("APRON-FEEDER_FRAME_RIGHT",(fx,1.23,.58),(8.4,.26,.32),STEEL); parent(right,feed)
skirt_l=box("APRON-FEEDER_SKIRT_LEFT",(fx-.2,-1.14,1.30),(7.5,.12,.74),LIGHT); parent(skirt_l,feed)
skirt_r=box("APRON-FEEDER_SKIRT_RIGHT",(fx-.2,1.14,1.30),(7.5,.12,.74),LIGHT); parent(skirt_r,feed)

# Pan loop group — translation by exactly one pitch is visually seamless on loop.
pan_group=bpy.data.objects.new("APRON-FEEDER_PANS_GROUP",None);col.objects.link(pan_group);pan_group.location=(fx,0,0);parent(pan_group,feed)
pitch=.40
for i in range(20):
    x_local=-3.8+i*pitch
    pan=box(f"APRON-FEEDER_PAN_TOP_{i+1:02d}",(fx+x_local,0,1.16),(.36,2.42,.12),LINER,bw=.018);parent(pan,pan_group)
for i in range(20):
    x_local=3.8-i*pitch
    pan=box(f"APRON-FEEDER_PAN_RETURN_{i+1:02d}",(fx+x_local,0,.40),(.36,2.42,.10),LINER,bw=.015);parent(pan,pan_group)

pan_group.rotation_mode="XYZ"
pan_group.location.x=fx
pan_group.keyframe_insert(data_path="location",frame=1,index=0)
pan_group.location.x=fx+pitch
pan_group.keyframe_insert(data_path="location",frame=48,index=0)
if pan_group.animation_data and pan_group.animation_data.action:
    pan_group.animation_data.action.name="APRON_FEEDER_PanLoop"

# Two shafts + sprockets rotate together, but each object keeps its own Action.
# Sharing one Action datablock causes glTF ACTIVE_ACTIONS to export just one
# rotor channel even though both Blender objects evaluate correctly in-editor.
for idx,x in enumerate((fx-3.82,fx+3.82),1):
    rotor=bpy.data.objects.new(f"APRON-FEEDER_ROTOR_{idx:02d}",None);col.objects.link(rotor);rotor.location=(x,0,.78);parent(rotor,feed)
    shaft=cyl(f"APRON-FEEDER_SHAFT_{idx:02d}",(x,0,.78),.24,2.65,STEEL,axis="Y",verts=28);parent(shaft,rotor)
    for y in (-1.05,1.05):
        ring=torus(f"APRON-FEEDER_SPROCKET_{idx:02d}_{y:+.2f}",(x,y,.78),.38,.085,LINER,axis="Y");parent(ring,rotor)
    rotor.rotation_mode="XYZ"
    for frame, angle in ((1,0),(13,-math.pi/2),(25,-math.pi),(37,-math.pi*1.5),(48,-math.tau)):
        rotor.rotation_euler.y=angle
        rotor.keyframe_insert(data_path="rotation_euler",frame=frame,index=1)
    if rotor.animation_data and rotor.animation_data.action:
        rotor.animation_data.action.name=f"APRON_FEEDER_Sprocket_{idx:02d}"

# Motor + gearbox.
motor=cyl("APRON-FEEDER_MOTOR",(fx+3.25,-1.9,.72),.34,1.05,BLUE,axis="X",verts=36);parent(motor,feed)
gear=box("APRON-FEEDER_GEARBOX",(fx+2.18,-1.9,.68),(.88,.72,.76),STEEL,bw=.08);parent(gear,feed)
guard=box("APRON-FEEDER_DRIVE_GUARD",(fx+2.78,-1.48,.68),(.78,.58,.72),ORANGE,bw=.07);parent(guard,feed)

# Ore lumps on top.
for i in range(16):
    px=fx-3.55+(i%8)*.88
    py=-.68+(i%4)*.45
    pz=1.43+(i%3)*.05
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.18+(i%4)*.035,location=(px,py,pz))
    rock=bpy.context.object;rock.name=f"APRON-FEEDER_ORE_{i+1:02d}";setmat(rock,ORE);move(rock);parent(rock,pan_group)

# ---------------------------------------------------------------------------
# PRIMARY JAW CRUSHER — 5.4 x 4.2 x 4.7 m.
# ---------------------------------------------------------------------------
crusher=root("PRIMARY-CRUSHER",(0,0,0),"5.4 x 4.2 x 4.7")
crusher["reference_class"]="industrial jaw crusher ~1.2 m feed opening class"
cx=0

base=box("PRIMARY-CRUSHER_BASE",(cx,0,.28),(5.0,3.8,.45),STEEL,bw=.06);parent(base,crusher)
for x in (cx-2.0,cx+2.0):
    for y in (-1.45,1.45):
        s=box(f"PRIMARY-CRUSHER_SUPPORT_{x}_{y}",(x,y,.96),(.42,.42,1.05),STEEL,bw=.04);parent(s,crusher)

# Side frames.
side_l=box("PRIMARY-CRUSHER_SIDE_L",(cx, -1.55,2.7),(3.7,.22,2.75),LIGHT,bw=.08);parent(side_l,crusher)
side_r=box("PRIMARY-CRUSHER_SIDE_R",(cx, 1.55,2.7),(3.7,.22,2.75),LIGHT,bw=.08);parent(side_r,crusher)
back=box("PRIMARY-CRUSHER_BACK",(cx-1.65,0,2.65),(.30,3.2,2.65),LIGHT,bw=.07);parent(back,crusher)

# Fixed jaw.
fixed=box("PRIMARY-CRUSHER_FIXED_JAW",(cx-.72,0,2.60),(.34,2.5,2.55),LINER,rot=(0,math.radians(-14),0),bw=.025);parent(fixed,crusher)

# Moving jaw pivot.
jaw=bpy.data.objects.new("PRIMARY-CRUSHER_MOVING_JAW",None);col.objects.link(jaw);jaw.location=(cx+1.0,0,3.77);parent(jaw,crusher)
jawplate=box("PRIMARY-CRUSHER_MOVING_JAW_PLATE",(cx+.45,0,2.77),(.38,2.5,2.45),LINER,rot=(0,math.radians(10),0),bw=.025);parent(jawplate,jaw)
for i in range(8):
    y=-1.03+i*.295
    rib=box(f"PRIMARY-CRUSHER_JAW_RIB_{i+1:02d}",(cx+.43,y,2.77),(.12,.08,2.25),STEEL,rot=(0,math.radians(10),0),bw=.012);parent(rib,jaw)

jaw.rotation_mode="XYZ"
for frame, angle_deg in ((1,-1.6),(10,1.6),(19,-1.6),(28,1.6),(36,-1.6)):
    jaw.rotation_euler.y=math.radians(angle_deg)
    jaw.keyframe_insert(data_path="rotation_euler",frame=frame,index=1)
if jaw.animation_data and jaw.animation_data.action:
    jaw.animation_data.action.name="PRIMARY_CRUSHER_JawOscillation"

# Eccentric/flywheel assemblies rotate together, but each target needs a unique
# Action so all three channels survive glTF export.
for idx,y in enumerate((-1.96,1.96),1):
    fly=bpy.data.objects.new(f"PRIMARY-CRUSHER_FLYWHEEL_{idx:02d}",None);col.objects.link(fly);fly.location=(cx+.55,y,3.62);parent(fly,crusher)
    ring=torus(f"PRIMARY-CRUSHER_FLYWHEEL_RING_{idx:02d}",(cx+.55,y,3.62),.72,.16,ORANGE,axis="Y");parent(ring,fly)
    hub=cyl(f"PRIMARY-CRUSHER_FLYWHEEL_HUB_{idx:02d}",(cx+.55,y,3.62),.24,.26,STEEL,axis="Y",verts=24);parent(hub,fly)
    for s in range(6):
        a=s/6*math.tau
        spoke=box(f"PRIMARY-CRUSHER_FLYWHEEL_SPOKE_{idx:02d}_{s+1}",(cx+.55+math.cos(a)*.34,y,3.62+math.sin(a)*.34),(.92,.11,.11),ORANGE,rot=(0,-a,0),bw=.015);parent(spoke,fly)
    fly.rotation_mode="XYZ"
    for frame, angle in ((1,0),(10,-math.pi/2),(19,-math.pi),(28,-math.pi*1.5),(36,-math.tau)):
        fly.rotation_euler.y=angle
        fly.keyframe_insert(data_path="rotation_euler",frame=frame,index=1)
    if fly.animation_data and fly.animation_data.action:
        fly.animation_data.action.name=f"PRIMARY_CRUSHER_Flywheel_{idx:02d}"

ecc=bpy.data.objects.new("PRIMARY-CRUSHER_ECCENTRIC",None);col.objects.link(ecc);ecc.location=(cx+.55,0,3.62);parent(ecc,crusher)
shaft=cyl("PRIMARY-CRUSHER_ECCENTRIC_SHAFT",(cx+.55,0,3.62),.23,3.85,STEEL,axis="Y",verts=28);parent(shaft,ecc)
ecc.rotation_mode="XYZ"
for frame, angle in ((1,0),(10,-math.pi/2),(19,-math.pi),(28,-math.pi*1.5),(36,-math.tau)):
    ecc.rotation_euler.y=angle
    ecc.keyframe_insert(data_path="rotation_euler",frame=frame,index=1)
if ecc.animation_data and ecc.animation_data.action:
    ecc.animation_data.action.name="PRIMARY_CRUSHER_Eccentric"

# Feed/discharge chutes and drive.
feed_chute=box("PRIMARY-CRUSHER_FEED_CHUTE",(cx-.25,0,4.15),(2.3,3.3,.18),LIGHT,rot=(0,math.radians(-10),0),bw=.04);parent(feed_chute,crusher)
discharge=box("PRIMARY-CRUSHER_DISCHARGE_CHUTE",(cx+.25,0,.75),(1.8,2.55,.18),LIGHT,rot=(0,math.radians(-12),0),bw=.04);parent(discharge,crusher)
motor=cyl("PRIMARY-CRUSHER_DRIVE_MOTOR",(cx-1.45,-2.05,1.05),.45,1.5,BLUE,axis="X",verts=36);parent(motor,crusher)
drive=pipe("PRIMARY-CRUSHER_DRIVE_SHAFT",(cx-.70,-2.05,1.05),(cx+.55,-1.96,3.62),.08,STEEL);parent(drive,crusher)
platform=box("PRIMARY-CRUSHER_PLATFORM",(cx,-2.0,2.65),(4.6,.95,.12),STEEL,bw=.02);parent(platform,crusher)
for x in (cx-2,cx-1,cx,cx+1,cx+2):
    p=pipe(f"PRIMARY-CRUSHER_RAIL_POST_{x}",(x,-2.45,2.7),(x,-2.45,3.60),.03,ORANGE);parent(p,crusher)
p=pipe("PRIMARY-CRUSHER_RAIL",(cx-2.15,-2.45,3.55),(cx+2.15,-2.45,3.55),.03,ORANGE);parent(p,crusher)

# Ore inside crushing chamber.
for i in range(12):
    px=cx-.15+((i%3)-1)*.30
    py=((i%4)-1.5)*.30
    pz=3.75-(i%6)*.46
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.20+(i%4)*.045,location=(px,py,pz))
    rock=bpy.context.object;rock.name=f"PRIMARY-CRUSHER_ORE_{i+1:02d}";setmat(rock,ORE if i<6 else CRUSHED);move(rock);parent(rock,crusher)

# Export.
exports={}
for r, fn in [
    (rom,"ROM-HOPPER.glb"),
    (feed,"APRON-FEEDER.glb"),
    (crusher,"PRIMARY-CRUSHER.glb"),
]:
    path=export_root(r,fn)
    exports[r.name]={"path":path,"bytes":os.path.getsize(path),"objects":1+len(r.children_recursive)}

checkpoint=os.path.join(os.path.expanduser("~"),"OneDrive","Desktop","CHATON","PULPA_LAB_BLENDER_CHECKPOINT_B6_FRONTEND.blend")
bpy.ops.wm.save_as_mainfile(filepath=checkpoint)
result={
    "checkpoint":checkpoint,
    "exports":exports,
    "actions":[a.name for a in bpy.data.actions if a.name.startswith("APRON_FEEDER") or a.name.startswith("PRIMARY_CRUSHER")],
}
