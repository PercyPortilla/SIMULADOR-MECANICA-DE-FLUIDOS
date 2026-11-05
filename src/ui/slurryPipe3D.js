/**
 * Dedicated Babylon.js instructional cutaway for the studied slurry line.
 *
 * The pipe is an enlarged teaching prop, NOT an alteration of the V57 CAD.
 * All particles, the deposit and abrasion overlays are qualitative only.
 * Hydraulic numbers continue to come exclusively from the existing solver.
 */
import {
  ArcRotateCamera, Color3, Color4, DirectionalLight, Engine,
  HemisphericLight, Matrix, Mesh, MeshBuilder, PBRMaterial, Quaternion,
  Scene, StandardMaterial, Vector3, VertexData, Camera, ImageProcessingConfiguration,
} from '@babylonjs/core';

const R = 1.20;
const LENGTH = 12.2;
const N = 62;
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,Number.isFinite(v)?v:min));
const random=(index,salt)=>{
  const n=Math.sin((index+1)*78.233+salt*43.51)*43758.5453;
  return n-Math.floor(n);
};

/** Read-only interpolation of the solver's equivalent laminar radial profile.
 * Not a particle force model or a spatial CFD velocity field.
 */
export function radialVelocityFactor(profile,normalizedRadius,meanVelocity){
  if(!profile?.radiusM?.length||!profile?.velocityMps?.length||!(meanVelocity>0))return 1;
  const rr=profile.radiusM, vv=profile.velocityMps;
  if(rr.length!==vv.length||rr.length<2)return 1;
  const maximum=rr.at(-1);
  if(!(maximum>0))return 1;
  const radius=clamp(normalizedRadius)*maximum;
  for(let k=1;k<rr.length;k++){
    if(radius<=rr[k]){
      const t=clamp((radius-rr[k-1])/Math.max(1e-10,rr[k]-rr[k-1]));
      const local=vv[k-1]*(1-t)+vv[k]*t;
      return clamp(local/meanVelocity,0,3.5);
    }
  }
  return clamp(vv.at(-1)/meanVelocity,0,3.5);
}

function material(scene,name,color,{alpha=1,metallic=0.25,roughness=.5}={}){
  const m=new PBRMaterial(name,scene);
  m.albedoColor=Color3.FromHexString(color);
  m.metallic=metallic;m.roughness=roughness;m.alpha=alpha;
  m.backFaceCulling=false;
  return m;
}

function surface(scene,name,rows,cols,point,mat){
  const positions=[],indices=[],normals=[];
  for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
    positions.push(...point(row/rows,col/cols));
  }
  for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){
    const a=row*(cols+1)+col,b=a+1,c=a+cols+1,d=c+1;
    indices.push(a,c,b,b,c,d);
  }
  VertexData.ComputeNormals(positions,indices,normals);
  const mesh=new Mesh(name,scene);
  const data=new VertexData();
  data.positions=positions;data.indices=indices;data.normals=normals;data.applyToMesh(mesh);
  mesh.material=mat;mesh.isPickable=false;
  return mesh;
}

function createBed(scene,mat){
  const mesh=new Mesh('EDU_PIPE_3D_VOLUME_DEPOSITO',scene);
  mesh.material=mat;mesh.isPickable=false;
  let lastLevel=null;
  function update(bed){
    const level=-R+Math.min(.85,Math.max(0,bed)*1.5)*R;
    if(lastLevel!==null&&Math.abs(lastLevel-level)<.025)return;
    lastLevel=level;
    if(bed<.006){mesh.setEnabled(false);return;}
    mesh.setEnabled(true);
    const start=Math.acos(clamp(level/R,-1,1));
    const perimeter=[];
    for(let i=0;i<=36;i++){
      const a=start+(2*Math.PI-2*start)*(i/36);
      perimeter.push([R*Math.cos(a),R*Math.sin(a)]);
    }
    // Last arc point -> first arc point closes across the upper sediment surface.
    const count=perimeter.length,positions=[],indices=[],normals=[];
    for(const x of [-LENGTH*.485,LENGTH*.485])
      for(const [y,z] of perimeter)positions.push(x,y,z);
    for(let i=0;i<count;i++){
      const j=(i+1)%count;
      indices.push(i,j,count+i,j,count+j,count+i);
    }
    const originStart=positions.length/3,originEnd=originStart+1;
    positions.push(-LENGTH*.485,level*.55,0,LENGTH*.485,level*.55,0);
    for(let i=0;i<count;i++){
      const j=(i+1)%count;
      indices.push(originStart,j,i,originEnd,count+i,count+j);
    }
    VertexData.ComputeNormals(positions,indices,normals);
    const data=new VertexData();data.positions=positions;data.indices=indices;
    data.normals=normals;data.applyToMesh(mesh,true);
  }
  update(0);
  return {mesh,update};
}

export function createSlurryPipe3DScene({canvas,engineFactory}){
  const engine=engineFactory?.(canvas)??new Engine(canvas,true,{
    preserveDrawingBuffer:true,stencil:false,doNotHandleContextLost:false,
  });
  const scene=new Scene(engine);
  // E11: D5-inspired neutral photographic lookdev for the existing 3D tube.
  // No change to tube dimensions, material flow logic, solver or inspector UI.
  scene.clearColor=new Color4(.13,.15,.16,1);
  scene.fogEnabled=false;
  scene.imageProcessingConfiguration.toneMappingEnabled=true;
  scene.imageProcessingConfiguration.toneMappingType=ImageProcessingConfiguration.TONEMAPPING_ACES;
  scene.imageProcessingConfiguration.exposure=1.03;
  scene.imageProcessingConfiguration.contrast=1.14;
  const hemi=new HemisphericLight('EDU_PIPE_3D_FILL',new Vector3(-.2,1,-.3),scene);
  hemi.intensity=.94;hemi.groundColor=new Color3(.19,.20,.19);
  const key=new DirectionalLight('EDU_PIPE_3D_KEY',new Vector3(-.42,-1,.6),scene);
  key.intensity=1.39;
  key.diffuse=new Color3(1,.94,.87);
  const rim=new DirectionalLight('EDU_PIPE_3D_RIM',new Vector3(.5,-.3,-.7),scene);
  rim.intensity=.34;rim.diffuse=new Color3(.72,.82,.86);
  const camera=new ArcRotateCamera('EDU_PIPE_3D_CAMERA',-Math.PI/2+.26,1.10,16,
    new Vector3(0,-.08,0),scene);
  camera.mode=Camera.ORTHOGRAPHIC_CAMERA;
  camera.lowerRadiusLimit=12;camera.upperRadiusLimit=20;
  camera.lowerAlphaLimit=-2.08;camera.upperAlphaLimit=-.92;
  camera.lowerBetaLimit=.85;camera.upperBetaLimit=1.58;
  camera.panningSensibility=0;camera.wheelPrecision=42;
  // Independent inspector interaction never alters the mine's camera.
  if(canvas?.addEventListener)camera.attachControl(canvas,true);
  scene.activeCamera=camera;
  // Orientation exposes the front/top of the physically hollow C-shaped pipe.
  const a0=-.34,a1=Math.PI*1.36;
  const steel=material(scene,'EDU_PIPE_3D_STEEL','#87989d',{alpha:.31,metallic:.47,roughness:.56});
  const liner=material(scene,'EDU_PIPE_3D_LINER','#748186',{alpha:.13,metallic:.10,roughness:.79});
  const flange=material(scene,'EDU_PIPE_3D_FLANGE','#919fa4',{metallic:.68,roughness:.47});
  const edge=material(scene,'EDU_PIPE_3D_CUT_EDGE','#b7c3c4',{metallic:.58,roughness:.46});
  const fluid=material(scene,'EDU_PIPE_3D_FLUID','#777e7b',{alpha:.11,metallic:.02,roughness:.69});
  const earth=material(scene,'EDU_PIPE_3D_SEDIMENT','#a08b6d',{metallic:0,roughness:.97});
  earth.emissiveColor=new Color3(.06,.03,.012);
  const abrasion=material(scene,'EDU_PIPE_3D_ABRASION','#fa7c30',{alpha:.12,metallic:.05,roughness:.75});
  abrasion.emissiveColor=Color3.FromHexString('#f45b19').scale(.4);
  surface(scene,'EDU_PIPE_3D_OUTER_SHELL',N,1,(t,u)=>{
    const a=a0+t*(a1-a0),rad=R+.12;
    return [-LENGTH/2+LENGTH*u,rad*Math.cos(a),rad*Math.sin(a)];
  },steel);
  surface(scene,'EDU_PIPE_3D_INNER_LINER',N,1,(t,u)=>{
    const a=a0+t*(a1-a0);
    return [-LENGTH/2+LENGTH*u,R*Math.cos(a),R*Math.sin(a)];
  },liner);
  for(const a of [a0,a1]){
    surface(scene,'EDU_PIPE_3D_VISIBLE_CUT_EDGE',1,1,(t,u)=>{
      const rad=R+.12*t;
      return [-LENGTH/2+LENGTH*u,rad*Math.cos(a),rad*Math.sin(a)];
    },edge);
  }
  for(const x of [-LENGTH*.50,LENGTH*.50]){
    const torus=MeshBuilder.CreateTorus('EDU_PIPE_3D_FLANGE', {
      diameter:2*(R+.14),thickness:.145,tessellation:60,
    },scene);
    torus.rotation.z=Math.PI/2;torus.position.x=x;torus.material=flange;
    for(let b=0;b<12;b++){
      const a=2*Math.PI*b/12;
      const bolt=MeshBuilder.CreateCylinder('EDU_PIPE_3D_BOLT',{
        diameter:.077,height:.12,tessellation:8,
      },scene);
      bolt.rotation.z=Math.PI/2;
      bolt.position.set(x+(x>0?.09:-.09),(R+.14)*Math.cos(a),(R+.14)*Math.sin(a));
      bolt.material=edge;
    }
  }
  // A faint carrier medium lets particles and their real 3D depth remain visible.
  const liquid=MeshBuilder.CreateCylinder('EDU_PIPE_3D_CARRIER',{
    height:LENGTH*.965,diameter:2*R*.989,tessellation:60,cap:Mesh.NO_CAP,
  },scene);
  liquid.rotation.z=Math.PI/2;liquid.material=fluid;
  liquid.isPickable=false;
  const bed=createBed(scene,earth);
  const wearStrip=surface(scene,'EDU_PIPE_3D_WEAR_HOTSPOT',12,1,(t,u)=>{
    const a=Math.PI-.43+t*.86,r=R+.009;
    return [-LENGTH*.49+LENGTH*.98*u,r*Math.cos(a),r*Math.sin(a)];
  },abrasion);
  wearStrip.setEnabled(false);
  const grainMats=[
    material(scene,'EDU_PIPE_3D_FINE','#aeb1a1',{metallic:.02,roughness:.96}),
    material(scene,'EDU_PIPE_3D_COARSE','#c19a6d',{metallic:.04,roughness:.94}),
  ];
  const prototypes=[0,1].map(i=>{
    const m=MeshBuilder.CreateIcoSphere('EDU_PIPE_3D_GRAIN_'+(i?'COARSE':'FINE'),{
      radius:1,subdivisions:i?1:1,flat:true,
    },scene);
    m.material=grainMats[i];m.isPickable=false;
    return m;
  });
  const groups=[[],[]];
  for(let i=0;i<410;i++){
    const coarse=random(i,9)>.62;
    groups[Number(coarse)].push({
      x:random(i,1)*LENGTH-LENGTH/2,phi:random(i,2)*Math.PI*2,
      radial:Math.sqrt(random(i,3))*R*.91,
      size:random(i,4),show:random(i,5),speed:.55+random(i,6)*.75,
    });
  }
  const matrixArrays=groups.map(g=>new Float32Array(g.length*16));
  const lineMats=[0,1,2].map((_,i)=>material(scene,'EDU_PIPE_3D_STREAK_'+i,
    i===0?'#55e4e8':i===1?'#77e7fb':'#d6f4ef',{metallic:.18,roughness:.38}));
  const flowLines=[];
  for(let k=0;k<5;k++){
    const y=(k-2)*.31;
    const path=[];
    for(let i=0;i<=44;i++){
      const x=-LENGTH*.49+LENGTH*.98*i/44;
      path.push(new Vector3(x,y,-.35+.07*Math.sin(i*.35+k)));
    }
    const tube=MeshBuilder.CreateTube('EDU_PIPE_3D_STREAMLINE',{
      path,radius:.014+(k===2?.008:0),tessellation:6,
    },scene);
    tube.material=lineMats[k%lineMats.length];tube.isPickable=false;
    flowLines.push(tube);
  }
  let disposed=false,playing=true,t=0,model=null,lastBed=0,mode='flow';
  function resize(){
    if(disposed)return;
    const rect=canvas.getBoundingClientRect?.();
    const aspect=Math.max(1.3,(rect?.width||900)/Math.max(50,rect?.height||260));
    const halfHeight=1.62;
    camera.orthoTop=halfHeight;camera.orthoBottom=-halfHeight;
    camera.orthoLeft=-halfHeight*aspect;camera.orthoRight=halfHeight*aspect;
    engine.resize();
  }
  function render({nextModel,bedLevel,dt=0,tab='flow',animate=true}={}){
    if(disposed)return;
    model=nextModel??model;
    if(!model)return;
    playing=Boolean(animate);mode=tab;
    const delta=clamp(dt,0,.1);
    if(playing)t+=delta;
    const sediment=clamp(bedLevel??model.bed);
    lastBed=sediment;
    bed.update(sediment);
    abrasion.alpha=mode==='wear'?.18+model.wearExposureVisual*.58:0;
    wearStrip.setEnabled(mode==='wear');
    for(const proto of prototypes){
      proto.setEnabled(true);
    }
    for(let groupIndex=0;groupIndex<2;groupIndex++){
      const group=groups[groupIndex],array=matrixArrays[groupIndex];
      for(let i=0;i<group.length;i++){
        const grain=group[i];
        const count=clamp((model.solidsMass-.04)*1.15,.05,.85);
        const visible=grain.show<count;
        // Coarse particles are more concentrated near the lower wall.
        const coarse=groupIndex===1;
        const bottomBias=coarse?(.34+sediment*.75):sediment*.35;
        const z=grain.radial*Math.sin(grain.phi);
        const wallLimit=Math.sqrt(Math.max(0,R*R-z*z))-.075;
        const y=clamp(grain.radial*Math.cos(grain.phi)-bottomBias,-wallLimit,wallLimit);
        const radial=Math.hypot(y,z)/R;
        const multiplier=radialVelocityFactor(model.profile,radial,model.velocity);
        if(playing&&delta){
          const bedSlowdown=coarse&&y<-R+sediment*1.25 ? .16 : 1;
          grain.x+=delta*model.velocity*multiplier*grain.speed*bedSlowdown;
          if(grain.x>LENGTH/2)grain.x-=LENGTH;
        }
        const size=visible ? (coarse?.055+grain.size*.098:.017+grain.size*.031) *
          (model.d50mm===null?1:clamp(.78+model.d50mm*.23,.7,1.5)) : 0;
        const pos=new Vector3(grain.x,y,z);
        Matrix.Compose(new Vector3(size,size,size),Quaternion.Identity(),pos)
          .copyToArray(array,i*16);
      }
      prototypes[groupIndex].thinInstanceSetBuffer('matrix',array,16,false);
    }
    for(const line of flowLines)line.setEnabled(mode==='profile'&&model.velocity>.01);
    scene.render();
  }
  resize();
  return {
    engine,scene,camera,resize,render,
    get status(){return {
      mode,playing,bed:lastBed,particles:groups.reduce((n,g)=>n+g.length,0),
      cutaway:true,geo3D:true,e11D5Visual:true,sourceCadModified:false,cfd:false,disposed,
    };},
    dispose(){if(disposed)return;disposed=true;scene.dispose();engine.dispose();},
  };
}
