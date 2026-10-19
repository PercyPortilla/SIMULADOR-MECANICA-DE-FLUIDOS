import bpy

s=bpy.context.scene;s.frame_set(1);bpy.context.view_layer.update()
REQ=[
 'V54_HAUL_PORTAL_APPROACH','V54_HAUL_PORTAL_APRON','V54_DRILL_PAD_SPUR','V54_LOADING_PAD_SPUR','V54_BOTTOM_MANEUVER_LOOP',
 'V54_WASTE_DUMP_MAIN','V54_WASTE_DUMP_SECONDARY','V54_LOW_GRADE_ORE_STOCK',
 'V54_PIT_PERIMETER_DIVERSION_DITCH','V54_RAMP_DITCH_L','V54_RAMP_DITCH_R','V54_PIT_BOTTOM_SUMP',
 'V54_PIT_OUTER_TERRAIN_BLEND','V54_EXISTING_SITE_TO_PIT_BLEND'
]
AUTH=['V53_PIT_RAMP_9M','V53_PIT_COLLAR','V53_PIT_BOTTOM','V53_PAD_DRILLING','V53_PAD_LOADING','V53_PAD_MANEUVER']
print('VERSION',s.get('PULPA_LAB_MASTER_VERSION'),'OBJECTS',len(s.objects))
print('MISSING_NEW',[n for n in REQ if not bpy.data.objects.get(n)])
print('AUTH_MISSING_OR_HIDDEN',[n for n in AUTH if not bpy.data.objects.get(n) or bpy.data.objects[n].hide_render])
for n in ['V54_HAUL_PORTAL_APPROACH','V54_DRILL_PAD_SPUR','V54_LOADING_PAD_SPUR','V54_BOTTOM_MANEUVER_LOOP']:
 o=bpy.data.objects.get(n);print('ROAD',n,'WIDTH',o.get('width_m') if o else None,'DIMS',tuple(round(float(v),2) for v in o.dimensions) if o else None)
for n in ['V54_WASTE_DUMP_MAIN','V54_WASTE_DUMP_SECONDARY','V54_LOW_GRADE_ORE_STOCK']:
 o=bpy.data.objects.get(n);print('PILE',n,'LOC',tuple(round(float(v),2) for v in o.matrix_world.translation) if o else None,'DIMS',tuple(round(float(v),2) for v in o.dimensions) if o else None)
for n in ['TRUCK-01','TRUCK-02','TRUCK-03','EXCAVATOR-01','ROM-HOPPER','MILL-01','CLASS-01','R-01','CIP-ADSORPTION']:
 o=bpy.data.objects.get(n);print('ROOT',n,tuple(round(float(v),3) for v in o.matrix_world.translation) if o else None)
print('PASS_BASIC',s.get('PULPA_LAB_MASTER_VERSION')=='V54' and not [n for n in REQ if not bpy.data.objects.get(n)] and not [n for n in AUTH if not bpy.data.objects.get(n) or bpy.data.objects[n].hide_render])
