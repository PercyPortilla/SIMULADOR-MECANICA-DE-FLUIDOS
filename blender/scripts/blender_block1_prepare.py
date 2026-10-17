import bpy
import os

# PULPA LAB — Block 1: clean scene and prepare an export-safe asset workspace.

scene = bpy.context.scene
scene.name = "PULPA_LAB"

# Remove the test/default scene objects only; preserve datablocks until Blender purges them.
for obj in list(scene.objects):
    bpy.data.objects.remove(obj, do_unlink=True)

# Metric project units: 1 Blender unit = 1 metre.
scene.unit_settings.system = "METRIC"
scene.unit_settings.scale_length = 1.0
scene.unit_settings.length_unit = "METERS"
scene.render.fps = 30

# Neutral world lighting for asset authoring.
world = scene.world or bpy.data.worlds.new("PULPA_LAB_WORLD")
scene.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get("Background")
if bg:
    bg.inputs["Color"].default_value = (0.035, 0.045, 0.055, 1.0)
    bg.inputs["Strength"].default_value = 0.35

# Clean previous PULPA LAB collections if the block is re-run.
for name in [
    "PULPA_LAB_ASSETS",
    "REOLOGIA_CORE",
    "PIPELINES",
    "PROCESS_PLANT",
    "MINE_EQUIPMENT",
    "INFRASTRUCTURE",
]:
    col = bpy.data.collections.get(name)
    if col:
        bpy.data.collections.remove(col)

root = bpy.data.collections.new("PULPA_LAB_ASSETS")
scene.collection.children.link(root)

subcollections = {}
for name in [
    "REOLOGIA_CORE",
    "PIPELINES",
    "PROCESS_PLANT",
    "MINE_EQUIPMENT",
    "INFRASTRUCTURE",
]:
    col = bpy.data.collections.new(name)
    root.children.link(col)
    subcollections[name] = col

# Project/export metadata.
scene["pulpa_lab_units"] = "metres"
scene["pulpa_lab_export_format"] = "GLB/GLTF"
scene["pulpa_lab_axis_policy"] = "Blender Z-up; glTF exporter handles Y-up conversion"
scene["pulpa_lab_asset_rule"] = "root empty at equipment datum; animated parts separate; applied object scale"
scene["pulpa_lab_web_target"] = "Three.js / glTF"

# Save a recoverable checkpoint.
checkpoint = os.path.join(os.path.expanduser("~"), "OneDrive", "Desktop", "CHATON", "PULPA_LAB_BLENDER_CHECKPOINT_B1.blend")
bpy.ops.wm.save_as_mainfile(filepath=checkpoint)

result = {
    "scene": scene.name,
    "units": scene.unit_settings.system,
    "scale_length": scene.unit_settings.scale_length,
    "collections": ["PULPA_LAB_ASSETS"] + list(subcollections.keys()),
    "object_count": len(scene.objects),
    "checkpoint": checkpoint,
}
