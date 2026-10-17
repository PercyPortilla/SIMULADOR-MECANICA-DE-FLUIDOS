import bpy
import json
import os
from mathutils import Vector

BASE = os.path.join(os.path.expanduser('~'), 'OneDrive', 'Desktop', 'CHATON', 'PULPA_LAB_GLBS')
FILES = [
    'APRON-FEEDER.glb', 'PRIMARY-CRUSHER.glb', 'MILL-01.glb', 'SLURRY-PUMP-01.glb',
    'LEACH-REACTOR.glb', 'CIP-ADSORPTION.glb', 'SMELTING-FURNACE.glb',
    'MINING-SHOVEL.glb', 'WHEEL-LOADER.glb',
]

def bbox(objects):
    points = []
    for obj in objects:
        if obj.type == 'MESH' and obj.visible_get():
            points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not points:
        return None
    xs=[p.x for p in points]; ys=[p.y for p in points]; zs=[p.z for p in points]
    return {
        'min': [min(xs), min(ys), min(zs)],
        'max': [max(xs), max(ys), max(zs)],
        'size': [max(xs)-min(xs), max(ys)-min(ys), max(zs)-min(zs)],
    }

report = {}
for filename in FILES:
    path = os.path.join(BASE, filename)
    before_obj = set(bpy.data.objects)
    before_actions = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=path)
    objects = [o for o in bpy.data.objects if o not in before_obj]
    actions = [a for a in bpy.data.actions if a not in before_actions]
    ranges = []
    for action in actions:
        lo, hi = action.frame_range
        ranges.append((float(lo), float(hi)))
    if ranges:
        lo = min(r[0] for r in ranges)
        hi = max(r[1] for r in ranges)
    else:
        lo = hi = 1.0
    samples = sorted(set([int(round(lo)), int(round(hi)), int(round((lo+hi)/2)), int(round(lo+(hi-lo)*.25)), int(round(lo+(hi-lo)*.75))]))
    frames = {}
    overall_min_z = 1e9
    overall_max_z = -1e9
    max_span = [0,0,0]
    for frame in samples:
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        b = bbox(objects)
        if not b:
            continue
        overall_min_z = min(overall_min_z, b['min'][2])
        overall_max_z = max(overall_max_z, b['max'][2])
        max_span = [max(max_span[i], b['size'][i]) for i in range(3)]
        frames[str(frame)] = {k:[round(v,3) for v in vals] for k,vals in b.items()}
    report[filename] = {
        'action_ranges': [[round(a,2),round(b,2)] for a,b in ranges],
        'samples': frames,
        'overall_min_z': round(overall_min_z,3) if overall_min_z < 1e8 else None,
        'overall_max_z': round(overall_max_z,3) if overall_max_z > -1e8 else None,
        'max_span': [round(v,3) for v in max_span],
        'grounding_warning': overall_min_z < -0.35,
    }
    for obj in objects:
        bpy.data.objects.remove(obj, do_unlink=True)
    for action in actions:
        if action.users == 0:
            bpy.data.actions.remove(action)

result = report
