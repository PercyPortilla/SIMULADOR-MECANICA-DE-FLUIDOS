import bpy
from mathutils import Vector

scene=bpy.context.scene
deps=bpy.context.evaluated_depsgraph_get()

REQ=['ROM-HOPPER','APRON-FEEDER','PRIMARY-CRUSHER','STOCKPILE-RECLAIM','MILL-01','SUMP-01','SLURRY-PUMP-01','CLASS-01','R-01','R-02','R-03','R-04','PUMP-01','CIP-ADSORPTION','ELUTION-SKID','EW-CELLS','SMELTING-FURNACE']
FRAME=bpy.data.objects.get('V49_PROCESS_LAYOUT_FRAME')

def mesh_bounds(root):
    deps=bpy.context.evaluated_depsgraph_get();pts=[]
    for q in [root]+list(root.children_recursive):
        if q.type!='MESH' or q.hide_render:continue
        ev=q.evaluated_get(deps);me=ev.to_mesh();mw=ev.matrix_world
        pts.extend(mw@v.co for v in me.vertices);ev.to_mesh_clear()
    if not pts:return None
    mn=Vector((min(p.x for p in pts),min(p.y for p in pts),min(p.z for p in pts)))
    mx=Vector((max(p.x for p in pts),max(p.y for p in pts),max(p.z for p in pts)))
    return mn,mx

print('VERSION',scene.get('PULPA_LAB_MASTER_VERSION'),'OBJECTS',len(scene.objects),'MISSING',[n for n in REQ if not bpy.data.objects.get(n)])
print('FRAME',tuple(round(float(v),3) for v in FRAME.location),tuple(round(float(v),3) for v in FRAME.rotation_euler))

scene.frame_set(1);bpy.context.view_layer.update()
for n in REQ:
    o=bpy.data.objects[n];b=mesh_bounds(o)
    if b:
        mn,mx=b;c=(mn+mx)*.5
        print('CENTER',n,tuple(round(float(v),2) for v in c),'YSPAN',(round(float(mn.y),2),round(float(mx.y),2)),'ZMIN',round(float(mn.z),2),'PARENT',o.parent.name if o.parent else None)

stock=mesh_bounds(bpy.data.objects['STOCKPILE-RECLAIM'])
row=[]
for n in ['MILL-01','SUMP-01','SLURRY-PUMP-01','CLASS-01','R-01','R-02','R-03','R-04','PUMP-01','CIP-ADSORPTION','ELUTION-SKID','EW-CELLS','SMELTING-FURNACE']:
    b=mesh_bounds(bpy.data.objects[n]);row.append((n,b[0],b[1]))
min_row_y=min(mn.y for _,mn,mx in row);max_stock_y=stock[1].y
print('ROW_STOCKPILE_CLEARANCE_Y',round(float(min_row_y-max_stock_y),3))

chain=['ROM-HOPPER','APRON-FEEDER','PRIMARY-CRUSHER','CV-02','STOCKPILE-RECLAIM','CV-03','MILL-01','SUMP-01','SLURRY-PUMP-01','CLASS-01','R-01','R-02','R-03','R-04','PUMP-01','CIP-ADSORPTION','ELUTION-SKID','EW-CELLS','SMELTING-FURNACE']
for n in chain:
    o=bpy.data.objects.get(n)
    if o:print('FLOW',n,'UP',o.get('upstream'),'DOWN',o.get('downstream'),'BELT',o.get('belt_object'))

legacy=[o.name for o in scene.objects if o.name.startswith(('V17_CONV_ROM_TO_STOCK','V17_CONV_STOCK_RECLAIM','V20_STACKER_FEED_CONV','V20_STACKER_BOOM')) and not o.hide_render]
print('LEGACY_VISIBLE',legacy)
print('NEW_CONV_COUNTS',sum(1 for o in scene.objects if o.name.startswith('V49_CV02_BELT_')),sum(1 for o in scene.objects if o.name.startswith('V49_CV03_BELT_')))

probes=['TRUCK-01','LOADER-01_ARM_PIVOT','APRON-FEEDER_PANS_GROUP','PRIMARY-CRUSHER_MOVING_JAW','MILL-01_TRUNNION_01','SLURRY-PUMP-01_SHAFT','R-01_ROTATING_GROUP','V43_CLASS_SWIRL_ROOT_01','V40_ELUTION_PIVOT_01','EW-CELLS_CATHODE_1_1','V39_EW_SMELT_CART','V49_CV02_ORE_01','V49_CV03_ORE_01']
for f in (1,48,300,720,1500,2500,2890):
    scene.frame_set(f);bpy.context.view_layer.update();print('FRAMECHECK',f)
    for n in probes:
        o=bpy.data.objects.get(n)
        if not o:print(' PROBE',n,'MISSING');continue
        p=o.matrix_world.translation
        print(' PROBE',n,'P',tuple(round(float(v),3) for v in p),'R',tuple(round(float(v),3) for v in o.rotation_euler))

bad=[]
for o in scene.objects:
    s=[abs(float(v)) for v in o.scale]
    if min(s)<.01 or max(s)>100:bad.append((o.name,tuple(round(v,4) for v in s)))
print('SCALE_ANOMALIES',len(bad),'SAMPLE',bad[:10])

for pad in ['V49_PAD_RECOVERY','V49_PAD_LEACH_CIP','V49_PAD_CLASS_PUMP','V49_PAD_SUMP','V49_PAD_MILL','V49_PROCESS_ACCESS_ROAD']:
    o=bpy.data.objects.get(pad);print('CIVIL',pad,'OK' if o else 'MISSING',tuple(round(float(v),2) for v in o.dimensions) if o else None)

print('PASS_BASIC',scene.get('PULPA_LAB_MASTER_VERSION')=='V50' and FRAME is not None and not legacy and not [n for n in REQ if not bpy.data.objects.get(n)])
