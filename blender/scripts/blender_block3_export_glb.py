import bpy
import os
from mathutils import Matrix

scene = bpy.context.scene
asset_names = ["MILL-01", "SUMP-01", "SLURRY-PUMP-01", "CLASS-01"]
roots = [bpy.data.objects.get(n) for n in asset_names]
if any(r is None for r in roots):
    missing = [n for n, r in zip(asset_names, roots) if r is None]
    raise RuntimeError(f"Missing asset roots: {missing}")

export_dir = os.path.join(os.path.expanduser("~"), "OneDrive", "Desktop", "CHATON", "PULPA_LAB_GLBS")
os.makedirs(export_dir, exist_ok=True)

def select_hierarchy(root):
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
    bpy.context.view_layer.objects.active = root

def apply_mesh_transforms_and_modifiers(root):
    # Bake visual modifiers and normalise rotation/scale while preserving equipment datum locations.
    for obj in [root] + list(root.children_recursive):
        if obj.type != "MESH":
            continue
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        # Apply bevels so the GLB does not depend on modifier evaluation downstream.
        for mod in list(obj.modifiers):
            try:
                bpy.ops.object.modifier_apply(modifier=mod.name)
            except RuntimeError:
                pass
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

def export_selected(filepath, animation_mode="ACTIVE_ACTIONS"):
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        export_format="GLB",
        use_selection=True,
        export_cameras=False,
        export_lights=False,
        export_materials="EXPORT",
        export_extras=True,
        export_yup=True,
        export_apply=True,
        export_animations=True,
        export_animation_mode=animation_mode,
        export_frame_range=True,
        export_optimize_animation_size=True,
        export_force_sampling=False,
        export_morph=False,
        export_skins=False,
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
    )

for root in roots:
    apply_mesh_transforms_and_modifiers(root)

exports = {}

# Individual assets export at their own datum (root translated temporarily to world origin).
for root in roots:
    old_matrix = root.matrix_world.copy()
    root.location = (0.0, 0.0, 0.0)
    bpy.context.view_layer.update()
    select_hierarchy(root)
    filepath = os.path.join(export_dir, f"{root.name}.glb")
    export_selected(filepath, "ACTIVE_ACTIONS")
    exports[root.name] = {
        "path": filepath,
        "bytes": os.path.getsize(filepath) if os.path.exists(filepath) else 0,
    }
    root.matrix_world = old_matrix
    bpy.context.view_layer.update()

# Combined authoring layout export.
bpy.ops.object.select_all(action="DESELECT")
for root in roots:
    root.select_set(True)
    for child in root.children_recursive:
        child.select_set(True)
bpy.context.view_layer.objects.active = roots[0]
combined_path = os.path.join(export_dir, "PULPA_LAB_REOLOGIA_CORE.glb")
export_selected(combined_path, "ACTIVE_ACTIONS")
exports["PULPA_LAB_REOLOGIA_CORE"] = {
    "path": combined_path,
    "bytes": os.path.getsize(combined_path) if os.path.exists(combined_path) else 0,
}

# Save final authored checkpoint.
checkpoint = os.path.join(os.path.expanduser("~"), "OneDrive", "Desktop", "CHATON", "PULPA_LAB_BLENDER_CHECKPOINT_B3.blend")
bpy.ops.wm.save_as_mainfile(filepath=checkpoint)

# Validation report.
validation = {}
for root in roots:
    meshes = [o for o in root.children_recursive if o.type == "MESH"]
    nonunit_scale = [
        o.name for o in meshes
        if any(abs(s - 1.0) > 1e-5 for s in o.scale)
    ]
    validation[root.name] = {
        "mesh_count": len(meshes),
        "hierarchy_objects": 1 + len(root.children_recursive),
        "nonunit_scale_meshes": nonunit_scale,
        "root_location": [round(v, 4) for v in root.location],
    }

result = {
    "checkpoint": checkpoint,
    "export_dir": export_dir,
    "exports": exports,
    "validation": validation,
    "actions": [a.name for a in bpy.data.actions],
}
