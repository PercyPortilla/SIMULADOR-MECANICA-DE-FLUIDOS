import fs from 'node:fs/promises';

const port = Number(process.argv[2] || 9231);
const baseUrl = process.argv[3] || 'http://127.0.0.1:4174/?qa=v22-visual-realism';
const outputDir = new URL('./v22-visual-realism/', import.meta.url);
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
    networkFailures.push({ errorText: message.params?.errorText, type: message.params?.type, url: message.params?.requestId });
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
async function camera(id, delay = 850) {
  await evaluate(`document.querySelector('[data-camera=${JSON.stringify(id)}]')?.click()`);
  await wait(delay);
}
async function inspect(id, mode = 'normal') {
  await evaluate(`(() => {
    const select = document.querySelector('#inspection-target');
    const modeSelect = document.querySelector('#inspection-mode');
    if (!select || !Array.from(select.options).some((option) => option.value === ${JSON.stringify(id)})) return false;
    select.value = ${JSON.stringify(id)};
    select.dispatchEvent(new Event('change', { bubbles: true }));
    if (modeSelect && !modeSelect.disabled) {
      modeSelect.value = ${JSON.stringify(mode)};
      modeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    document.querySelector('[data-camera="inspection"]')?.click();
    return true;
  })()`);
  await wait(950);
}

await Promise.all([send('Page.enable'), send('Runtime.enable'), send('Network.enable')]);
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: baseUrl });
await wait(11000);

const boot = await evaluate(`(() => {
  const labels = document.querySelector('#labels-toggle');
  if (labels?.checked) labels.click();
  const animations = document.querySelector('#animations-toggle');
  if (animations && !animations.checked) animations.click();
  return {
    title: document.title,
    releaseTag: document.querySelector('.release-tag')?.textContent?.trim() ?? '',
    academicBadge: document.querySelector('.academic-case-heading small')?.textContent?.trim() ?? '',
    sceneError: document.querySelector('#scene-error')?.hidden === false ? document.querySelector('#scene-error')?.innerText : '',
    earthworkRequested: performance.getEntriesByType('resource').some((entry) => entry.name.includes('RECEPTION-EARTHWORK-V21.glb')),
    earthworkBytes: performance.getEntriesByType('resource').find((entry) => entry.name.includes('RECEPTION-EARTHWORK-V21.glb'))?.transferSize ?? 0,
    targets: Array.from(document.querySelector('#inspection-target')?.options ?? []).map((option) => option.value).filter(Boolean).length,
  };
})()`);

for (const id of ['general', 'reception', 'crushing', 'grinding', 'recovery']) {
  await camera(id);
  await capture(`${id}-desktop`);
}

await inspect('MILL-01', 'normal');
await capture('mill-inspection');
await inspect('PUMP-01', 'interior');
await capture('pump-interior-inspection');
await inspect('CLASS-01', 'interior');
await capture('cyclone-interior-inspection');

const desktop = await evaluate(`(() => ({
  documentWidth: document.documentElement.scrollWidth,
  viewportWidth: window.innerWidth,
  activeCamera: document.querySelector('[data-camera].active')?.dataset?.camera ?? '',
  activeTarget: document.querySelector('#inspection-target')?.value ?? '',
  activeMode: document.querySelector('#inspection-mode')?.value ?? '',
  guide: document.querySelector('#inspection-guide')?.innerText ?? '',
  sceneError: document.querySelector('#scene-error')?.hidden === false ? document.querySelector('#scene-error')?.innerText : '',
  glbResources: performance.getEntriesByType('resource').filter((entry) => entry.name.endsWith('.glb')).length,
}))()`);

await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await wait(500);
await evaluate(`window.scrollTo(0, 0)`);
await camera('reception', 700);
await capture('reception-mobile');
const mobile = await evaluate(`(() => ({
  documentWidth: document.documentElement.scrollWidth,
  viewportWidth: window.innerWidth,
  bodyWidth: document.body.getBoundingClientRect().width,
  releaseTag: document.querySelector('.release-tag')?.textContent?.trim() ?? '',
  sceneCardWidth: document.querySelector('.scene-card')?.getBoundingClientRect().width ?? 0,
}))()`);

const summary = {
  boot: boot.result?.value,
  desktop: desktop.result?.value,
  mobile: mobile.result?.value,
  runtimeErrors,
  networkFailures,
};
await fs.writeFile(new URL('summary.json', outputDir), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
socket.close();
