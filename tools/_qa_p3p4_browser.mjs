/* Chrome CDP smoke of source-mesh P3→P4 reveal: no fabricated wet mates. */
import fs from 'node:fs';
const port=Number(process.env.CDP_PORT||9333);
const sitePort=Number(process.env.SITE_PORT||8767);
const tabs=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();
const tab=tabs.find(x=>x.type==='page'&&x.url.includes('127.0.0.1:'));
if(!tab)throw Error('NO_QA_CHROME_PAGE');
const ws=new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
const pending=new Map(),errors=[];let id=0;
ws.onmessage=e=>{
 const data=JSON.parse(e.data);
 if(data.method==='Runtime.exceptionThrown')errors.push(data.params?.exceptionDetails?.exception?.description||data.params?.exceptionDetails?.text);
 const p=pending.get(data.id);
 if(p){pending.delete(data.id);data.error?p.reject(new Error(data.error.message)):p.resolve(data.result);}
};
const send=(method,params={})=>new Promise((resolve,reject)=>{
 const n=++id;pending.set(n,{resolve,reject});
 ws.send(JSON.stringify({id:n,method,params}));
});
const evaluate=async(expression)=>{
 const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
 if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);
 return r.result.value;
};
await send('Page.enable');await send('Runtime.enable');
await send('Page.navigate',{url:'http://127.0.0.1:'+sitePort+'/?view=lab'});
await new Promise(r=>setTimeout(r,1500));
let ready=false;
for(let i=0;i<40;i++){
 ready=await evaluate('!!document.querySelector("#v57EnterEulerLab")&&!document.querySelector("#v57EnterEulerLab").disabled');
 if(ready)break;
 await new Promise(r=>setTimeout(r,750));
}
if(!ready)throw Error('V57_VISUAL_NOT_READY');
await evaluate('if(!document.body.classList.contains("v57-industrial"))document.querySelector("#v57EnterEulerLab").click()');
await new Promise(r=>setTimeout(r,500));
await evaluate('document.querySelector("#v57InspectP3P4").click()');
await new Promise(r=>setTimeout(r,1300));
const first=await evaluate(`({
 lab:document.body.classList.contains("v57-industrial"),
 panelOpen:!document.querySelector("#v57PumpP3P4Audit")?.hidden,
 panelText:document.querySelector("#v57PumpP3P4Audit")?.innerText,
 main:window.__PULPA_MAIN_PRESENTATION_QA__?.().siteVisualLoaded,
 data:window.__PULPA_MAIN_PRESENTATION_QA__?.().p3p4
})`);
const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
fs.writeFileSync('qa-artifacts/p3p4-live-source-wet-gate.png',Buffer.from(shot.data,'base64'));
await evaluate('document.querySelector("#v57InspectP3P4").click()');
const after=await evaluate(`({
 hidden:!!document.querySelector("#v57PumpP3P4Audit")?.hidden,
 inactive:window.__PULPA_MAIN_PRESENTATION_QA__?.().p3p4?.active===false
})`);
await evaluate('document.querySelector("#v57InspectP3P4").click()');
await evaluate('document.querySelector("#v57ExitEulerLab").click()');
const restored=await evaluate(`({
 labOff:!document.body.classList.contains("v57-industrial"),
 p3p4Off:window.__PULPA_MAIN_PRESENTATION_QA__?.().p3p4?.active===false,
 sceneRestored:window.__PULPA_MAIN_PRESENTATION_QA__?.().scope?.active===false
})`);
const qa={first,after,restored,exceptions:errors,
 pass:ready&&first.panelOpen&&first.main&&
 !first.data?.certifiedWetMate&&first.data?.authoredFluidMeshesFound>=3&&
 first.data?.straightFluidSegmentsAnimated>=2&&after.hidden&&after.inactive&&
 restored.labOff&&restored.p3p4Off&&restored.sceneRestored&&errors.length===0};
fs.writeFileSync('qa-artifacts/p3p4-live-source-wet-gate.json',JSON.stringify(qa,null,2));
console.log(JSON.stringify(qa,null,2));
ws.close();if(!qa.pass)process.exitCode=1;
