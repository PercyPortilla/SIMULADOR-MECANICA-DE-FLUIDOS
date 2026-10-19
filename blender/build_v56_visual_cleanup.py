import bpy

EXPECTED='V55'
OUT=r'C:\Users\USER\OneDrive\Desktop\CHATON\pulpa-v31-babylon\blender\PULPA_LAB_BLENDER_MASTER_V56.blend'
scene=bpy.context.scene
if scene.get('PULPA_LAB_MASTER_VERSION') != EXPECTED:
    raise RuntimeError(f'V56 cleanup requires {EXPECTED}, got {scene.get("PULPA_LAB_MASTER_VERSION")!r}')


def hide_obj(obj, reason):
    if not obj:
        return
    obj.hide_render = True
    obj.hide_viewport = True
    obj['v56_hidden_reason'] = reason


def hide_names(names, reason):
    count = 0
    for name in names:
        obj = bpy.data.objects.get(name)
        if obj:
            hide_obj(obj, reason)
            count += 1
    return count


def ensure_collection(name, parent_name=None):
    coll = bpy.data.collections.get(name)
    if coll is None:
        coll = bpy.data.collections.new(name)
    parent = bpy.data.collections.get(parent_name) if parent_name else None
    parent_children = parent.children if parent else scene.collection.children
    if coll.name not in parent_children:
        parent_children.link(coll)
    return coll


def make_box(name, location, dimensions, material, collection):
    existing = bpy.data.objects.get(name)
    if existing:
        bpy.data.objects.remove(existing, do_unlink=True)
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if collection not in obj.users_collection:
        collection.objects.link(obj)
    for owner in list(obj.users_collection):
        if owner != collection:
            owner.objects.unlink(obj)
    if material:
        obj.data.materials.append(material)
    obj['v56_electrical_cleanup'] = True
    return obj


def set_material(name, rgba, metallic=0.08, roughness=0.58):
    mat = bpy.data.materials.get(name)
    if not mat:
        return False
    mat.diffuse_color = (*rgba, 1.0)
    if mat.node_tree:
        bsdf = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if bsdf:
            base = bsdf.inputs.get('Base Color')
            if base:
                for link in list(base.links):
                    mat.node_tree.links.remove(link)
                base.default_value = (*rgba, 1.0)
            if bsdf.inputs.get('Metallic'):
                bsdf.inputs['Metallic'].default_value = metallic
            if bsdf.inputs.get('Roughness'):
                bsdf.inputs['Roughness'].default_value = roughness
    return True


# ---------------------------------------------------------------------------
# 1) STRAY SOURCE LIBRARY — prototype modules were still render-visible at
# world origin. They are authoring assets, not part of the plant.
# ---------------------------------------------------------------------------
prototype_collection = bpy.data.collections.get('V15_HYBRID_MODULES')
prototype_hidden = 0
if prototype_collection:
    for obj in prototype_collection.objects:
        hide_obj(obj, 'V56: source/prototype module; not part of final plant scene')
        prototype_hidden += 1


# ---------------------------------------------------------------------------
# 2) LEGACY ELECTRICAL ROUTING — V19 tray stayed in the old corridor after
# layout migration, while its supports moved to the final process row. V24
# drops therefore became long black floating arcs. Hide the obsolete subsystem.
# ---------------------------------------------------------------------------
cable_tray_names = ['V19_CABLE_TRAY_L', 'V19_CABLE_TRAY_R'] + [
    f'V19_CABLE_TRAY_RUNG_{i:02d}' for i in range(1, 37)
]
cable_hidden = hide_names(
    cable_tray_names,
    'V56: unsupported legacy cable tray left in pre-V49 corridor',
)
cable_hidden += hide_names(
    [f'V24_CABLE_DROP_{i:02d}' for i in range(1, 7)],
    'V56: obsolete hanging cable drop from legacy tray; visually read as floating black cable',
)


# ---------------------------------------------------------------------------
# 3) DUPLICATED PIPE-RACK STRUCTURE — V16 rack members and V19 corridor frames
# occupy the same final envelope. V19 is the newer authoritative structure.
# ---------------------------------------------------------------------------
duplicate_rack = []
for obj in scene.objects:
    if obj.name.startswith('V16_RACK_') or obj.name.startswith('V16_SHORT_RACK_'):
        duplicate_rack.append(obj)
for obj in duplicate_rack:
    hide_obj(obj, 'V56: duplicated legacy rack member; V19 corridor frame is authoritative')


# ---------------------------------------------------------------------------
# 4) ORPHANED MAINTENANCE GANTRY — the V21 gantry at x=116 was authored for a
# pump island that no longer occupies that bay after the final process layout.
# It now reads as an unsupported/floating frame over an empty pad. Hide it.
# ---------------------------------------------------------------------------
orphan_gantry = [o for o in scene.objects if o.name.startswith('V21_GANTRY_116')]
for obj in orphan_gantry:
    hide_obj(obj, 'V56: orphaned maintenance gantry left over from pre-final process infill')


# ---------------------------------------------------------------------------
# 5) AUXILIARY V20 UTILITY CORRIDOR — its source lineage is legacy, but the
# corridor is structurally supported and also carries valid stockpile spray
# equipment. Keep it intact in V56 rather than deleting a legitimate service.
# ---------------------------------------------------------------------------
v20_util = bpy.data.collections.get('V20_UTILITIES')
v20_preserved = len(v20_util.objects) if v20_util else 0


# ---------------------------------------------------------------------------
# 6) INDUSTRIAL MATERIAL TUNING — preserve functional colour coding, but use
# muted plant colours so pipes read as real services rather than neon guides.
# ---------------------------------------------------------------------------
material_updates = {
    'V16_WaterPipe': ((0.105, 0.165, 0.220), 0.10, 0.58),
    'V16_AirPipe': ((0.255, 0.265, 0.275), 0.16, 0.54),
    'V19_ChemPipe': ((0.245, 0.135, 0.115), 0.08, 0.60),
    'V16_ProcessPipe': ((0.325, 0.280, 0.170), 0.10, 0.58),
    'V52_Recycle': ((0.340, 0.220, 0.130), 0.08, 0.60),
    'V21_FirePipe': ((0.330, 0.105, 0.085), 0.08, 0.60),
    'V19_CableTray': ((0.210, 0.225, 0.240), 0.55, 0.44),
}
updated_materials = []
for name, (color, metal, rough) in material_updates.items():
    if set_material(name, color, metal, rough):
        updated_materials.append(name)


# ---------------------------------------------------------------------------
# 7) CAP VISIBLE UTILITY/SERVICE PIPE ENDS — several retained headers terminate
# at rack boundaries by design. Closed bevel caps make them read as finished
# industrial lines instead of accidental cut/open tubes in end-on views.
# ---------------------------------------------------------------------------
pipe_cap_tokens = (
    'PIPE', 'HEADER', 'UTILITY_DROP', 'UTILITY_WASH_WATER', 'WATER_BRANCH', 'DUST_BRANCH',
    'EXPANSION_LOOP', 'FIREWATER_RING',
)
capped_curves = []
for obj in scene.objects:
    if obj.hide_render or obj.type != 'CURVE':
        continue
    if getattr(obj.data, 'bevel_depth', 0.0) <= 0.0:
        continue
    upper = obj.name.upper()
    if any(token in upper for token in pipe_cap_tokens):
        obj.data.use_fill_caps = True
        obj['v56_pipe_end_caps'] = True
        capped_curves.append(obj.name)


# ---------------------------------------------------------------------------
# 8) REBUILD ELECTRICAL TRUNK ON THE FINAL V19 PIPE RACK.
# The old 144 m tray was left behind in the pre-V49 corridor. Replace it with a
# compact ladder tray mounted outside the final rack, with explicit cantilever
# supports. No hanging decorative drops are reintroduced.
# ---------------------------------------------------------------------------
electrical = ensure_collection('V56_ELECTRICAL_CLEANUP', 'V51_50_PROCESS_PIPING_UTILITIES')
tray_material = bpy.data.materials.get('V19_CableTray')
tray_objects = []
tray_objects.append(make_box('V56_CABLE_TRAY_MAIN_RAIL_A', (246.0, 44.10, 7.78), (144.0, 0.10, 0.18), tray_material, electrical))
tray_objects.append(make_box('V56_CABLE_TRAY_MAIN_RAIL_B', (246.0, 44.80, 7.78), (144.0, 0.10, 0.18), tray_material, electrical))
for idx, x in enumerate(range(174, 319, 4), start=1):
    tray_objects.append(make_box(
        f'V56_CABLE_TRAY_MAIN_RUNG_{idx:02d}',
        (float(x), 44.45, 7.76),
        (0.10, 0.80, 0.08),
        tray_material,
        electrical,
    ))
for idx, x in enumerate(range(176, 317, 10), start=1):
    tray_objects.append(make_box(
        f'V56_CABLE_TRAY_SUPPORT_{idx:02d}',
        (float(x), 44.15, 7.58),
        (0.12, 1.50, 0.12),
        tray_material,
        electrical,
    ))


# ---------------------------------------------------------------------------
# 9) SMALL GROUNDING FIXES FOUND BY THE FINAL VISUAL AUDIT.
# The service pickup had no hierarchy root, so every authored part must receive
# the same Z correction. LOADER-01 has a clean root and can be adjusted there.
# ---------------------------------------------------------------------------
service_pickup_parts = [
    obj for obj in scene.objects if obj.name.startswith('V24_SERVICE_PICKUP_')
]
for obj in service_pickup_parts:
    obj.location.z -= 0.40
    obj['v56_grounding_adjustment_z'] = -0.40

loader = bpy.data.objects.get('LOADER-01')
if loader:
    loader.location.z -= 0.09
    loader['v56_grounding_adjustment_z'] = -0.09


# Reassert that the authoritative main process routes remain visible.
AUTHORITATIVE = [
    'V52_PIPE_MILL_TO_SUMP',
    'V52_PIPE_SUMP_TO_SLURRY_PUMP',
    'V52_PIPE_SLURRY_PUMP_TO_CLASS',
    'V52_PIPE_CLASS_OVERFLOW_TO_R01',
    'V52_PIPE_CLASS_UNDERFLOW_SUCTION',
    'V52_PIPE_CLASS_UNDERFLOW_TO_MILL',
    'V39_PIPE_R01_TO_R02',
    'V39_PIPE_R02_TO_R03',
    'V39_PIPE_R03_TO_R04',
    'V37_PIPE_R04_TO_PUMP',
    'V52_PIPE_PUMP_TO_CIP',
    'V52_PIPE_CIP_TO_ELUTION',
    'V52_PIPE_ELUTION_TO_EW',
    'V39_EW_SMELT_CART',
]
for name in AUTHORITATIVE:
    obj = bpy.data.objects.get(name)
    if obj:
        obj.hide_render = False
        obj.hide_viewport = False
        obj['v56_authoritative_process'] = True


scene['PULPA_LAB_MASTER_VERSION'] = 'V56'
scene['PULPA_LAB_V56_BASE'] = 'V55 final release preserved; visual cleanup only'
scene['PULPA_LAB_V56_SCOPE'] = 'Remove legacy floating/duplicate clutter and professionalize utility pipe materials'
scene['PULPA_LAB_V56_NOTES'] = (
    'Hidden, not deleted: V15 prototype library, unsupported legacy V19 cable tray + V24 hanging drops, '
    'duplicated V16 rack structures, and orphaned V21_GANTRY_116. V20 stockpile/service utilities are preserved. '
    'Visible service/utility curve ends are capped and full-pipe colours are further muted for industrial realism. '
    'A new supported V56 '
    'ladder cable tray is mounted on the final V19 corridor. V19 final corridor frames and '
    'V52/V39/V37 process routes remain authoritative. Utility colours retained but muted for industrial realism. '
    'Grounding corrected: V24 service pickup -0.40 m and LOADER-01 -0.09 m.'
)
scene.frame_set(1)
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print('V56_SAVED', OUT)
print('PROTOTYPE_HIDDEN', prototype_hidden)
print('CABLE_SUBSYSTEM_HIDDEN', cable_hidden)
print('DUPLICATE_RACK_HIDDEN', len(duplicate_rack))
print('ORPHAN_GANTRY_HIDDEN', len(orphan_gantry))
print('V20_UTILITY_PRESERVED', v20_preserved)
print('CAPPED_SERVICE_CURVES', len(capped_curves))
print('NEW_SUPPORTED_CABLE_TRAY_OBJECTS', len(tray_objects))
print('UPDATED_MATERIALS', updated_materials)
print('SERVICE_PICKUP_GROUNDED', len(service_pickup_parts), '-0.40m')
print('LOADER_GROUNDED', bool(loader), '-0.09m')
