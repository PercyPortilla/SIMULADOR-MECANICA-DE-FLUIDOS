// One-shot Chrome DevTools smoke for the existing V57 scene and new cutaway.
// The browser is started separately and must NOT be duplicated on retry.
import fs from 'node:fs';

const port=Number(process.env.CDP_PORT||9333);
const sitePort=Number(process.env.SITE_PORT||8766);
const response=await fetch('http://127.0.0.1:'+port+'/json/list');
const tabs=await response.json();
const page=tabs.find(t=>t.type==='page'&&t.url.includes('127.0.0.1:'));
if(!page?.webSocketDebuggerUrl)throw new Error('CHROME_PAGE_NOT_FOUND');
const socket=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
let index=0;
const exceptions=[];
const pending=new Map();
socket.onmessage=e=>{
 const msg=JSON.parse(String(e.data));
 if(msg.method==='Runtime.exceptionThrown')exceptions.push(msg.params?.exceptionDetails?.text||'Runtime exception');
 const p=pending.get(msg.id);
 if(p){pending.delete(msg.id);msg.error?p.reject(Error(msg.error.message)):p.resolve(msg.result);}
};
const send=(method,params={})=>new Promise((resolve,reject)=>{
 const id=++index;pending.set(id,{resolve,reject});
 socket.send(JSON.stringify({id,method,params}));
});
const evaluate=async(expression)=>{
 const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
 if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);
 return r.result?.value;
};
await send('Page.enable');await send('Runtime.enable');
if(page.url.includes('127.0.0.1:'+sitePort+'/')){
 await send('Page.reload',{ignoreCache:true});
}else{
 await send('Page.navigate',{url:'http://127.0.0.1:'+sitePort+'/?view=lab'});
}
await new Promise(r=>setTimeout(r,1600));
let ready=false;
for(let i=0;i<35;i++){
 ready=Boolean(await evaluate('!!document.querySelector("#v57EnterEulerLab") && !document.querySelector("#v57EnterEulerLab").disabled'));
 if(ready)break;
 await new Promise(r=>setTimeout(r,1000));
}
if(ready){
 await evaluate('if(!document.body.classList.contains("v57-industrial"))document.querySelector("#v57EnterEulerLab")?.click()');
 await new Promise(r=>setTimeout(r,800));
 await evaluate('if(document.querySelector("#v57PipeInspector")?.hidden)document.querySelector("#v57OpenPipeInspector")?.click()');
 await new Promise(r=>setTimeout(r,2200));
}
const outcome=await evaluate(`({
 ready: !!document.querySelector("#v57EnterEulerLab")&&!document.querySelector("#v57EnterEulerLab").disabled,
 lab:document.body.classList.contains("v57-industrial"),
 inspectorOpen:!document.querySelector("#v57PipeInspector")?.hidden,
 pipeWidth:document.querySelector(document.querySelector("#v57Pipe3DCanvas")?.hidden?"#v57PipeCutCanvas":"#v57Pipe3DCanvas")?.clientWidth,
 pipeHeight:document.querySelector(document.querySelector("#v57Pipe3DCanvas")?.hidden?"#v57PipeCutCanvas":"#v57Pipe3DCanvas")?.clientHeight,
 pipeSpeed:document.querySelector("#v57PipeSpeed")?.textContent,
 pipeRatio:document.querySelector("#v57PipeRatio")?.textContent,
 pipe3DStatus:(()=>{const d=window.__PULPA_MAIN_PRESENTATION_QA__?.().pipeInspector;return d?{
  render3D:d.render3D,ready:d.render3DReady,error:d.render3DError,scene:d.scene3D
 }:null})(),
 diagnostic:document.querySelector("#v57PipeInterpretation")?.textContent,
 sceneStatus:(()=>{const s=window.__PULPA_MAIN_PRESENTATION_QA__?.();return s?{
  siteVisualLoaded:s.siteVisualLoaded,siteMeshCount:s.siteMeshCount,
  camera:s.camera,scope:s.scope,inspectionTargetId:s.inspectionTargetId
 }:null})(),
 scriptErrors:window.__pipeSmokeErrors??[]
})`);
const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
const path='qa-artifacts/pipe-inspector-visual-smoke.png';
fs.writeFileSync(path,Buffer.from(screenshot.data,'base64'));
let fallback=null;
if(outcome.inspectorOpen&&outcome.pipe3DStatus?.ready){
 await evaluate('document.querySelector("#v57PipeDimension")?.click()');
 await new Promise(r=>setTimeout(r,400));
 fallback=await evaluate(`({
  dimensionLabel:document.querySelector("#v57PipeDimension")?.textContent,
  canvas2DVisible:!document.querySelector("#v57PipeCutCanvas")?.hidden,
  canvas3DHidden:!!document.querySelector("#v57Pipe3DCanvas")?.hidden
 })`);
 const shot2d=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
 fs.writeFileSync('qa-artifacts/pipe-inspector-fallback-2d.png',Buffer.from(shot2d.data,'base64'));
 await evaluate('document.querySelector("#v57PipeDimension")?.click()');
}
let expanded=null;
if(outcome.inspectorOpen&&outcome.pipe3DStatus?.ready){
 await evaluate('document.querySelector("#v57ExpandPipe")?.click()');
 await new Promise(r=>setTimeout(r,550));
 expanded=await evaluate(`({
  enabled:!!window.__PULPA_MAIN_PRESENTATION_QA__?.().pipeInspector?.expanded,
  heroHeight:document.querySelector("#v57Pipe3DCanvas")?.clientHeight,
  heroWidth:document.querySelector("#v57Pipe3DCanvas")?.clientWidth
 })`);
 const largeShot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
 fs.writeFileSync('qa-artifacts/pipe-inspector-expanded-3d.png',Buffer.from(largeShot.data,'base64'));
 await evaluate('document.querySelector("#v57ExpandPipe")?.click()');
}
const focusShots=[];
if(outcome.inspectorOpen){
 await evaluate('document.querySelector("#v57ClosePipe")?.click()');
 for(const choice of ['mill','sump','pump','cyclones']){
  await evaluate(`(()=>{const el=document.querySelector("#v57View");el.value="${choice}";el.dispatchEvent(new Event("change",{bubbles:true}));})()`);
  await new Promise(r=>setTimeout(r,700));
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  const target='qa-artifacts/pipe-camera-'+choice+'.png';
  fs.writeFileSync(target,Buffer.from(shot.data,'base64'));
  focusShots.push(target);
 }
 await evaluate('(()=>{const el=document.querySelector("#v57View");el.value="all";el.dispatchEvent(new Event("change",{bubbles:true}));document.querySelector("#v57OpenPipeInspector")?.click();})()');
 await new Promise(r=>setTimeout(r,500));
}
if(outcome.inspectorOpen){
 await evaluate('(()=>{const v=document.querySelector("#v57Velocity");v.value="0.30";v.dispatchEvent(new Event("input",{bubbles:true}));const s=document.querySelector("#v57Solids");s.value="55";s.dispatchEvent(new Event("input",{bubbles:true}));})()');
 await new Promise(r=>setTimeout(r,1100));
}
const changed=await evaluate(`({
 pipeSpeed:document.querySelector("#v57PipeSpeed")?.textContent,
 pipeSolids:document.querySelector("#v57PipeSolids")?.textContent,
 pipeRatio:document.querySelector("#v57PipeRatio")?.textContent,
 pipeHeight:document.querySelector(document.querySelector("#v57Pipe3DCanvas")?.hidden?"#v57PipeCutCanvas":"#v57Pipe3DCanvas")?.clientHeight,
 pipeRegime:document.querySelector("#v57PipeRegime")?.textContent
})`);
const after=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
fs.writeFileSync('qa-artifacts/pipe-inspector-parameter-change.png',Buffer.from(after.data,'base64'));
// Verify that Bingham and Herschel-Bulkley controls really reach the
// existing hydraulic solver, not a decorative on-screen-only slider.
const rheologyBefore=await evaluate(`({
  model:document.querySelector("#v57Rheology")?.value,
  yieldVisible:!document.querySelector("#v57YieldControl")?.hidden,
  yieldText:document.querySelector("#v57YieldValue")?.textContent,
  pressure:document.querySelector("#v57Pressure")?.textContent,
  plug:window.__PULPA_MAIN_PRESENTATION_QA__?.().pipeInspector?.model?.plugRadiusRatio
})`);
if(rheologyBefore.model==='bingham'){
 await evaluate('(()=>{const y=document.querySelector("#v57Yield");y.value="22";y.dispatchEvent(new Event("input",{bubbles:true}));})()');
}
const binghamAfter=await evaluate(`({
  model:document.querySelector("#v57Rheology")?.value,
  yieldText:document.querySelector("#v57YieldValue")?.textContent,
  pressure:document.querySelector("#v57Pressure")?.textContent,
  plug:window.__PULPA_MAIN_PRESENTATION_QA__?.().pipeInspector?.model?.plugRadiusRatio
})`);
await evaluate('(()=>{const r=document.querySelector("#v57Rheology");r.value="hb";r.dispatchEvent(new Event("change",{bubbles:true}));})()');
await evaluate('(()=>{const n=document.querySelector("#v57N");n.value="0.55";n.dispatchEvent(new Event("input",{bubbles:true}));})()');
const hbAfter=await evaluate(`({
  model:document.querySelector("#v57Rheology")?.value,
  nVisible:!document.querySelector("#v57NControl")?.hidden,
  nText:document.querySelector("#v57NValue")?.textContent,
  pressure:document.querySelector("#v57Pressure")?.textContent,
  profileLabel:document.querySelector("#v57PipeProfileLabel")?.textContent,
  plug:window.__PULPA_MAIN_PRESENTATION_QA__?.().pipeInspector?.model?.plugRadiusRatio
})`);
const rheologyScreenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
fs.writeFileSync('qa-artifacts/pipe-inspector-rheology-hb.png',Buffer.from(rheologyScreenshot.data,'base64'));
await evaluate('(()=>{document.querySelector("[data-pipe-tab=wear]")?.click(); const v=document.querySelector("#v57Velocity");v.value="3.5";v.dispatchEvent(new Event("input",{bubbles:true}));const s=document.querySelector("#v57Solids");s.value="70";s.dispatchEvent(new Event("input",{bubbles:true}));})()');
await new Promise(r=>setTimeout(r,950));
const abrasion=await evaluate(`({
  mode:window.__PULPA_MAIN_PRESENTATION_QA__?.().pipeInspector?.scene3D?.mode,
  wearExposureVisual:window.__PULPA_MAIN_PRESENTATION_QA__?.().pipeInspector?.model?.wearExposureVisual,
  velocity:document.querySelector("#v57PipeSpeed")?.textContent,
  solids:document.querySelector("#v57PipeSolids")?.textContent
})`);
const abrasionScreenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
fs.writeFileSync('qa-artifacts/pipe-inspector-abrasion-3d.png',Buffer.from(abrasionScreenshot.data,'base64'));
await evaluate('document.querySelector("#v57ExitEulerLab")?.click()');
await new Promise(r=>setTimeout(r,450));
const restored=await evaluate(`({
 mineVisible:!document.body.classList.contains("v57-industrial"),
 inspectorHidden:!!document.querySelector("#v57PipeInspector")?.hidden,
 studyScopeDisabled:window.__PULPA_MAIN_PRESENTATION_QA__?.().scope?.active===false
})`);
const qa={path,before:outcome,fallback,expanded,after:changed,abrasion,
 rheology:{before:rheologyBefore,binghamAfter,hbAfter,
  yieldReacted:rheologyBefore.yieldText!==binghamAfter.yieldText,
  modelReacted:hbAfter.model==='hb'&&hbAfter.nVisible&&hbAfter.nText?.startsWith('0.55'),
  screenshot:'qa-artifacts/pipe-inspector-rheology-hb.png'},
 restored,runtimeExceptions:exceptions,focusShots,
 velocityReacted:outcome.pipeSpeed!==changed.pipeSpeed,
 pipeHeightAccepted:changed.pipeHeight>=155,
 mineRestored:restored.mineVisible&&restored.inspectorHidden&&restored.studyScopeDisabled,
 changeScreenshot:'qa-artifacts/pipe-inspector-parameter-change.png'};
fs.writeFileSync('qa-artifacts/pipe-inspector-visual-smoke.json',JSON.stringify(qa,null,2));
console.log(JSON.stringify(qa,null,2));
if(!outcome.ready||!outcome.inspectorOpen||!outcome.pipe3DStatus?.ready||
 outcome.pipe3DStatus.error||!qa.velocityReacted||!qa.pipeHeightAccepted||
 !qa.mineRestored||!qa.rheology.yieldReacted||!qa.rheology.modelReacted||
 !fallback?.canvas2DVisible||!fallback?.canvas3DHidden||
 !expanded?.enabled||!(expanded?.heroHeight>outcome.pipeHeight+120)||
 !Number.isFinite(abrasion?.wearExposureVisual)||abrasion.mode!=='wear'||
 exceptions.length)process.exitCode=1;
socket.close();
