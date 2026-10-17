import bpy
import math
import os
from mathutils import Vector

scene = bpy.context.scene
core = bpy.data.collections.get("REOLOGIA_CORE")
if core is None:
    raise RuntimeError("REOLOGIA_CORE collection not found.")

for qa in ["QA_CAMERA", "QA_KEY", "QA_FILL", "QA_GROUND"]:
    obj = bpy.data.objects.get(qa)
    if obj:
        bpy.data.objects.remove(obj, do_unlink=True)

MAT_STEEL = bpy.data.materials["MAT_Steel_Dark"]
MAT_STEEL_LIGHT = bpy.data.materials["MAT_Steel_Light"]
MAT_BLUE = bpy.data.materials["MAT_Industrial_Blue"]
MAT_ORANGE = bpy.data.materials["MAT_Safety_Orange"]
MAT_CONCRETE = bpy.data.materials["MAT_Concrete"]

def clear_detail(prefix):
    for obj in list(bpy.data.objects):
        if obj.name.startswith(prefix):
            bpy.data.objects.remove(obj, do_unlink=True)

for p in ("MILL-01_DETAIL_", "SUMP-01_DETAIL_", "SLURRY-PUMP-01_DETAIL_", "CLASS-01_DETAIL_"):
    clear_detail(p)

def move_to_core(obj):
    for col in list(obj.users_collection):
        col.objects.unlink(obj)
    core.objects.link(obj)

def set_mat(obj, mat):
    if hasattr(obj.data, "materials"):
        obj.data.materials.clear()
        obj.data.materials.append(mat)

def bevel(obj, width=0.04, segments=2):
    mod = obj.modifiers.new("EdgeSoftening", "BEVEL")
    mod.width = width
    mod.segments = segments

def box(name, loc, dims, mat, bw=0.035):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    o = bpy.context.object
    o.name = name
    o.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bw:
        bevel(o, bw, 2)
    set_mat(o, mat)
    move_to_core(o)
    return o

def cyl(name, loc, radius, depth, mat, axis="Z", vertices=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    o = bpy.context.object
    o.name = name
    if axis == "X":
        o.rotation_euler[1] = math.radians(90)
    elif axis == "Y":
        o.rotation_euler[0] = math.radians(90)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    set_mat(o, mat)
    move_to_core(o)
    return o

def torus(name, loc, major, minor, mat, axis="Z"):
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
        o.rotation_euler[1] = math.radians(90)
    elif axis == "Y":
        o.rotation_euler[0] = math.radians(90)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    set_mat(o, mat)
    move_to_core(o)
    return o

def parent_keep_world(child, parent):
    mw = child.matrix_world.copy()
    child.parent = parent
    child.matrix_world = mw

def pipe(name, a, b, radius, mat):
    a, b = Vector(a), Vector(b)
    v = b - a
    mid = (a + b) * 0.5
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=radius, depth=v.length, location=mid)
    o = bpy.context.object
    o.name = name
    o.rotation_mode = "QUATERNION"
    o.rotation_quaternion = v.to_track_quat("Z", "Y")
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    set_mat(o, mat)
    move_to_core(o)
    return o

# ---------- MILL-01 detail ----------
mill = bpy.data.objects["MILL-01"]
rot = bpy.data.objects["MILL-01_ROTATING_GROUP"]
for i, x in enumerate((-2.65, -1.35, 0.0, 1.35, 2.65), start=1):
    r = torus(f"MILL-01_DETAIL_SHELL_RIB_{i:02d}", (x, 0, 3.15), 2.31, 0.055, MAT_STEEL, axis="X")
    parent_keep_world(r, rot)
for i, x in enumerate((2.15, 2.55, 2.95, 3.35), start=1):
    fin = torus(f"MILL-01_DETAIL_MOTOR_FIN_{i:02d}", (x, -3.05, 1.02), 0.575, 0.024, MAT_STEEL, axis="X")
    parent_keep_world(fin, mill)
guard = box("MILL-01_DETAIL_PINION_GUARD", (1.35, -2.55, 2.18), (1.0, 0.85, 0.95), MAT_ORANGE, 0.08)
parent_keep_world(guard, mill)

# ---------- SUMP-01 detail ----------
sump = bpy.data.objects["SUMP-01"]
z_top = 3.20
rim_specs = [
    ((0, 2.12, z_top), (4.55, 0.14, 0.14)),
    ((0, -2.12, z_top), (4.55, 0.14, 0.14)),
    ((2.12, 0, z_top), (0.14, 4.30, 0.14)),
    ((-2.12, 0, z_top), (0.14, 4.30, 0.14)),
]
for i, (loc, dims) in enumerate(rim_specs, start=1):
    o = box(f"SUMP-01_DETAIL_TOP_RIM_{i:02d}", Vector((12,0,0)) + Vector(loc), dims, MAT_STEEL, 0.025)
    parent_keep_world(o, sump)

# Handrail on north/east/south sides; west left clearer for access and piping.
rail_z0, rail_z1 = 3.32, 4.22
posts = [
    (-1.9, 2.22), (0.0, 2.22), (1.9, 2.22),
    (2.22, 1.8), (2.22, 0.0), (2.22, -1.8),
    (1.9, -2.22), (0.0, -2.22), (-1.9, -2.22),
]
for i, (x, y) in enumerate(posts, start=1):
    o = pipe(f"SUMP-01_DETAIL_RAIL_POST_{i:02d}", (12+x, y, rail_z0), (12+x, y, rail_z1), 0.035, MAT_ORANGE)
    parent_keep_world(o, sump)
rail_segments = [
    ((10.1, 2.22, 4.17), (13.9, 2.22, 4.17)),
    ((10.1, 2.22, 3.75), (13.9, 2.22, 3.75)),
    ((14.22, 1.8, 4.17), (14.22, -1.8, 4.17)),
    ((14.22, 1.8, 3.75), (14.22, -1.8, 3.75)),
    ((13.9, -2.22, 4.17), (10.1, -2.22, 4.17)),
    ((13.9, -2.22, 3.75), (10.1, -2.22, 3.75)),
]
for i, (a, b) in enumerate(rail_segments, start=1):
    o = pipe(f"SUMP-01_DETAIL_RAIL_{i:02d}", a, b, 0.035, MAT_ORANGE)
    parent_keep_world(o, sump)

# Ladder on west wall.
for y in (-0.45, 0.45):
    o = pipe("SUMP-01_DETAIL_LADDER_SIDE_A" if y < 0 else "SUMP-01_DETAIL_LADDER_SIDE_B",
             (9.78, y, 0.15), (9.78, y, 3.75), 0.032, MAT_STEEL_LIGHT)
    parent_keep_world(o, sump)
for i, z in enumerate([0.45, 0.85, 1.25, 1.65, 2.05, 2.45, 2.85, 3.25], start=1):
    o = pipe(f"SUMP-01_DETAIL_LADDER_RUNG_{i:02d}", (9.78, -0.45, z), (9.78, 0.45, z), 0.026, MAT_STEEL_LIGHT)
    parent_keep_world(o, sump)

for name, loc, major, axis in [
    ("SUMP-01_DETAIL_INLET_FLANGE", (9.45, 0.85, 2.55), 0.30, "X"),
    ("SUMP-01_DETAIL_OUTLET_FLANGE", (14.55, -0.9, 0.80), 0.25, "X"),
]:
    o = torus(name, loc, major, 0.055, MAT_STEEL_LIGHT, axis=axis)
    parent_keep_world(o, sump)

# ---------- SLURRY-PUMP-01 detail ----------
pump = bpy.data.objects["SLURRY-PUMP-01"]
old = bpy.data.objects.get("SLURRY-PUMP-01_VOLUTE")
if old:
    bpy.data.objects.remove(old, do_unlink=True)

core_casing = cyl("SLURRY-PUMP-01_DETAIL_CASING_CORE", (20.05, 0, 1.18), 0.92, 0.62, MAT_BLUE, axis="X", vertices=48)
parent_keep_world(core_casing, pump)

# Spiral volute tube in YZ plane around pump axis.
curve_data = bpy.data.curves.new("SLURRY-PUMP-01_DETAIL_VOLUTE_CURVE_DATA", type="CURVE")
curve_data.dimensions = "3D"
curve_data.bevel_depth = 0.18
curve_data.bevel_resolution = 3
spline = curve_data.splines.new("POLY")
count = 48
spline.points.add(count - 1)
cx, cy, cz = 20.05, 0.0, 1.18
for i in range(count):
    t = i / (count - 1)
    ang = -0.25 * math.pi + t * 1.82 * math.pi
    r = 0.56 + 0.46 * t
    y = cy + math.cos(ang) * r
    z = cz + math.sin(ang) * r
    spline.points[i].co = (cx, y, z, 1.0)
volute = bpy.data.objects.new("SLURRY-PUMP-01_DETAIL_VOLUTE_SPIRAL", curve_data)
core.objects.link(volute)
curve_data.materials.append(MAT_BLUE)
parent_keep_world(volute, pump)

for name, loc, major, axis in [
    ("SLURRY-PUMP-01_DETAIL_SUCTION_FLANGE", (18.35, 0, 1.18), 0.43, "X"),
    ("SLURRY-PUMP-01_DETAIL_DISCHARGE_FLANGE", (20.35, 0, 2.78), 0.35, "Z"),
]:
    o = torus(name, loc, major, 0.07, MAT_STEEL_LIGHT, axis=axis)
    parent_keep_world(o, pump)

for i, x in enumerate((21.75, 22.05, 22.35, 22.65, 22.95), start=1):
    fin = torus(f"SLURRY-PUMP-01_DETAIL_MOTOR_FIN_{i:02d}", (x, 0, 1.02), 0.605, 0.025, MAT_STEEL, axis="X")
    parent_keep_world(fin, pump)

guard = box("SLURRY-PUMP-01_DETAIL_COUPLING_GUARD", (21.15, 0, 1.18), (0.82, 0.82, 0.76), MAT_ORANGE, 0.07)
parent_keep_world(guard, pump)
for i, x in enumerate((-0.95, 1.35), start=1):
    foot = box(f"SLURRY-PUMP-01_DETAIL_SUPPORT_{i:02d}", (21+x, 0, 0.48), (0.75, 1.15, 0.36), MAT_STEEL, 0.04)
    parent_keep_world(foot, pump)

# ---------- CLASS-01 detail ----------
cluster = bpy.data.objects["CLASS-01"]
# Perimeter maintenance platform strips around cyclone cluster.
platforms = [
    ((31, 2.05, 3.35), (4.3, 0.55, 0.10)),
    ((31, -2.05, 3.35), (4.3, 0.55, 0.10)),
    ((33.95, 0, 3.35), (0.55, 3.6, 0.10)),
    ((28.05, 0, 3.35), (0.55, 3.6, 0.10)),
]
for i, (loc, dims) in enumerate(platforms, start=1):
    o = box(f"CLASS-01_DETAIL_PLATFORM_{i:02d}", loc, dims, MAT_STEEL, 0.015)
    parent_keep_world(o, cluster)

# Overflow branches and top rail.
ring_r = 1.48
for i in range(6):
    ang = math.tau * i / 6
    x = 31 + math.cos(ang) * ring_r
    y = math.sin(ang) * ring_r
    a = (x, y, 3.95)
    b = (31 + math.cos(ang)*0.34, math.sin(ang)*0.34, 4.15)
    o = pipe(f"CLASS-01_DETAIL_OVERFLOW_BRANCH_{i+1:02d}", a, b, 0.055, MAT_STEEL_LIGHT)
    parent_keep_world(o, cluster)

# Sparse safety rail around two accessible sides to preserve visibility.
for i, (x, y) in enumerate([(28.0, -2.35), (31.0, -2.35), (34.0, -2.35), (34.25, -1.6), (34.25, 0), (34.25, 1.6)], start=1):
    o = pipe(f"CLASS-01_DETAIL_RAIL_POST_{i:02d}", (x, y, 3.42), (x, y, 4.35), 0.03, MAT_ORANGE)
    parent_keep_world(o, cluster)
for i, (a, b) in enumerate([
    ((28.0, -2.35, 4.30), (34.0, -2.35, 4.30)),
    ((28.0, -2.35, 3.88), (34.0, -2.35, 3.88)),
    ((34.25, -1.6, 4.30), (34.25, 1.6, 4.30)),
    ((34.25, -1.6, 3.88), (34.25, 1.6, 3.88)),
], start=1):
    o = pipe(f"CLASS-01_DETAIL_RAIL_{i:02d}", a, b, 0.03, MAT_ORANGE)
    parent_keep_world(o, cluster)

checkpoint = os.path.join(os.path.expanduser("~"), "OneDrive", "Desktop", "CHATON", "PULPA_LAB_BLENDER_CHECKPOINT_B2_REFINED.blend")
bpy.ops.wm.save_as_mainfile(filepath=checkpoint)

result = {
    "checkpoint": checkpoint,
    "detail_counts": {
        prefix: sum(1 for o in bpy.data.objects if o.name.startswith(prefix))
        for prefix in ("MILL-01_DETAIL_", "SUMP-01_DETAIL_", "SLURRY-PUMP-01_DETAIL_", "CLASS-01_DETAIL_")
    },
    "scene_objects": len(scene.objects),
}
