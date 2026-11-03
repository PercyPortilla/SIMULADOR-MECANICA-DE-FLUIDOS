"""L359 independent Blender BVH audit of signed V57 source and authentic L354 CAD.

Runs only in headless Blender 5.2 on the isolated signed L59 .blend, never saves
that source or modifies the web GLB. Uses signed L354 native STL→world mapping.
This is a geometric preassembly gate, NOT pressure/CFD certification.
"""
import bpy
import hashlib
import json
import struct
import sys
from pathlib import Path
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

args = sys.argv[sys.argv.index("--") + 1:]
out = Path(args[0])
out.parent.mkdir(parents=True, exist_ok=True)
lab = Path(args[1])
sw = lab / "sw_lab_sources"
native_dir = sw / "L354_SUCTION_EYE_SEG02_ADAPTER_NATIVE_20261102"
stl = native_dir / "L354_SEG02_TO_L133_OPEN_ANNULAR_LOFT_EDU_NO_PRESSURE.STL"
gate = json.loads((native_dir / "L354_NATIVE_STL_LOCAL_TO_WORLD_TRANSFORM_QA.json").read_text(encoding="utf-8"))
native_qa = json.loads((native_dir / "L354_INDEPENDENT_SOURCE_TO_NATIVE_BREP_QA.json").read_text(encoding="utf-8"))
assert native_qa["new_adapter_design"]["source_end_normal_matches_SEG02"] is False
matrix = Matrix(gate["STL_to_world_4x4_m_per_mm"])

def sha(path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            b = f.read(1024*1024)
            if not b:
                return h.hexdigest()
            h.update(b)

def load_binary_stl(p):
    buf = p.read_bytes()
    n, = struct.unpack_from("<I", buf, 80)
    assert 84 + 50 * n == len(buf)
    vertices, faces = [], []
    for i in range(n):
        row = struct.unpack_from("<12f", buf, 84+i*50)
        face=[]
        for j in range(3):
            face.append(len(vertices))
            vertices.append(matrix @ Vector(row[3+3*j:6+3*j]))
        faces.append(tuple(face))
    return geometry(vertices, faces)

def geometry(vertices, faces):
    return {
        "vertices": vertices,
        "faces": faces,
        "tree": BVHTree.FromPolygons(vertices, faces, all_triangles=True, epsilon=0),
        "bounds": [[min(v[i] for v in vertices), max(v[i] for v in vertices)] for i in range(3)],
        "triangles": len(faces),
    }

def original_mesh(o):
    dg = bpy.context.evaluated_depsgraph_get()
    m = o.evaluated_get(dg)
    mesh = m.to_mesh()
    try:
        mesh.calc_loop_triangles()
        return geometry(
            [m.matrix_world @ vert.co for vert in mesh.vertices],
            [tuple(t.vertices) for t in mesh.loop_triangles],
        )
    finally:
        m.to_mesh_clear()

def ray(g, origin, direction, length):
    p, n, face, distance = g["tree"].ray_cast(Vector(origin), Vector(direction), length)
    return {
        "first_hit_xyz": list(p) if p is not None else None,
        "distance_m": float(distance) if p is not None else None,
        "face_index": face,
    }

def compact(g):
    return {"bounds_world_m":g["bounds"],"triangles":g["triangles"]}

assert bpy.context.scene.unit_settings.system == "METRIC"
names = [o.name for o in bpy.data.objects if
         "SUCTION_SEG02" in o.name or "CASING_HUB" in o.name or "DISCHARGE_PIPE" in o.name]
target_groups = [
    ("source_suction_seg02", "SLURRY-PUMP-01_SUCTION_SEG02_LAB"),
    ("source_hub", "SLURRY-PUMP-01_CASING_HUB_LAB"),
    ("source_discharge", "SLURRY-PUMP-01_DISCHARGE_PIPE_LAB"),
]
models = {}
missing = []
for key,name in target_groups:
    obj=bpy.data.objects.get(name)
    if obj is None or obj.type!="MESH":
        missing.append(name)
    else:
        models[key] = original_mesh(obj)
assert not missing, "Missing source signed Blender objects: " + ", ".join(missing)
adapter = load_binary_stl(stl)

tests = {}
for key,g in models.items():
    pairs = len(adapter["tree"].overlap(g["tree"]))
    tests[key] = {
        "source":compact(g),
        "adapter_surface_triangle_intersection_pairs":pairs,
    }

source_axis_start = (202.2,90.0,22.2)
axis = (1,0,0)
ray_tests = {
    "source_seg02_past_end":ray(models["source_suction_seg02"],source_axis_start,axis,4),
    "original_hub_blocker":ray(models["source_hub"],source_axis_start,axis,4),
    "candidate_annular_adapter_clear_center":ray(adapter,source_axis_start,axis,4),
    "source_discharge_up_from_z22":ray(models["source_discharge"],(205,90,22),(0,0,1),6),
}
report={
    "block":"L359",
    "status":"PASS_READONLY_COMPARATIVE_BVH__NO_GO_ORIGINAL_WET_MATE",
    "blender_version":bpy.app.version_string,
    "source_scene":bpy.data.filepath,
    "source_scene_sha256":sha(Path(bpy.data.filepath)),
    "source_scene_not_saved":True,
    "original_objects":len(bpy.data.objects),
    "native_CAD_STL_sha256":sha(stl),
    "native_CAD_STEP_qa":native_qa["status"],
    "native_CAD_STL_to_world_4x4":gate["STL_to_world_4x4_m_per_mm"],
    "native_STL_placement_study_only":True,
    "source_names_found":names,
    "adapter_world":compact(adapter),
    "comparison":tests,
    "axis_ray_tests":ray_tests,
    "source_end_angle_residual_deg":native_qa["measured_source_entry_angle_residual_deg"],
    "source_end_mated":False,
    "source_hub_open":False,
    "source_discharge_open":False,
    "one_connected_pump_wet_fluid_domain":False,
    "hydraulic_source_mate_GO":False,
    "warnings":[
        "Mesh triangle surface overlaps alone cannot prove or reject sealed volume contact.",
        "Signed L354 orientation and L133 hypothetical ID do not establish an industrial wet mate.",
        "Solver and source CAD/GLB were not modified; no edited .blend was written.",
    ],
}
out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print("L359_BVH",json.dumps({
    "adapter_triangles":adapter["triangles"],
    "intersect_pairs":{k:v["adapter_surface_triangle_intersection_pairs"] for k,v in tests.items()},
    "source_blockers":ray_tests,
    "output":str(out),
},ensure_ascii=False))
