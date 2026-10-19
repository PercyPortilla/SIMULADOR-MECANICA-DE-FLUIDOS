import bpy
import os
import re
import shutil
import subprocess

OUT = r'C:\Users\USER\OneDrive\Desktop\CHATON\pulpa-v31-babylon\dist\models\pulpa-v49'
os.makedirs(OUT, exist_ok=True)

scene = bpy.context.scene
if scene.get('PULPA_LAB_MASTER_VERSION') != 'V49':
    raise RuntimeError(f"Expected V49, got {scene.get('PULPA_LAB_MASTER_VERSION')!r}")

def prepare_gltf_materials():
    """Preserve Blender's authored viewport colours when procedural nodes cannot export to glTF."""
    fixed = []
    legacy_pattern = re.compile(r'^V(?:1[6-9]|[2-9]\d)_')
    for material in bpy.data.materials:
        if not material.node_tree:
            continue
        principled = next((node for node in material.node_tree.nodes if node.type == 'BSDF_PRINCIPLED'), None)
        if not principled:
            continue
        base = principled.inputs.get('Base Color')
        if not base:
            continue
        procedural_link = base.is_linked and any(link.from_node.type != 'TEX_IMAGE' for link in base.links)
        default_base = max(abs(float(base.default_value[i]) - 0.8) for i in range(3)) < 1e-5
        diffuse = tuple(float(value) for value in material.diffuse_color)
        colour_delta = max(abs(diffuse[i] - float(base.default_value[i])) for i in range(3))
        legacy_default = bool(legacy_pattern.match(material.name)) and default_base and colour_delta > 0.08
        if not procedural_link and not legacy_default:
            continue
        for link in list(base.links):
            material.node_tree.links.remove(link)
        base.default_value = diffuse
        fixed.append((material.name, 'procedural' if procedural_link else 'legacy-default'))
    print('GLTF_MATERIAL_FALLBACKS', len(fixed), fixed)
    return fixed

prepare_gltf_materials()

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

def export(name, objects, bake_scene=False):
    selected = select_objects(objects)
    path = os.path.join(OUT, name + '.glb')
    bpy.ops.export_scene.gltf(
        filepath=path, export_format='GLB', use_selection=True,
        export_cameras=False, export_lights=False, export_materials='EXPORT',
        export_extras=True, export_yup=True, export_apply=False,
        export_animations=True,
        export_animation_mode='SCENE' if bake_scene else 'ACTIVE_ACTIONS',
        export_frame_range=True, export_optimize_animation_size=True,
        export_force_sampling=bake_scene, export_bake_animation=False,
        export_anim_scene_split_object=not bake_scene,
        export_morph=False, export_skins=False,
        export_texcoords=True, export_normals=True, export_tangents=False,
    )
    print('EXPORTED', name, len(selected), os.path.getsize(path))
    return path

def resample_animation(path, tolerance=0.0001):
    npx = shutil.which('npx.cmd') or shutil.which('npx')
    if not npx:
        raise RuntimeError('npx is required to resample the production V49 animation.')
    optimized = os.path.splitext(path)[0] + '.resampled.glb'
    subprocess.run([
        npx,
        '--yes',
        '@gltf-transform/cli@4.2.1',
        'resample',
        path,
        optimized,
        '--tolerance',
        str(tolerance),
    ], check=True)
    raw_size = os.path.getsize(path)
    optimized_size = os.path.getsize(optimized)
    os.replace(optimized, path)
    print('RESAMPLED', os.path.basename(path), raw_size, '->', optimized_size)
    return path

all_objects = [o for o in scene.objects if o.type not in {'CAMERA','LIGHT'} and not o.hide_render]
# FULL_SITE is the production Babylon visual. Scene sampling bakes the Blender
# drivers/constraints (mill, feeder, loader, cyclones, V49 ore, etc.) into glTF
# animation channels so the web does not lose the authored V49 motion.
full_site_path = export('PULPA_LAB_V49_FULL_SITE', all_objects, bake_scene=True)
resample_animation(full_site_path)

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
