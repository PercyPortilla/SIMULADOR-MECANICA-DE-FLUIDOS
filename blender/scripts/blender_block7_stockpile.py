import bpy
import math
import os

col = bpy.data.collections.get("PROCESS_PLANT")
if col is None:
    raise RuntimeError("PROCESS_PLANT collection missing.")

for obj in list(bpy.data.objects):
    if obj.name == "STOCKPILE-RECLAIM" or obj.name.startswith("STOCKPILE-RECLAIM_"):
        bpy.data.objects.remove(obj, do_unlink=True)

STEEL = bpy.data.materials["MAT_Steel_Dark"]
LIGHT = bpy.data.materials["MAT_Steel_Light"]
ORANGE = bpy.data.materials["MAT_Safety_Orange"]
ORE = bpy.data.materials.get("MAT_ROM_Ore") or bpy.data.materials["MAT_Slurry"]
CONCRETE = bpy.data.materials["MAT_Concrete"]

def move(o):
    for c in list(o.users_collection):
        c.objects.unlink(o)
    col.objects.link(o)

def setmat(o,m):
    if hasattr(o.data,"materials"):
        o.data.materials.clear(); o.data.materials.append(m)

def box(name, loc, dims, m, rot=(0,0,0), bevel=.03):
    bpy.ops.mesh.primitive_cube_add(location=loc, rotation=rot)
    o=bpy.context.object;o.name=name;o.dimensions=dims
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new("EdgeSoftening","BEVEL");mod.width=bevel;mod.segments=2
    setmat(o,m);move(o);return o

def cone(name,loc,radius,height,m,scale=(1,1,1),verts=64):
    bpy.ops.mesh.primitive_cone_add(vertices=verts,radius1=radius,radius2=.15,depth=height,location=loc)
    o=bpy.context.object;o.name=name;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    setmat(o,m);move(o);return o

def cyl(name,loc,r,d,m,axis="Z",verts=28):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=d,location=loc)
    o=bpy.context.object;o.name=name
    if axis=="X":o.rotation_euler[1]=math.pi/2
    elif axis=="Y":o.rotation_euler[0]=math.pi/2
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    setmat(o,m);move(o);return o

def parent(o,r):
    mw=o.matrix_world.copy();o.parent=r;o.matrix_world=mw

root=bpy.data.objects.new("STOCKPILE-RECLAIM",None);col.objects.link(root);root.location=(260,0,0)
root["dimensions_m"]="50 x 40 x 10"
root["reference_class"]="coarse ore stockpile with loader-fed reclaim hopper"
root["web_asset"]=True

cx=260
pad=box("STOCKPILE-RECLAIM_PAD",(cx+2,0,.06),(44,35,.12),CONCRETE,bevel=.01);parent(pad,root)

# Irregular piles: several overlapping low-poly cones produce a natural footprint
# without making the GLB unnecessarily dense.
piles=[
    (-3.5, 0.5, 13.2, 8.6, (1.0,1.10,1.16)),
    (5.5,-3.8, 7.6, 5.0, (1.12,1.0,1.24)),
    (-8.0,5.8, 6.0, 4.0, (.95,1.0,1.30)),
]
for i,(x,y,r,h,scale) in enumerate(piles,1):
    p=cone(f"STOCKPILE-RECLAIM_PILE_{i:02d}",(cx+x,y,h/2+.12),r,h,ORE,scale=scale,verts=56)
    p.rotation_euler[2]=0.18*i
    parent(p,root)

# Reclaim hopper at the authoritative loader dump area (+21.5, +12 local).
hx=cx+21.5;hy=12.0
hopper=box("STOCKPILE-RECLAIM_HOPPER",(hx,hy,2.1),(5.0,5.0,3.0),LIGHT,rot=(0,0,math.pi/4),bevel=.06);parent(hopper,root)
throat=box("STOCKPILE-RECLAIM_HOPPER_THROAT",(hx,hy,.80),(2.1,2.1,1.7),STEEL,rot=(0,0,math.pi/4),bevel=.04);parent(throat,root)

# Grizzly over loader hopper.
for i in range(-4,5):
    y=hy+i*.48
    bar=cyl(f"STOCKPILE-RECLAIM_GRIZZLY_{i+5:02d}",(hx,y,3.65),.045,4.3,STEEL,axis="X",verts=16);parent(bar,root)

# Reclaim apron/feeder points roughly toward the existing reclaimOut local port
# [27, 1.15, 8.9].
feeder=box("STOCKPILE-RECLAIM_FEEDER",(cx+24.3,10.4,.72),(6.2,2.2,.45),STEEL,rot=(0,0,-.22),bevel=.04);parent(feeder,root)
for i in range(12):
    pan=box(f"STOCKPILE-RECLAIM_PAN_{i+1:02d}",(cx+21.8+i*.45,10.85-i*.10,.98),(.38,1.9,.10),LIGHT,rot=(0,0,-.22),bevel=.012);parent(pan,root)

# Support columns and small access platform around hopper.
for dx in (-2.2,2.2):
    for dy in (-2.2,2.2):
        leg=box(f"STOCKPILE-RECLAIM_LEG_{dx}_{dy}",(hx+dx,hy+dy,1.65),(.22,.22,3.3),STEEL,bevel=.02);parent(leg,root)
deck=box("STOCKPILE-RECLAIM_SERVICE_DECK",(hx,hy-3.0,3.0),(5.2,1.0,.12),STEEL,bevel=.02);parent(deck,root)
for i,x in enumerate([hx-2.4,hx-1.2,hx,hx+1.2,hx+2.4],1):
    post=box(f"STOCKPILE-RECLAIM_RAIL_POST_{i:02d}",(x,hy-3.45,3.45),(.05,.05,.9),ORANGE,bevel=.0);parent(post,root)
rail=box("STOCKPILE-RECLAIM_RAIL",(hx,hy-3.45,3.88),(5.0,.05,.05),ORANGE,bevel=.0);parent(rail,root)

# Export at datum.
old=root.matrix_world.copy();root.location=(0,0,0);bpy.context.view_layer.update()
bpy.ops.object.select_all(action="DESELECT");root.select_set(True)
for c in root.children_recursive:c.select_set(True)
bpy.context.view_layer.objects.active=root
outdir=os.path.join(os.path.expanduser("~"),"OneDrive","Desktop","CHATON","PULPA_LAB_GLBS");os.makedirs(outdir,exist_ok=True)
path=os.path.join(outdir,"STOCKPILE-RECLAIM.glb")
bpy.ops.export_scene.gltf(filepath=path,export_format="GLB",use_selection=True,export_cameras=False,export_lights=False,
    export_extras=True,export_animations=False,export_yup=True,export_apply=True)
root.matrix_world=old;bpy.context.view_layer.update()

checkpoint=os.path.join(os.path.expanduser("~"),"OneDrive","Desktop","CHATON","PULPA_LAB_BLENDER_CHECKPOINT_B7_STOCKPILE.blend")
bpy.ops.wm.save_as_mainfile(filepath=checkpoint)
result={"checkpoint":checkpoint,"glb":path,"bytes":os.path.getsize(path),"objects":1+len(root.children_recursive)}
