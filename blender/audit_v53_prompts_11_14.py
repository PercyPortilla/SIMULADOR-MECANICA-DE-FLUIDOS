import bpy
from mathutils import Vector

s=bpy.context.scene;s.frame_set(1);bpy.context.view_layer.update()
REQ=[
 'V53_PIT_COLLAR','V53_PIT_FACE_01','V53_PIT_BERM_01','V53_PIT_FACE_05','V53_PIT_BOTTOM',
 'V53_PIT_RAMP_9M','V53_PIT_RAMP_TIE_TO_MAIN_HAUL','V53_PAD_DRILLING','V53_PAD_LOADING','V53_PAD_MANEUVER',
 'V53_PIT_EXCAVATOR','V53_PIT_TRUCK_A','V53_PIT_TRUCK_B'
]
HIDDEN=['V23_UTILITY_DROP_01','V23_UTILITY_DROP_02','V23_UTILITY_DROP_03','V23_UTILITY_DROP_04','V25_BRANCH_LEACH_OVERFLOW','V16_UTILITY_AIR_HEADER','V16_UTILITY_WATER_HEADER']
AUTH=['V52_PIPE_MILL_TO_SUMP','V52_PIPE_SUMP_TO_SLURRY_PUMP','V52_PIPE_SLURRY_PUMP_TO_CLASS','V52_PIPE_CLASS_OVERFLOW_TO_R01','V52_PIPE_CLASS_UNDERFLOW_TO_MILL','V39_PIPE_R01_TO_R02','V39_PIPE_R02_TO_R03','V39_PIPE_R03_TO_R04','V37_PIPE_R04_TO_PUMP','V52_PIPE_PUMP_TO_CIP','V52_PIPE_CIP_TO_ELUTION','V52_PIPE_ELUTION_TO_EW']

print('VERSION',s.get('PULPA_LAB_MASTER_VERSION'),'OBJECTS',len(s.objects))
print('MISSING_NEW',[n for n in REQ if not bpy.data.objects.get(n)])
print('CLEANUP_NOT_HIDDEN',[n for n in HIDDEN if not bpy.data.objects.get(n) or not (bpy.data.objects[n].hide_render and bpy.data.objects[n].hide_viewport)])
print('AUTH_NOT_VISIBLE',[n for n in AUTH if not bpy.data.objects.get(n) or bpy.data.objects[n].hide_render])
for n in ['V53_PIT_EXCAVATOR','V53_PIT_TRUCK_A','V53_PIT_TRUCK_B']:
 o=bpy.data.objects.get(n);print('STATIC',n,'LOC',tuple(round(float(v),3) for v in o.matrix_world.translation) if o else None,'ANIM',bool(o and o.animation_data))
for n in ['TRUCK-01','TRUCK-02','TRUCK-03','EXCAVATOR-01','ROM-HOPPER','MILL-01','CLASS-01','R-01','CIP-ADSORPTION']:
 o=bpy.data.objects.get(n);print('ORIGINAL',n,'LOC',tuple(round(float(v),3) for v in o.matrix_world.translation) if o else None,'ANIM',o.animation_data.action.name if o and o.animation_data and o.animation_data.action else None)
print('PIT_META',s.get('PULPA_LAB_V53_PIT_CENTER'),s.get('PULPA_LAB_V53_PIT_DEPTH_M'))
print('RAMP_WIDTH',bpy.data.objects['V53_PIT_RAMP_9M'].get('width_m'))
print('PASS_BASIC',s.get('PULPA_LAB_MASTER_VERSION')=='V53' and not [n for n in REQ if not bpy.data.objects.get(n)] and not [n for n in HIDDEN if not bpy.data.objects.get(n) or not (bpy.data.objects[n].hide_render and bpy.data.objects[n].hide_viewport)] and not [n for n in AUTH if not bpy.data.objects.get(n) or bpy.data.objects[n].hide_render])
