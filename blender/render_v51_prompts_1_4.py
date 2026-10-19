import bpy
from mathutils import Vector

scene = bpy.context.scene
base = r'C:\Users\USER\OneDrive\Desktop\CHATON\pulpa-v31-babylon\blender'
scene.render.engine = 'BLENDER_WORKBENCH'
scene.render.resolution_x = 1600
scene.render.resolution_y = 900
scene.render.resolution_percentage = 75
scene.display.shading.light = 'STUDIO'
scene.display.shading.color_type = 'MATERIAL'
scene.display.shading.show_shadows = True
scene.display.shading.show_cavity = True
scene.display.shading.cavity_type = 'BOTH'

camera_data = bpy.data.cameras.new('V51_REVIEW_CAM_DATA')
camera = bpy.data.objects.new('V51_REVIEW_CAM', camera_data)
scene.collection.objects.link(camera)
scene.camera = camera

def shot(filename, frame, location, target, lens=58):
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    camera.location = location
    camera.data.lens = lens
    camera.rotation_euler = (Vector(target) - Vector(location)).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = base + '\\' + filename
    bpy.ops.render.render(write_still=True)

shot('V51_P2_ROM_APRON_CRUSHER.png', 48, (190, -34, 17), (191.5, 0, 2.4), 62)
shot('V51_P3_CV02_STOCKPILE.png', 120, (235, -42, 24), (241, 0, 4.5), 58)
shot('V51_P4_RECLAIM_CV03.png', 240, (286, -28, 22), (292, 12, 3.8), 60)
shot('V51_P4_CV03_MILL.png', 300, (316, -8, 24), (326, 32, 5.2), 58)
shot('V51_P1_4_OVERVIEW.png', 300, (264, -92, 76), (260, 12, 3.5), 52)
print('V51_RENDERS_DONE')
