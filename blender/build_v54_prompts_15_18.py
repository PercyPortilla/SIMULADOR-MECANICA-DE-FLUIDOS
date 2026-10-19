import bpy, math
from mathutils import Vector

EXPECTED='V53'
OUT=r'C:\Users\USER\OneDrive\Desktop\CHATON\pulpa-v31-babylon\blender\PULPA_LAB_BLENDER_MASTER_V54.blend'
scene=bpy.context.scene
if scene.get('PULPA_LAB_MASTER_VERSION') != EXPECTED:
    raise RuntimeError(f'V54 requires {EXPECTED}, got {scene.get("PULPA_LAB_MASTER_VERSION")!r}')


def ensure_collection(name,parent=None):
    c=bpy.data.collections.get(name)
    if c is None: c=bpy.data.collections.new(name)
    owner=parent if parent is not None else scene.collection
    if c.name not in owner.children: owner.children.link(c)
    return c


pit_root=bpy.data.collections.get('V53_12_OPEN_PIT') or scene.collection
COL_ROADS=ensure_collection('V54_15_ROAD_INTEGRATION',pit_root)
COL_DUMPS=ensure_collection('V54_16_DUMPS_STOCKPILES',pit_root)
COL_DRAIN=ensure_collection('V54_17_DRAINAGE',pit_root)
COL_TOPO=ensure_collection('V54_18_TOPOGRAPHY_BLEND',pit_root)


def mat(name,color,metal=0.0,rough=.9):
    m=bpy.data.materials.get(name)
    if m is None:
        m=bpy.data.materials.new(name);m.use_nodes=True
        bs=m.node_tree.nodes.get('Principled BSDF')
        if bs:
            bs.inputs['Base Color'].default_value=(*color,1)
            bs.inputs['Metallic'].default_value=metal
            bs.inputs['Roughness'].default_value=rough
    return m


M_EARTH=bpy.data.materials.get('V16_Earth') or mat('V54_Earth',(0.22,.12,.06))
M_ROCK=bpy.data.materials.get('V22_Rock') or mat('V54_Rock',(.16,.13,.105))
M_ROAD=bpy.data.materials.get('V16_Road') or mat('V54_Road',(.07,.065,.06))
M_FILL=bpy.data.materials.get('V28_RoadFill') or mat('V54_Fill',(.18,.13,.085))
M_ORE=bpy.data.materials.get('MAT_ROM_Ore') or mat('V54_Ore',(.16,.085,.03))
M_DITCH=mat('V54_Ditch',(.11,.075,.045),0,.98)
M_WATER=mat('V54_Water',(.06,.18,.22),.05,.28)


def mesh_obj(name,verts,faces,material,col):
    me=bpy.data.meshes.new(name+'_M');me.from_pydata(verts,[],faces);me.update()
    o=bpy.data.objects.new(name,me);col.objects.link(o);o.data.materials.append(material);o['v54_prompt_15_18']=True
    return o


def road_ribbon(name,pts,width=9.0,material=M_ROAD,col=COL_ROADS):
    pts=[Vector(p) for p in pts];half=width*.5;verts=[]
    for i,p in enumerate(pts):
        p0=pts[max(0,i-1)];p1=pts[min(len(pts)-1,i+1)];t=p1-p0
        lat=Vector((-t.y,t.x,0))
        if lat.length<1e-6:lat=Vector((0,1,0))
        lat.normalize();verts.extend([tuple(p+lat*half),tuple(p-lat*half)])
    faces=[(2*i,2*i+2,2*i+3,2*i+1) for i in range(len(pts)-1)]
    o=mesh_obj(name,verts,faces,material,col);o['width_m']=width;return o


def polyline(name,pts,material,bevel=.12,col=COL_DRAIN):
    cu=bpy.data.curves.new(name+'_C','CURVE');cu.dimensions='3D';cu.bevel_depth=bevel;cu.bevel_resolution=2
    sp=cu.splines.new('POLY');sp.points.add(len(pts)-1)
    for q,p in zip(sp.points,pts):q.co=(*p,1)
    o=bpy.data.objects.new(name,cu);col.objects.link(o);o.data.materials.append(material);o['v54_prompt_15_18']=True;return o


def box(name,loc,dims,material,col):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=dims
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for c in list(o.users_collection):c.objects.unlink(o)
    col.objects.link(o);o.data.materials.append(material);o['v54_prompt_15_18']=True;return o


# ==========================================================================
# Prompt 15 — road integration.
# The V53 9 m ramp remains authoritative. Add a wider portal apron and short
# branch roads to the drilling/loading pads; do not touch original truck route.
# ==========================================================================
portal_pts=[
    (357.5,-29.2,-1.16),
    (362.5,-31.0,-1.16),
    (367.5,-34.0,-1.16),
    (371.5,-38.5,-1.35),
]
road_ribbon('V54_HAUL_PORTAL_APPROACH',portal_pts,9.0)
box('V54_HAUL_PORTAL_APRON',(365.0,-31.8,-1.20),(18.0,13.5,.18),M_ROAD,COL_ROADS)

# Bench spurs give the operating pads plausible truck access.
road_ribbon('V54_DRILL_PAD_SPUR',[
    (395.0,-44.5,-2.25),(392.0,-49.0,-2.95),(388.0,-53.0,-3.60),(384.0,-56.0,-3.77)
],8.0)
road_ribbon('V54_LOADING_PAD_SPUR',[
    (343.0,-63.0,-7.55),(338.0,-67.0,-8.45),(333.0,-72.0,-9.25),(329.0,-78.0,-9.76)
],8.0)
road_ribbon('V54_BOTTOM_MANEUVER_LOOP',[
    (343.5,-80.0,-15.76),(349.0,-75.5,-15.76),(359.0,-75.0,-15.76),
    (367.0,-80.0,-15.76),(365.0,-87.0,-15.76),(355.0,-89.0,-15.76),
    (345.0,-87.0,-15.76),(343.5,-80.0,-15.76)
],7.5)

# Roadside safety berms around the portal, visually linking old road and pit.
for name,loc,dims in [
    ('V54_PORTAL_BERM_N',(365.5,-24.8,-.72),(20.0,1.0,.85)),
    ('V54_PORTAL_BERM_S',(365.5,-38.5,-.72),(20.0,1.0,.85)),
]: box(name,loc,dims,M_FILL,COL_ROADS)


# ==========================================================================
# Prompt 16 — waste dumps and ore piles.
# Place them on the east/south-east side, away from the plant and animated haul
# route. Terraced waste dump + smaller low-grade ore stockpile.
# ==========================================================================
def irregular_pile(name,center,rx,ry,h,material,col=COL_DUMPS,seed_phase=0.0):
    cx,cy,cz=center;N=40;verts=[]
    rings=[(1.0,0.0),(.72,.42),(.44,.72),(.18,.92)]
    for ri,(scale,zf) in enumerate(rings):
        for i in range(N):
            a=2*math.pi*i/N
            f=1+.06*math.sin(3*a+seed_phase)+.025*math.sin(7*a-.4)
            verts.append((cx+rx*scale*f*math.cos(a),cy+ry*scale*f*math.sin(a),cz+h*zf))
    verts.append((cx,cy,cz+h));apex=len(verts)-1
    faces=[]
    for r in range(len(rings)-1):
        for i in range(N):
            j=(i+1)%N;faces.append((r*N+i,r*N+j,(r+1)*N+j,(r+1)*N+i))
    r=len(rings)-1
    for i in range(N):faces.append((r*N+i,r*N+((i+1)%N),apex))
    o=mesh_obj(name,verts,faces,material,col);o['pile_type']=name;return o

irregular_pile('V54_WASTE_DUMP_MAIN',(430.0,-103.0,-1.0),24.0,17.0,10.0,M_ROCK,seed_phase=.2)
irregular_pile('V54_WASTE_DUMP_SECONDARY',(420.0,-126.0,-1.4),15.0,10.0,6.0,M_ROCK,seed_phase=1.1)
irregular_pile('V54_LOW_GRADE_ORE_STOCK',(425.0,-48.0,-1.0),13.0,9.0,5.0,M_ORE,seed_phase=.7)

# Dump access tracks.
road_ribbon('V54_WASTE_DUMP_ACCESS',[(403,-91,-1.3),(414,-96,-1.15),(426,-101,-1.0)],7.5)
road_ribbon('V54_LOW_GRADE_ACCESS',[(406,-38,-1.3),(414,-42,-1.1),(424,-47,-1.0)],7.0)


# ==========================================================================
# Prompt 17 — drainage and ditches.
# Perimeter diversion ditch, ramp side ditches, pad drains and a bottom sump.
# ==========================================================================
CX,CY=355.0,-78.0
outer=[]
for i in range(73):
    a=2*math.pi*i/72
    rx,ry=75.0,65.0
    f=1+.018*math.sin(5*a+.2)
    outer.append((CX+rx*f*math.sin(a),CY+ry*f*math.cos(a),-.72))
polyline('V54_PIT_PERIMETER_DIVERSION_DITCH',outer,M_DITCH,.18)

# Drain parallel to the portal connection and direct it south away from the plant.
polyline('V54_PORTAL_DITCH_N',[(356,-23.8,-1.38),(365,-25.0,-1.42),(374,-30,-1.55),(381,-39,-1.75)],M_DITCH,.15)
polyline('V54_PORTAL_DITCH_S',[(357,-37.7,-1.42),(365,-39.2,-1.50),(374,-43,-1.70),(382,-49,-1.95)],M_DITCH,.15)

# Ramp ditches sampled from the V53 ramp centerline math, slightly inside edges.
def ramp_center(t):
    a=.18+t*(2.48*math.pi);rx=54-(54-14)*t;ry=45-(45-8)*t
    return Vector((CX+rx*math.sin(a),CY+ry*math.cos(a),-1.18-14.55*t))
centers=[ramp_center(i/40) for i in range(41)]
left=[];right=[]
for i,p in enumerate(centers):
    p0=centers[max(0,i-1)];p1=centers[min(40,i+1)];t=p1-p0;lat=Vector((-t.y,t.x,0));lat.normalize()
    left.append(tuple(p+lat*3.95+Vector((0,0,-.08))));right.append(tuple(p-lat*3.95+Vector((0,0,-.08))))
polyline('V54_RAMP_DITCH_L',left,M_DITCH,.12)
polyline('V54_RAMP_DITCH_R',right,M_DITCH,.12)

polyline('V54_DRILL_PAD_DRAIN',[(372,-62,-4.05),(380,-64,-4.20),(390,-66,-4.55),(397,-70,-5.0)],M_DITCH,.13)
polyline('V54_LOADING_PAD_DRAIN',[(318,-85,-10.1),(325,-88,-10.45),(334,-91,-10.85),(340,-94,-11.2)],M_DITCH,.13)

# Bottom collection sump/pond with a short ditch from the manoeuvre pad.
box('V54_PIT_BOTTOM_SUMP',(356.0,-72.0,-16.20),(5.5,3.8,.35),M_WATER,COL_DRAIN)
polyline('V54_BOTTOM_COLLECTION_DITCH',[(346,-80,-15.96),(350,-77,-16.02),(354,-74,-16.10),(356,-72,-16.15)],M_DITCH,.14)


# ==========================================================================
# Prompt 18 — final topographic integration.
# Extend terrain around the pit and blend it back into the V53 collar/old site.
# ==========================================================================
N=80
def ring_surface(name,outer_rx,outer_ry,inner_rx,inner_ry,z_outer,z_inner,material,col=COL_TOPO,phase=.0):
    verts=[]
    for i in range(N):
        a=2*math.pi*i/N;f=1+.018*math.sin(4*a+phase)+.012*math.sin(9*a)
        verts.append((CX+outer_rx*f*math.sin(a),CY+outer_ry*f*math.cos(a),z_outer+.18*math.sin(2*a)))
    for i in range(N):
        a=2*math.pi*i/N;f=1+.02*math.sin(3*a+.3)
        verts.append((CX+inner_rx*f*math.sin(a),CY+inner_ry*f*math.cos(a),z_inner))
    faces=[]
    for i in range(N):
        j=(i+1)%N;faces.append((i,j,N+j,N+i))
    return mesh_obj(name,verts,faces,material,col)

# Broad apron around pit to eliminate the visual 'island in empty space'.
ring_surface('V54_PIT_OUTER_TERRAIN_BLEND',92,79,68.5,58.5,-.82,-1.02,M_EARTH)

# Additional north-west transition pad joins existing V16 ground/haul-road edge.
blend_pts=[
    (300,-18,-1.05),(335,-18,-1.0),(365,-18,-1.0),(385,-28,-.95),
    (386,-48,-.9),(374,-54,-.95),(347,-47,-1.0),(315,-38,-1.02)
]
mesh_obj('V54_EXISTING_SITE_TO_PIT_BLEND',blend_pts,[(0,1,6,7),(1,2,5,6),(2,3,4,5)],M_EARTH,COL_TOPO)

# Small talus/rock scatter at two outer toes for natural transition.
for i in range(22):
    a=(i/22)*math.pi*.9+math.pi*.15
    r=69.5+(i%4)*1.35
    x=CX+r*math.sin(a);y=CY+(.83*r)*math.cos(a);z=-1.15-.15*(i%3)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.42+.08*(i%3),location=(x,y,z))
    o=bpy.context.object;o.name=f'V54_PIT_TALUS_{i+1:02d}';o.scale=(1.4,1.0,.75)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    for c in list(o.users_collection):c.objects.unlink(o)
    COL_TOPO.objects.link(o);o.data.materials.append(M_ROCK);o['v54_prompt_15_18']=True


scene['PULPA_LAB_MASTER_VERSION']='V54'
scene['PULPA_LAB_V54_BASE']='V53 prompts 11-14 preserved'
scene['PULPA_LAB_V54_SCOPE']='Prompts 15-18: pit roads + dumps/stockpiles + drainage + topography integration'
scene['PULPA_LAB_V54_NOTES']=(
    'V53 pit/ramp/pads and all plant equipment remain fixed. Added 9m portal integration, pad spurs and bottom loop; '
    'waste dumps + low-grade ore stockpile on east/south-east side; perimeter/ramp/pad drainage and bottom sump; '
    'outer terrain blend plus site-to-pit transition and talus to remove floating/seam appearance.'
)
scene.frame_set(1);bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print('V54_SAVED',OUT,'OBJECTS',len(scene.objects),'ROADS',len(COL_ROADS.objects),'DUMPS',len(COL_DUMPS.objects),'DRAIN',len(COL_DRAIN.objects),'TOPO',len(COL_TOPO.objects))
