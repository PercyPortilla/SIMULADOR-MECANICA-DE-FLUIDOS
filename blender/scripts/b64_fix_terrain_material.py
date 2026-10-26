"""B64: repair terrain materials for web export with self-contained glTF-compatible diffuse textures."""
import bpy, sys
from pathlib import Path

args=sys.argv[sys.argv.index('--')+1:]
output=Path(args[0]); texroot=Path(args[1])
scene=bpy.context.scene
terrain=bpy.data.objects.get('V57_TERRAIN_INTEGRATED')
if terrain is None or terrain.type!='MESH': raise RuntimeError('B64: V57_TERRAIN_INTEGRATED missing')
uv=terrain.data.uv_layers.active
if uv is None: raise RuntimeError('B64: terrain UV map missing')
if not terrain.get('B64_uv_tiled'):
    for loop in uv.data:
        loop.uv.x *= 40.0; loop.uv.y *= 40.0
    terrain['B64_uv_tiled']=40.0

def load_packed(path):
    img=bpy.data.images.load(str(path), check_existing=False)
    img.colorspace_settings.name='sRGB'; img.pack(); img.filepath=f'//B64_PACKED/{path.name}'
    return img

def material(label, roughness):
    diffuse=load_packed(texroot/f'{label}_diffuse.jpg')
    mat=bpy.data.materials.new(f'MAT_B64_TERRAIN_{label.upper()}')
    mat.use_nodes=True; nt=mat.node_tree; nt.nodes.clear()
    out=nt.nodes.new('ShaderNodeOutputMaterial'); out.location=(520,0)
    bsdf=nt.nodes.new('ShaderNodeBsdfPrincipled'); bsdf.location=(260,0)
    tex=nt.nodes.new('ShaderNodeTexImage'); tex.image=diffuse; tex.extension='REPEAT'; tex.location=(-260,120)
    nt.links.new(tex.outputs['Color'],bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value=roughness; bsdf.inputs['Metallic'].default_value=0.0
    nt.links.new(bsdf.outputs['BSDF'],out.inputs['Surface'])
    mat['B64_glTF_safe']=True; mat['B64_texture_policy']='packed 768px diffuse; fixed roughness; no external runtime dependency'
    return mat

mats=[material('earth',0.84),material('gravel',0.90),material('rock',0.88)]
terrain.data.materials.clear()
for m in mats: terrain.data.materials.append(m)
counts=[0,0,0]
for p in terrain.data.polygons:
    z=abs(p.normal.z); idx=0 if z>=0.86 else (1 if z>=0.58 else 2)
    p.material_index=idx; counts[idx]+=1
terrain.data.update()
terrain['B64_material_assignment']={'earth':counts[0],'gravel':counts[1],'rock':counts[2]}
scene['visual_authority']='V57/B64'; scene['source_master']='PULPA_LAB_V57_B63_MASTER_DEFINITIVO.blend'
scene['B64_fix']='self-contained glTF terrain diffuse materials; repaired missing B63 external paths'
scene['B64_solver_policy']='visual-only; solver and hydraulic equations unchanged'
output.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(output),check_existing=False)
print('B64_TERRAIN_FIXED',counts,'packed',sum(1 for i in bpy.data.images if i.packed_file),'output',output)
