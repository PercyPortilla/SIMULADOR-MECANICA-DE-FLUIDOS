import bpy, os, re, shutil, subprocess

ROOT=r'C:\Users\USER\OneDrive\Desktop\CHATON\pulpa-v31-babylon'
OUT=os.path.join(ROOT,'public','models','pulpa-v56')
DIST=os.path.join(ROOT,'dist','models','pulpa-v56')
TMP=os.path.join(ROOT,'blender')
os.makedirs(OUT,exist_ok=True);os.makedirs(DIST,exist_ok=True)
scene=bpy.context.scene
if scene.get('PULPA_LAB_MASTER_VERSION')!='V56':
    raise RuntimeError(f"Expected V56, got {scene.get('PULPA_LAB_MASTER_VERSION')!r}")

STATIC=os.path.join(TMP,'_v56_static.glb')
DYNAMIC=os.path.join(TMP,'_v56_dynamic.glb')
MERGED=os.path.join(OUT,'PULPA_LAB_V56_FULL_SITE.glb')


def prepare_materials():
    fixed=[];legacy=re.compile(r'^V(?:1[6-9]|[2-9]\d)_')
    for m in bpy.data.materials:
        if not m.node_tree:continue
        p=next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
        if not p:continue
        base=p.inputs.get('Base Color')
        if not base:continue
        procedural=base.is_linked and any(link.from_node.type!='TEX_IMAGE' for link in base.links)
        default=max(abs(float(base.default_value[i])-.8) for i in range(3))<1e-5
        diffuse=tuple(float(v) for v in m.diffuse_color)
        delta=max(abs(diffuse[i]-float(base.default_value[i])) for i in range(3))
        legacy_default=bool(legacy.match(m.name)) and default and delta>.08
        if not procedural and not legacy_default:continue
        for link in list(base.links):m.node_tree.links.remove(link)
        base.default_value=diffuse;fixed.append(m.name)
    print('MATERIAL_FALLBACKS',len(fixed),flush=True)


def export_subset(path,objects,animations):
    bpy.ops.object.select_all(action='DESELECT')
    objects=list(objects)
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    kwargs=dict(
        filepath=path,export_format='GLB',use_selection=True,
        export_cameras=False,export_lights=False,export_materials='EXPORT',export_extras=True,
        export_yup=True,export_apply=False,export_animations=animations,
        export_morph=False,export_skins=False,export_texcoords=True,export_normals=True,export_tangents=False,
    )
    if animations:
        kwargs.update(
            export_animation_mode='SCENE',export_frame_range=True,
            export_optimize_animation_size=True,export_force_sampling=False,
            export_bake_animation=False,export_anim_scene_split_object=True,
        )
    bpy.ops.export_scene.gltf(**kwargs)
    print('EXPORTED',os.path.basename(path),'objects',len(objects),'bytes',os.path.getsize(path),flush=True)


prepare_materials()
visible={o for o in scene.objects if o.type not in {'CAMERA','LIGHT'} and not o.hide_render}
seeds=set()
for o in visible:
    ad=o.animation_data
    if (ad and (ad.action or ad.drivers or ad.nla_tracks)) or o.constraints:
        seeds.add(o)

dynamic=set(seeds)
for seed in list(seeds):
    dynamic.update(o for o in seed.children_recursive if o in visible)
    p=seed.parent
    while p:
        if p in visible:dynamic.add(p)
        p=p.parent
static=visible-dynamic
print('PARTITION','visible',len(visible),'dynamic',len(dynamic),'static',len(static),flush=True)

export_subset(STATIC,static,False)
export_subset(DYNAMIC,dynamic,True)

npx=shutil.which('npx.cmd') or shutil.which('npx')
if not npx:raise RuntimeError('npx required for V56 split merge')
subprocess.run([npx,'--yes','@gltf-transform/cli@4.2.1','merge',STATIC,DYNAMIC,MERGED,'--merge-scenes'],check=True)
print('MERGED',os.path.getsize(MERGED),flush=True)

resampled=os.path.join(OUT,'PULPA_LAB_V56_FULL_SITE.resampled.glb')
subprocess.run([npx,'--yes','@gltf-transform/cli@4.2.1','resample',MERGED,resampled,'--tolerance','0.0001'],check=True)
before=os.path.getsize(MERGED);after=os.path.getsize(resampled);os.replace(resampled,MERGED)
print('RESAMPLED',before,'->',after,flush=True)

deduped=os.path.join(OUT,'PULPA_LAB_V56_FULL_SITE.dedup.glb')
subprocess.run([npx,'--yes','@gltf-transform/cli@4.2.1','dedup',MERGED,deduped],check=True)
before=os.path.getsize(MERGED);after=os.path.getsize(deduped);os.replace(deduped,MERGED)
print('DEDUP',before,'->',after,flush=True)

dst=os.path.join(DIST,os.path.basename(MERGED));shutil.copy2(MERGED,dst)
print('COPIED_DIST',os.path.getsize(dst),flush=True)

for p in (STATIC,DYNAMIC):
    try:os.remove(p)
    except OSError:pass
print('V56_SPLIT_EXPORT_DONE',MERGED,flush=True)
