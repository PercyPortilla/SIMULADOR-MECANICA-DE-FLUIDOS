/* Qualitative visual training effects on the REAL full-site V57, using its own
 * live scenario & solver. Bubbles/pulses/grains are instructional annotations,
 * NOT CFD, wet CAD bores, measured sensors or a pump-performance certificate.
 */
import {MeshBuilder,StandardMaterial,Color3,Vector3} from '@babylonjs/core';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,Number(x)||0));
function build(scene,name,color,alpha){
 const m=new StandardMaterial(name,scene);
 m.diffuseColor=Color3.FromHexString(color);
 m.emissiveColor=m.diffuseColor.scale(.55);
 m.alpha=alpha;m.disableDepthWrite=true;m.backFaceCulling=false;
 return m;
}
export function createV57FaultEffects(scene,{getState,getResults}){
 const vapor=build(scene,'EDU_V57_VAPOR','#8fe5ff',.76);
 const loss=build(scene,'EDU_V57_HEADLOSS','#ffa44d',.74);
 const motor=build(scene,'EDU_V57_MOTOR','#f56c55',.76);
 const solid=build(scene,'EDU_V57_SEDIMENT','#ab7649',.85);
 function sphere(name,size,material){
  const m=MeshBuilder.CreateSphere(name,{diameter:size,segments:8},scene);
  m.isPickable=false;m.material=material;m.isVisible=false;return m;
 }
 function torus(name,size,material){
  const m=MeshBuilder.CreateTorus(name,{diameter:size,thickness:.045,tessellation:16},scene);
  m.isPickable=false;m.material=material;m.isVisible=false;return m;
 }
 const cav=Array.from({length:22},(_,i)=>sphere('V57_EDU_CAVITACION_'+i,.13,vapor));
 const dp=Array.from({length:12},(_,i)=>torus('V57_EDU_PERDIDAS_'+i,.58,loss));
 const power=Array.from({length:5},(_,i)=>torus('V57_EDU_MOTOR_'+i,.78,motor));
 const sediment=Array.from({length:30},(_,i)=>sphere('V57_EDU_SEDIMENTO_'+i,.13,solid));
 let mode='realista',t=0,allowCav=true,allowBed=true,playing=true;
 let last={cavitation:0,pressureLoss:0,power:0,settling:0,
  visibleCavitation:0,visibleHeadLoss:0,visibleMotor:0,visibleSediment:0,
  source:'V57 live scenario; qualitative illustrations',physicallyMeasured:false,CFD:false};
 function evaluate(){
  const s=getState(),r=getResults(),v=Math.max(0,Number(s?.transport?.pipe1?.velocityMps)||0);
  const lossM=Math.max(0,Number(s?.energy?.suctionHeadLossM)||0);
  const solids=clamp(s?.slurry?.solidsMassFraction);
  const K=Math.max(0,Number(s?.transport?.pipe1?.minorLossCoefficient)||0);
  const pressure=Number(r?.transport?.requiredPressurePa);
  const electricity=Number(r?.energy?.electricalPowerW);
  const npshMargin=Number(r?.pump?.npsh?.marginM);
  const measuredMargin=Number.isFinite(npshMargin) && r?.pump?.npsh?.marginM!=null;
  const active=v>.01;
  // These are illustrative visual intensities, NEVER measurements.
  const cavitation=active?clamp((lossM-2)/7*.9+(measuredMargin?clamp(-npshMargin/4):0)) : 0;
  const pressureLoss=active?clamp((K-2)/33*.9+
    (Number.isFinite(pressure)?clamp((pressure/1000-86.9)/320)*.2:0)):0;
  const energy=active&&Number.isFinite(electricity)?clamp((electricity/1000-3)/12):0;
  const settling=clamp((solids-.18)*1.2+(v<.5?.48:0)+(active?0:.2));
  return {cavitation,pressureLoss,power:energy,settling,active,
    modelNpshMarginKnown:measuredMargin,
    source:'Indices solely for instructional animation; solver unaffected',
    physicallyMeasured:false,CFD:false};
 }
 function hide(){for(const m of [...cav,...dp,...power,...sediment])m.isVisible=false;}
 function tick(dt){
  const s=evaluate(),inspect=mode==='transparencia'||mode==='didactico';
  hide();
  if(!playing){last={...s,visibleCavitation:0,visibleHeadLoss:0,visibleMotor:0,visibleSediment:0};return;}
  const dtSafe=clamp(dt,0,.09);t+=dtSafe;
  const count=(intensity,length)=>Math.round(length*clamp((intensity-.1)/.78));
  const visibleCavitation=inspect&&allowCav?count(s.cavitation,cav.length):0;
  const visibleHeadLoss=inspect?count(s.pressureLoss,dp.length):0;
  const visibleMotor=count(s.power,power.length);
  const visibleSediment=inspect&&allowBed?count(s.settling,sediment.length):0;
  for(let i=0;i<visibleCavitation;i++){
   const m=cav[i],p=(t*(.4+s.cavitation*2)+i*.61)%1;
   m.isVisible=true;
   m.position.set(196+p*9,23.3+.18*Math.sin(t*4+i),-90+.19*Math.cos(i*1.7+t));
   m.scaling.setAll(.5+p*s.cavitation);
  }
  for(let i=0;i<visibleHeadLoss;i++){
   const m=dp[i],p=(t*(.2+s.pressureLoss)+i/dp.length)%1;
   m.isVisible=true;
   m.position.set(212+p*16,29.5,-98);
   m.rotation.z=Math.PI/2;
   m.scaling.setAll(.4+p*.85);
  }
  for(let i=0;i<visibleMotor;i++){
   const m=power[i];m.isVisible=true;m.position.set(209.3,23.5+i*.12,-90);
   m.rotation.y=t*1.6+i*.2;
  }
  for(let i=0;i<visibleSediment;i++){
   const m=sediment[i];m.isVisible=true;
   const p=(t*.12+i*.61)%1;
   m.position.set(176+((i*.618)%1)*4,21.7+Math.max(0,1-p)*1.5,-92+((i*.417)%1)*4);
   m.scaling.setAll(.55+s.settling*.35);
  }
  last={...s,visibleCavitation,visibleHeadLoss,visibleMotor,visibleSediment};
 }
 const observer=scene.onBeforeRenderObservable.add(()=>{
  const dt=scene.getEngine().getDeltaTime()/1000;
  tick(dt);
 });
 tick(0);
 return {
  setMode(x){mode=x;tick(0)},
  setCavitationVisible(x){allowCav=!!x;tick(0)},
  setSedimentationVisible(x){allowBed=!!x;tick(0)},
  setPlaying(x){playing=!!x;tick(0)},
  refresh(){tick(0)},
  get status(){return {...last,mode,allowCav,allowBed,playing,
    origin:'V57 anchor-based didactic effects; 1u = 1m',
    sourceGLBModified:false,solverModified:false,wetCertified:false}},
  dispose(){scene.onBeforeRenderObservable.remove(observer);
    for(const m of [...cav,...dp,...power,...sediment])m.dispose()}
 };
}
