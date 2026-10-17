import fs from 'node:fs/promises';

const port = Number(process.argv[2] || 9224);
const pages = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
const page = pages.find((item) => item.type === 'page' && item.url.includes('127.0.0.1:4173'));
if (!page?.webSocketDebuggerUrl) throw new Error(`No production preview page on CDP ${port}.`);

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
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  }),
]);
await new Promise((resolve) => setTimeout(resolve, 6000));

const click = (selector) => evaluate(`(() => {
  const node = document.querySelector(${JSON.stringify(selector)});
  if (!node) return false;
  node.click();
  return true;
})()`);

await click('#presentation-toggle');
await new Promise((resolve) => setTimeout(resolve, 900));
const first = await evaluate(`(() => ({
  active: document.querySelector('#presentation-controls')?.dataset.active,
  selected: document.querySelector('#inspection-target')?.value,
  progress: document.querySelector('#presentation-progress')?.textContent?.trim(),
  guide: document.querySelector('#inspection-guide')?.innerText ?? '',
  camera: document.querySelector('[data-camera].active')?.dataset.camera ?? null,
}))()`);
await screenshot('v17-presentation-desktop.png');

await click('#presentation-next');
await new Promise((resolve) => setTimeout(resolve, 500));
const second = await evaluate(`(() => ({
  selected: document.querySelector('#inspection-target')?.value,
  progress: document.querySelector('#presentation-progress')?.textContent?.trim(),
}))()`);

await click('#presentation-play');
await new Promise((resolve) => setTimeout(resolve, 7900));
const autoplay = await evaluate(`(() => ({
  selected: document.querySelector('#inspection-target')?.value,
  progress: document.querySelector('#presentation-progress')?.textContent?.trim(),
  playing: document.querySelector('#presentation-play')?.getAttribute('aria-pressed'),
}))()`);
await click('#presentation-play');
const paused = await evaluate(`document.querySelector('#presentation-play')?.getAttribute('aria-pressed')`);

await send('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await new Promise((resolve) => setTimeout(resolve, 600));
const mobile = await evaluate(`(() => {
  const controls = document.querySelector('#presentation-controls')?.getBoundingClientRect();
  const guide = document.querySelector('#inspection-guide')?.getBoundingClientRect();
  const viewport = document.querySelector('.scene-viewport')?.getBoundingClientRect();
  return {
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: innerWidth,
    controls: controls && { x: controls.x, y: controls.y, width: controls.width, height: controls.height },
    guide: guide && { x: guide.x, y: guide.y, width: guide.width, height: guide.height },
    viewport: viewport && { x: viewport.x, y: viewport.y, width: viewport.width, height: viewport.height },
  };
})()`);
await screenshot('v17-presentation-mobile.png');

await click('#presentation-toggle');
const exited = await evaluate(`(() => ({
  active: document.querySelector('#presentation-controls')?.dataset.active,
  playerHidden: document.querySelector('#presentation-player')?.hidden,
  guidePresentationClass: document.querySelector('#inspection-guide')?.classList.contains('presentation-summary'),
}))()`);

const summary = {
  runtimeErrors,
  networkFailures,
  first,
  second,
  autoplay,
  paused,
  mobile,
  exited,
};
await fs.writeFile(new URL('./v17-presentation-summary.json', import.meta.url), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
socket.close();
