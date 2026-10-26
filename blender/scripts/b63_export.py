"""Final B63 web export; a single synchronized clip and shared mesh data."""
import bpy, sys, json
from pathlib import Path
target=Path(sys.argv[sys.argv.index('--')+1])
scene=bpy.context.scene
assert scene.get('visual_authority')=='V57/B63'
scene.frame_set(1)
for o in bpy.context.view_layer.objects:
 o.select_set(False)
for o in bpy.context.view_layer.objects:
 hidden=o.hide_render or any(c.hide_render for c in o.users_collection)
 if o.type in {'MESH','CURVE','FONT','EMPTY'} and not hidden:
  o.hide_set(False);o.select_set(True)
  p=o.parent
  while p:p.hide_set(False);p.select_set(True);p=p.parent
target.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,
 export_apply=True,export_extras=True,export_animations=True,export_animation_mode='SCENE',
 export_anim_scene_split_object=False,export_frame_range=True,export_frame_step=1,
 export_optimize_animation_size=True,export_optimize_animation_keep_anim_object=False,
 export_cameras=False,export_lights=False,export_yup=True)
print('B63_EXPORTED',target.stat().st_size)
