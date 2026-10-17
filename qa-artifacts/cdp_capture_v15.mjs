import fs from 'node:fs/promises';
import path from 'node:path';

const outputDir = new URL('./v15-zones/', import.meta.url);
await fs.mkdir(outputDir, { recursive: true });

const pages = await fetch('http://127.0.0.1:9222/json').then((response) => response.json());
const page = pages.find((item) => item.type === 'page' && item.url.includes('127.0.0.1:4173'));
if (!page?.webSocketDebuggerUrl) throw new Error('No se encontró la página V15 en el puerto CDP 9222.');

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let sequence = 0;
const pending = new Map();
const runtimeErrors = [];
const networkFailures = [];
const moduleResponses = new Set();

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
    if (url.includes('/models/pulpa-blender/v15-modules/')) moduleResponses.add(url.split('/').at(-1));
  }
});

function send(method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const evaluate = (expression) => send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });

await Promise.all([send('Page.enable'), send('Runtime.enable'), send('Network.enable'), send('Log.enable')]);
await wait(12000);

await evaluate(`(() => {
  const labels = document.querySelector('#labels-toggle');
  if (labels?.checked) labels.click();
  return document.querySelector('#view-title')?.textContent || '';
})()`);

const cameras = ['general', 'reception', 'crushing', 'grinding', 'leaching', 'recovery'];
for (const camera of cameras) {
  const result = await evaluate(`(() => {
    const button = document.querySelector('[data-camera="${camera}"]');
    if (!button) return { ok: false, reason: 'button missing' };
    button.click();
    return { ok: true, title: document.querySelector('#view-title')?.textContent || '' };
  })()`);
  if (!result.result?.value?.ok) throw new Error(`No se pudo activar cámara ${camera}.`);
  await wait(1800);
  const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  await fs.writeFile(new URL(`v15-${camera}.png`, outputDir), Buffer.from(shot.data, 'base64'));
}

const inspection = await evaluate(`(() => {
  const select = document.querySelector('#inspection-target');
  if (!select) return false;
  select.value = 'MILL-01';
  select.dispatchEvent(new Event('change'));
  return true;
})()`);
if (inspection.result?.value) {
  await wait(1500);
  const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  await fs.writeFile(new URL('v15-inspection-mill.png', outputDir), Buffer.from(shot.data, 'base64'));
}

const summary = {
  cameras,
  runtimeErrors,
  networkFailures,
  loadedHybridModules: [...moduleResponses].sort(),
};
await fs.writeFile(new URL('cdp-summary.json', outputDir), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
socket.close();
