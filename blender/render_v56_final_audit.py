import bpy
from mathutils import Vector

s = bpy.context.scene
base = r'C:\Users\USER\OneDrive\Desktop\CHATON\pulpa-v31-babylon\blender'
s.render.engine = 'BLENDER_WORKBENCH'
s.render.resolution_x = 1440
s.render.resolution_y = 900
s.render.resolution_percentage = 75
s.display.shading.light = 'STUDIO'
s.display.shading.color_type = 'MATERIAL'
s.display.shading.show_shadows = True
s.display.shading.show_cavity = True
s.display.shading.cavity_type = 'BOTH'

cd = bpy.data.cameras.new('V56_FINAL_AUDIT_CAM_DATA')
cam = bpy.data.objects.new('V56_FINAL_AUDIT_CAM', cd)
s.collection.objects.link(cam)
s.camera = cam


def shot(name, loc, target, lens=58, frame=720):
    s.frame_set(frame)
    bpy.context.view_layer.update()
    cam.location = loc
    cam.data.lens = lens
    cam.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    s.render.filepath = base + '\\' + name
    bpy.ops.render.render(write_still=True)


shot('V56_FINAL_PICKUP_GROUND.png', (202, -31, 8.5), (214, -17, -1.1), 62, 1)
shot('V56_FINAL_LOADER_GROUND.png', (310, 18, 2.8), (292, 18, -0.45), 52, 720)
shot('V56_FINAL_LEGACY_SIDE.png', (128, -26, 16), (112, 1, 2.8), 62, 720)
shot('V56_FINAL_RACK_SIDE.png', (252, 18, 23), (252, 42, 7.0), 70, 720)
shot('V56_FINAL_RACK_END.png', (327, 42, 15), (276, 42, 7.4), 72, 720)
shot('V56_FINAL_PROCESS_ROW.png', (300, 5, 30), (264, 34, 4.8), 58, 720)

print('V56_FINAL_AUDIT_RENDERS_DONE')
