"""B63: conservative scene cleanup, contact corrections and lossless reuse.
Run with Blender --background INPUT.blend --disable-autoexec --python this.py -- OUTPUT.blend REPORT.json.
The input file is never overwritten. Export is a separate, final release step.
"""
import bpy, bmesh, json, sys, math, hashlib, struct, re
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

args=sys.argv[sys.argv.index('--')+1:]
output,report_path=map(Path,args[:2])
scene=bpy.context.scene
scene.frame_set(1)
report={'revision':'V57/B63','removed':[],'contacts':[],'shared_meshes':0,'shared_materials':0,'keys_removed':0,'checks':{}}
def curves(a):
 if hasattr(a,'fcurves'):return list(a.fcurves)
 return [f for l in a.layers for s in l.strips for b in s.channelbags for f in b.fcurves]
def objcurves(o):return curves(o.animation_data.action) if o.animation_data and o.animation_data.action else []
def animated(o):return bool(o.animation_data or (o.data and getattr(o.data,'animation_data',None)))
def bounds(o):
 pts=[o.matrix_world@Vector(c) for c in o.bound_box]
 return Vector(tuple(min(p[i] for p in pts) for i in range(3))),Vector(tuple(max(p[i] for p in pts) for i in range(3)))
def remove(o,reason):
 report['removed'].append({'name':o.name,'reason':reason});bpy.data.objects.remove(o,do_unlink=True)
def world_z(o,delta):
 m=o.matrix_world.copy();m.translation.z+=delta;o.matrix_world=m
def resize_z(o,low,high):
 lo,hi=bounds(o)
 if hi.z-lo.z<1e-5 or high<=low:return
 if o.data.users>1:o.data=o.data.copy()
 inv=o.matrix_world.inverted()
 for v in o.data.vertices:
  p=o.matrix_world@v.co;p.z=low+(p.z-lo.z)/(hi.z-lo.z)*(high-low);v.co=inv@p
 o.data.update()

report['before']={'objects':len(bpy.data.objects),'meshes':len(bpy.data.meshes),'materials':len(bpy.data.materials),'keys':sum(len(f.keyframe_points) for a in bpy.data.actions for f in curves(a))}
# Remove only permanently hidden geometry without animation or dependencies.
# Keep internal process meshes and helper empties used by inspection/POV.
referenced=set()
for o in bpy.data.objects:
 for c in o.constraints:
  if getattr(c,'target',None):referenced.add(c.target)
 for m in o.modifiers:
  if getattr(m,'object',None):referenced.add(m.object)
for o in list(bpy.data.objects):
 hidden=o.hide_render or any(c.hide_render for c in o.users_collection)
 process=any(s in o.name.upper() for s in ['FLUID','IMPELLER','SLURRY','CHARGE','INTERNAL','MOVING'])
 if o.type in {'MESH','CURVE','FONT'} and hidden and not animated(o) and not o.children and o not in referenced and not process:
  remove(o,'permanently hidden superseded geometry')

# Restore continuous ground beneath the south stockpile loader track. This
# stops at x=-66, before the reclaim opening at x=-64 (the opening stays clear).
terrain=bpy.data.objects['V57_TERRAIN_INTEGRATED']
for v in terrain.data.vertices:
 x,y,z=v.co
 if -130<x<-66 and 98<y<115:
  blend=min(1,max(0,min(x+130,-66-x,y-98,115-y)/3))
  v.co.z=z*(1-blend)+35.40*blend
terrain.data.update()
mat=bpy.data.materials.get('MAT_V57_CIVIL_COMPACTED_FILL')
mesh=bpy.data.meshes.new('B63_STOCKPILE_LOADER_APRON')
mesh.from_pydata([(-128,100,35.40),(-66,100,35.40),(-66,111,35.40),(-128,111,35.40)],[],[(0,1,2,3)])
mesh.materials.append(mat)
apron=bpy.data.objects.new('B63_STOCKPILE_LOADER_APRON',mesh);scene.collection.objects.link(apron)
apron['purpose']='continuous loader contact surface; reclaim notch remains open'
# Normalize actual surface normals; nonplanar terrain is triangulated once.
bm=bmesh.new();bm.from_mesh(terrain.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6)
bmesh.ops.triangulate(bm,faces=list(bm.faces),quad_method='BEAUTY',ngon_method='BEAUTY')
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(terrain.data);bm.free()

def build_surfaces():
 dg=bpy.context.evaluated_depsgraph_get();result=[]
 for o in scene.objects:
  # Vehicle dump floors and process vessel floors are not ground.
  if o.type!='MESH' or o.hide_render:continue
  if not (o.name.startswith(('CIV_','V57_TERRAIN','V57_FINAL_','B63_STOCKPILE','B60_HILL','V57_B60'))):continue
  if not any(s in o.name for s in ['TERRAIN','ROAD','RAMP','PAD','APRON','GROUND']):continue
  ev=o.evaluated_get(dg);me=ev.to_mesh()
  if me.polygons:result.append((o.name,BVHTree.FromPolygons([o.matrix_world@v.co for v in me.vertices],[list(p.vertices) for p in me.polygons])))
  ev.to_mesh_clear()
 return result
surfaces=build_surfaces()
def ground(x,y,near):
 hits=[]
 for name,bvh in surfaces:
  loc,normal,_,_=bvh.ray_cast(Vector((x,y,near+3)),Vector((0,0,-1)),150)
  if loc and abs(normal.z)>.1:hits.append((loc.z,name))
 return max(hits) if hits else None

# Repair support feet and posts, maintaining their mechanical top elevations.
# B60 already supplies extended CV02 legs: remove their obsolete airborne feet.
for idx in range(2,7):
 o=bpy.data.objects.get(f'CV-02_SUPPORT_{idx:02d}_FOOT')
 if o:remove(o,'superseded by grounded B60 paired footings')
for o in list(scene.objects):
 if o.type!='MESH' or o.hide_render or animated(o):continue
 is_foot=o.name.endswith('_FOOT') and any(p in o.name for p in ['SUPPORT_','SUPPORT-'])
 if not is_foot:continue
 lo,hi=bounds(o);center=(lo+hi)*.5;g=ground(center.x,center.y,lo.z)
 if not g or abs(lo.z-g[0])<.12:continue
 delta=g[0]+.015-lo.z
 world_z(o,delta)
 stem=o.name[:-5]
 for sibling in scene.objects:
  if sibling.type=='MESH' and sibling.name.startswith(stem) and any(p in sibling.name for p in ['_POST','_LEG']):
   sl,sh=bounds(sibling)
   if sh.z>g[0]+.2:resize_z(sibling,g[0]+.10,sh.z)
 report['contacts'].append({'name':o.name,'delta_z':round(delta,5),'surface':g[1]})
for o in list(scene.objects):
 if o.type!='MESH' or o.hide_render or not o.name.startswith('RACK-COLUMN-'):continue
 lo,hi=bounds(o);c=(lo+hi)*.5;g=ground(c.x,c.y,lo.z)
 if g and g[0]<hi.z-.3 and abs(g[0]-lo.z)>.12:
  resize_z(o,g[0]-.03,hi.z);report['contacts'].append({'name':o.name,'base_z':g[0]})

# TRUCK-01 had an open 79 m loop. Use the authored traversal as a reversible
# low-speed maneuver, with dwell at each end, instead of teleporting at wrap.
# All subassembly phases remain on the common 720-frame clock.
truck=bpy.data.objects['TRUCK-01']
original=[]
for f in range(1,721,12):
 scene.frame_set(f);original.append((f,truck.location.copy(),truck.rotation_euler.copy()))
scene.frame_set(720);original.append((720,truck.location.copy(),truck.rotation_euler.copy()))
for fc in objcurves(truck):
 if fc.data_path in {'location','rotation_euler'}:fc.keyframe_points.clear()
for f,p,r in original:
 for dest in [1+(f-1)*.46,720-(f-1)*.46]:
  truck.location=p;truck.rotation_euler=r;truck.keyframe_insert('location',frame=dest);truck.keyframe_insert('rotation_euler',frame=dest)
truck['B63_motion']='empty low-speed forward/reverse maneuver; continuous loop, dwell at endpoints'
for fc in objcurves(truck):
 if fc.data_path in {'location','rotation_euler'}:
  for k in fc.keyframe_points:k.interpolation='LINEAR'

# Ground mobile equipment using actual tire vertices, not rotated AABBs (which
# overestimate a cylindrical tire radius by up to sqrt(2)). Sample before
# editing so each contact correction is measured against the original pose.
names=['TRUCK-01','TRUCK-02','TRUCK-03','ROM-LOADER-01','STOCKPILE-LOADER-01','EXCAVATOR-01']
mobile={n:bpy.data.objects.get(n) for n in names}
samples={n:[] for n in names}
contact_meshes={n:[c for c in o.children_recursive if c.type=='MESH' and ('_TIRE' in c.name or 'TRACK_SHOE' in c.name)] for n,o in mobile.items() if o}
for f in sorted(set(list(range(1,721,12))+[720])):
 scene.frame_set(f)
 for n,o in mobile.items():
  if not o:continue
  corrections=[]
  for w in contact_meshes[n]:
   pts=[w.matrix_world@v.co for v in w.data.vertices]
   if not pts:continue
   center=sum(pts,Vector())/len(pts);bottom=min(p.z for p in pts);g=ground(center.x,center.y,bottom)
   if g:corrections.append(g[0]+.025-bottom)
  if corrections:
   # Highest contact prevents penetration; slope variation is recorded below.
   dz=max(corrections);samples[n].append((f,o.location.z+dz,dz))
for n,values in samples.items():
 o=mobile[n]
 if not o or not values:continue
 if max(abs(x[2]) for x in values)<.07:continue
 for fc in objcurves(o):
  if fc.data_path=='location' and fc.array_index==2:fc.keyframe_points.clear()
 for f,z,dz in values:o.location.z=z;o.keyframe_insert('location',index=2,frame=f)
 for fc in objcurves(o):
  if fc.data_path=='location' and fc.array_index==2:
   for k in fc.keyframe_points:k.interpolation='LINEAR'
 report['contacts'].append({'name':n,'max_z_correction':max(abs(x[2]) for x in values)})

# Stationary trucks must not spin their wheels. Match moving wheel rotation to
# traveled distance, reversing the sign during the return maneuver.
for n in ['TRUCK-01','TRUCK-02','TRUCK-03']:
 root=mobile[n];spins=[o for o in root.children_recursive if 'WHEEL_SPIN_' in o.name and o.type=='EMPTY']
 if n!='TRUCK-01':
  for o in spins:
   o.animation_data_clear();o.rotation_euler=(0,0,0)
 else:
  distance=0;last=None
  for f in sorted(set(list(range(1,721,12))+[720])):
   scene.frame_set(f);p=root.location.copy()
   if last:distance+=(p-last).length*(1 if f<360 else -1)
   last=p
   for o in spins:
    o.rotation_euler.y=-distance/1.42;o.keyframe_insert('rotation_euler',index=1,frame=f)

# Lossless removal of redundant linear/constant keys. Curved Bezier motion is
# retained, except truly constant curves with flat handles.
for a in bpy.data.actions:
 for fc in curves(a):
  keys=fc.keyframe_points
  if len(keys)<3 or fc.modifiers:continue
  vals=[float(k.co.y) for k in keys]
  if max(vals)-min(vals)<1e-7 and all(abs(k.handle_left.y-k.co.y)<1e-7 and abs(k.handle_right.y-k.co.y)<1e-7 for k in keys):
   for idx in range(len(keys)-2,0,-1):keys.remove(keys[idx],fast=True);report['keys_removed']+=1
  else:
   for idx in range(len(keys)-2,0,-1):
    a0,b,c=keys[idx-1],keys[idx],keys[idx+1]
    if a0.interpolation=='LINEAR' and b.interpolation=='LINEAR' and c.co.x>a0.co.x:
     expected=a0.co.y+(c.co.y-a0.co.y)*(b.co.x-a0.co.x)/(c.co.x-a0.co.x)
     if abs(expected-b.co.y)<1e-7:keys.remove(b,fast=True);report['keys_removed']+=1
  fc.update()
scene.frame_set(1)

def material_key(m):
 if m.animation_data or (m.node_tree and m.node_tree.animation_data):return None
 nodes=[];links=[]
 if m.use_nodes:
  for n in m.node_tree.nodes:
   inputs=[]
   for s in n.inputs:
    if hasattr(s,'default_value'):
     v=s.default_value;inputs.append((s.identifier,list(v) if hasattr(v,'__len__') and not isinstance(v,str) else v))
   nodes.append((n.name,n.bl_idname,inputs,getattr(getattr(n,'image',None),'name',None)))
  links=[(l.from_node.name,l.from_socket.identifier,l.to_node.name,l.to_socket.identifier) for l in m.node_tree.links]
 return json.dumps([list(m.diffuse_color),m.metallic,m.roughness,m.use_nodes,m.surface_render_method,m.use_backface_culling,nodes,links],sort_keys=True,default=str)
mats={}
for m in list(bpy.data.materials):
 k=material_key(m)
 if k is None:continue
 if k in mats:m.user_remap(mats[k]);report['shared_materials']+=1
 else:mats[k]=m

def mesh_key(me):
 if me.shape_keys or me.animation_data or me.attributes.get('custom_normal'):return None
 # Preserve every mesh attribute (including UVs, colors and sharp edges).
 h=hashlib.sha256()
 for v in me.vertices:h.update(struct.pack('<3f',*v.co))
 for p in me.polygons:h.update(struct.pack('<I?',p.material_index,p.use_smooth));h.update(struct.pack('<'+'I'*len(p.vertices),*p.vertices))
 for attr in me.attributes:
  h.update((attr.name+attr.data_type+attr.domain).encode())
  for d in attr.data:
   for prop in ['value','vector','color']:
    if hasattr(d,prop):h.update(str(getattr(d,prop)[: ] if hasattr(getattr(d,prop),'__len__') else getattr(d,prop)).encode());break
 h.update(str([m.name if m else '' for m in me.materials]).encode())
 return h.hexdigest()
seen={}
for o in scene.objects:
 if o.type!='MESH':continue
 k=mesh_key(o.data)
 if not k:continue
 if k in seen and seen[k]!=o.data:o.data=seen[k];report['shared_meshes']+=1
 else:seen[k]=o.data

# Delete only exact static duplicates with the same parent, mesh and transform.
# Semantic roots and animated descendants are never merged away.
duplicates={}
for o in list(scene.objects):
 if o.type!='MESH' or animated(o) or o.children or o.modifiers or o in referenced:continue
 key=(o.data.name,o.parent.name if o.parent else None,tuple(round(v,7) for row in o.matrix_world for v in row),o.hide_render)
 if key in duplicates and re.search(r'\.\d{3}$',o.name):remove(o,'exact duplicate geometry and transform')
 else:duplicates[key]=o
# Purge only unreferenced datablocks, not object hierarchies or reusable internals.
for group in [bpy.data.meshes,bpy.data.materials,bpy.data.curves,bpy.data.actions]:
 for block in list(group):
  if block.users==0:group.remove(block)
for c in list(bpy.data.collections):
 if c.name.startswith('V57_LAYOUT') and not c.all_objects:bpy.data.collections.remove(c)

scene['visual_authority']='V57/B63';scene['source_master']='PULPA_LAB_V57_B61_MASTER_DEFINITIVO.blend'
scene['B63_solver_policy']='visual-only; solver and hydraulic equations unchanged'
scene.frame_set(1)
first=mobile['TRUCK-01'].matrix_world.translation.copy();scene.frame_set(720)
last=mobile['TRUCK-01'].matrix_world.translation.copy()
report['checks']['truck_loop_position_error_m']=(last-first).length
report['checks']['finite_transforms']=all(math.isfinite(v) for o in scene.objects for row in o.matrix_world for v in row)
report['checks']['critical_equipment']=all(bpy.data.objects.get(n) for n in ['MILL-01_ROOT','SUMP-01_ROOT','SLURRY-PUMP-01_ROOT','CLASS-01_ROOT','R-01_ROOT','CIP-ADSORPTION_ROOT','TRUCK-01'])
report['after']={'objects':len(bpy.data.objects),'meshes':len(bpy.data.meshes),'materials':len(bpy.data.materials),'keys':sum(len(f.keyframe_points) for a in bpy.data.actions for f in curves(a))}
assert report['checks']['finite_transforms'] and report['checks']['critical_equipment']
assert report['checks']['truck_loop_position_error_m']<.02
scene.frame_set(1)
scene.camera=bpy.data.objects['V57_CAM_PROCESS']
scene.render.engine='BLENDER_EEVEE'
output.parent.mkdir(parents=True,exist_ok=True);report_path.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(output),compress=True)
report_path.write_text(json.dumps(report,indent=2),encoding='utf-8')
print('B63_PASS',json.dumps({k:report[k] for k in ['before','after','shared_meshes','shared_materials','keys_removed','checks']}))
