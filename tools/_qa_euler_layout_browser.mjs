/* In-place Chrome QA: DOM preservation and non-overlapping Euler workbench. */
import fs from 'node:fs';
const site=process.env.SITE_PORT||'8767', cdp=process.env.CDP_PORT||'9333';
const pages=await (await fetch('http://127.0.0.1:'+cdp+'/json/list')).json();
const page=pages.find(p=>p.type==='page'&&p.url.includes('127.0.0.1:'));
if(!page?.webSocketDebuggerUrl)throw Error('NO_CDP_PAGE');
const ws=new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
let seq=0;const pending=new Map(),exceptions=[];
ws.onmessage=event=>{
 const message=JSON.parse(event.data);
 if(message.method==='Runtime.exceptionThrown'){
  exceptions.push(message.params?.exceptionDetails?.exception?.description||message.params?.exceptionDetails?.text||'exception');
 }
 const p=pending.get(message.id);
 if(p){pending.delete(message.id);message.error?p.reject(Error(message.error.message)):p.resolve(message.result);}
};
const send=(method,params={})=>new Promise((resolve,reject)=>{
 const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));
});
const evaluate=async(expression)=>{
 const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
 if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);
 return r.result?.value;
};
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
await send('Page.enable');await send('Runtime.enable');
await send('Page.navigate',{url:'http://127.0.0.1:'+site+'/?view=lab'});
await wait(1400);
for(let i=0;i<40;i++){
 const ready=await evaluate('!!document.querySelector("#v57EnterEulerLab")&&!document.querySelector("#v57EnterEulerLab").disabled');
 if(ready)break;
 if(i===39)throw Error('V57_NOT_READY');
 await wait(700);
}
await evaluate('if(!document.body.classList.contains("v57-industrial"))document.querySelector("#v57EnterEulerLab").click()');
await wait(600);
const check=async(label)=>{
 const data=await evaluate(`(()=>{
   const rect=id=>{
    const node=typeof id==='string'?document.querySelector(id):id;
    if(!node||node.hidden||getComputedStyle(node).display==='none')return null;
    const r=node.getBoundingClientRect();
    return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};
   };
   const overlaps=(a,b)=>{
    if(!a||!b)return false;
    return Math.min(a.right,b.right)-Math.max(a.x,b.x)>3&&
      Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>3;
   };
   const inspect=rect('#v57PipeInspector'),right=rect('#v57RightWorkspace'),
     left=rect('.v57-side-left'),dock=rect('#v57ControlDock');
   const slider=rect('#v57Velocity'),dockBody=rect('.v57-control-body');
   const viewport=rect('.scene-viewport');
   const tabs=[...document.querySelectorAll('.v57-right-tabs [data-euler-panel]')]
     .map(n=>({name:n.dataset.eulerPanel,selected:n.getAttribute('aria-selected')}));
   const data=window.__PULPA_MAIN_PRESENTATION_QA__?.();
   const originalIds=['#v57Flow','#v57Pressure','#v57Power','#sections','#kpi-flow','#result-model',
      '#v57Velocity','#v57Solids','#v57Rheology','#v57Pipe3DCanvas'];
   return {
    title:document.querySelector('.topbar h1')?.textContent,
    inspector:inspect,right,left,dock,dockBody,slider,viewport,tabs,
    noRightOverlap:!overlaps(inspect,right)&&!overlaps(dock,right),
    noLeftOverlap:!overlaps(inspect,left)&&!overlaps(dock,left),
    elements:originalIds.map(id=>({id,present:!!document.querySelector(id)})),
    active:document.body.classList.contains('v57-industrial'),
    sidebarParent:document.querySelector('.sidebar')?.parentElement?.dataset?.eulerStage||'original',
    rightPanel:data?.uiLayout?.rightPanel,
    rightOpen:data?.uiLayout?.rightOpen,
    leftOpen:data?.uiLayout?.leftOpen,
    relocated:data?.uiLayout?.relocatedOriginalRegions,
    velocity:data?.scenarioParameterInputs?.velocityMps,
    flow:document.querySelector('#v57Flow')?.textContent,
    pipe3d:data?.pipeInspector?.render3DReady,
    sliderFullyVisible:!dock||!slider||slider.bottom<=dock.bottom-1&&slider.y>=dock.y&&
      slider.bottom<=innerHeight,
    documentScrollWidth:document.documentElement.scrollWidth,windowWidth:innerWidth,windowHeight:innerHeight,
   };
 })()`);
 const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
 const filename='qa-artifacts/euler-layout-'+label+'.png';
 fs.writeFileSync(filename,Buffer.from(screenshot.data,'base64'));
 return {...data,screenshot:filename};
};
const baseline=await check('indicators');
await evaluate('document.querySelector("#v57MoreControls").click()');
const moreControls=await evaluate(`({
 opened:document.querySelector("#v57MoreControls")?.getAttribute("aria-expanded")==="true",
 d50Visible:getComputedStyle(document.querySelector("#v57D50").closest("label")).display!=="none",
 nFieldPresent:!!document.querySelector("#v57N"),
 originalRheologyInputPresent:!!document.querySelector("#field-rheology-yieldStressPa")
})`);
await evaluate('document.querySelector("#v57MoreControls").click()');
await evaluate('document.querySelector("#v57OpenPipeInspector").click()');
await wait(1300);
const inspected=await check('inspector');
await evaluate('document.querySelector(".v57-right-tabs [data-euler-panel=parameters]").click()');
await wait(400);
const parameters=await check('parameters');
const beforeVelocity=await evaluate('window.__PULPA_MAIN_PRESENTATION_QA__?.().scenarioParameterInputs.velocityMps');
await evaluate('(()=>{const slider=document.querySelector("#v57Velocity");slider.value="2.2";slider.dispatchEvent(new Event("input",{bubbles:true}));})()');
await wait(250);
const afterVelocity=await evaluate('window.__PULPA_MAIN_PRESENTATION_QA__?.().scenarioParameterInputs.velocityMps');
await evaluate('document.querySelector("#v57Reset").click()');
await evaluate('document.querySelector(".v57-right-tabs [data-euler-panel=results]").click()');
await wait(450);
const results=await check('analysis');
await evaluate('document.querySelector("#v57RailOptions").click()');
await wait(300);
const options=await check('options');
await evaluate('document.querySelector("#v57RailOptions").click()');
await evaluate('document.querySelector("#v57RailFocus").click()');
await wait(300);
const exposition=await check('exposition');
await evaluate('document.querySelector("#v57RailFocus").click()');
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
await wait(450);
const laptop1280=await check('laptop-1280');
await send('Emulation.setDeviceMetricsOverride',{width:760,height:820,deviceScaleFactor:1,mobile:true});
await wait(450);
const mobilePanel=await check('mobile-panel');
await evaluate('document.querySelector("#v57CloseRightWorkspace").click()');
await wait(450);
const mobileInspector=await check('mobile-inspector');
await send('Emulation.clearDeviceMetricsOverride');
await evaluate('document.querySelector("#v57ExitEulerLab").click()');
await wait(300);
const restored=await evaluate(`({
 labOff:!document.body.classList.contains('v57-industrial'),
 sidebarBack:document.querySelector('.workspace > .sidebar')!==null,
 summaryBack:document.querySelector('.content .hydraulic-summary')!==null,
 resultsBack:document.querySelector('.content .result-panel')!==null,
 scopeOff:window.__PULPA_MAIN_PRESENTATION_QA__?.().scope?.active===false
})`);
const screenshots={baseline,inspected,parameters,results,options,exposition,laptop1280,mobilePanel,mobileInspector};
const qa={states:screenshots,moreControls,sliderPropagation:{beforeVelocity,afterVelocity},restored,exceptions,pass:
 Object.entries(screenshots).every(([name,x])=>
  x.noRightOverlap&&x.noLeftOverlap&&
  (name==='mobilePanel'||x.sliderFullyVisible)&&x.elements.every(e=>e.present))&&
 moreControls.opened&&moreControls.d50Visible&&moreControls.nFieldPresent&&
 moreControls.originalRheologyInputPresent&&beforeVelocity!==afterVelocity&&
 Math.abs(afterVelocity-2.2)<1e-6&&
 inspected.pipe3d===true&&parameters.rightPanel==='parameters'&&parameters.relocated===3&&
 results.rightPanel==='results'&&options.leftOpen&&
 exposition.rightOpen===false&&
 laptop1280.sliderFullyVisible&&mobileInspector.inspector?.width>400&&
 restored.labOff&&restored.sidebarBack&&restored.summaryBack&&restored.resultsBack&&restored.scopeOff&&
 exceptions.length===0};
fs.writeFileSync('qa-artifacts/euler-layout-workbench-qa.json',JSON.stringify(qa,null,2));
console.log(JSON.stringify({pass:qa.pass,moreControls,sliderPropagation:qa.sliderPropagation,restored,exceptions,states:
 Object.fromEntries(Object.entries(screenshots).map(([k,x])=>[k,{
  overlapRight:!x.noRightOverlap,overlapLeft:!x.noLeftOverlap,panel:x.rightPanel,
  leftOpen:x.leftOpen,rightOpen:x.rightOpen,relocated:x.relocated,
  inspectorWidth:x.inspector?.width,sliderVisible:x.sliderFullyVisible,
  sliderBottom:x.slider?.bottom,dockBottom:x.dock?.bottom,viewportBottom:x.viewport?.bottom,
  windowHeight:x.windowHeight,scrollExcess:x.documentScrollWidth-x.windowWidth
 }]))},null,2));
ws.close();if(!qa.pass)process.exitCode=1;
