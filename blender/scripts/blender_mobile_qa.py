import bpy
import os
from mathutils import Vector

scene=bpy.context.scene
for name in ["QA_MOBILE_CAMERA","QA_MOBILE_KEY","QA_MOBILE_FILL","QA_MOBILE_GROUND"]:
    o=bpy.data.objects.get(name)
    if o:bpy.data.objects.remove(o,do_unlink=True)

bpy.ops.mesh.primitive_plane_add(size=85,location=(330,0,-.08))
ground=bpy.context.object;ground.name="QA_MOBILE_GROUND"
mat=bpy.data.materials.get("MAT_QA_Ground")
if mat:ground.data.materials.append(mat)

bpy.ops.object.camera_add(location=(329,-44,20))
cam=bpy.context.object;cam.name="QA_MOBILE_CAMERA";scene.camera=cam
target=Vector((330,0,2.4))
cam.rotation_euler=(target-cam.location).to_track_quat("-Z","Y").to_euler()
cam.data.lens=48

def light(name,loc,energy,size):
    bpy.ops.object.light_add(type="AREA",location=loc)
    o=bpy.context.object;o.name=name;o.data.energy=energy;o.data.shape="DISK";o.data.size=size
    o.rotation_euler=(target-o.location).to_track_quat("-Z","Y").to_euler()

light("QA_MOBILE_KEY",(315,-14,22),2200,11)
light("QA_MOBILE_FILL",(348,-8,13),1100,9)
scene.render.engine="BLENDER_EEVEE"
scene.render.resolution_x=1600;scene.render.resolution_y=750;scene.render.resolution_percentage=100
scene.render.image_settings.file_format="PNG"
out=os.path.join(os.path.expanduser("~"),"OneDrive","Desktop","CHATON","PULPA_LAB_MOBILE_QA.png")
scene.render.filepath=out
bpy.ops.render.render(write_still=True)
result={"render":out}
