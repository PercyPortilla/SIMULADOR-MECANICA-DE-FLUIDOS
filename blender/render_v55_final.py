import bpy
from mathutils import Vector

s=bpy.context.scene;base=r'C:\Users\USER\OneDrive\Desktop\CHATON\pulpa-v31-babylon\blender'
s.render.engine='BLENDER_WORKBENCH';s.render.resolution_x=1600;s.render.resolution_y=900;s.render.resolution_percentage=75
s.display.shading.light='STUDIO';s.display.shading.color_type='MATERIAL';s.display.shading.show_shadows=True;s.display.shading.show_cavity=True;s.display.shading.cavity_type='BOTH'
cd=bpy.data.cameras.new('V55_REVIEW_CAM_DATA');cam=bpy.data.objects.new('V55_REVIEW_CAM',cd);s.collection.objects.link(cam);s.camera=cam
def shot(name,loc,target,lens=55,frame=1):
    s.frame_set(frame);bpy.context.view_layer.update();cam.location=loc;cam.data.lens=lens
    cam.rotation_euler=(Vector(target)-Vector(loc)).to_track_quat('-Z','Y').to_euler();s.render.filepath=base+'\\'+name;bpy.ops.render.render(write_still=True)
shot('V55_FINAL_PIT.png',(470,-190,105),(355,-76,-7),52)
shot('V55_FINAL_TIE_DRAINAGE.png',(420,-115,48),(370,-45,-5),60)
shot('V55_FINAL_DUMPS.png',(175,-20,65),(80,31,2.5),58)
shot('V55_FINAL_PROCESS.png',(264,-10,42),(260,35,5.5),58,720)
shot('V55_FINAL_OVERVIEW.png',(470,-240,145),(260,-35,-1),48,720)
print('V55_RENDERS_DONE')
