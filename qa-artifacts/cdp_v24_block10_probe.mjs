import fs from 'node:fs/promises';

const port = Number(process.argv[2] || 9232);
const baseUrl = process.argv[3] || 'http://127.0.0.1:4175/?qa=v24-block10';
const outputDir = new URL('./v24-block10/', import.meta.url);
await fs.mkdir(outputDir, { recursive: true });

const pages = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
const page = pages.find((item) => item.type === 'page');
if (!page?.webSocketDebuggerUrl) throw new Error(`No browser page on CDP ${port}.`);
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
    const entry = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(message.error.message)); else entry.resolve(message.result);
    return;
  }
  if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params?.exceptionDetails?.exception?.description || message.params?.exceptionDetails?.text || 'Runtime exception');
  if (message.method === 'Network.loadingFailed' && !message.params?.canceled) networkFailures.push({ errorText: message.params?.errorText, type: message.params?.type });
});
function send(method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const evaluate = (expression) => send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
async function capture(name) {
  const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  await fs.writeFile(new URL(`${name}.png`, outputDir), Buffer.from(shot.data, 'base64'));
}
async function camera(id) {
  await evaluate(`document.querySelector('[data-camera=${JSON.stringify(id)}]')?.click()`);
  await wait(850);
  await capture(id);
}
async function inspect(id, mode = 'normal') {
  await evaluate(`(() => {
    const target=document.querySelector('#inspection-target');
    const modeSelect=document.querySelector('#inspection-mode');
    if(!target || !Array.from(target.options).some(o=>o.value===${JSON.stringify(id)})) return false;
    target.value=${JSON.stringify(id)}; target.dispatchEvent(new Event('change',{bubbles:true}));
    if(modeSelect && !modeSelect.disabled){modeSelect.value=${JSON.stringify(mode)};modeSelect.dispatchEvent(new Event('change',{bubbles:true}));}
    document.querySelector('[data-camera="inspection"]')?.click(); return true;
  })()`);
  await wait(900);
  await capture(`inspection-${id.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${mode}`);
}

await Promise.all([send('Page.enable'), send('Runtime.enable'), send('Network.enable')]);
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: baseUrl });
await wait(10500);
await evaluate(`(() => { const labels=document.querySelector('#labels-toggle'); if(labels?.checked) labels.click(); const a=document.querySelector('#animations-toggle'); if(a && !a.checked) a.click(); })()`);
for (const id of ['general', 'reception', 'grinding', 'recovery']) await camera(id);
await inspect('MILL-01', 'interior');
await inspect('SLURRY-PUMP-01', 'interior');
await inspect('CIP-ADSORPTION', 'transparent');

const info = await evaluate(`(() => ({
  releaseTag: document.querySelector('.release-tag')?.textContent?.trim() ?? '',
  sceneError: document.querySelector('#scene-error')?.hidden === false ? document.querySelector('#scene-error')?.innerText : '',
  animationsEnabled: Boolean(document.querySelector('#animations-toggle')?.checked),
  targets: Array.from(document.querySelector('#inspection-target')?.options ?? []).filter(o=>o.value).length,
  guideHasHotspots: /COMPONENTES CLAVE/.test(document.querySelector('#inspection-guide')?.innerText ?? ''),
  glbResources: performance.getEntriesByType('resource').filter((entry)=>entry.name.endsWith('.glb')).length,
  documentWidth: document.documentElement.scrollWidth,
  viewportWidth: window.innerWidth,
}))()`);
const summary = { ...info.result?.value, runtimeErrors, networkFailures };
await fs.writeFile(new URL('summary.json', outputDir), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
socket.close();
