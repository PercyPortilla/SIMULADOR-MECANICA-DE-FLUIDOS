"""L362: independent Blender source-mesh BVH check of corrected native L358.

Pure read-only: signed L59 .blend, L358 STEP/STL and B64 transforms untouched.
This evaluates triangle-level interference, not watertight hydraulic mating.
"""
import bpy, json, struct, sys, hashlib
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

out=Path(sys.argv[sys.argv.index("--")+1])
root=Path(sys.argv[sys.argv.index("--")+2])
src=root/"sw_lab_sources/L358_SOURCE_ANGLE_CORRECTION_NATIVE_20261102"
stl=src/"L358_B_3POINT_SOURCE_ANGLE_INLET_TRUE_OPEN_EDUCATIONAL.STL"
aff=json.loads((src/"L358_NATIVE_STL_MM_TO_B64_WORLD_AFFINE_QA.json").read_text("utf8"))
qa=json.loads((src/"L358_INDEPENDENT_STEP_TRUE_SOURCE_ANGLE_AND_LUMEN_QA.json").read_text("utf8"))
assert "PASS_REAL_SW2026_EDU_SOURCE_ANGLE" in qa["status"]
assert qa["checks"]["actual_SOURCE_wet_mate_GO"] is False
matrix=Matrix(aff["affine_native_STL_mm_to_world_m_4x4"])

def mesh_geometry(vs,fs):
    return {"tree":BVHTree.FromPolygons(vs,fs,all_triangles=True,epsilon=0),
            "bbox":[[min(p[i] for p in vs),max(p[i] for p in vs)] for i in range(3)],
            "triangles":len(fs)}

def native():
    data=stl.read_bytes()
    n,=struct.unpack_from("<I",data,80)
    assert len(data)==84+n*50
    vs=[];fs=[]
    for i in range(n):
        a=struct.unpack_from("<12f",data,84+i*50)
        face=[]
        for j in range(3):
            face.append(len(vs));vs.append(matrix@Vector(a[3+3*j:6+3*j]))
        fs.append(tuple(face))
    return mesh_geometry(vs,fs)

def original(name):
    ob=bpy.data.objects.get(name)
    assert ob is not None and ob.type=="MESH",name
    dg=bpy.context.evaluated_depsgraph_get()
    evaluated=ob.evaluated_get(dg)
    m=evaluated.to_mesh()
    try:
        m.calc_loop_triangles()
        return mesh_geometry(
            [evaluated.matrix_world@v.co for v in m.vertices],
            [tuple(face.vertices) for face in m.loop_triangles])
    finally:
        evaluated.to_mesh_clear()

def ray(g,start,direction,maxdist=5):
    p,n,idx,dist=g["tree"].ray_cast(Vector(start),Vector(direction),maxdist)
    return {"hit_world_m":list(p) if p else None,"distance_m":float(dist) if p else None,"face":idx}

o={
 "suction_seg02": original("SLURRY-PUMP-01_SUCTION_SEG02_LAB"),
 "hub": original("SLURRY-PUMP-01_CASING_HUB_LAB"),
 "discharge": original("SLURRY-PUMP-01_DISCHARGE_PIPE_LAB"),
}
a=native()
comparisons={}
for name,geo in o.items():
    comparisons[name]={
      "source_bbox_world_m":geo["bbox"],
      "surface_triangle_pairs_overlapping":len(a["tree"].overlap(geo["tree"])),
    }
axis=(202.2,90,22.2)
rays={
 "source_suction_cap":ray(o["suction_seg02"],axis,(1,0,0)),
 "source_hub_cap":ray(o["hub"],axis,(1,0,0)),
 "new_L358_centerline":ray(a,axis,(1,0,0)),
 "source_discharge_cap":ray(o["discharge"],(205,90,22),(0,0,1),6),
}
report={
 "block":"L362",
 "status":"PASS_INDEPENDENT_L358_NATIVE_CANDIDATE_BVH__NO_GO_SOURCE_WET_MATE",
 "blender_version":bpy.app.version_string,
 "original_blend_source_not_modified":True,
 "source_blend_sha256":hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest(),
 "new_L358_native_stl_sha256":hashlib.sha256(stl.read_bytes()).hexdigest(),
 "candidate_pose_signed_affine":aff["affine_native_STL_mm_to_world_m_4x4"],
 "native_candidate_triangles":a["triangles"],
 "native_candidate_world_bbox":a["bbox"],
 "input_verified_STEP_inlet_angle_error_deg":qa["measured_native_inlet_face_normal_angular_error_deg"],
 "source_signed_capped_geometry_preserved":True,
 "candidate_mesh_bvh_surface_overlaps":comparisons,
 "rays":rays,
 "source_hydraulic_mate_pass":False,
 "notes":"Surface overlap pairs measure triangles, NOT collision volume; original caps remain and prevent certified wet continuity.",
}
assert rays["source_suction_cap"]["hit_world_m"] is not None
assert rays["source_hub_cap"]["hit_world_m"] is not None
assert rays["new_L358_centerline"]["hit_world_m"] is None
assert rays["source_discharge_cap"]["hit_world_m"] is not None
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
print("L362_BVH",json.dumps({"pairs":{k:v["surface_triangle_pairs_overlapping"] for k,v in comparisons.items()},
 "signed_inlet_error_deg":qa["measured_native_inlet_face_normal_angular_error_deg"],
 "source_caps_still_blocked":True,"output":str(out)},ensure_ascii=False))
