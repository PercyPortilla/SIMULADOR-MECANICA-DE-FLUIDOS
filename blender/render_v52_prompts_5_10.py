import bpy
from mathutils import Vector

scene=bpy.context.scene;base=r'C:\Users\USER\OneDrive\Desktop\CHATON\pulpa-v31-babylon\blender'
scene.render.engine='BLENDER_WORKBENCH';scene.render.resolution_x=1600;scene.render.resolution_y=900;scene.render.resolution_percentage=75
scene.display.shading.light='STUDIO';scene.display.shading.color_type='MATERIAL';scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=True;scene.display.shading.cavity_type='BOTH'
cd=bpy.data.cameras.new('V52_REVIEW_CAM_DATA');cam=bpy.data.objects.new('V52_REVIEW_CAM',cd);scene.collection.objects.link(cam);scene.camera=cam

def shot(name,frame,loc,target,lens=58):
    scene.frame_set(frame);bpy.context.view_layer.update();cam.location=loc;cam.data.lens=lens
    cam.rotation_euler=(Vector(target)-Vector(loc)).to_track_quat('-Z','Y').to_euler();scene.render.filepath=base+'\\'+name;bpy.ops.render.render(write_still=True)

shot('V52_P5_MILL_SUMP_PUMP.png',48,(326,-3,18),(325,35,4.2),60)
shot('V52_P6_7_PUMP_CLASS_CYCLONES.png',300,(307,-2,20),(308,35,5.2),60)
shot('V52_P7_UNDERFLOW_RETURN.png',300,(319,8,18),(320,31,4.0),58)
shot('V52_P7_RECYCLE_PUMP.png',300,(307,12,11),(305.7,30.6,2.8),64)
shot('V52_P8_9_REACTORS_CIP.png',720,(265,-8,24),(262,35,6.2),58)
shot('V52_P10_RECOVERY.png',720,(208,-5,19),(208,35,4.6),58)
shot('V52_P10_EW_SMELTING.png',720,(190,14,12),(190,35,3.2),62)
shot('V52_P5_10_OVERVIEW.png',720,(260,-95,72),(260,35,4.8),54)
print('V52_RENDERS_DONE')
