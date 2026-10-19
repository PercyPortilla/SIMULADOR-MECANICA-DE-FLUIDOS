import bpy
from mathutils import Vector

scene = bpy.context.scene
deps = bpy.context.evaluated_depsgraph_get()

REQ_ROOTS = ['ROM-HOPPER', 'APRON-FEEDER', 'PRIMARY-CRUSHER', 'CV-02', 'STOCKPILE-RECLAIM', 'CV-03', 'MILL-01']
REQ_V51 = [
    'V51_ROM_TO_APRON_CHUTE_BOTTOM',
    'V51_APRON_TRANSFER_TAIL_BOTTOM',
    'V51_CV02_STOCKPILE_DISCHARGE_BOTTOM',
    'V51_CV03_TRANSFER_DECK',
    'V51_RECLAIM_TO_CV03_CHUTE_BOTTOM',
    'V51_CV03_MILL_FEED_CHUTE_BOTTOM',
]
REQ_COLLECTIONS = [
    'V51_ORGANIZED', 'V51_00_CORE_ASSETS', 'V51_10_TERRAIN_EARTHWORKS',
    'V51_20_ROADS_DRAINAGE', 'V51_30_CIVIL_SITE_INFRA', 'V51_40_SOLIDS_HANDLING',
    'V51_50_PROCESS_PIPING_UTILITIES', 'V51_60_OPERATION_ANIMATION_LAYOUT',
    'V51_70_LIGHTING_QA', 'V51_02_OPEN_PIT_TODO', 'V51_FRONTEND_TRANSFERS',
]

EXPECTED_WORLD = {
    'ROM-HOPPER': (180.0, 0.0, 0.0),
    'APRON-FEEDER': (190.0, 0.0, 0.0),
    'PRIMARY-CRUSHER': (204.0, 0.0, 0.0),
    'STOCKPILE-RECLAIM': (260.0, 0.0, 0.0),
    'MILL-01': (334.0, 35.0, 2.0),
}

def fmt(v):
    return tuple(round(float(x), 4) for x in v)

def dist(a, b):
    return (Vector(a) - Vector(b)).length

print('VERSION', scene.get('PULPA_LAB_MASTER_VERSION'))
print('OBJECTS', len(scene.objects))
print('MISSING_ROOTS', [n for n in REQ_ROOTS if bpy.data.objects.get(n) is None])
print('MISSING_V51', [n for n in REQ_V51 if bpy.data.objects.get(n) is None])
print('MISSING_COLLECTIONS', [n for n in REQ_COLLECTIONS if bpy.data.collections.get(n) is None])

for name, expected in EXPECTED_WORLD.items():
    obj = bpy.data.objects[name]
    actual = obj.matrix_world.translation
    print('ROOT_POSE', name, fmt(actual), 'ERR', round(dist(actual, expected), 8))

top_names = sorted(c.name for c in scene.collection.children)
print('SCENE_TOP_COLLECTIONS', top_names)
print('ONLY_ORGANIZED_PLUS_NEW', [n for n in top_names if not n.startswith('V51_')])

old_rom = bpy.data.objects.get('V49_ROM_TO_APRON_CHUTE')
print('OLD_ROM_HIDDEN', bool(old_rom and old_rom.hide_render and old_rom.hide_viewport))
for prefix in ('V49_APRON_TO_CRUSHER_', 'V49_CV02_', 'V49_CV03_'):
    visible = [o.name for o in scene.objects if o.name.startswith(prefix) and not o.hide_render]
    print('VISIBLE', prefix, len(visible))

chain = ['ROM-HOPPER','APRON-FEEDER','PRIMARY-CRUSHER','CV-02','STOCKPILE-RECLAIM','CV-03','MILL-01']
for name in chain:
    obj = bpy.data.objects[name]
    print('FLOW', name, 'UP', obj.get('upstream'), 'DOWN', obj.get('downstream'), 'BELT', obj.get('belt_object'))

# Original animation probes must still move.
probes = ['APRON-FEEDER_PANS_GROUP', 'PRIMARY-CRUSHER_MOVING_JAW', 'V49_CV02_ORE_01', 'V49_CV03_ORE_01', 'MILL-01_TRUNNION_01']
poses = {}
for frame in (1, 48, 300):
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    for name in probes:
        obj = bpy.data.objects.get(name)
        if obj:
            poses.setdefault(name, []).append((frame, obj.matrix_world.translation.copy(), obj.rotation_euler.copy()))

for name, samples in poses.items():
    moved = False
    p0, r0 = samples[0][1], samples[0][2]
    for _, p, r in samples[1:]:
        if (p-p0).length > 1e-5 or sum(abs(float(a-b)) for a,b in zip(r,r0)) > 1e-5:
            moved = True
    print('ANIM', name, 'MOVED', moved, 'SAMPLES', [(f, fmt(p), fmt(r)) for f,p,r in samples])

v51_visible = [o for o in scene.objects if o.name.startswith('V51_') and not o.hide_render]
print('V51_VISIBLE_OBJECTS', len(v51_visible))
print('DROP_ORE_COUNT', sum(1 for o in scene.objects if o.name.startswith('V51_CV02_DROP_ORE_')))

pass_basic = (
    scene.get('PULPA_LAB_MASTER_VERSION') == 'V51'
    and not [n for n in REQ_ROOTS if bpy.data.objects.get(n) is None]
    and not [n for n in REQ_V51 if bpy.data.objects.get(n) is None]
    and not [n for n in REQ_COLLECTIONS if bpy.data.collections.get(n) is None]
    and all(dist(bpy.data.objects[n].matrix_world.translation, expected) < 1e-6 for n, expected in EXPECTED_WORLD.items())
    and bool(old_rom and old_rom.hide_render and old_rom.hide_viewport)
    and all(any(o.name.startswith(prefix) and not o.hide_render for o in scene.objects) for prefix in ('V49_APRON_TO_CRUSHER_', 'V49_CV02_', 'V49_CV03_'))
)
print('PASS_BASIC', pass_basic)
