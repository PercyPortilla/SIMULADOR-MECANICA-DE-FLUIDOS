import fs from 'node:fs/promises';

const port = Number(process.argv[2] || 9232);
const baseUrl = process.argv[3] || 'http://127.0.0.1:4175/?qa=v24-block1';
const outputDir = new URL('./v24-block1/', import.meta.url);
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
    if (message.error) entry.reject(new Error(message.error.message));
    else entry.resolve(message.result);
    return;
  }
  if (message.method === 'Runtime.exceptionThrown') {
    runtimeErrors.push(message.params?.exceptionDetails?.exception?.description || message.params?.exceptionDetails?.text || 'Runtime exception');
  }
  if (message.method === 'Network.loadingFailed' && !message.params?.canceled) {
    networkFailures.push({ errorText: message.params?.errorText, type: message.params?.type });
  }
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
async function camera(id, delay = 900) {
  await evaluate(`document.querySelector('[data-camera=${JSON.stringify(id)}]')?.click()`);
  await wait(delay);
}
async function inspect(id, delay = 950) {
  await evaluate(`(() => {
    const select = document.querySelector('#inspection-target');
    if (!select || !Array.from(select.options).some((option) => option.value === ${JSON.stringify(id)})) return false;
    select.value = ${JSON.stringify(id)};
    select.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('[data-camera="inspection"]')?.click();
    return true;
  })()`);
  await wait(delay);
}

await Promise.all([send('Page.enable'), send('Runtime.enable'), send('Network.enable')]);
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: baseUrl });
await wait(10500);

const boot = await evaluate(`(() => {
  const labels = document.querySelector('#labels-toggle');
  if (labels?.checked) labels.click();
  const animations = document.querySelector('#animations-toggle');
  if (animations && !animations.checked) animations.click();
  const resources = performance.getEntriesByType('resource').map((entry) => entry.name);
  return {
    title: document.title,
    releaseTag: document.querySelector('.release-tag')?.textContent?.trim() ?? '',
    sceneError: document.querySelector('#scene-error')?.hidden === false ? document.querySelector('#scene-error')?.innerText : '',
    targets: Array.from(document.querySelector('#inspection-target')?.options ?? []).map((option) => option.value).filter(Boolean).length,
    animationsEnabled: Boolean(animations?.checked),
    haulTruckGlbRequested: resources.some((name) => name.includes('HAUL-TRUCK.glb')),
    shovelGlbRequested: resources.some((name) => name.includes('MINING-SHOVEL.glb')),
    loaderGlbRequested: resources.some((name) => name.includes('WHEEL-LOADER.glb')),
  };
})()`);

await camera('reception');
await capture('reception-operating');
await inspect('EXCAVATOR-01');
await capture('open-pit-excavator-operating');
await inspect('STOCKPILE-RECLAIM');
await capture('stockpile-reclaim-operating');
await inspect('LOADER-01');
await capture('stockpile-loader-operating');

const toggle = await evaluate(`(() => {
  const animations = document.querySelector('#animations-toggle');
  if (!animations) return { found: false };
  if (animations.checked) animations.click();
  const off = animations.checked;
  animations.click();
  return { found: true, offStateChecked: off, resumedChecked: animations.checked };
})()`);
await wait(700);

const summary = {
  boot: boot.result?.value,
  toggle: toggle.result?.value,
  runtimeErrors,
  networkFailures,
};
await fs.writeFile(new URL('summary.json', outputDir), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
socket.close();
