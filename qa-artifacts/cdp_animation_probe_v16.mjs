import fs from 'node:fs/promises';

const outputDir = new URL('./v16-animation-runtime/', import.meta.url);
await fs.mkdir(outputDir, { recursive: true });

const pages = await fetch('http://127.0.0.1:9222/json').then((response) => response.json());
const page = pages.find((item) => item.type === 'page' && item.url.includes('127.0.0.1:4173'));
if (!page?.webSocketDebuggerUrl) throw new Error('No PULPA LAB preview page on CDP 9222.');

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let sequence = 0;
const pending = new Map();
const runtimeErrors = [];
const networkFailures = [];
const glbResponses = new Set();
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
  if (message.method === 'Network.responseReceived') {
    const url = message.params?.response?.url || '';
    if (url.endsWith('.glb')) glbResponses.add(url.split('/').at(-1));
  }
});

function send(method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const evaluate = (expression) => send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });

await Promise.all([send('Page.enable'), send('Runtime.enable'), send('Network.enable')]);
await wait(9000);

await evaluate(`(() => {
  const labels = document.querySelector('#labels-toggle');
  if (labels?.checked) labels.click();
  const animations = document.querySelector('#animations-toggle');
  if (animations && !animations.checked) animations.click();
  return true;
})()`);

async function capture(name) {
  const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  await fs.writeFile(new URL(`${name}.png`, outputDir), Buffer.from(shot.data, 'base64'));
}

const cameras = ['reception', 'crushing', 'grinding', 'leaching', 'recovery'];
for (const camera of cameras) {
  const clicked = await evaluate(`(() => {
    const button = document.querySelector('[data-camera="${camera}"]');
    if (!button) return false;
    button.click();
    return true;
  })()`);
  if (!clicked.result?.value) throw new Error(`Missing camera button: ${camera}`);
  await wait(700);
  await capture(`${camera}-on-a`);
  await wait(1800);
  await capture(`${camera}-on-b`);
}

await evaluate(`(() => {
  const button = document.querySelector('[data-camera="grinding"]');
  button?.click();
  const animations = document.querySelector('#animations-toggle');
  if (animations?.checked) animations.click();
  return animations?.checked ?? null;
})()`);
await wait(700);
await capture('grinding-off-a');
await wait(1800);
await capture('grinding-off-b');

const summary = {
  runtimeErrors,
  networkFailures,
  loadedGlbs: [...glbResponses].sort(),
  cameras,
};
await fs.writeFile(new URL('probe-summary.json', outputDir), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
socket.close();
