/**
 * P3→P4: study-only reveal of AUTHORED V57 fluid meshes and signed discontinuities.
 * Source evidence L127/L346/L347; no geometry/pose edits, no new hydraulic mate.
 */
import {Color3,MeshBuilder,StandardMaterial,Vector3} from '@babylonjs/core';

export const P3P4_SIGNED_GATE=Object.freeze({
  source:'L127 + L346 + L347 independent signed CAD/BVH audits',
  measuredGapM:1.5139007568359375,
  suctionSkewDeg:1.1573121503220216,
  suctionSectionEndBlenderM:[202.89999389648438,90.00000381469727,22.199997901916504],
  suctionBlockedWallBlenderM:[204.4250030517578,90,22.200000762939453],
  dischargeBlockedWallBlenderM:[205,90,23.39999771118164],
  eyeOpen:false,dischargeOpen:false,wetMateCertified:false,
  fluidVolumeConnected:false,certifiedCFD:false,
});

const SOURCE_FLUID_NAMES=Object.freeze([
  'SLURRY-PUMP-01_SUCTION_FLUID_SEG01',
  'SLURRY-PUMP-01_SUCTION_ELBOW_FLUID_01',
  'SLURRY-PUMP-01_SUCTION_FLUID_SEG02',
  'SLURRY-PUMP-01_DISCHARGE_FLUID',
]);
const SHELL_NAMES=Object.freeze([
  'SLURRY-PUMP-01_SUCTION_SEG01','SLURRY-PUMP-01_SUCTION_ELBOW_01',
  'SLURRY-PUMP-01_SUCTION_SEG02','SLURRY-PUMP-01_DISCHARGE_PIPE',
  'SLURRY-PUMP-01_VOLUTE',
]);
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,finite(v)?v:a));
const toScene=([x,y,z])=>new Vector3(x,z,-y);

export function segmentFromFluidMesh(mesh){
  if(!mesh?.getBoundingInfo?.())return null;
  mesh.computeWorldMatrix?.(true);
  const b=mesh.getBoundingInfo().boundingBox;
  const min=b.minimumWorld,max=b.maximumWorld;
  const span=[max.x-min.x,max.y-min.y,max.z-min.z];
  const axis=span.indexOf(Math.max(...span));
  // The straight suction/discharge sections are suitable for a local axial
  // tracer; elbows are too curved for a 1D path and deliberately omitted.
  if(span[axis]<.35||span[axis]<Math.max(...span.filter((_,i)=>i!==axis))*2.0)return null;
  const center=b.centerWorld.clone();
  const start=center.clone(),end=center.clone();
  const k=['x','y','z'][axis];
  start[k]=min[k]+span[axis]*.08;
  end[k]=max[k]-span[axis]*.08;
  return {name:mesh.name,start,end,length:Vector3.Distance(start,end),
    source:'actual V57 signed GLB fluid mesh AABB, approximate centerline'};
}

export function createPumpP3P4Inspection({scene,getVelocity=()=>0,invalidate=()=>{}}){
  if(!scene)throw Error('P3P4_SCENE_REQUIRED');
  let active=false,disposed=false,animationEnabled=true,elapsed=0;
  const changed=new Map();
  const graphics=[];
  const tracerPaths=[];
  const materials=[];
  const missing=[];
  const red=new StandardMaterial('P3P4_EDU_RED_NO_WET_MATE',scene);
  red.diffuseColor=Color3.FromHexString('#ef5638');
  red.emissiveColor=Color3.FromHexString('#fb593a').scale(.58);
  const amber=new StandardMaterial('P3P4_EDU_TRACER',scene);
  amber.diffuseColor=Color3.FromHexString('#c5f0f4');
  amber.emissiveColor=Color3.FromHexString('#46e4ef').scale(.65);
  const carrier=new StandardMaterial('P3P4_EDU_VISIBLE_SIGNED_FLUID',scene);
  carrier.diffuseColor=Color3.FromHexString('#568999');
  carrier.emissiveColor=Color3.FromHexString('#1c5061').scale(.35);
  carrier.alpha=.72;carrier.backFaceCulling=false;carrier.disableDepthWrite=true;
  materials.push(red,amber,carrier);
  const remember=mesh=>{if(!changed.has(mesh))changed.set(mesh,{
    isVisible:mesh.isVisible,visibility:mesh.visibility,material:mesh.material,
  });};
  const marker=(name,world,diameter=.26)=>{
    const m=MeshBuilder.CreateSphere(name,{diameter,segments:12},scene);
    m.position.copyFrom(world);m.material=red;m.isPickable=false;
    m.metadata={visualOnly:true,wetCertified:false,diagnostic:true};
    graphics.push(m);return m;
  };
  const pointEnd=toScene(P3P4_SIGNED_GATE.suctionSectionEndBlenderM);
  const pointHub=toScene(P3P4_SIGNED_GATE.suctionBlockedWallBlenderM);
  const pointOut=toScene(P3P4_SIGNED_GATE.dischargeBlockedWallBlenderM);
  // Distinct endpoints, not a fake connecting tube. The dots show an open gap.
  const a=marker('SLURRY-PUMP-01_P3P4_EDU_SUCTION_END',pointEnd,.23);
  marker('SLURRY-PUMP-01_P3P4_EDU_HUB_BLOCKED',pointHub,.35);
  marker('SLURRY-PUMP-01_P3P4_EDU_DISCHARGE_BLOCKED',pointOut,.35);
  const dir=pointHub.subtract(pointEnd);
  for(let i=0;i<7;i++){
    const p=pointEnd.add(dir.scale((i+.45)/7));
    marker('SLURRY-PUMP-01_P3P4_EDU_GAP_DASH_'+i,p,.095);
  }
  for(const n of SOURCE_FLUID_NAMES){
    const m=scene.getMeshByName(n);
    if(!m){missing.push(n);continue;}
    const isStraight=!n.includes('ELBOW');
    if(isStraight){
      const segment=segmentFromFluidMesh(m);
      if(segment){
        segment.tracers=[];
        for(let j=0;j<7;j++){
          const tracer=MeshBuilder.CreateSphere('SLURRY-PUMP-01_P3P4_EDU_FLUID_TRACER_'+tracerPaths.length+'_'+j,
            {diameter:.11,segments:8},scene);
          tracer.material=amber;tracer.isPickable=false;
          tracer.metadata={visualOnly:true,wetCertified:false,sourceMesh:n};
          segment.tracers.push(tracer);graphics.push(tracer);
        }
        tracerPaths.push(segment);
      }
    }
  }
  const allFluid=SOURCE_FLUID_NAMES.map(n=>scene.getMeshByName(n)).filter(Boolean);
  const allShell=SHELL_NAMES.map(n=>scene.getMeshByName(n)).filter(Boolean);
  const updates=(on)=>{
    for(const mesh of allFluid){
      remember(mesh);
      if(on){mesh.isVisible=true;mesh.visibility=1;mesh.material=carrier;}
      else {const original=changed.get(mesh);if(original){
        mesh.isVisible=original.isVisible;mesh.visibility=original.visibility;mesh.material=original.material;
      }}
    }
    for(const mesh of allShell){
      remember(mesh);
      if(on)mesh.visibility=.24;
      else {const original=changed.get(mesh);if(original){
        mesh.visibility=original.visibility;mesh.isVisible=original.isVisible;mesh.material=original.material;
      }}
    }
    // Existing B71 "seam bridge" is capped and only visual: hide it while
    // inspecting to expose the signed geometric discontinuity.
    const bridge=scene.getMeshByName('B71_sump-to-pump_SEAM_BRIDGE');
    if(bridge){
      remember(bridge);
      if(on)bridge.isVisible=false;
      else {const original=changed.get(bridge);bridge.isVisible=original.isVisible;}
    }
  };
  const rootState={active,missing,segments:tracerPaths.length};
  function tick(dt){
    if(!active)return;
    const v=Math.max(0,Number(getVelocity())||0);
    if(animationEnabled)elapsed+=clamp(dt,0,.08)*Math.min(5,v);
    for(const segment of tracerPaths){
      segment.tracers.forEach((mesh,i)=>{
        const t=(i/segment.tracers.length+elapsed/Math.max(1,segment.length))%1;
        mesh.position.copyFrom(Vector3.Lerp(segment.start,segment.end,t));
        mesh.isVisible=true;
        mesh.scaling.setAll(v>0?.7+Math.min(v,3)*.1:.52);
      });
    }
  }
  const observer=scene.onBeforeRenderObservable.add(()=>tick(scene.getEngine().getDeltaTime()/1000));
  function setActive(on){
    if(disposed)return false;
    if(active===Boolean(on))return active;
    active=Boolean(on);
    updates(active);
    for(const mesh of graphics)mesh.setEnabled(active);
    if(active)tick(0);
    invalidate(240);
    return active;
  }
  for(const m of graphics)m.setEnabled(false);
  return {
    setActive,setPlaying(v){animationEnabled=Boolean(v)},
    get status(){return {
      active,verified:false,certifiedWetMate:false,source:'signed L127/L346/L347',
      signedGapM:P3P4_SIGNED_GATE.measuredGapM,
      blockedSuction:true,blockedDischarge:true,
      authoredFluidMeshesFound:allFluid.length,authoredFluidMeshesExpected:SOURCE_FLUID_NAMES.length,
      straightFluidSegmentsAnimated:tracerPaths.length,missing,
      overlayOnly:true,sourceCadModified:false,solverModified:false,geometryMoved:false,
    }},
    dispose(){if(disposed)return;setActive(false);scene.onBeforeRenderObservable.remove(observer);
      graphics.forEach(m=>m.dispose());materials.forEach(m=>m.dispose());changed.clear();disposed=true;},
  };
}
