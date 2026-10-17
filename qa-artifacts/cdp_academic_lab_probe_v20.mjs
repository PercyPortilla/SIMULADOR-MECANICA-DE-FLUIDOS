import fs from 'node:fs/promises';

const port = Number(process.argv[2] || 9228);
const pages = await fetch('http://127.0.0.1:' + port + '/json').then((response) => response.json());
const page = pages.find((item) => item.type === 'page' && item.url.includes('127.0.0.1:5173'));
if (!page?.webSocketDebuggerUrl) throw new Error('No V20 page on CDP ' + port + '.');

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let sequence = 0;
const pending = new Map();
const runtimeErrors = [];
const networkFailures = [];
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const waiter = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message));
    else waiter.resolve(message.result);
    return;
  }
  if (message.method === 'Runtime.exceptionThrown') {
    runtimeErrors.push(message.params?.exceptionDetails?.text || 'Runtime exception');
  }
  if (message.method === 'Network.loadingFailed') {
    networkFailures.push(message.params?.errorText || 'Network loading failed');
  }
});

function send(method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Evaluation failed');
  return result.result?.value;
}

async function click(selector) {
  return evaluate("(() => { const n=document.querySelector(" + JSON.stringify(selector) + "); if(!n) return false; n.click(); return true; })()");
}

async function setSelect(selector, value) {
  return evaluate("(() => { const n=document.querySelector(" + JSON.stringify(selector) + "); if(!n) return false; n.value=" + JSON.stringify(value) + "; n.dispatchEvent(new Event('change',{bubbles:true})); return true; })()");
}

async function setPrediction(key, value) {
  return evaluate("(() => { const n=document.querySelector('[data-lab-prediction=\"" + key + "\"]'); if(!n) return false; n.value=" + JSON.stringify(value) + "; n.dispatchEvent(new Event('change',{bubbles:true})); return true; })()");
}

async function screenshot(name) {
  const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  await fs.writeFile(new URL('./' + name, import.meta.url), Buffer.from(shot.data, 'base64'));
}

await Promise.all([
  send('Runtime.enable'),
  send('Network.enable'),
  send('Page.enable'),
  send('Emulation.setDeviceMetricsOverride', {
    width: 1600,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  }),
]);
await new Promise((resolve) => setTimeout(resolve, 6500));

await evaluate("document.querySelector('#academic-lab').open=true");
const initial = await evaluate("(() => { const scene=document.querySelector('.scene-card')?.getBoundingClientRect(); const kpi=document.querySelector('.kpi-grid')?.getBoundingClientRect(); const result=document.querySelector('.result-panel')?.getBoundingClientRect(); return { badge:document.querySelector('.academic-case-heading small')?.textContent, experiment:document.querySelector('#academic-lab-select')?.value, predictionCount:document.querySelectorAll('[data-lab-prediction]').length, sceneBeforeKpis:Boolean(scene&&kpi&&scene.top<kpi.top), sceneBeforeResults:Boolean(scene&&result&&scene.top<result.top), sceneTop:scene?.top, kpiTop:kpi?.top, resultTop:result?.top }; })()");

await setPrediction('flow', 'igual');
await setPrediction('pressure', 'sube');
await setPrediction('head', 'sube');
await setPrediction('power', 'sube');
await setPrediction('annualEnergy', 'sube');
await click('#academic-lab-run');
await new Promise((resolve) => setTimeout(resolve, 250));

const evaluation = await evaluate("(() => ({ resultHidden:document.querySelector('#academic-lab-result')?.hidden, score:document.querySelector('.academic-lab-score')?.innerText ?? '', rows:document.querySelectorAll('.academic-lab-table-wrap tbody tr').length, status:document.querySelector('#academic-lab-status')?.innerText ?? '', quality:document.querySelector('.academic-lab-quality')?.innerText ?? '', conclusion:document.querySelector('.academic-lab-conclusion')?.innerText ?? '', reportDisabled:document.querySelector('#academic-lab-report')?.disabled, loadBDisabled:document.querySelector('#academic-lab-load-b')?.disabled, activeLength:document.querySelector('#field-transport-pipe1-lengthM')?.value, activeDz:document.querySelector('#field-transport-pipe1-elevationChangeM')?.value }))()");

await evaluate("(() => { window.__qaDownloadClicks=0; HTMLAnchorElement.prototype.click=function(){ window.__qaDownloadClicks += 1; }; return true; })()");
await click('#academic-lab-report');
const report = await evaluate("(() => ({ clickCount:window.__qaDownloadClicks, status:document.querySelector('#academic-lab-status')?.innerText ?? '' }))()");

await click('#academic-lab-load-b');
await new Promise((resolve) => setTimeout(resolve, 200));
const loadedIntervention = await evaluate("(() => ({ length:document.querySelector('#field-transport-pipe1-lengthM')?.value, dz:document.querySelector('#field-transport-pipe1-elevationChangeM')?.value, velocity:document.querySelector('#field-transport-pipe1-velocityMps')?.value, scenarioStatus:document.querySelector('#scenario-status')?.innerText ?? '' }))()");

await setSelect('#inspection-target', 'MILL-01');
await new Promise((resolve) => setTimeout(resolve, 250));
const inspection = await evaluate("(() => ({ guide:document.querySelector('#inspection-guide')?.innerText ?? '', legend:document.querySelector('.inspection-context-legend')?.innerText ?? '', camera:[...document.querySelectorAll('#camera-switcher button')].find((b)=>b.classList.contains('active'))?.dataset.camera ?? '' }))()");

await screenshot('v20-academic-lab-desktop.png');

await send('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await new Promise((resolve) => setTimeout(resolve, 500));
const mobile = await evaluate("(() => { const panel=document.querySelector('.academic-case-panel')?.getBoundingClientRect(); const lab=document.querySelector('#academic-lab')?.getBoundingClientRect(); const table=document.querySelector('.academic-lab-table-wrap')?.getBoundingClientRect(); return { documentWidth:document.documentElement.scrollWidth, viewportWidth:innerWidth, panel:panel&&{x:panel.x,width:panel.width}, lab:lab&&{x:lab.x,width:lab.width}, table:table&&{x:table.x,width:table.width} }; })()");
await screenshot('v20-academic-lab-mobile.png');

const summary = {
  runtimeErrors,
  networkFailures,
  initial,
  evaluation,
  report,
  loadedIntervention,
  inspection,
  mobile,
};
await fs.writeFile(new URL('./v20-academic-lab-summary.json', import.meta.url), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
socket.close();
