import bpy
from mathutils import Vector

s=bpy.context.scene;base=r'C:\Users\USER\OneDrive\Desktop\CHATON\pulpa-v31-babylon\blender'
s.render.engine='BLENDER_WORKBENCH';s.render.resolution_x=1600;s.render.resolution_y=900;s.render.resolution_percentage=75
s.display.shading.light='STUDIO';s.display.shading.color_type='MATERIAL';s.display.shading.show_shadows=True;s.display.shading.show_cavity=True;s.display.shading.cavity_type='BOTH'
cd=bpy.data.cameras.new('V54_REVIEW_CAM_DATA');cam=bpy.data.objects.new('V54_REVIEW_CAM',cd);s.collection.objects.link(cam);s.camera=cam
def shot(name,loc,target,lens=55,frame=1):
 s.frame_set(frame);bpy.context.view_layer.update();cam.location=loc;cam.data.lens=lens;cam.rotation_euler=(Vector(target)-Vector(loc)).to_track_quat('-Z','Y').to_euler();s.render.filepath=base+'\\'+name;bpy.ops.render.render(write_still=True)
shot('V54_P15_ROAD_INTEGRATION.png',(430,-155,60),(365,-55,-5),58)
shot('V54_P16_DUMPS.png',(490,-165,70),(425,-92,1),58)
shot('V54_P17_DRAINAGE.png',(425,-145,58),(355,-78,-8),58)
shot('V54_P18_TOPO_BLEND.png',(455,-185,90),(355,-72,-4),52)
shot('V54_P15_18_OVERVIEW.png',(470,-225,135),(280,-45,-2),48)
print('V54_RENDERS_DONE')
