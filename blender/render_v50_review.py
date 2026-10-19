import bpy
from mathutils import Vector

scene = bpy.context.scene
base = r'C:\Users\USER\OneDrive\Desktop\CHATON\pulpa-v31-babylon\blender'
scene.render.engine = 'BLENDER_WORKBENCH'
scene.render.resolution_x = 1600
scene.render.resolution_y = 900
scene.render.resolution_percentage = 70
scene.display.shading.light = 'STUDIO'
scene.display.shading.color_type = 'MATERIAL'
scene.display.shading.show_shadows = True
scene.display.shading.show_cavity = True
scene.display.shading.cavity_type = 'BOTH'

camera_data = bpy.data.cameras.new('V50_REVIEW_CAM_DATA')
camera = bpy.data.objects.new('V50_REVIEW_CAM', camera_data)
scene.collection.objects.link(camera)
scene.camera = camera

def shot(name, frame, location, target, lens=52):
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    camera.location = location
    camera.data.lens = lens
    camera.rotation_euler = (Vector(target) - Vector(location)).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = base + '\\' + name
    bpy.ops.render.render(write_still=True)

shot('V50_V48BASE_OVERVIEW.png', 1, (260, -120, 105), (255, 13, 2.8), 52)
shot('V50_V48BASE_FRONTEND.png', 48, (190, -46, 23), (205, 1, 2.8), 54)
shot('V50_V48BASE_STOCK_MILL.png', 300, (300, -48, 33), (305, 18, 4.2), 55)
shot('V50_V48BASE_PROCESS.png', 720, (260, -48, 30), (260, 35, 4.2), 56)
shot('V50_V48BASE_PROCESS_NORTH.png', 720, (260, 86, 25), (260, 35, 4.0), 60)
print('V50_RENDERS_DONE')
