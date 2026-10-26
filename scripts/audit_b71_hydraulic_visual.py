import bpy
import sys
from mathutils import Vector


TARGET_TOKENS = (
    'MILL-01',
    'SUMP-01',
    'SLURRY-PUMP-01',
    'CLASS-01',
    'PIPE_SUMP_TO_SLURRY_PUMP',
    'PIPE_SLURRY_PUMP_TO_CLASS',
    'PIPE_MILL_TO_SUMP',
    'PIPE-1',
)


def world_bounds(obj):
    if obj.type != 'MESH' or not obj.bound_box:
        return None
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    mins = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    maxs = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return mins, maxs


def main():
    argv = sys.argv
    glb = argv[argv.index('--') + 1]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=glb)
    matched = [obj for obj in bpy.context.scene.objects if any(token in obj.name.upper() for token in TARGET_TOKENS)]
    print(f'B71 V57 audit: {len(matched)} matching objects')
    for obj in sorted(matched, key=lambda item: item.name):
        bounds = world_bounds(obj)
        if bounds:
            mins, maxs = bounds
            center = (mins + maxs) * 0.5
            size = maxs - mins
            mats = [slot.material.name for slot in obj.material_slots if slot.material]
            print(
                f'{obj.name}|center={center.x:.3f},{center.y:.3f},{center.z:.3f}'
                f'|size={size.x:.3f},{size.y:.3f},{size.z:.3f}'
                f'|mats={";".join(mats[:4])}'
            )
        else:
            loc = obj.matrix_world.translation
            print(f'{obj.name}|type={obj.type}|loc={loc.x:.3f},{loc.y:.3f},{loc.z:.3f}')

    concrete = []
    for obj in bpy.context.scene.objects:
        bounds = world_bounds(obj)
        if not bounds:
            continue
        mins, maxs = bounds
        center = (mins + maxs) * 0.5
        if not (125 <= center.x <= 245 and 72 <= center.y <= 118 and 17 <= center.z <= 27):
            continue
        mats = [slot.material.name for slot in obj.material_slots if slot.material]
        signature = f'{obj.name} {" ".join(mats)}'.upper()
        if 'CONCRETE' not in signature and 'PAD' not in signature and 'FOUNDATION' not in signature:
            continue
        size = maxs - mins
        concrete.append((obj.name, center, size, mats))
    print(f'B71 concrete/pad corridor: {len(concrete)} meshes')
    for name, center, size, mats in sorted(concrete, key=lambda item: item[0])[:80]:
        print(
            f'B71_CONCRETE|{name}|center={center.x:.3f},{center.y:.3f},{center.z:.3f}'
            f'|size={size.x:.3f},{size.y:.3f},{size.z:.3f}|mats={";".join(mats[:4])}'
        )


if __name__ == '__main__':
    main()
