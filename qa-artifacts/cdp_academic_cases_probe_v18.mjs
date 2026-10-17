import fs from 'node:fs/promises';

const port = Number(process.argv[2] || 9225);
const pages = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
const page = pages.find((item) => item.type === 'page' && item.url.includes('127.0.0.1:5173'));
if (!page?.webSocketDebuggerUrl) throw new Error(`No V18 dev page on CDP ${port}.`);

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

async function selectCase(id) {
  return evaluate(`(() => {
    const select = document.querySelector('#academic-case-select');
    if (!select) return false;
    select.value = ${JSON.stringify(id)};
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
}

async function click(selector) {
  return evaluate(`(() => {
    const node = document.querySelector(${JSON.stringify(selector)});
    if (!node) return false;
    node.click();
    return true;
  })()`);
}

async function screenshot(name) {
  const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  await fs.writeFile(new URL(`./${name}`, import.meta.url), Buffer.from(shot.data, 'base64'));
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

await selectCase('high-solids-bingham');
const previewOnly = await evaluate(`(() => ({
  selected: document.querySelector('#academic-case-select')?.value,
  guideVisible: !document.querySelector('#academic-case-guide')?.hidden,
  guideText: document.querySelector('#academic-case-guide')?.innerText ?? '',
  solidsBeforeLoad: document.querySelector('#field-slurry-solidsMassFraction')?.value,
}))()`);

await click('#academic-case-load');
await new Promise((resolve) => setTimeout(resolve, 350));
const highSolidsLoaded = await evaluate(`(() => ({
  solids: document.querySelector('#field-slurry-solidsMassFraction')?.value,
  model: document.querySelector('#field-rheology-model')?.value,
  status: document.querySelector('#academic-case-status')?.innerText ?? '',
  density: document.querySelector('#kpi-density')?.innerText ?? '',
  pressure: document.querySelector('#kpi-dp')?.innerText ?? '',
  power: document.querySelector('#kpi-power')?.innerText ?? '',
}))()`);

await selectCase('metallurgical-scope');
await click('#academic-case-load');
await new Promise((resolve) => setTimeout(resolve, 350));
const metallurgyLoaded = await evaluate(`(() => ({
  residence: document.querySelector('#result-residence')?.innerText ?? '',
  conversion: document.querySelector('#result-leach-conversion')?.innerText ?? '',
  recovery: document.querySelector('#kpi-recovery')?.innerText ?? '',
  gold: document.querySelector('#result-gold')?.innerText ?? '',
}))()`);

await selectCase('static-head-energy');
await click('#academic-case-present');
await new Promise((resolve) => setTimeout(resolve, 900));
const presentation = await evaluate(`(() => ({
  active: document.querySelector('#presentation-controls')?.dataset.active,
  target: document.querySelector('#inspection-target')?.value,
  progress: document.querySelector('#presentation-progress')?.innerText?.trim(),
  labelsChecked: document.querySelector('#labels-toggle')?.checked,
  guideText: document.querySelector('#inspection-guide')?.innerText ?? '',
  academicStatus: document.querySelector('#academic-case-status')?.innerText ?? '',
}))()`);
await screenshot('v18-academic-cases-desktop.png');

await send('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await new Promise((resolve) => setTimeout(resolve, 500));
const mobile = await evaluate(`(() => {
  const panel = document.querySelector('.academic-case-panel')?.getBoundingClientRect();
  return {
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: innerWidth,
    panel: panel && { x: panel.x, width: panel.width },
  };
})()`);
await screenshot('v18-academic-cases-mobile.png');

const summary = {
  runtimeErrors,
  networkFailures,
  previewOnly,
  highSolidsLoaded,
  metallurgyLoaded,
  presentation,
  mobile,
};
await fs.writeFile(new URL('./v18-academic-cases-summary.json', import.meta.url), JSON.stringify(summary, null, 2) + 'n');
console.log(JSON.stringify(summary, null, 2));
socket.close();

