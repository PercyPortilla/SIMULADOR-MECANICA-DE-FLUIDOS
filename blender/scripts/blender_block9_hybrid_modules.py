import bpy
import math
import os
from mathutils import Vector

MASTER = os.path.join(os.path.expanduser("~"), "OneDrive", "Desktop", "CHATON", "PULPA_LAB_BLENDER_MASTER_V14.blend")
if bpy.data.filepath != MASTER and os.path.exists(MASTER):
    bpy.ops.wm.open_mainfile(filepath=MASTER)

root_collection = bpy.data.collections.get("PULPA_LAB_ASSETS")
if root_collection is None:
    root_collection = bpy.data.collections.new("PULPA_LAB_ASSETS")
    bpy.context.scene.collection.children.link(root_collection)

modules = bpy.data.collections.get("V15_HYBRID_MODULES")
if modules is not None:
    for obj in list(modules.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
else:
    modules = bpy.data.collections.new("V15_HYBRID_MODULES")
    root_collection.children.link(modules)


def mat(name, color, metallic=0.0, roughness=0.5):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = next((n for n in material.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf:
        for socket in bsdf.inputs:
            if socket.name == "Base Color":
                socket.default_value = (*color, 1)
            elif socket.name == "Metallic":
                socket.default_value = metallic
            elif socket.name == "Roughness":
                socket.default_value = roughness
    return material


STEEL = mat("V15_Steel", (0.20, 0.24, 0.25), 0.72, 0.36)
PAINT = mat("V15_Painted_Steel", (0.30, 0.36, 0.37), 0.52, 0.43)
SAFETY = mat("V15_Safety", (0.93, 0.55, 0.06), 0.22, 0.42)
RUBBER = mat("V15_Rubber", (0.028, 0.032, 0.034), 0.03, 0.92)
LINER = mat("V15_Wear_Liner", (0.08, 0.085, 0.09), 0.42, 0.58)
MOTOR = mat("V15_Motor_Blue", (0.07, 0.18, 0.26), 0.48, 0.42)
GALV = mat("V15_Galvanized", (0.48, 0.53, 0.54), 0.72, 0.33)


def move(obj):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    modules.objects.link(obj)


def assign(obj, material):
    if hasattr(obj.data, "materials"):
        obj.data.materials.clear()
        obj.data.materials.append(material)


def bevel(obj, width=0.025, segments=2):
    mod = obj.modifiers.new("EdgeSoftening", "BEVEL")
    mod.width = width
    mod.segments = segments


def box(name, loc, dims, material, rot=(0, 0, 0), bw=0.025):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bw:
        bevel(obj, bw)
    assign(obj, material)
    move(obj)
    return obj


def cyl(name, loc, radius, depth, material, axis="Z", verts=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc)
    obj = bpy.context.object
    obj.name = name
    if axis == "X":
        obj.rotation_euler[1] = math.pi / 2
    elif axis == "Y":
        obj.rotation_euler[0] = math.pi / 2
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    assign(obj, material)
    move(obj)
    return obj


def torus(name, loc, major, minor, material, axis="X", major_segments=32):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major,
        minor_radius=minor,
        major_segments=major_segments,
        minor_segments=10,
        location=loc,
    )
    obj = bpy.context.object
    obj.name = name
    if axis == "X":
        obj.rotation_euler[1] = math.pi / 2
    elif axis == "Y":
        obj.rotation_euler[0] = math.pi / 2
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    assign(obj, material)
    move(obj)
    return obj


def pipe(name, a, b, radius, material, verts=16):
    a, b = Vector(a), Vector(b)
    v = b - a
    mid = (a + b) * 0.5
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=v.length, location=mid)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = v.to_track_quat("Z", "Y")
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    assign(obj, material)
    move(obj)
    return obj


def root(name, metadata=None):
    obj = bpy.data.objects.new(name, None)
    modules.objects.link(obj)
    obj.empty_display_type = "PLAIN_AXES"
    obj["web_asset"] = True
    obj["v15_hybrid_module"] = True
    if metadata:
        for key, value in metadata.items():
            obj[key] = value
    return obj


def parent(obj, parent_obj):
    world = obj.matrix_world.copy()
    obj.parent = parent_obj
    obj.matrix_world = world


def add_bolts(parent_obj, x, radius, count=8):
    for i in range(count):
        angle = math.tau * i / count
        bolt = cyl(
            f"{parent_obj.name}_BOLT_{i+1:02d}",
            (x, math.cos(angle) * radius, math.sin(angle) * radius),
            0.018,
            0.045,
            STEEL,
            axis="X",
            verts=10,
        )
        parent(bolt, parent_obj)


def export_asset(asset_root, filename):
    bpy.ops.object.select_all(action="DESELECT")
    asset_root.select_set(True)
    for child in asset_root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = asset_root
    outdir = os.path.join(os.path.expanduser("~"), "OneDrive", "Desktop", "CHATON", "PULPA_LAB_GLBS", "v15-modules")
    os.makedirs(outdir, exist_ok=True)
    path = os.path.join(outdir, filename)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_animations=False,
        export_yup=True,
        export_apply=True,
    )
    return path


# ---------------------------------------------------------------------------
# Conveyor head station. Process flow axis: +X. Nominal belt width: 1.40 m.
# ---------------------------------------------------------------------------
head = root("CONVEYOR-HEAD-MODULE", {"nominal_belt_width_m": 1.4, "flow_axis": "+X"})
for y in (-0.83, 0.83):
    bearing = box(f"CONVEYOR-HEAD_BEARING_{'L' if y < 0 else 'R'}", (0, y, 0.02), (0.42, 0.34, 0.42), STEEL, bw=0.055)
    parent(bearing, head)
pulley = cyl("CONVEYOR-HEAD_PULLEY", (0, 0, 0.02), 0.34, 1.72, RUBBER, axis="Y", verts=40)
parent(pulley, head)
shaft = cyl("CONVEYOR-HEAD_SHAFT", (0, 0, 0.02), 0.105, 2.05, STEEL, axis="Y", verts=24)
parent(shaft, head)
guard = box("CONVEYOR-HEAD_GUARD", (-0.10, -1.14, 0.18), (1.35, 0.16, 1.05), SAFETY, bw=0.07)
parent(guard, head)
gearbox = box("CONVEYOR-HEAD_GEARBOX", (-0.70, -1.45, 0.03), (0.82, 0.72, 0.72), PAINT, bw=0.09)
parent(gearbox, head)
motor = cyl("CONVEYOR-HEAD_MOTOR", (-1.48, -1.45, 0.03), 0.32, 1.05, MOTOR, axis="X", verts=36)
parent(motor, head)
for x in (-1.82, -1.55, -1.28, -1.01):
    fin = torus(f"CONVEYOR-HEAD_MOTOR_FIN_{x}", (x, -1.45, 0.03), 0.33, 0.022, STEEL, axis="X")
    parent(fin, head)
for y in (-0.95, 0.95):
    leg = box(f"CONVEYOR-HEAD_LEG_{y}", (0, y, -0.72), (0.22, 0.22, 1.15), STEEL, bw=0.025)
    parent(leg, head)
    foot = box(f"CONVEYOR-HEAD_FOOT_{y}", (0, y, -1.31), (0.58, 0.52, 0.10), GALV, bw=0.015)
    parent(foot, head)
beam = box("CONVEYOR-HEAD_CROSSBEAM", (0, 0, -0.12), (0.24, 2.35, 0.24), STEEL, bw=0.025)
parent(beam, head)


# ---------------------------------------------------------------------------
# Conveyor tail/take-up station.
# ---------------------------------------------------------------------------
tail = root("CONVEYOR-TAIL-MODULE", {"nominal_belt_width_m": 1.4, "flow_axis": "+X"})
pulley = cyl("CONVEYOR-TAIL_PULLEY", (0, 0, 0.02), 0.34, 1.72, RUBBER, axis="Y", verts=40)
parent(pulley, tail)
shaft = cyl("CONVEYOR-TAIL_SHAFT", (0, 0, 0.02), 0.10, 2.02, STEEL, axis="Y", verts=24)
parent(shaft, tail)
for y in (-0.83, 0.83):
    bearing = box(f"CONVEYOR-TAIL_BEARING_{'L' if y < 0 else 'R'}", (0, y, 0.02), (0.42, 0.34, 0.42), STEEL, bw=0.055)
    parent(bearing, tail)
    rail = box(f"CONVEYOR-TAIL_TAKEUP_RAIL_{'L' if y < 0 else 'R'}", (-0.72, y, -0.16), (1.70, 0.14, 0.14), PAINT, bw=0.02)
    parent(rail, tail)
    screw = cyl(f"CONVEYOR-TAIL_TAKEUP_SCREW_{'L' if y < 0 else 'R'}", (-0.78, y, 0.03), 0.045, 1.28, GALV, axis="X", verts=16)
    parent(screw, tail)
    foot = box(f"CONVEYOR-TAIL_FOOT_{'L' if y < 0 else 'R'}", (-0.1, y, -0.62), (0.62, 0.52, 0.10), GALV, bw=0.015)
    parent(foot, tail)
frame = box("CONVEYOR-TAIL_FRAME", (-0.10, 0, -0.24), (1.90, 2.20, 0.18), STEEL, bw=0.025)
parent(frame, tail)


# ---------------------------------------------------------------------------
# Troughing idler module. Local X is belt travel; Y is cross-belt in Blender,
# which exports as Z lateral in Three.js after Y-up conversion.
# ---------------------------------------------------------------------------
idler = root("CONVEYOR-IDLER-MODULE", {"nominal_belt_width_m": 1.4, "flow_axis": "+X"})
base = box("CONVEYOR-IDLER_BASE", (0, 0, -0.16), (0.18, 1.95, 0.14), STEEL, bw=0.02)
parent(base, idler)
center = cyl("CONVEYOR-IDLER_CENTER_ROLL", (0, 0, 0.02), 0.075, 0.72, GALV, axis="Y", verts=18)
parent(center, idler)
for side in (-1, 1):
    y = side * 0.61
    roll = cyl(
        f"CONVEYOR-IDLER_SIDE_{'L' if side < 0 else 'R'}",
        (0, y, 0.17),
        0.075,
        0.62,
        GALV,
        axis="Y",
        verts=18,
    )
    roll.rotation_euler[0] = math.radians(side * 22)
    parent(roll, idler)
    bracket = box(
        f"CONVEYOR-IDLER_BRACKET_{'L' if side < 0 else 'R'}",
        (0, side * 0.93, -0.01),
        (0.16, 0.12, 0.48),
        STEEL,
        rot=(math.radians(side * 22), 0, 0),
        bw=0.018,
    )
    parent(bracket, idler)


# ---------------------------------------------------------------------------
# Discharge hood / transfer point. Open at +X toward downstream equipment.
# ---------------------------------------------------------------------------
hood = root("CONVEYOR-TRANSFER-HOOD", {"nominal_belt_width_m": 1.4, "flow_axis": "+X"})
roof = box("TRANSFER-HOOD_ROOF", (0.20, 0, 0.70), (1.75, 1.95, 0.14), PAINT, bw=0.04)
parent(roof, hood)
for side in (-1, 1):
    wall = box(
        f"TRANSFER-HOOD_SIDE_{'L' if side < 0 else 'R'}",
        (0.18, side * 0.91, 0.25),
        (1.75, 0.12, 0.95),
        PAINT,
        bw=0.035,
    )
    parent(wall, hood)
    liner = box(
        f"TRANSFER-HOOD_LINER_{'L' if side < 0 else 'R'}",
        (0.20, side * 0.84, 0.21),
        (1.52, 0.055, 0.70),
        LINER,
        bw=0.01,
    )
    parent(liner, hood)
front = box("TRANSFER-HOOD_INSPECTION_DOOR", (-0.48, -0.99, 0.35), (0.64, 0.08, 0.58), STEEL, bw=0.05)
parent(front, hood)
for z in (0.14, 0.48):
    rib = box(f"TRANSFER-HOOD_RIB_{z}", (0.15, 0, z), (0.08, 2.03, 0.08), STEEL, bw=0.012)
    parent(rib, hood)


# ---------------------------------------------------------------------------
# Generic industrial valve. Base pipe OD: 0.40 m. Process axis: +X.
# ---------------------------------------------------------------------------
valve = root("PIPE-VALVE-MODULE", {"nominal_pipe_od_m": 0.4, "flow_axis": "+X"})
body = cyl("PIPE-VALVE_BODY", (0, 0, 0), 0.29, 0.48, PAINT, axis="X", verts=40)
parent(body, valve)
for x in (-0.29, 0.29):
    flange = cyl(f"PIPE-VALVE_FLANGE_{'A' if x < 0 else 'B'}", (x, 0, 0), 0.34, 0.09, STEEL, axis="X", verts=36)
    parent(flange, valve)
    add_bolts(valve, x, 0.265, 8)
stem = cyl("PIPE-VALVE_STEM", (0, 0, 0.40), 0.045, 0.52, STEEL, verts=18)
parent(stem, valve)
wheel = torus("PIPE-VALVE_HANDWHEEL", (0, 0, 0.74), 0.30, 0.032, SAFETY, axis="Z", major_segments=36)
parent(wheel, valve)
hub = cyl("PIPE-VALVE_HANDWHEEL_HUB", (0, 0, 0.74), 0.055, 0.11, STEEL, verts=16)
parent(hub, valve)
for a in range(0, 360, 90):
    angle = math.radians(a)
    spoke = pipe(
        f"PIPE-VALVE_SPOKE_{a}",
        (0, 0, 0.74),
        (math.cos(angle) * 0.25, math.sin(angle) * 0.25, 0.74),
        0.018,
        SAFETY,
        verts=10,
    )
    parent(spoke, valve)


# ---------------------------------------------------------------------------
# Flange pair module with visible bolt circle. Base OD: 0.40 m, axis +X.
# ---------------------------------------------------------------------------
flange_root = root("PIPE-FLANGE-MODULE", {"nominal_pipe_od_m": 0.4, "flow_axis": "+X"})
for x in (-0.055, 0.055):
    ring = cyl(f"PIPE-FLANGE_RING_{x:+.3f}", (x, 0, 0), 0.34, 0.075, STEEL, axis="X", verts=36)
    parent(ring, flange_root)
gasket = cyl("PIPE-FLANGE_GASKET", (0, 0, 0), 0.255, 0.025, LINER, axis="X", verts=32)
parent(gasket, flange_root)
add_bolts(flange_root, 0, 0.265, 8)


# ---------------------------------------------------------------------------
# Pipe saddle / clamp module. Base OD: 0.40 m.
# ---------------------------------------------------------------------------
saddle = root("PIPE-SADDLE-MODULE", {"nominal_pipe_od_m": 0.4, "flow_axis": "+X"})
base = box("PIPE-SADDLE_BASE", (0, 0, -0.30), (0.72, 0.58, 0.13), GALV, bw=0.025)
parent(base, saddle)
pedestal = box("PIPE-SADDLE_PEDESTAL", (0, 0, -0.17), (0.24, 0.34, 0.24), STEEL, bw=0.025)
parent(pedestal, saddle)
band = torus("PIPE-SADDLE_CLAMP", (0, 0, 0), 0.235, 0.032, GALV, axis="X", major_segments=32)
parent(band, saddle)
for y in (-0.24, 0.24):
    lug = box(f"PIPE-SADDLE_LUG_{y}", (0, y, -0.03), (0.16, 0.10, 0.22), STEEL, bw=0.02)
    parent(lug, saddle)


assets = [
    (head, "CONVEYOR-HEAD-MODULE.glb"),
    (tail, "CONVEYOR-TAIL-MODULE.glb"),
    (idler, "CONVEYOR-IDLER-MODULE.glb"),
    (hood, "CONVEYOR-TRANSFER-HOOD.glb"),
    (valve, "PIPE-VALVE-MODULE.glb"),
    (flange_root, "PIPE-FLANGE-MODULE.glb"),
    (saddle, "PIPE-SADDLE-MODULE.glb"),
]

exports = {}
for asset, filename in assets:
    path = export_asset(asset, filename)
    exports[asset.name] = {
        "path": path,
        "bytes": os.path.getsize(path),
        "objects": 1 + len(asset.children_recursive),
    }

master_v15 = os.path.join(os.path.expanduser("~"), "OneDrive", "Desktop", "CHATON", "PULPA_LAB_BLENDER_MASTER_V15.blend")
bpy.ops.wm.save_as_mainfile(filepath=master_v15)
result = {"master": master_v15, "exports": exports}
