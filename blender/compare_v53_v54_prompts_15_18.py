import bpy

V53=r'C:\Users\USER\OneDrive\Desktop\CHATON\pulpa-v31-babylon\blender\PULPA_LAB_BLENDER_MASTER_V53.blend'
V54=r'C:\Users\USER\OneDrive\Desktop\CHATON\pulpa-v31-babylon\blender\PULPA_LAB_BLENDER_MASTER_V54.blend'
ROOTS=['ROM-HOPPER','APRON-FEEDER','PRIMARY-CRUSHER','STOCKPILE-RECLAIM','MILL-01','SUMP-01','SLURRY-PUMP-01','CLASS-01','R-01','R-02','R-03','R-04','PUMP-01','CIP-ADSORPTION','ELUTION-SKID','EW-CELLS','SMELTING-FURNACE','TRUCK-01','TRUCK-02','TRUCK-03','EXCAVATOR-01','V53_PIT_EXCAVATOR','V53_PIT_TRUCK_A','V53_PIT_TRUCK_B']
PROBES=['MILL-01_TRUNNION_01','SLURRY-PUMP-01_SHAFT','V43_CLASS_SWIRL_ROOT_01','R-01_ROTATING_GROUP','PUMP-01_SHAFT','V39_EW_SMELT_CART']
FRAMES=(1,48,300,720)
def snap(path):
 bpy.ops.wm.open_mainfile(filepath=path);s=bpy.context.scene;out={}
 for f in FRAMES:
  s.frame_set(f);bpy.context.view_layer.update()
  for n in ROOTS+PROBES:
   o=bpy.data.objects.get(n)
   if o:out[(f,n)]=tuple(float(v) for row in o.matrix_world for v in row)
 return out
a=snap(V53);b=snap(V54);chg=[]
for k,v in a.items():
 if k not in b:chg.append((k,'MISSING'));continue
 e=max(abs(x-y) for x,y in zip(v,b[k]))
 if e>1e-7:chg.append((k,e))
print('SAMPLES',len(a),'CHANGED',len(chg),chg[:25]);print('PASS_PRESERVATION',not chg)
