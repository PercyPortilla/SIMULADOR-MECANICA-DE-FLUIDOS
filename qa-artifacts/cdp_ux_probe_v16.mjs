import fs from 'node:fs/promises';

const port = Number(process.argv[2] || 9223);
const pages = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
const page = pages.find((item) => item.type === 'page' && item.url.includes('127.0.0.1:5173'));
if (!page?.webSocketDebuggerUrl) throw new Error(`No Vite page on CDP ${port}.`);

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
  if (message.method === 'Runtime.exceptionThrown') {
    runtimeErrors.push(message.params?.exceptionDetails?.text || 'Runtime exception');
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

async function screenshot(filename) {
  const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  await fs.writeFile(new URL(`./${filename}`, import.meta.url), Buffer.from(shot.data, 'base64'));
}

await Promise.all([
  send('Runtime.enable'),
  send('Page.enable'),
  send('Emulation.setDeviceMetricsOverride', {
    width: 1600,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  }),
]);
await new Promise((resolve) => setTimeout(resolve, 5000));

await evaluate(`(() => {
  const select = document.querySelector('#inspection-target');
  select.value = 'MILL-01';
  select.dispatchEvent(new Event('change'));
  return true;
})()`);
await new Promise((resolve) => setTimeout(resolve, 1000));

const desktop = await evaluate(`(() => {
  const select = document.querySelector('#inspection-target');
  const guide = document.querySelector('#inspection-guide');
  const viewport = document.querySelector('.scene-viewport');
  const guideRect = guide?.getBoundingClientRect();
  const viewportRect = viewport?.getBoundingClientRect();
  return {
    optionCount: select?.options?.length ?? 0,
    selected: select?.value ?? null,
    guideHidden: guide?.hidden ?? null,
    guideText: guide?.innerText ?? '',
    guideRect: guideRect && { x: guideRect.x, y: guideRect.y, width: guideRect.width, height: guideRect.height },
    viewportRect: viewportRect && { x: viewportRect.x, y: viewportRect.y, width: viewportRect.width, height: viewportRect.height },
    activeCameraButton: document.querySelector('[data-camera].active')?.dataset?.camera ?? null,
  };
})()`);
await screenshot('v16-ux-desktop.png');

await send('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await new Promise((resolve) => setTimeout(resolve, 700));
const mobile = await evaluate(`(() => {
  const guide = document.querySelector('#inspection-guide');
  const viewport = document.querySelector('.scene-viewport');
  const guideRect = guide?.getBoundingClientRect();
  const viewportRect = viewport?.getBoundingClientRect();
  return {
    guideHidden: guide?.hidden ?? null,
    guideRect: guideRect && { x: guideRect.x, y: guideRect.y, width: guideRect.width, height: guideRect.height },
    viewportRect: viewportRect && { x: viewportRect.x, y: viewportRect.y, width: viewportRect.width, height: viewportRect.height },
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: innerWidth,
  };
})()`);
await screenshot('v16-ux-mobile.png');

const summary = { runtimeErrors, desktop, mobile };
await fs.writeFile(new URL('./v16-ux-summary.json', import.meta.url), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
socket.close();
