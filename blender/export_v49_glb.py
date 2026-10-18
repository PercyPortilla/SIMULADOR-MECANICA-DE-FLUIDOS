import bpy
import os

OUT = r'C:\Users\USER\OneDrive\Desktop\CHATON\pulpa-v31-babylon\dist\models\pulpa-v49'
os.makedirs(OUT, exist_ok=True)

scene = bpy.context.scene
if scene.get('PULPA_LAB_MASTER_VERSION') != 'V49':
    raise RuntimeError(f"Expected V49, got {scene.get('PULPA_LAB_MASTER_VERSION')!r}")

def select_objects(objects):
    bpy.ops.object.select_all(action='DESELECT')
    selected = []
    for o in objects:
        if o and o.type not in {'CAMERA', 'LIGHT'} and not o.hide_render:
            o.select_set(True)
            selected.append(o)
    if not selected:
        raise RuntimeError('No exportable objects selected')
    bpy.context.view_layer.objects.active = selected[0]
    return selected

def export(name, objects):
    selected = select_objects(objects)
    path = os.path.join(OUT, name + '.glb')
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True,
        export_cameras=False, export_lights=False, export_materials='EXPORT',
        export_extras=True, export_yup=True, export_apply=False,
        export_animations=True, export_animation_mode='ACTIVE_ACTIONS',
        export_frame_range=True, export_optimize_animation_size=True,
        export_force_sampling=False, export_morph=False, export_skins=False,
        export_texcoords=True, export_normals=True, export_tangents=False,
    )
    print('EXPORTED', name, len(selected), os.path.getsize(path))
    return path

all_objects = [o for o in scene.objects if o.type not in {'CAMERA','LIGHT'} and not o.hide_render]
export('PULPA_LAB_V49_FULL_SITE', all_objects)

def hierarchy(name):
    root = bpy.data.objects.get(name)
    return [root] + list(root.children_recursive) if root else []

process = []
for name in ['V49_PROCESS_LAYOUT_FRAME','MILL-01','SUMP-01','SLURRY-PUMP-01','CLASS-01','R-01','R-02','R-03','R-04','PUMP-01','CIP-ADSORPTION','ELUTION-SKID','EW-CELLS','SMELTING-FURNACE']:
    process += hierarchy(name)
for cname in ['V19_PIPE_DETAIL','V21_PIPE_BRIDGES','V23_PIPE_FIX','V25_PIPE_FINAL','V37_RECOVERY_PIPING','V39_PROCESS_CONNECTIONS','V39_RECOVERY_TRANSFER','V49_CIVIL']:
    c = bpy.data.collections.get(cname)
    if c: process += list(c.all_objects)
export('PULPA_LAB_V49_PROCESS', list(dict.fromkeys(process)))

front = []
for name in ['ROM-HOPPER','APRON-FEEDER','PRIMARY-CRUSHER','STOCKPILE-RECLAIM','CV-01','CV-02','CV-03','LOADER-01']:
    front += hierarchy(name)
for o in scene.objects:
    if o.name.startswith(('V49_','V22_ROM_','V20_ROM_','V20_STOCK_','V21_TRUSS_ROM_','V21_TRUSS_STOCK_')):
        front.append(o)
export('PULPA_LAB_V49_FRONTEND_STOCKPILE', list(dict.fromkeys(front)))

print('V49_EXPORT_DONE', OUT)
