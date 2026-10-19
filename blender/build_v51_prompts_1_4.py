import bpy
from mathutils import Vector

EXPECTED = 'V50'
OUT = r'C:\Users\USER\OneDrive\Desktop\CHATON\pulpa-v31-babylon\blender\PULPA_LAB_BLENDER_MASTER_V51.blend'
scene = bpy.context.scene

if scene.get('PULPA_LAB_MASTER_VERSION') != EXPECTED:
    raise RuntimeError(f'V51 prompts 1-4 require {EXPECTED}, got {scene.get("PULPA_LAB_MASTER_VERSION")!r}')


def ensure_collection(name, parent=None):
    col = bpy.data.collections.get(name)
    if col is None:
        col = bpy.data.collections.new(name)
    owner = parent if parent is not None else scene.collection
    if col.name not in owner.children:
        owner.children.link(col)
    return col


ORG_ROOT = ensure_collection('V51_ORGANIZED')
ORG = {
    'core': ensure_collection('V51_00_CORE_ASSETS', ORG_ROOT),
    'terrain': ensure_collection('V51_10_TERRAIN_EARTHWORKS', ORG_ROOT),
    'roads': ensure_collection('V51_20_ROADS_DRAINAGE', ORG_ROOT),
    'civil': ensure_collection('V51_30_CIVIL_SITE_INFRA', ORG_ROOT),
    'solids': ensure_collection('V51_40_SOLIDS_HANDLING', ORG_ROOT),
    'piping': ensure_collection('V51_50_PROCESS_PIPING_UTILITIES', ORG_ROOT),
    'operations': ensure_collection('V51_60_OPERATION_ANIMATION_LAYOUT', ORG_ROOT),
    'qa': ensure_collection('V51_70_LIGHTING_QA', ORG_ROOT),
    'pit': ensure_collection('V51_02_OPEN_PIT_TODO', ORG_ROOT),
}
TRANSFER = ensure_collection('V51_FRONTEND_TRANSFERS', ORG['solids'])


def material(name, color, metallic=0.0, roughness=0.65):
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    if bsdf:
        bsdf.inputs['Base Color'].default_value = (*color, 1.0)
        bsdf.inputs['Metallic'].default_value = metallic
        bsdf.inputs['Roughness'].default_value = roughness
    return mat


M_STEEL = bpy.data.materials.get('V16_Steel') or material('V51_Steel', (0.18, 0.21, 0.23), 0.6, 0.45)
M_ORANGE = bpy.data.materials.get('V16_Orange') or material('V51_Orange', (0.82, 0.25, 0.035), 0.1, 0.55)
M_BELT = bpy.data.materials.get('V17_Belt') or material('V51_Belt', (0.035, 0.04, 0.045), 0.0, 0.88)
M_ORE = bpy.data.materials.get('V35_AnimatedOre') or material('V51_AnimatedOre', (0.18, 0.105, 0.035), 0.0, 0.95)


def new_object_to_collection(obj, col=TRANSFER):
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    col.objects.link(obj)
    obj['v51_frontend_correction'] = True
    return obj


def box(name, loc, dims, mat, col=TRANSFER):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    new_object_to_collection(obj, col)
    return obj


def beam_between(name, a, b, width, height, mat, col=TRANSFER):
    a = Vector(a)
    b = Vector(b)
    delta = b - a
    length = delta.length
    if length < 1e-6:
        raise RuntimeError(f'Zero-length beam: {name}')
    bpy.ops.mesh.primitive_cube_add(size=1, location=(a + b) * 0.5)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = (length, width, height)
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = Vector((1, 0, 0)).rotation_difference(delta.normalized())
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    new_object_to_collection(obj, col)
    return obj


def chute(name, a, b, width=1.8, wall_height=0.65):
    a = Vector(a)
    b = Vector(b)
    center_delta = b - a
    lateral = Vector((-center_delta.y, center_delta.x, 0.0))
    if lateral.length < 1e-6:
        lateral = Vector((0, 1, 0))
    lateral.normalize()
    side = lateral * (width * 0.5)
    bottom = beam_between(name + '_BOTTOM', a, b, width, 0.16, M_STEEL)
    left = beam_between(name + '_SIDE_L', a + side + Vector((0, 0, wall_height * 0.35)),
                        b + side + Vector((0, 0, wall_height * 0.35)), 0.12, wall_height, M_STEEL)
    right = beam_between(name + '_SIDE_R', a - side + Vector((0, 0, wall_height * 0.35)),
                         b - side + Vector((0, 0, wall_height * 0.35)), 0.12, wall_height, M_STEEL)
    for obj in (bottom, left, right):
        obj['transfer_role'] = name
    return (bottom, left, right)


def curve_path(name, pts):
    curve = bpy.data.curves.new(name + '_C', 'CURVE')
    curve.dimensions = '3D'
    curve.path_duration = 180
    spline = curve.splines.new('POLY')
    spline.points.add(len(pts) - 1)
    for point, value in zip(spline.points, pts):
        point.co = (*value, 1.0)
    obj = bpy.data.objects.new(name, curve)
    TRANSFER.objects.link(obj)
    obj.hide_render = True
    obj.hide_viewport = True
    obj['v51_frontend_correction'] = True
    return obj


def conveyor(name, pts, width=1.9, ore_count=7, trestle_base=None):
    for index, (a, b) in enumerate(zip(pts[:-1], pts[1:]), 1):
        beam_between(f'{name}_BELT_{index:02d}', a, b, width, 0.16, M_BELT)
        av = Vector(a)
        bv = Vector(b)
        delta = bv - av
        lateral = Vector((-delta.y, delta.x, 0.0))
        if lateral.length < 1e-6:
            lateral = Vector((0, 1, 0))
        lateral.normalize()
        offset = lateral * (width * 0.52)
        lift = Vector((0, 0, 0.46))
        beam_between(f'{name}_RAIL_L_{index:02d}', av + lift + offset, bv + lift + offset, 0.07, 0.07, M_ORANGE)
        beam_between(f'{name}_RAIL_R_{index:02d}', av + lift - offset, bv + lift - offset, 0.07, 0.07, M_ORANGE)

    for index, p in enumerate(pts[1:-1], 1):
        x, y, z = p
        if callable(trestle_base):
            base = float(trestle_base(x, y, z))
        elif trestle_base is None:
            base = 1.55 if (x > 300 and y > 25) else 0.0
        else:
            base = float(trestle_base)
        height = max(0.4, z - base - 0.15)
        box(f'{name}_TRESTLE_{index:02d}', (x, y, base + height * 0.5), (0.24, 2.5, height), M_STEEL)

    path = curve_path(name + '_PATH', pts)
    for index in range(ore_count):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.24, location=(0, 0, 0))
        ore = bpy.context.object
        ore.name = f'{name}_ORE_{index + 1:02d}'
        ore.scale = (1.7, 1.0, 0.55)
        ore.data.materials.append(M_ORE)
        new_object_to_collection(ore)
        constraint = ore.constraints.new('FOLLOW_PATH')
        constraint.name = 'V51_BeltTravel'
        constraint.target = path
        constraint.use_fixed_location = True
        constraint.forward_axis = 'FORWARD_X'
        constraint.up_axis = 'UP_Z'
        driver = constraint.driver_add('offset_factor').driver
        phase = int(index * 180 / ore_count)
        driver.expression = f'((frame+{phase})%180)/180.0'
    return path


# ---------------------------------------------------------------------------
# Prompt 1: V51 organization by COLLECTION CONTAINERS only. Objects keep their
# users_collection, parents, matrix_parent_inverse, actions and drivers exactly.
# ---------------------------------------------------------------------------
COLLECTION_GROUPS = {
    'core': ['PULPA_LAB_ASSETS'],
    'terrain': [
        'V17_EARTH_BENCHES', 'V20_TOPOGRAPHY', 'V22_TERRAIN_DETAIL',
        'V26_RIPRAP', 'V26_TERRAIN_ROCKS', 'V28_ROAD_EMBANKMENTS',
        'V28_TERRAIN_FILL', 'V29_SHOULDER_GROUNDING', 'V30_CATCH_BENCHES',
        'V30_GROUNDING_FINAL', 'V30_TALUS', 'V31_EARTH_COLLARS',
        'V31_SLOPE_SKINS', 'V37_EXCAVATOR_BENCH',
    ],
    'roads': [
        'V17_ROADS_DRAINS', 'V20_ROADS', 'V22_ROAD_FIX', 'V27_ROAD_SHOULDERS',
        'V30_DRAINAGE', 'V31_CULVERT_DETAIL', 'V31_ROAD_SECTION', 'V32_CULVERTS',
    ],
    'civil': [
        'V16_CIVIL', 'V16_INFRA', 'V17_SITE_DETAILS', 'V18_SITE_FINISH',
        'V19_CIVIL_DETAIL', 'V20_ROM', 'V20_SITE_INFRA', 'V20_STOCKPILE',
        'V21_SITE_DETAIL', 'V21_STOCKPILE_REALISM', 'V22_ROM_CIVIL',
        'V22_STOCK_FINISH', 'V23_SUPPORT_FIX', 'V24_OPERATION_DETAIL',
        'V24_SCALE_CUES', 'V24_SURFACE_DETAIL', 'V26_DUST_DECALS',
        'V28_FOUNDATION_GROUNDING', 'V31_RETAINING_DETAIL', 'V32_CIVIL_FIX',
        'V50_CIVIL',
    ],
    'solids': ['V17_CONVEYORS', 'V21_CONVEYOR_UPGRADE', 'V34_COMPONENT_CONTROLLERS', 'V50_CONVEYORS'],
    'piping': [
        'V16_PIPING', 'V19_CATWALKS', 'V19_PIPE_DETAIL', 'V20_UTILITIES',
        'V21_PIPE_BRIDGES', 'V21_PROCESS_INFILL', 'V23_CATWALK_FIX', 'V23_PIPE_FIX',
        'V25_CATWALK_FINAL', 'V25_PIPE_FINAL', 'V35_RECOVERY_PIPING',
        'V37_RECOVERY_PIPING', 'V39_PROCESS_CONNECTIONS', 'V39_RECOVERY_TRANSFER',
    ],
    'operations': [
        'V34_OPERATIONAL_EQUIPMENT', 'V35_ANIMATION_VISUALS', 'V40_ANIMATION_FIX',
        'V43_STRICT_ANIMATION_FIX', 'V50_LAYOUT',
    ],
    'qa': ['V24_LIGHTING', 'Collection'],
}

for key, names in COLLECTION_GROUPS.items():
    umbrella = ORG[key]
    for cname in names:
        col = bpy.data.collections.get(cname)
        if col is None:
            continue
        if col.name not in umbrella.children:
            umbrella.children.link(col)
        if col.name in scene.collection.children:
            scene.collection.children.unlink(col)


# Only the old ROM-to-apron box is superseded. Existing V49 apron/CV02/CV03
# belts and their Follow Path ore stay authoritative to preserve animations.
old_rom_chute = bpy.data.objects.get('V49_ROM_TO_APRON_CHUTE')
if old_rom_chute:
    old_rom_chute.hide_render = True
    old_rom_chute.hide_viewport = True
    old_rom_chute['superseded_by'] = 'V51_ROM_TO_APRON_CHUTE'


# ---------------------------------------------------------------------------
# Prompt 2: ROM -> APRON -> PRIMARY-CRUSHER.
# Equipment roots and animated V49 belt stay fixed. We bridge only measured
# transfer gaps so V50 animation and validated positions remain untouched.
# ---------------------------------------------------------------------------
rom = bpy.data.objects['ROM-HOPPER']
apron = bpy.data.objects['APRON-FEEDER']
crusher = bpy.data.objects['PRIMARY-CRUSHER']

# Hopper throat to the west end of the apron top pans.
chute('V51_ROM_TO_APRON_CHUTE', (181.05, 0.0, 1.92), (186.08, 0.0, 1.22), 1.90, 0.72)
# Last apron top pan ends at x~193.98; the V49 transfer belt begins at x~194.18.
chute('V51_APRON_TRANSFER_TAIL', (193.90, 0.0, 1.18), (194.28, 0.0, 1.39), 1.54, 0.42)

rom['downstream'] = 'APRON-FEEDER'
apron['upstream'] = 'ROM-HOPPER'
apron['downstream'] = 'PRIMARY-CRUSHER'
crusher['upstream'] = 'APRON-FEEDER'
crusher['downstream'] = 'CV-02'


# ---------------------------------------------------------------------------
# Prompt 3: PRIMARY-CRUSHER -> CV-02 -> STOCKPILE.
# V49 crusher discharge already overlaps CV-02 correctly. Keep the validated
# belt route and model the missing 3.8 m stockpile drop as a real discharge chute.
# ---------------------------------------------------------------------------
chute('V51_CV02_STOCKPILE_DISCHARGE', (247.92, 0.50, 6.72), (249.05, 0.50, 3.32), 1.78, 0.78)
for index, t in enumerate((0.10, 0.30, 0.50, 0.70, 0.88), 1):
    p = Vector((247.92, 0.50, 6.72)).lerp(Vector((249.05, 0.50, 3.32)), t)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.20 + 0.025 * (index % 2), location=p)
    ore = bpy.context.object
    ore.name = f'V51_CV02_DROP_ORE_{index:02d}'
    ore.scale = (1.15, 0.90, 0.85)
    ore.data.materials.append(M_ORE)
    new_object_to_collection(ore)

cv2 = bpy.data.objects.get('CV-02')
stockpile = bpy.data.objects['STOCKPILE-RECLAIM']
if cv2:
    cv2['upstream'] = 'PRIMARY-CRUSHER'
    cv2['downstream'] = 'STOCKPILE-RECLAIM'
    cv2['v51_transfer_visual'] = 'V51_CV02_STOCKPILE_DISCHARGE'
stockpile['upstream'] = 'CV-02'
stockpile['downstream'] = 'CV-03'


# ---------------------------------------------------------------------------
# Prompt 4: STOCKPILE -> CV-03 -> MILL-01.
# Preserve V49 CV-03 and its ore animation. The feeder/belt junction changes
# direction by ~85 degrees, so make that turn explicit with a transfer tower,
# then bridge the tiny final gap into the mill trunnion.
# ---------------------------------------------------------------------------
for sx in (-0.78, 0.78):
    for sy in (-0.78, 0.78):
        box(f'V51_CV03_TRANSFER_LEG_{sx:+.2f}_{sy:+.2f}',
            (287.10 + sx, 10.20 + sy, 1.50), (0.18, 0.18, 3.0), M_STEEL)
box('V51_CV03_TRANSFER_DECK', (287.10, 10.20, 2.92), (2.10, 2.10, 0.16), M_STEEL)
chute('V51_RECLAIM_TO_CV03_CHUTE', (286.72, 9.78, 1.08), (287.22, 10.18, 1.32), 1.68, 0.58)
chute('V51_CV03_MILL_FEED_CHUTE', (337.96, 35.0, 5.96), (338.43, 35.0, 5.58), 1.50, 0.58)

cv3 = bpy.data.objects.get('CV-03')
mill = bpy.data.objects['MILL-01']
if cv3:
    cv3['upstream'] = 'STOCKPILE-RECLAIM'
    cv3['downstream'] = 'MILL-01'
    cv3['v51_transfer_visual'] = 'V51_CV03_TRANSFER_DECK'
mill['upstream'] = 'CV-03'


scene.frame_set(1)
bpy.context.view_layer.update()
scene['PULPA_LAB_MASTER_VERSION'] = 'V51'
scene['PULPA_LAB_V51_BASE'] = 'V50 preserved; prompts 1-4 modeled in Blender'
scene['PULPA_LAB_V51_SCOPE'] = 'organization + ROM/APRON/CRUSHER + CV02/stockpile + CV03/mill only'
scene['PULPA_LAB_V51_NOTES'] = (
    'Prompt 1 safely reparents collection containers only; object memberships/parents/actions are preserved. '
    'Prompt 2 fixes measured ROM->apron and apron->transfer gaps without moving equipment or the animated belt. '
    'Prompt 3 keeps validated CV-02 and models its missing stockpile drop chute/ore stream. '
    'Prompt 4 keeps validated CV-03, adds an explicit reclaim transfer tower and bridges the mill feed gap. '
    'Only the obsolete V49 ROM chute is hidden; downstream mill/sump/classification process is untouched.'
)
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print('V51_SAVED', OUT)
print('OBJECTS', len(scene.objects), 'TRANSFER_OBJECTS', len(TRANSFER.objects))
print('VERSION', scene.get('PULPA_LAB_MASTER_VERSION'))
