import bpy
import math
import os
from mathutils import Vector

scene = bpy.context.scene

# Remove previous QA-only objects.
for name in ["QA_CAMERA", "QA_KEY", "QA_FILL", "QA_GROUND"]:
    obj = bpy.data.objects.get(name)
    if obj:
        bpy.data.objects.remove(obj, do_unlink=True)

# Simple neutral ground plane.
bpy.ops.mesh.primitive_plane_add(size=55, location=(15.5, 0, -0.48))
ground = bpy.context.object
ground.name = "QA_GROUND"
mat = bpy.data.materials.get("MAT_QA_Ground") or bpy.data.materials.new("MAT_QA_Ground")
mat.use_nodes = True
bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
if bsdf:
    for s in bsdf.inputs:
        if s.name == "Base Color":
            s.default_value = (0.055, 0.065, 0.075, 1.0)
        elif s.name == "Roughness":
            s.default_value = 0.82
ground.data.materials.append(mat)

# Camera framing all four assets.
bpy.ops.object.camera_add(location=(16.0, -42.0, 20.0))
cam = bpy.context.object
cam.name = "QA_CAMERA"
scene.camera = cam

target = Vector((15.5, 0.0, 2.0))
direction = target - cam.location
cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
cam.data.lens = 36

def area_light(name, loc, energy, size):
    bpy.ops.object.light_add(type="AREA", location=loc)
    light = bpy.context.object
    light.name = name
    light.data.energy = energy
    light.data.shape = "DISK"
    light.data.size = size
    direction = target - light.location
    light.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    return light

area_light("QA_KEY", (6, -10, 18), 1800, 10)
area_light("QA_FILL", (28, -4, 10), 900, 8)

scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1600
scene.render.resolution_y = 700
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
out = os.path.join(os.path.expanduser("~"), "OneDrive", "Desktop", "CHATON", "PULPA_LAB_CORE_QA.png")
scene.render.filepath = out
bpy.ops.render.render(write_still=True)

result = {"render": out, "resolution": [1600, 700]}
