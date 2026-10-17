import bpy
import math
import os
from mathutils import Vector

scene = bpy.context.scene
core = bpy.data.collections.get("REOLOGIA_CORE")
if core is None:
    raise RuntimeError("REOLOGIA_CORE collection not found. Run Block 1 first.")

# ---------- helpers ----------
def material(name, base, metallic=0.0, roughness=0.5):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        bsdf = mat.node_tree.nodes.new("ShaderNodeBsdfPrincipled")
    # Socket names are stable in Blender 5.x, but resolve by identifier/name defensively.
    def socket(label):
        return next((s for s in bsdf.inputs if s.name == label or s.identifier == label), None)
    base_socket = socket("Base Color")
    metallic_socket = socket("Metallic")
    roughness_socket = socket("Roughness")
    if base_socket:
        base_socket.default_value = (*base, 1.0)
    if metallic_socket:
        metallic_socket.default_value = metallic
    if roughness_socket:
        roughness_socket.default_value = roughness
    return mat

MAT_STEEL = material("MAT_Steel_Dark", (0.10, 0.12, 0.14), 0.72, 0.28)
MAT_STEEL_LIGHT = material("MAT_Steel_Light", (0.34, 0.38, 0.42), 0.68, 0.32)
MAT_BLUE = material("MAT_Industrial_Blue", (0.055, 0.20, 0.36), 0.42, 0.34)
MAT_ORANGE = material("MAT_Safety_Orange", (0.82, 0.25, 0.045), 0.20, 0.38)
MAT_RUBBER = material("MAT_Rubber_Liner", (0.028, 0.032, 0.035), 0.05, 0.78)
MAT_CONCRETE = material("MAT_Concrete", (0.30, 0.31, 0.30), 0.0, 0.84)
MAT_SLURRY = material("MAT_Slurry", (0.18, 0.13, 0.085), 0.0, 0.68)

def move_to_collection(obj, collection=core):
    for col in list(obj.users_collection):
        col.objects.unlink(obj)
    collection.objects.link(obj)

def bevel(obj, width=0.05, segments=2):
    mod = obj.modifiers.new("EdgeSoftening", "BEVEL")
    mod.width = width
    mod.segments = segments

def set_mat(obj, mat):
    if obj.data and hasattr(obj.data, "materials"):
        obj.data.materials.clear()
        obj.data.materials.append(mat)

def box(name, loc, dims, mat, bevel_w=0.04):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel_w:
        bevel(obj, bevel_w, 2)
    set_mat(obj, mat)
    move_to_collection(obj)
    return obj

def cyl(name, loc, radius, depth, mat, axis="Z", vertices=40):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    obj = bpy.context.object
    obj.name = name
    if axis == "X":
        obj.rotation_euler[1] = math.radians(90)
    elif axis == "Y":
        obj.rotation_euler[0] = math.radians(90)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    set_mat(obj, mat)
    move_to_collection(obj)
    return obj

def cone(name, loc, radius_bottom, radius_top, depth, mat, vertices=40):
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius_bottom,
        radius2=radius_top,
        depth=depth,
        location=loc,
    )
    obj = bpy.context.object
    obj.name = name
    set_mat(obj, mat)
    move_to_collection(obj)
    return obj

def torus(name, loc, major_radius, minor_radius, mat, rotate_y=False):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=48,
        minor_segments=12,
        location=loc,
    )
    obj = bpy.context.object
    obj.name = name
    if rotate_y:
        obj.rotation_euler[1] = math.radians(90)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    set_mat(obj, mat)
    move_to_collection(obj)
    return obj

def sphere(name, loc, scale, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=20, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    set_mat(obj, mat)
    move_to_collection(obj)
    return obj

def empty(name, loc):
    obj = bpy.data.objects.new(name, None)
    core.objects.link(obj)
    obj.location = loc
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.65
    return obj

def parent_keep_world(child, parent):
    world = child.matrix_world.copy()
    child.parent = parent
    child.matrix_world = world

def clear_prefix(prefix):
    for obj in list(bpy.data.objects):
        if obj.name == prefix or obj.name.startswith(prefix + "_"):
            bpy.data.objects.remove(obj, do_unlink=True)

def pipe_between(name, a, b, radius, mat):
    a = Vector(a)
    b = Vector(b)
    vec = b - a
    length = vec.length
    mid = (a + b) * 0.5
    bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=radius, depth=length, location=mid)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = vec.to_track_quat("Z", "Y")
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    set_mat(obj, mat)
    move_to_collection(obj)
    return obj

def add_root(name, loc, dimensions, notes):
    root = empty(name, loc)
    root["equipment_id"] = name
    root["dimensions_m"] = dimensions
    root["web_asset"] = True
    root["notes"] = notes
    return root

# Clear only previously generated core assets, allowing safe re-runs.
for prefix in ("MILL-01", "SUMP-01", "SLURRY-PUMP-01", "CLASS-01"):
    clear_prefix(prefix)
for action in list(bpy.data.actions):
    if action.name.startswith("MILL-01") or action.name.startswith("SLURRY-PUMP-01"):
        bpy.data.actions.remove(action)

# ---------- MILL-01 ----------
base = Vector((0.0, 0.0, 0.0))
mill = add_root(
    "MILL-01", base, "approx 9.6 L x 7.0 W x 5.7 H",
    "Ball mill shell 4.5 m diameter x 7.0 m long; rotating group exported as animation."
)

rot = empty("MILL-01_ROTATING_GROUP", base + Vector((0, 0, 3.15)))
parent_keep_world(rot, mill)

shell = cyl("MILL-01_SHELL", base + Vector((0, 0, 3.15)), 2.25, 7.0, MAT_STEEL_LIGHT, axis="X", vertices=64)
parent_keep_world(shell, rot)
liner = cyl("MILL-01_LINER_BAND", base + Vector((0, 0, 3.15)), 2.30, 6.45, MAT_STEEL, axis="X", vertices=64)
parent_keep_world(liner, rot)

for idx, x in enumerate((-3.42, 3.42), start=1):
    ring = torus(f"MILL-01_END_RING_{idx:02d}", base + Vector((x, 0, 3.15)), 2.28, 0.18, MAT_STEEL, rotate_y=True)
    parent_keep_world(ring, rot)
    tr = cyl(f"MILL-01_TRUNNION_{idx:02d}", base + Vector((x + (-0.55 if x < 0 else 0.55), 0, 3.15)), 0.72, 1.25, MAT_STEEL_LIGHT, axis="X")
    parent_keep_world(tr, rot)

gear = torus("MILL-01_RING_GEAR", base + Vector((2.65, 0, 3.15)), 2.48, 0.16, MAT_ORANGE, rotate_y=True)
parent_keep_world(gear, rot)

for x in (-2.55, 2.55):
    plinth = box("MILL-01_BEARING_PLINTH_L" if x < 0 else "MILL-01_BEARING_PLINTH_R",
                base + Vector((x, 0, 0.75)), (1.55, 3.3, 1.5), MAT_CONCRETE, 0.08)
    parent_keep_world(plinth, mill)
    saddle = box("MILL-01_BEARING_SADDLE_L" if x < 0 else "MILL-01_BEARING_SADDLE_R",
                 base + Vector((x, 0, 1.75)), (1.1, 2.25, 0.52), MAT_STEEL, 0.06)
    parent_keep_world(saddle, mill)

drive_base = box("MILL-01_DRIVE_BASE", base + Vector((2.75, -3.05, 0.42)), (3.1, 1.75, 0.45), MAT_STEEL, 0.04)
motor = cyl("MILL-01_MOTOR", base + Vector((2.75, -3.05, 1.02)), 0.55, 1.9, MAT_BLUE, axis="X", vertices=48)
gearbox = box("MILL-01_GEARBOX", base + Vector((1.15, -3.05, 1.02)), (1.05, 1.15, 1.15), MAT_STEEL_LIGHT, 0.10)
pinion = cyl("MILL-01_PINION", base + Vector((1.3, -2.55, 2.2)), 0.30, 0.72, MAT_ORANGE, axis="Y")
for o in (drive_base, motor, gearbox, pinion):
    parent_keep_world(o, mill)

# Continuous shell rotation: 6 s/rev at 30 fps.
rot.rotation_mode = "XYZ"
rot.rotation_euler = (0, 0, 0)
for frame, angle in ((1, 0), (46, math.pi / 2), (91, math.pi), (136, math.pi * 1.5), (180, math.tau)):
    rot.rotation_euler.x = angle
    rot.keyframe_insert(data_path="rotation_euler", frame=frame, index=0)
if rot.animation_data and rot.animation_data.action:
    rot.animation_data.action.name = "MILL-01_Rotation"

# ---------- SUMP-01 ----------
base = Vector((12.0, 0.0, 0.0))
sump = add_root(
    "SUMP-01", base, "4.4 L x 4.4 W x 3.4 H",
    "Open slurry sump with inlet/outlet nozzles; dimensions suitable for plant-scale visualization."
)

floor = box("SUMP-01_FLOOR", base + Vector((0, 0, 0.16)), (4.4, 4.4, 0.32), MAT_STEEL, 0.05)
wall_specs = [
    ("N", (0, 2.08, 1.65), (4.4, 0.24, 3.0)),
    ("S", (0, -2.08, 1.65), (4.4, 0.24, 3.0)),
    ("E", (2.08, 0, 1.65), (0.24, 4.0, 3.0)),
    ("W", (-2.08, 0, 1.65), (0.24, 4.0, 3.0)),
]
for suffix, l, d in wall_specs:
    obj = box(f"SUMP-01_WALL_{suffix}", base + Vector(l), d, MAT_STEEL_LIGHT, 0.035)
    parent_keep_world(obj, sump)
parent_keep_world(floor, sump)

slurry = box("SUMP-01_SLURRY_SURFACE", base + Vector((0, 0, 2.15)), (3.85, 3.85, 0.08), MAT_SLURRY, 0.02)
parent_keep_world(slurry, sump)

inlet = cyl("SUMP-01_INLET_NOZZLE", base + Vector((-2.55, 0.85, 2.55)), 0.22, 1.1, MAT_STEEL, axis="X")
outlet = cyl("SUMP-01_OUTLET_NOZZLE", base + Vector((2.55, -0.9, 0.8)), 0.18, 1.1, MAT_STEEL, axis="X")
for obj in (inlet, outlet):
    parent_keep_world(obj, sump)

for x in (-1.85, 1.85):
    for y in (-1.85, 1.85):
        leg = box(f"SUMP-01_LEG_{'P' if x>0 else 'N'}{'P' if y>0 else 'N'}",
                  base + Vector((x, y, -0.15)), (0.28, 0.28, 0.65), MAT_STEEL, 0.025)
        parent_keep_world(leg, sump)

# ---------- SLURRY-PUMP-01 ----------
base = Vector((21.0, 0.0, 0.0))
pump = add_root(
    "SLURRY-PUMP-01", base, "4.6 L x 2.1 W x 2.6 H",
    "Centrifugal slurry pump with axial suction, vertical discharge and animated coupling/shaft proxy."
)

baseplate = box("SLURRY-PUMP-01_BASEPLATE", base + Vector((0.35, 0, 0.18)), (4.5, 2.0, 0.36), MAT_STEEL, 0.05)
housing = sphere("SLURRY-PUMP-01_VOLUTE", base + Vector((-0.95, 0, 1.18)), (1.05, 0.72, 1.05), MAT_BLUE)
housing.rotation_euler[1] = math.radians(90)
suction = cyl("SLURRY-PUMP-01_SUCTION", base + Vector((-2.05, 0, 1.18)), 0.34, 1.45, MAT_STEEL_LIGHT, axis="X")
discharge = cyl("SLURRY-PUMP-01_DISCHARGE", base + Vector((-0.65, 0, 2.13)), 0.28, 1.25, MAT_STEEL_LIGHT, axis="Z")
motor_body = cyl("SLURRY-PUMP-01_MOTOR", base + Vector((1.35, 0, 1.02)), 0.58, 1.75, MAT_BLUE, axis="X", vertices=48)
motor_end = cyl("SLURRY-PUMP-01_MOTOR_ENDCAP", base + Vector((2.30, 0, 1.02)), 0.50, 0.28, MAT_STEEL, axis="X")
for obj in (baseplate, housing, suction, discharge, motor_body, motor_end):
    parent_keep_world(obj, pump)

shaft_rot = empty("SLURRY-PUMP-01_ROTATING_GROUP", base + Vector((0.20, 0, 1.18)))
parent_keep_world(shaft_rot, pump)
shaft = cyl("SLURRY-PUMP-01_SHAFT", base + Vector((0.20, 0, 1.18)), 0.11, 1.35, MAT_STEEL_LIGHT, axis="X")
coupling = cyl("SLURRY-PUMP-01_COUPLING", base + Vector((0.62, 0, 1.18)), 0.24, 0.42, MAT_ORANGE, axis="X")
for obj in (shaft, coupling):
    parent_keep_world(obj, shaft_rot)
shaft_rot.rotation_mode = "XYZ"
for frame, angle in ((1, 0), (12, math.pi / 2), (23, math.pi), (34, math.pi * 1.5), (45, math.tau)):
    shaft_rot.rotation_euler.x = angle
    shaft_rot.keyframe_insert(data_path="rotation_euler", frame=frame, index=0)
if shaft_rot.animation_data and shaft_rot.animation_data.action:
    shaft_rot.animation_data.action.name = "SLURRY-PUMP-01_ShaftRotation"

# ---------- CLASS-01 ----------
base = Vector((31.0, 0.0, 0.0))
cluster = add_root(
    "CLASS-01", base, "4.8 L x 4.8 W x 4.3 H",
    "Six 500 mm hydrocyclones with feed manifold, overflow header, underflow spigots and support frame."
)
cluster["cyclone_count"] = 6
cluster["cyclone_nominal_diameter_m"] = 0.50
cluster["animation_policy"] = "No mechanical motion; represent slurry flow in the web layer."

# Structural frame.
for x in (-1.9, 1.9):
    for y in (-1.9, 1.9):
        leg = box(f"CLASS-01_FRAME_LEG_{x:+.1f}_{y:+.1f}", base + Vector((x, y, 1.75)), (0.16, 0.16, 3.5), MAT_STEEL, 0.025)
        parent_keep_world(leg, cluster)
for y in (-1.9, 1.9):
    beam = box(f"CLASS-01_FRAME_BEAM_X_{y:+.1f}", base + Vector((0, y, 3.45)), (4.0, 0.16, 0.16), MAT_STEEL, 0.02)
    parent_keep_world(beam, cluster)
for x in (-1.9, 1.9):
    beam = box(f"CLASS-01_FRAME_BEAM_Y_{x:+.1f}", base + Vector((x, 0, 3.45)), (0.16, 4.0, 0.16), MAT_STEEL, 0.02)
    parent_keep_world(beam, cluster)

feed_manifold = cyl("CLASS-01_FEED_MANIFOLD", base + Vector((0, 0, 3.85)), 0.48, 0.8, MAT_BLUE, axis="Z", vertices=48)
overflow_header = cyl("CLASS-01_OVERFLOW_HEADER", base + Vector((0, 0, 4.15)), 0.28, 0.55, MAT_STEEL_LIGHT, axis="Z")
parent_keep_world(feed_manifold, cluster)
parent_keep_world(overflow_header, cluster)

ring_r = 1.48
for i in range(6):
    ang = math.tau * i / 6
    x = base.x + math.cos(ang) * ring_r
    y = base.y + math.sin(ang) * ring_r
    prefix = f"CLASS-01_CYCLONE_{i+1:02d}"
    upper = cyl(prefix + "_BARREL", (x, y, 3.05), 0.25, 0.72, MAT_BLUE, axis="Z", vertices=36)
    taper = cone(prefix + "_CONE", (x, y, 2.05), 0.07, 0.25, 1.55, MAT_BLUE, vertices=36)
    spigot = cyl(prefix + "_UNDERFLOW", (x, y, 1.13), 0.065, 0.38, MAT_STEEL_LIGHT, axis="Z", vertices=28)
    vortex = cyl(prefix + "_OVERFLOW", (x, y, 3.67), 0.075, 0.55, MAT_STEEL_LIGHT, axis="Z", vertices=28)
    for obj in (upper, taper, spigot, vortex):
        parent_keep_world(obj, cluster)
    # Radial feed connection to manifold.
    p1 = Vector((base.x + math.cos(ang)*0.40, base.y + math.sin(ang)*0.40, 3.82))
    p2 = Vector((x, y, 3.43))
    branch = pipe_between(prefix + "_FEED_BRANCH", p1, p2, 0.075, MAT_STEEL_LIGHT)
    parent_keep_world(branch, cluster)

feed_in = cyl("CLASS-01_FEED_INLET", base + Vector((-2.55, 0, 3.85)), 0.20, 1.6, MAT_STEEL_LIGHT, axis="X")
overflow_out = cyl("CLASS-01_OVERFLOW_OUTLET", base + Vector((0, 0, 4.55)), 0.16, 0.75, MAT_STEEL_LIGHT, axis="Z")
parent_keep_world(feed_in, cluster)
parent_keep_world(overflow_out, cluster)

# Web/export conventions per root.
for root in (mill, sump, pump, cluster):
    root["coordinate_system"] = "Z-up authoring / glTF export"
    root["meters_per_unit"] = 1.0
    root["optimized_for"] = "web GLB"

scene.frame_start = 1
scene.frame_end = 180

checkpoint = os.path.join(os.path.expanduser("~"), "OneDrive", "Desktop", "CHATON", "PULPA_LAB_BLENDER_CHECKPOINT_B2.blend")
bpy.ops.wm.save_as_mainfile(filepath=checkpoint)

def descendant_count(root):
    return 1 + len(root.children_recursive)

result = {
    "checkpoint": checkpoint,
    "roots": {
        root.name: {
            "dimensions_m": root.get("dimensions_m"),
            "objects_in_hierarchy": descendant_count(root),
        }
        for root in (mill, sump, pump, cluster)
    },
    "animations": [
        obj.animation_data.action.name
        for obj in (rot, shaft_rot)
        if obj.animation_data and obj.animation_data.action
    ],
    "scene_objects": len(scene.objects),
}
