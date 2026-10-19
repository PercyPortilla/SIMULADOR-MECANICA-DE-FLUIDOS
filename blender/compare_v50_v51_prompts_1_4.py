import bpy
from mathutils import Matrix

V50 = r'C:\Users\USER\OneDrive\Desktop\CHATON\pulpa-v31-babylon\blender\PULPA_LAB_BLENDER_MASTER_V50.blend'
V51 = r'C:\Users\USER\OneDrive\Desktop\CHATON\pulpa-v31-babylon\blender\PULPA_LAB_BLENDER_MASTER_V51.blend'

ROOTS = ['ROM-HOPPER','APRON-FEEDER','PRIMARY-CRUSHER','STOCKPILE-RECLAIM','MILL-01','SUMP-01','SLURRY-PUMP-01','CLASS-01']
PROBES = ['APRON-FEEDER_PANS_GROUP','PRIMARY-CRUSHER_MOVING_JAW','V49_CV02_ORE_01','V49_CV03_ORE_01','MILL-01_TRUNNION_01']
FRAMES = (1, 48, 300, 720)

def snapshot(path):
    bpy.ops.wm.open_mainfile(filepath=path)
    scene = bpy.context.scene
    out = {'version': scene.get('PULPA_LAB_MASTER_VERSION'), 'samples': {}}
    for frame in FRAMES:
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        for name in ROOTS + PROBES:
            obj = bpy.data.objects.get(name)
            if obj:
                out['samples'][(frame, name)] = tuple(float(v) for row in obj.matrix_world for v in row)
    return out

base = snapshot(V50)
new = snapshot(V51)

def max_err(a, b):
    return max(abs(x-y) for x,y in zip(a,b))

changed = []
for key, matrix in base['samples'].items():
    other = new['samples'].get(key)
    if other is None:
        changed.append((key, 'MISSING'))
        continue
    err = max_err(matrix, other)
    if err > 1e-7:
        changed.append((key, err))

print('VERSIONS', base['version'], new['version'])
print('SAMPLES', len(base['samples']))
print('CHANGED', len(changed), changed[:20])
print('PASS_PRESERVATION', not changed)
