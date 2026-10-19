import bpy, math
from mathutils import Vector

EXPECTED='V54'
OUT=r'C:\Users\USER\OneDrive\Desktop\CHATON\pulpa-v31-babylon\blender\PULPA_LAB_BLENDER_MASTER_V55.blend'
scene=bpy.context.scene
if scene.get('PULPA_LAB_MASTER_VERSION') != EXPECTED:
    raise RuntimeError(f'V55 requires {EXPECTED}, got {scene.get("PULPA_LAB_MASTER_VERSION")!r}')


def ensure_collection(name,parent=None):
    c=bpy.data.collections.get(name)
    if c is None:c=bpy.data.collections.new(name)
    owner=parent if parent is not None else scene.collection
    if c.name not in owner.children:owner.children.link(c)
    return c


org=bpy.data.collections.get('V51_ORGANIZED') or scene.collection
pit=bpy.data.collections.get('V53_12_OPEN_PIT') or org
COL_FIX=ensure_collection('V55_19_GROUNDING_TOPO_FIX',pit)
COL_DRAIN=ensure_collection('V55_19_FINAL_DRAINAGE',pit)
COL_DUMPS=ensure_collection('V55_19_FINAL_DUMPS',pit)
COL_QA=ensure_collection('V55_20_ANIMATION_QA',org)


def material(name,color,metal=0.0,rough=.9):
    m=bpy.data.materials.get(name)
    if m is None:
        m=bpy.data.materials.new(name);m.use_nodes=True
        bs=m.node_tree.nodes.get('Principled BSDF')
        if bs:
            bs.inputs['Base Color'].default_value=(*color,1)
            bs.inputs['Metallic'].default_value=metal
            bs.inputs['Roughness'].default_value=rough
    return m


M_EARTH=bpy.data.materials.get('V16_Earth') or material('V55_Earth',(.22,.12,.06))
M_ROCK=bpy.data.materials.get('V22_Rock') or material('V55_Rock',(.16,.13,.105))
M_ROAD=bpy.data.materials.get('V16_Road') or material('V55_Road',(.07,.065,.06))
M_FILL=bpy.data.materials.get('V28_RoadFill') or material('V55_Fill',(.18,.13,.085))
M_ORE=bpy.data.materials.get('MAT_ROM_Ore') or material('V55_Ore',(.16,.085,.03))
M_DITCH=material('V55_Ditch',(.095,.065,.042),0,.98)
M_WATER=material('V55_Water',(.045,.16,.21),.05,.25)
M_RIPRAP=bpy.data.materials.get('V22_Rock') or M_ROCK


def hide(name,reason):
    o=bpy.data.objects.get(name)
    if o:
        o.hide_render=True;o.hide_viewport=True;o['v55_hidden_reason']=reason


def mesh_obj(name,verts,faces,mat,col=COL_FIX):
    me=bpy.data.meshes.new(name+'_M');me.from_pydata(verts,[],faces);me.update()
    o=bpy.data.objects.new(name,me);col.objects.link(o);o.data.materials.append(mat);o['v55_final']=True
    return o


def box(name,loc,dims,mat,col=COL_FIX):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=dims
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for c in list(o.users_collection):c.objects.unlink(o)
    col.objects.link(o);o.data.materials.append(mat);o['v55_final']=True;return o


def polyline(name,pts,mat,bevel=.12,col=COL_DRAIN):
    cu=bpy.data.curves.new(name+'_C','CURVE');cu.dimensions='3D';cu.bevel_depth=bevel;cu.bevel_resolution=2
    sp=cu.splines.new('POLY');sp.points.add(len(pts)-1)
    for q,p in zip(sp.points,pts):q.co=(*p,1)
    o=bpy.data.objects.new(name,cu);col.objects.link(o);o.data.materials.append(mat);o['v55_final']=True;return o


def road_ribbon(name,pts,width,mat=M_ROAD,col=COL_FIX):
    pts=[Vector(p) for p in pts];half=width*.5;verts=[]
    for i,p in enumerate(pts):
        p0=pts[max(0,i-1)];p1=pts[min(len(pts)-1,i+1)];t=p1-p0
        lat=Vector((-t.y,t.x,0))
        if lat.length<1e-6:lat=Vector((0,1,0))
        lat.normalize();verts.extend([tuple(p+lat*half),tuple(p-lat*half)])
    faces=[(2*i,2*i+2,2*i+3,2*i+1) for i in range(len(pts)-1)]
    o=mesh_obj(name,verts,faces,mat,col);o['width_m']=width;return o


def pad_fill(name,cx,cy,topx,topy,topz,bottomz,mat=M_EARTH):
    dz=max(.2,topz-bottomz);bx=topx+2*dz*1.8;by=topy+2*dz*1.8
    verts=[
        (cx-topx/2,cy-topy/2,topz),(cx+topx/2,cy-topy/2,topz),(cx+topx/2,cy+topy/2,topz),(cx-topx/2,cy+topy/2,topz),
        (cx-bx/2,cy-by/2,bottomz),(cx+bx/2,cy-by/2,bottomz),(cx+bx/2,cy+by/2,bottomz),(cx-bx/2,cy+by/2,bottomz),
    ]
    faces=[(0,1,2,3),(4,7,6,5),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)]
    return mesh_obj(name,verts,faces,mat,COL_FIX)


# ---------------------------------------------------------------------------
# Repair concrete V54 blockers before final grounding/export.
# ---------------------------------------------------------------------------
for n in (
    'V54_PIT_OUTER_TERRAIN_BLEND','V54_EXISTING_SITE_TO_PIT_BLEND',
    'V54_HAUL_PORTAL_APPROACH','V54_HAUL_PORTAL_APRON',
    'V54_WASTE_DUMP_MAIN','V54_WASTE_DUMP_SECONDARY','V54_LOW_GRADE_ORE_STOCK',
    'V54_WASTE_DUMP_ACCESS','V54_LOW_GRADE_ACCESS',
    'V54_PIT_PERIMETER_DIVERSION_DITCH','V54_PORTAL_DITCH_N','V54_PORTAL_DITCH_S',
    'V54_RAMP_DITCH_L','V54_RAMP_DITCH_R','V54_DRILL_PAD_DRAIN','V54_LOADING_PAD_DRAIN',
    'V54_PIT_BOTTOM_SUMP','V54_BOTTOM_COLLECTION_DITCH',
    'V53_PIT_RAMP_TIE_TO_MAIN_HAUL',
    'V53_PAD_DRILLING','V53_PAD_DRILLING_FILL','V53_PAD_LOADING','V53_PAD_LOADING_FILL','V53_PAD_MANEUVER',
):
    hide(n,'Superseded by V55 final terrain/road/grounding solution')


# Final terrain envelope: outer edge ties to the old site base near z=-6.8,
# inner edge meets the pit collar near z=-1.0, leaving the excavation open.
CX,CY=355.0,-78.0;N=112
# Overlap the transition terrain beneath the irregular V53 collar. Comparing
# the two authored radial modulation functions shows that 66.5x56.5 m can still
# sit outside the collar by ~2.7 m in a few sectors. A 63x53 m opening stays
# inside the V53 outer collar for the full 360 degrees while remaining outside
# its 58x48 m inner edge, so the excavation stays open and the seam is buried.
outer_rx,outer_ry=110.0,95.0;inner_rx,inner_ry=63.0,53.0
verts=[]
for i in range(N):
    a=2*math.pi*i/N
    f=1+.018*math.sin(4*a+.25)+.012*math.sin(9*a-.3)
    z=-6.80+.22*math.sin(2*a)+.10*math.sin(7*a)
    verts.append((CX+outer_rx*f*math.sin(a),CY+outer_ry*f*math.cos(a),z))
for i in range(N):
    a=2*math.pi*i/N
    f=1+.012*math.sin(5*a+.5)
    # Keep the transition just below the collar over the overlap to avoid
    # coplanar flicker while letting the authored pit collar remain visible.
    z=-1.12+.025*math.sin(3*a)
    verts.append((CX+inner_rx*f*math.sin(a),CY+inner_ry*f*math.cos(a),z))
faces=[]
for i in range(N):
    j=(i+1)%N;faces.append((i,j,N+j,N+i))
terrain=mesh_obj('V55_PIT_TERRAIN_ENVELOPE',verts,faces,M_EARTH,COL_FIX)
terrain['coverage']='x≈245..465, y≈-173..17; inner excavation preserved'


# Smooth 9 m tie from the existing haul-road corridor to the V53 ramp mouth.
B0=Vector((343.0,-29.0,-1.12));B1=Vector((350.0,-29.0,-1.13));B2=Vector((357.02,-31.38,-1.16));B3=Vector((364.668,-33.727,-1.18))
tie=[]
for i in range(25):
    t=i/24;u=1-t
    tie.append(u**3*B0+3*u*u*t*B1+3*u*t*t*B2+t**3*B3)
road_ribbon('V55_HAUL_RAMP_TIE_9M',[tuple(p) for p in tie],9.0)
# shoulders + pit-side safety berm
road_ribbon('V55_HAUL_RAMP_TIE_SHOULDER',[tuple(p+Vector((0,0,-.10))) for p in tie],12.0,M_FILL)
berm_pts=[]
for i,p in enumerate(tie):
    p0=tie[max(0,i-1)];p1=tie[min(len(tie)-1,i+1)];tv=p1-p0;lat=Vector((-tv.y,tv.x,0));lat.normalize()
    berm_pts.append(tuple(p-lat*5.4+Vector((0,0,.38))))
polyline('V55_HAUL_RAMP_SAFETY_BERM',berm_pts,M_FILL,.30,COL_FIX)


# Feathered operating terraces. Their top levels are retained but boxy fills
# are replaced by 1V:~2H earthwork. Bottom pad enlarged to ground both trucks.
pad_fill('V55_PAD_DRILLING_FILL',384.0,-56.0,20.0,12.0,-3.99,-6.35)
box('V55_PAD_DRILLING',(384.0,-56.0,-3.88),(20.0,12.0,.22),M_FILL,COL_FIX)
pad_fill('V55_PAD_LOADING_FILL',329.0,-80.0,18.0,18.0,-10.00,-12.9)
box('V55_PAD_LOADING',(329.0,-80.0,-9.88),(18.0,18.0,.24),M_FILL,COL_FIX)
pad_fill('V55_PAD_MANEUVER_FILL',351.5,-82.0,38.0,18.0,-16.00,-16.65)
box('V55_PAD_MANEUVER',(351.5,-82.0,-15.88),(38.0,18.0,.24),M_FILL,COL_FIX)


# Final grounding of static V53 pit fleet only. Original animated fleet remains
# byte-for-byte transform-preserved from V54.
pit_exc=bpy.data.objects.get('V53_PIT_EXCAVATOR')
if pit_exc:
    pit_exc.location.z += .22
    pit_exc['v55_grounding_adjustment_z']=.22
for n in ('V53_PIT_TRUCK_A','V53_PIT_TRUCK_B'):
    o=bpy.data.objects.get(n)
    if o:
        o.location.z += .33
        o['v55_grounding_adjustment_z']=.33


# Final dumps on measured supported back-bench terrain, away from plant/pit and
# from all animated truck routes.
def terraced_dump(name,cx,cy,z,width,depth,height,matl):
    levels=[(1.0,0.0),(.76,.45),(.56,.72),(.38,1.0)]
    verts=[];seg=40
    for scale,zf in levels:
        for i in range(seg):
            a=2*math.pi*i/seg
            f=1+.035*math.sin(3*a+.4)+.018*math.sin(7*a)
            verts.append((cx+(width*.5)*scale*f*math.cos(a),cy+(depth*.5)*scale*f*math.sin(a),z+height*zf))
    faces=[]
    for r in range(len(levels)-1):
        for i in range(seg):
            j=(i+1)%seg;faces.append((r*seg+i,r*seg+j,(r+1)*seg+j,(r+1)*seg+i))
    top_start=(len(levels)-1)*seg
    faces.append(tuple(top_start+i for i in range(seg)))
    o=mesh_obj(name,verts,faces,matl,COL_DUMPS);o['supported_back_bench']=True;return o

terraced_dump('V55_WASTE_DUMP_A',10.0,30.5,1.25,48.0,14.0,3.0,M_ROCK)
terraced_dump('V55_WASTE_DUMP_B',82.0,31.5,1.65,40.0,13.0,2.9,M_ROCK)
terraced_dump('V55_LOW_GRADE_ORE_A',121.0,33.0,1.65,18.0,9.0,3.0,M_ORE)
terraced_dump('V55_LOW_GRADE_ORE_B',148.0,33.0,1.65,14.0,8.0,2.5,M_ORE)


# Final drainage: open upgradient diversion ditch, one highwall ramp ditch,
# bench catch pits and a bottom sump/toe basin. Avoid closed level loops.
diversion=[
    (290,-17,-1.45),(320,-13,-1.55),(355,-13,-1.65),(390,-18,-1.80),(420,-32,-2.00),(438,-50,-2.40)
]
polyline('V55_UPGRADIENT_DIVERSION_DITCH',diversion,M_DITCH,.22)

highwall=[
    (365.88,-28.77,-1.43),(404.55,-59.80,-3.25),(395.97,-100.49,-5.07),
    (356.10,-114.18,-6.89),(323.42,-96.59,-8.70),(323.57,-67.69,-10.52),
    (348.87,-56.23,-12.34),(371.18,-64.99,-14.16),(372.68,-82.37,-15.98)
]
polyline('V55_RAMP_HIGHWALL_DITCH',highwall,M_DITCH,.16)

catch_pits=[
    ('V55_CATCH_PIT_B1',(400.92,-82.50,-4.15)),('V55_CATCH_PIT_B2',(349.14,-107.84,-7.15)),
    ('V55_CATCH_PIT_B3',(325.79,-73.73,-10.15)),('V55_CATCH_PIT_B4',(359.82,-63.44,-13.15)),
]
for name,(x,y,z) in catch_pits:
    box(name,(x,y,z-.12),(2.4,1.8,.24),M_WATER,COL_DRAIN)

polyline('V55_CATCH_CHUTE_B1',[(400.92,-82.50,-4.10),(399.0,-87.0,-4.35),(396.0,-91.0,-4.65)],M_DITCH,.13)
polyline('V55_CATCH_CHUTE_B2',[(349.14,-107.84,-7.10),(346.0,-104.0,-7.40),(341.0,-101.0,-7.75)],M_DITCH,.13)
polyline('V55_CATCH_CHUTE_B3',[(325.79,-73.73,-10.10),(328.0,-70.0,-10.35),(332.0,-67.0,-10.65)],M_DITCH,.13)
polyline('V55_CATCH_CHUTE_B4',[(359.82,-63.44,-13.10),(363.0,-64.0,-13.35),(367.0,-65.0,-13.65)],M_DITCH,.13)

box('V55_RAMP_TOE_BASIN',(368.0,-80.0,-16.34),(4.0,3.0,.25),M_WATER,COL_DRAIN)
box('V55_PIT_MAIN_SUMP',(358.0,-70.5,-16.48),(6.0,4.0,.28),M_WATER,COL_DRAIN)
polyline('V55_TOE_TO_SUMP_CULVERT',[(368,-80,-16.40),(364,-77,-16.48),(361,-74,-16.52),(358,-70.5,-16.54)],M_DITCH,.18)
polyline('V55_BOTTOM_GRADE_DITCH',[(344,-84,-16.02),(350,-80,-16.12),(354,-75,-16.28),(358,-70.5,-16.50)],M_DITCH,.14)
polyline('V55_TIE_CROSS_DRAIN',[(366,-26.8,-1.55),(366,-31.5,-1.62),(366,-37.0,-1.72)],M_DITCH,.18)

# Riprap at diversion outfall.
for i in range(14):
    a=2*math.pi*i/14;r=1.1+.35*(i%3)
    x=438+r*math.cos(a);y=-50+r*.7*math.sin(a);z=-2.45-.08*(i%2)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.28+.04*(i%3),location=(x,y,z))
    o=bpy.context.object;o.name=f'V55_OUTFALL_RIPRAP_{i+1:02d}'
    for c in list(o.users_collection):c.objects.unlink(o)
    COL_DRAIN.objects.link(o);o.data.materials.append(M_RIPRAP);o['v55_final']=True


# Prompt 20 is intentionally preservation-first: no animation curves are edited
# here. The dedicated audit samples the existing authored motion over the full
# 1..2900 timeline; only geometry/grounding of static pit copies was changed.
scene['PULPA_LAB_MASTER_VERSION']='V55'
scene['PULPA_LAB_V55_BASE']='V54 prompts 15-18 plus final blocker repair'
scene['PULPA_LAB_V55_SCOPE']='Prompts 19-22 final grounding, animation QA, total audit, GLB export'
scene['PULPA_LAB_V55_GROUNDING']='Static pit excavator +0.22m; pit trucks +0.33m; original animated fleet untouched'
scene['PULPA_LAB_V55_NOTES']=(
    'Replaces unsupported V54 terrain/dumps and sharp ramp tie with final supported geometry. '
    'Pit terrain envelope feathers to z~-6.8 site base while preserving excavation hole; operating pads use sloped cut/fill. '
    'Final drainage uses open diversion/highwall ditches, catch pits, toe basin and sump. '
    'No authored animation curves/actions were modified; animation integrity is validated separately.'
)
scene.frame_set(1);bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print('V55_SAVED',OUT,'OBJECTS',len(scene.objects),'FIX',len(COL_FIX.objects),'DRAIN',len(COL_DRAIN.objects),'DUMPS',len(COL_DUMPS.objects))
