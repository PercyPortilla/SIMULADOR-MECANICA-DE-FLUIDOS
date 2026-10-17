import fs from 'node:fs/promises';

const outputDir = new URL('./v16-animation-closeups/', import.meta.url);
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
});

function send(method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const evaluate = (expression) => send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });

await Promise.all([send('Page.enable'), send('Runtime.enable')]);
await send('Page.reload', { ignoreCache: true });
await wait(9000);

await evaluate(`(() => {
  const labels = document.querySelector('#labels-toggle');
  if (labels?.checked) labels.click();
  const animations = document.querySelector('#animations-toggle');
  if (animations && !animations.checked) animations.click();
  return Array.from(document.querySelector('#inspection-target')?.options ?? []).map(o => o.value);
})()`);

async function capture(name) {
  const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  await fs.writeFile(new URL(`${name}.png`, outputDir), Buffer.from(shot.data, 'base64'));
}

const targets = [
  ['APRON-FEEDER', 'normal'],
  ['PRIMARY-CRUSHER', 'normal'],
  ['MILL-01', 'normal'],
  ['SLURRY-PUMP-01', 'normal'],
  ['CLASS-01', 'interior'],
  ['R-01', 'interior'],
  ['CIP-ADSORPTION', 'interior'],
  ['SMELTING-FURNACE', 'normal'],
  ['EXCAVATOR-01', 'normal'],
  ['LOADER-01', 'normal'],
  ['TRUCK-01', 'normal'],
];

const availability = {};
for (const [target, mode] of targets) {
  const selected = await evaluate(`(() => {
    const select = document.querySelector('#inspection-target');
    const camera = document.querySelector('[data-camera="inspection"]');
    if (!select || !camera || !Array.from(select.options).some(o => o.value === ${JSON.stringify(target)})) return false;
    select.value = ${JSON.stringify(target)};
    select.dispatchEvent(new Event('change', { bubbles: true }));
    camera.click();
    const modeSelect = document.querySelector('#inspection-mode');
    if (modeSelect && !modeSelect.disabled) {
      modeSelect.value = ${JSON.stringify(mode)};
      modeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return true;
  })()`);
  availability[target] = Boolean(selected.result?.value);
  if (!availability[target]) continue;
  await wait(900);
  await capture(`${target}-a`);
  await wait(1400);
  await capture(`${target}-b`);
}

const summary = { runtimeErrors, availability };
await fs.writeFile(new URL('closeup-summary.json', outputDir), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
socket.close();
