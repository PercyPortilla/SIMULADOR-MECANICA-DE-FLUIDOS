import bpy
from mathutils import Vector

scene=bpy.context.scene;base=r'C:\Users\USER\OneDrive\Desktop\CHATON\pulpa-v31-babylon\blender'
scene.render.engine='BLENDER_WORKBENCH';scene.render.resolution_x=1500;scene.render.resolution_y=900;scene.render.resolution_percentage=65
scene.display.shading.light='STUDIO';scene.display.shading.color_type='MATERIAL';scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=True;scene.display.shading.cavity_type='BOTH'
cd=bpy.data.cameras.new('V49_REVIEW_CAM_DATA');cam=bpy.data.objects.new('V49_REVIEW_CAM',cd);scene.collection.objects.link(cam);scene.camera=cam

def shot(name,frame,loc,target,lens=52):
    scene.frame_set(frame);bpy.context.view_layer.update();cam.location=loc;cam.data.lens=lens
    cam.rotation_euler=(Vector(target)-Vector(loc)).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=base+'\\'+name;bpy.ops.render.render(write_still=True)

shot('V49_LAYOUT_OVERVIEW.png',1,(260,-120,105),(255,13,2.8),52)
shot('V49_LAYOUT_FRONTEND.png',48,(190,-34,18),(202,1,2.8),60)
shot('V49_LAYOUT_FRONTEND_WIDE.png',48,(190,-48,18),(190,0,2.4),48)
shot('V49_LAYOUT_STOCK_TO_MILL.png',300,(300,-42,30),(306,18,4.2),58)
shot('V49_LAYOUT_PROCESS_ROW.png',300,(260,-42,27),(260,35,4.2),58)
shot('V49_LAYOUT_PROCESS_ROW_NORTH.png',720,(260,82,23),(260,35,4.0),62)
print('V49_RENDERS_DONE')
