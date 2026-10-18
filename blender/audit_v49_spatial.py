import bpy
from mathutils import Vector

scene = bpy.context.scene
scene.frame_set(1)
bpy.context.view_layer.update()
deps = bpy.context.evaluated_depsgraph_get()

NAMES = [
    'ROM-HOPPER','APRON-FEEDER','PRIMARY-CRUSHER','CV-01','CV-02','STOCKPILE-RECLAIM','CV-03',
    'MILL-01','SUMP-01','SLURRY-PUMP-01','CLASS-01','R-01','R-02','R-03','R-04','PUMP-01',
    'CIP-ADSORPTION','ELUTION-SKID','EW-CELLS','SMELTING-FURNACE','LOADER-01'
]

def bounds(root):
    pts=[]
    for q in [root]+list(root.children_recursive):
        if q.type != 'MESH' or q.hide_render:
            continue
        ev=q.evaluated_get(deps)
        me=ev.to_mesh()
        mw=ev.matrix_world
        pts.extend(mw@v.co for v in me.vertices)
        ev.to_mesh_clear()
    if not pts:
        p=root.matrix_world.translation.copy()
        return p,p
    mn=Vector((min(p.x for p in pts),min(p.y for p in pts),min(p.z for p in pts)))
    mx=Vector((max(p.x for p in pts),max(p.y for p in pts),max(p.z for p in pts)))
    return mn,mx

def has_loc_anim(o):
    ad=o.animation_data
    action=ad.action if ad else None
    fcurves=[]
    if action:
        try:
            fcurves=list(action.fcurves)
        except Exception:
            fcurves=[]
    keyed=any(fc.data_path=='location' for fc in fcurves)
    drivers=bool(ad and ad.drivers and any(fc.data_path=='location' for fc in ad.drivers))
    nla=bool(ad and ad.nla_tracks)
    return keyed,drivers,nla,action.name if action else None

print('VERSION',scene.get('PULPA_LAB_MASTER_VERSION'),'OBJECTS',len(scene.objects))
for n in NAMES:
    o=bpy.data.objects.get(n)
    if not o:
        print('ROOT',n,'MISSING')
        continue
    mn,mx=bounds(o);c=(mn+mx)*.5
    print('ROOT',n,
          'LOCAL',tuple(round(float(v),3) for v in o.location),
          'WORLD',tuple(round(float(v),3) for v in o.matrix_world.translation),
          'CENTER',tuple(round(float(v),3) for v in c),
          'BOUNDS_X',(round(float(mn.x),3),round(float(mx.x),3)),
          'PARENT',o.parent.name if o.parent else None,
          'LOC_ANIM',has_loc_anim(o))

print('COLLECTIONS_MATCH')
for c in bpy.data.collections:
    u=c.name.upper()
    if any(k in u for k in ('ROAD','PIPE','RACK','PROCESS','CONVEY','TRANSFER','CIVIL')):
        names=[o.name for o in c.objects]
        print('COL',c.name,'COUNT',len(names),'SAMPLE',names[:12])

print('CONNECTOR_OBJECTS')
for o in scene.objects:
    u=o.name.upper()
    if any(k in u for k in ('CV-01','CV-02','CV-03','PIPE_','RACK','ROAD-')):
        if o.parent is None:
            print('TOP',o.name,'TYPE',o.type,'LOC',tuple(round(float(v),3) for v in o.location),'COLS',[c.name for c in o.users_collection])

print('CANDIDATE_PROCESS_ROW')
for n in ['MILL-01','SUMP-01','SLURRY-PUMP-01','CLASS-01','R-01','R-02','R-03','R-04','PUMP-01','CIP-ADSORPTION','ELUTION-SKID','EW-CELLS','SMELTING-FURNACE']:
    o=bpy.data.objects[n]
    mn,mx=bounds(o); c=(mn+mx)*.5
    tc=Vector((334.0-c.x,35.0-c.y,c.z))
    print('CAND',n,'CENTER',tuple(round(float(v),3) for v in tc),'SIZE',tuple(round(float(v),3) for v in (mx-mn)))

print('NORTH_CORRIDOR_STATIC_HITS')
for o in scene.objects:
    if o.parent is not None or o.type not in {'MESH','CURVE'} or o.hide_render:
        continue
    if any(c.name in {'V16_PIPING','V19_PIPE_DETAIL','V21_PIPE_BRIDGES','V23_PIPE_FIX','V25_PIPE_FINAL','V37_RECOVERY_PIPING','V39_PROCESS_CONNECTIONS','V39_RECOVERY_TRANSFER'} for c in o.users_collection):
        continue
    try:
        pts=[o.matrix_world@Vector(c) for c in o.bound_box]
        mn=Vector((min(p.x for p in pts),min(p.y for p in pts),min(p.z for p in pts)))
        mx=Vector((max(p.x for p in pts),max(p.y for p in pts),max(p.z for p in pts)))
    except Exception:
        continue
    if mx.x>=175 and mn.x<=341 and mx.y>=29.5 and mn.y<=42.0 and mx.z>=-0.5:
        print('HIT',o.name,'MIN',tuple(round(float(v),2) for v in mn),'MAX',tuple(round(float(v),2) for v in mx),'COLS',[c.name for c in o.users_collection])

print('CORRIDOR_HIT_COUNTS')
for yc in (35.0,-35.0,-42.0,25.0):
    hits=[]
    for o in scene.objects:
        if o.parent is not None or o.type not in {'MESH','CURVE'} or o.hide_render:
            continue
        try:
            pts=[o.matrix_world@Vector(c) for c in o.bound_box]
            mn=Vector((min(p.x for p in pts),min(p.y for p in pts),min(p.z for p in pts)))
            mx=Vector((max(p.x for p in pts),max(p.y for p in pts),max(p.z for p in pts)))
        except Exception:
            continue
        if mx.x>=175 and mn.x<=341 and mx.y>=yc-6.5 and mn.y<=yc+6.5 and mx.z>=-0.5:
            hits.append(o.name)
    print('YC',yc,'COUNT',len(hits),'SAMPLE',hits[:20])
