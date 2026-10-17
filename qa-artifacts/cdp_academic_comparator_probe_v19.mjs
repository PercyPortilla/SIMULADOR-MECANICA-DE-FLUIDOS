import fs from 'node:fs/promises';

const port = Number(process.argv[2] || 9227);
const pages = await fetch('http://127.0.0.1:' + port + '/json').then((response) => response.json());
const page = pages.find((item) => item.type === 'page' && item.url.includes('127.0.0.1:5173'));
if (!page?.webSocketDebuggerUrl) throw new Error('No V19 page on CDP ' + port + '.');

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
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
    return;
  }
  if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params?.exceptionDetails?.text || 'Runtime exception');
  if (message.method === 'Network.loadingFailed') networkFailures.push(message.params?.errorText || 'Network loading failed');
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

async function setSelect(selector, value) {
  return evaluate(
    "(() => { const node=document.querySelector(" + JSON.stringify(selector)
      + "); if(!node) return false; node.value=" + JSON.stringify(value)
      + "; node.dispatchEvent(new Event('change',{bubbles:true})); return true; })()",
  );
}

async function click(selector) {
  return evaluate(
    "(() => { const node=document.querySelector(" + JSON.stringify(selector)
      + "); if(!node) return false; node.click(); return true; })()",
  );
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
await new Promise((resolve) => setTimeout(resolve, 6000));

await evaluate("document.querySelector('#academic-comparator').open=true");
const initialState = await evaluate("(() => ({ solids:document.querySelector('#field-slurry-solidsMassFraction')?.value, model:document.querySelector('#field-rheology-model')?.value, left:document.querySelector('#academic-compare-left')?.value, right:document.querySelector('#academic-compare-right')?.value }))()");
await click('#academic-compare-run');
await new Promise((resolve) => setTimeout(resolve, 200));
const defaultComparison = await evaluate("(() => ({ rows:document.querySelectorAll('#academic-comparison-result tbody tr').length, text:document.querySelector('#academic-comparison-result')?.innerText ?? '', solids:document.querySelector('#field-slurry-solidsMassFraction')?.value, model:document.querySelector('#field-rheology-model')?.value }))()");

await setSelect('#academic-compare-left', 'newtonian-reference');
await setSelect('#academic-compare-right', 'static-head-energy');
await click('#academic-compare-run');
await new Promise((resolve) => setTimeout(resolve, 200));
const staticHeadComparison = await evaluate("document.querySelector('#academic-comparison-result')?.innerText ?? ''");
await screenshot('v19-academic-comparator-desktop.png');

await setSelect('#academic-compare-left', 'herschel-bulkley');
await setSelect('#academic-compare-right', 'power-law-scope');
await click('#academic-compare-run');
await new Promise((resolve) => setTimeout(resolve, 200));
const scopeComparison = await evaluate("document.querySelector('#academic-comparison-result')?.innerText ?? ''");

await send('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await new Promise((resolve) => setTimeout(resolve, 500));
const mobile = await evaluate("(() => { const panel=document.querySelector('.academic-case-panel')?.getBoundingClientRect(); const table=document.querySelector('.academic-comparison-table-wrap')?.getBoundingClientRect(); return { documentWidth:document.documentElement.scrollWidth, viewportWidth:innerWidth, panel:panel&&{x:panel.x,width:panel.width}, table:table&&{x:table.x,width:table.width} }; })()");
await screenshot('v19-academic-comparator-mobile.png');

const summary = {
  runtimeErrors,
  networkFailures,
  initialState,
  defaultComparison,
  staticHeadComparison,
  scopeComparison,
  mobile,
};
await fs.writeFile(new URL('./v19-academic-comparator-summary.json', import.meta.url), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
socket.close();
