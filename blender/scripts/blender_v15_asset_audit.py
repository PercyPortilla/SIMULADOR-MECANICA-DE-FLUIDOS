import bpy
import json
import os
from mathutils import Vector

BASE = os.path.join(os.path.expanduser('~'), 'OneDrive', 'Desktop', 'CHATON', 'PULPA_LAB_GLBS')
FILES = [
    'ROM-HOPPER.glb', 'APRON-FEEDER.glb', 'PRIMARY-CRUSHER.glb', 'STOCKPILE-RECLAIM.glb',
    'MILL-01.glb', 'SUMP-01.glb', 'SLURRY-PUMP-01.glb', 'CLASS-01.glb', 'LEACH-REACTOR.glb',
    'CIP-ADSORPTION.glb', 'ELUTION-SKID.glb', 'EW-CELLS.glb', 'SMELTING-FURNACE.glb',
    'HAUL-TRUCK.glb', 'MINING-SHOVEL.glb', 'WHEEL-LOADER.glb',
]
EXPECTED = {
    'ROM-HOPPER.glb': (11.5, 9.2, 7.6),
    'APRON-FEEDER.glb': (8.4, 2.8, 1.85),
    'PRIMARY-CRUSHER.glb': (5.4, 4.2, 4.7),
    'STOCKPILE-RECLAIM.glb': (50.0, 40.0, 10.0),
    'MILL-01.glb': (10.6, 6.1, 5.65),
    'SUMP-01.glb': (5.1, 5.1, 3.3),
    'SLURRY-PUMP-01.glb': (4.8, 2.65, 2.55),
    'CLASS-01.glb': (5.4, 5.4, 5.4),
    'LEACH-REACTOR.glb': (7.6, 7.6, 8.8),
    'CIP-ADSORPTION.glb': (13.8, 7.4, 6.9),
    'ELUTION-SKID.glb': (9.4, 5.6, 6.4),
    'EW-CELLS.glb': (10.8, 5.8, 3.8),
    'SMELTING-FURNACE.glb': (7.4, 5.8, 8.9),
    'HAUL-TRUCK.glb': (10.0, 5.25, 5.05),
    'MINING-SHOVEL.glb': (9.9, 8.0, 8.1),
    'WHEEL-LOADER.glb': (12.0, 3.75, 4.25),
}

def measure(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    bpy.context.scene.frame_set(1)
    bpy.context.view_layer.update()
    points = []
    for obj in new:
        if obj.type == 'MESH':
            points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    if not points:
        size = (0, 0, 0)
        mins = (0, 0, 0)
        maxs = (0, 0, 0)
    else:
        xs = [p.x for p in points]; ys = [p.y for p in points]; zs = [p.z for p in points]
        mins = (min(xs), min(ys), min(zs)); maxs = (max(xs), max(ys), max(zs))
        size = tuple(maxs[i] - mins[i] for i in range(3))
    actions = []
    for obj in new:
        action = getattr(getattr(obj, 'animation_data', None), 'action', None)
        if action and action.name not in actions:
            actions.append(action.name)
    for obj in new:
        bpy.data.objects.remove(obj, do_unlink=True)
    return size, mins, maxs, actions

report = {}
for filename in FILES:
    path = os.path.join(BASE, filename)
    size, mins, maxs, actions = measure(path)
    expected = EXPECTED[filename]
    ratios = [size[i] / expected[i] if expected[i] else 0 for i in range(3)]
    report[filename] = {
        'size': [round(v, 3) for v in size],
        'min': [round(v, 3) for v in mins],
        'max': [round(v, 3) for v in maxs],
        'expected': expected,
        'ratios': [round(v, 3) for v in ratios],
        'animations': actions,
        'suspicious': max(ratios) > 2.0 or (min(ratios) < 0.35 and filename != 'STOCKPILE-RECLAIM.glb'),
    }

module_dir = os.path.join(BASE, 'v15-modules')
modules = {}
for filename in sorted(os.listdir(module_dir)):
    if not filename.lower().endswith('.glb'):
        continue
    size, mins, maxs, actions = measure(os.path.join(module_dir, filename))
    modules[filename] = {
        'size': [round(v, 3) for v in size],
        'min': [round(v, 3) for v in mins],
        'max': [round(v, 3) for v in maxs],
    }

result = {'assets': report, 'modules': modules}
