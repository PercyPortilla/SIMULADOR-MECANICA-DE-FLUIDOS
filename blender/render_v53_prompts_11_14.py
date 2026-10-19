import bpy
from mathutils import Vector

s=bpy.context.scene;base=r'C:\Users\USER\OneDrive\Desktop\CHATON\pulpa-v31-babylon\blender'
s.render.engine='BLENDER_WORKBENCH';s.render.resolution_x=1600;s.render.resolution_y=900;s.render.resolution_percentage=75
s.display.shading.light='STUDIO';s.display.shading.color_type='MATERIAL';s.display.shading.show_shadows=True;s.display.shading.show_cavity=True;s.display.shading.cavity_type='BOTH'
cd=bpy.data.cameras.new('V53_REVIEW_CAM_DATA');cam=bpy.data.objects.new('V53_REVIEW_CAM',cd);s.collection.objects.link(cam);s.camera=cam
def shot(name,loc,target,lens=55,frame=1):
 s.frame_set(frame);bpy.context.view_layer.update();cam.location=loc;cam.data.lens=lens;cam.rotation_euler=(Vector(target)-Vector(loc)).to_track_quat('-Z','Y').to_euler();s.render.filepath=base+'\\'+name;bpy.ops.render.render(write_still=True)
shot('V53_P12_OPEN_PIT_AERIAL.png',(430,-170,90),(355,-78,-8),52)
shot('V53_P13_RAMP.png',(415,-135,45),(357,-75,-8),58)
shot('V53_P14_OPERATIONS.png',(405,-115,32),(350,-79,-10),62)
shot('V53_P11_14_PLANT_PIT_OVERVIEW.png',(410,-205,120),(260,-35,-2),50)
shot('V53_P11_PIPING_CLEAN.png',(260,-10,42),(260,35,6),58,720)
print('V53_RENDERS_DONE')
