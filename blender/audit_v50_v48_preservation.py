import bpy
import json
import os

scene = bpy.context.scene
out = os.environ.get('PULPA_AUDIT_OUT')
if not out:
    raise RuntimeError('PULPA_AUDIT_OUT is required')

environment_collections = [
    'V16_CIVIL', 'V17_ROADS_DRAINS', 'V19_CIVIL_DETAIL', 'V20_ROADS',
    'V20_TOPOGRAPHY', 'V22_ROAD_FIX', 'V22_ROM_CIVIL', 'V22_TERRAIN_DETAIL',
    'V26_TERRAIN_ROCKS', 'V27_ROAD_SHOULDERS', 'V28_FOUNDATION_GROUNDING',
    'V28_ROAD_EMBANKMENTS', 'V28_TERRAIN_FILL', 'V29_SHOULDER_GROUNDING',
    'V30_DRAINAGE', 'V30_GROUNDING_FINAL', 'V31_ROAD_SECTION', 'V32_CIVIL_FIX',
]

def matrix_values(obj):
    return [round(float(v), 7) for row in obj.matrix_world for v in row]

env = {}
for cname in environment_collections:
    collection = bpy.data.collections.get(cname)
    if not collection:
        continue
    for obj in collection.objects:
        env[obj.name] = {
            'collection': cname,
            'matrix': matrix_values(obj),
            'hide_render': bool(obj.hide_render),
            'hide_viewport': bool(obj.hide_viewport),
        }

animated = {}
for obj in scene.objects:
    ad = obj.animation_data
    drivers = len(ad.drivers) if ad and ad.drivers else 0
    action = ad.action.name if ad and ad.action else None
    follow = [c.name for c in obj.constraints if c.type == 'FOLLOW_PATH' and not c.mute]
    if drivers or action or follow:
        animated[obj.name] = {'drivers': drivers, 'action': action, 'follow_path': follow}

circuit_names = [
    'ROM-HOPPER','APRON-FEEDER','PRIMARY-CRUSHER','STOCKPILE-RECLAIM',
    'MILL-01','SUMP-01','SLURRY-PUMP-01','CLASS-01','R-01','R-02','R-03','R-04',
    'PUMP-01','CIP-ADSORPTION','ELUTION-SKID','EW-CELLS','SMELTING-FURNACE',
]
circuit = {}
for name in circuit_names:
    obj = bpy.data.objects.get(name)
    if obj:
        circuit[name] = [round(float(v), 4) for v in obj.matrix_world.translation]

payload = {
    'version': scene.get('PULPA_LAB_MASTER_VERSION'),
    'object_count': len(scene.objects),
    'environment': env,
    'animated': animated,
    'circuit': circuit,
}
with open(out, 'w', encoding='utf-8') as handle:
    json.dump(payload, handle, ensure_ascii=False, indent=2, sort_keys=True)
print('AUDIT_WRITTEN', out, 'ENV', len(env), 'ANIMATED', len(animated))
