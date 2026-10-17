import fs from 'node:fs/promises';

const port = Number(process.argv[2] || 9230);
const baseUrl = process.argv[3] || 'http://127.0.0.1:4173/?qa=v21-terrain-animation';
const outputDir = new URL('./v21-terrain-animation/', import.meta.url);
await fs.mkdir(outputDir, { recursive: true });

const pages = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
const page = pages.find((item) => item.type === 'page');
if (!page?.webSocketDebuggerUrl) throw new Error(`No Chrome page on CDP ${port}.`);

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

await Promise.all([send('Page.enable'), send('Runtime.enable'), send('Network.enable')]);
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: baseUrl });
await wait(10000);

const boot = await evaluate(`(() => {
  const labels = document.querySelector('#labels-toggle');
  if (labels?.checked) labels.click();
  const animations = document.querySelector('#animations-toggle');
  if (animations && !animations.checked) animations.click();
  return {
    title: document.title,
    targets: Array.from(document.querySelector('#inspection-target')?.options ?? []).map((option) => option.value).filter(Boolean),
    animationsEnabled: animations?.checked ?? null,
    sceneError: document.querySelector('#scene-error')?.hidden === false ? document.querySelector('#scene-error')?.innerText : '',
    earthworkRequested: performance.getEntriesByType('resource').some((entry) => entry.name.includes('RECEPTION-EARTHWORK-V21.glb')),
    millRequested: performance.getEntriesByType('resource').some((entry) => entry.name.includes('MILL-01.glb')),
    pumpRequested: performance.getEntriesByType('resource').some((entry) => entry.name.includes('SLURRY-PUMP-01.glb')),
  };
})()`);

async function selectInspection(target) {
  const result = await evaluate(`(() => {
    const select = document.querySelector('#inspection-target');
    const camera = document.querySelector('[data-camera="inspection"]');
    if (!select || !camera || !Array.from(select.options).some((option) => option.value === ${JSON.stringify(target)})) return false;
    select.value = ${JSON.stringify(target)};
    select.dispatchEvent(new Event('change', { bubbles: true }));
    camera.click();
    return true;
  })()`);
  if (!result.result?.value) throw new Error(`Inspection target not available: ${target}`);
  await wait(900);
}

const animatedTargets = ['ROM-HOPPER', 'STOCKPILE-RECLAIM', 'MILL-01', 'SLURRY-PUMP-01', 'PUMP-01', 'SUMP-01'];
for (const target of animatedTargets) {
  await selectInspection(target);
  await capture(`${target}-on-a`);
  await wait(1100);
  await capture(`${target}-on-b`);
}

await selectInspection('PUMP-01');
await evaluate(`(() => {
  const animations = document.querySelector('#animations-toggle');
  if (animations?.checked) animations.click();
  return animations?.checked ?? null;
})()`);
await wait(250);
await capture('PUMP-01-off-a');
await wait(1100);
await capture('PUMP-01-off-b');

await evaluate(`(() => {
  const animations = document.querySelector('#animations-toggle');
  if (animations && !animations.checked) animations.click();
  const reception = document.querySelector('[data-camera="reception"]');
  reception?.click();
  return Boolean(reception);
})()`);
await wait(1100);
await capture('reception-earthwork');

const finalState = await evaluate(`(() => ({
  animationsEnabled: document.querySelector('#animations-toggle')?.checked ?? null,
  activeCamera: document.querySelector('[data-camera].active')?.dataset?.camera ?? '',
  guide: document.querySelector('#inspection-guide')?.innerText ?? '',
  documentWidth: document.documentElement.scrollWidth,
  viewportWidth: window.innerWidth,
  resourceFailures: performance.getEntriesByType('resource').filter((entry) => entry.name.endsWith('.glb') && entry.duration === 0).map((entry) => entry.name),
}))()`);

const summary = {
  boot: boot.result?.value,
  runtimeErrors,
  networkFailures,
  finalState: finalState.result?.value,
  animatedTargets,
};
await fs.writeFile(new URL('summary.json', outputDir), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
socket.close();
