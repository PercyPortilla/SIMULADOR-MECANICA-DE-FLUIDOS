import bpy

V51=r'C:\Users\USER\OneDrive\Desktop\CHATON\pulpa-v31-babylon\blender\PULPA_LAB_BLENDER_MASTER_V51.blend'
V52=r'C:\Users\USER\OneDrive\Desktop\CHATON\pulpa-v31-babylon\blender\PULPA_LAB_BLENDER_MASTER_V52.blend'
ROOTS=['MILL-01','SUMP-01','SLURRY-PUMP-01','CLASS-01','R-01','R-02','R-03','R-04','PUMP-01','CIP-ADSORPTION','ELUTION-SKID','EW-CELLS','SMELTING-FURNACE']
PROBES=['MILL-01_TRUNNION_01','SLURRY-PUMP-01_SHAFT','V43_CLASS_SWIRL_ROOT_01','R-01_ROTATING_GROUP','R-04_ROTATING_GROUP','PUMP-01_SHAFT','V40_ELUTION_PIVOT_01','EW-CELLS_CATHODE_1_1','V39_EW_SMELT_CART']
FRAMES=(1,48,300,720)

def snap(path):
    bpy.ops.wm.open_mainfile(filepath=path)
    s=bpy.context.scene;out={}
    for f in FRAMES:
        s.frame_set(f);bpy.context.view_layer.update()
        for n in ROOTS+PROBES:
            o=bpy.data.objects.get(n)
            if o: out[(f,n)]=tuple(float(v) for row in o.matrix_world for v in row)
    return out

a=snap(V51);b=snap(V52);changed=[]
for k,v in a.items():
    if k not in b:changed.append((k,'MISSING'));continue
    err=max(abs(x-y) for x,y in zip(v,b[k]))
    if err>1e-7:changed.append((k,err))
print('SAMPLES',len(a),'CHANGED',len(changed),changed[:20])
print('PASS_PRESERVATION',not changed)
