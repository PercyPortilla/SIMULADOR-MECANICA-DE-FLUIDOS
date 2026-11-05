// Browser smoke for the non-3D areas of PULPA LAB, using Chrome CDP.
// Run against a locally served production build with a single Chrome instance
// launched with --remote-debugging-port=9335.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const targets = await (await fetch('http://127.0.0.1:9335/json')).json();
const target = targets.find((item) => item.type === 'page' && item.url.startsWith('http://127.0.0.1:8843/'));
if (!target) throw new Error('The local QA page is not available in Chrome CDP.');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((accept, reject) => {
  ws.addEventListener('open', accept, { once: true });
  ws.addEventListener('error', reject, { once: true });
});

const pending = new Map();
let nextId = 0;
ws.addEventListener('message', ({ data }) => {
  const result = JSON.parse(data);
  if (!result.id || !pending.has(result.id)) return;
  const { resolve: complete, reject } = pending.get(result.id);
  pending.delete(result.id);
  if (result.error) reject(new Error(JSON.stringify(result.error)));
  else complete(result.result);
});
function send(method, params = {}) {
  return new Promise((complete, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve: complete, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
  return response.result.value;
}
async function screenshot(path) {
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(path, Buffer.from(result.data, 'base64'));
}
await send('Page.enable');
await send('Runtime.enable');
await send('Page.reload', { ignoreCache: true });
await new Promise((accept) => setTimeout(accept, 1200));
for (let attempt = 0; attempt < 45; attempt += 1) {
  await new Promise((accept) => setTimeout(accept, 200));
  const ready = await evaluate(`Boolean(document.readyState === 'complete' && document.querySelector('#scenario-save-new') && document.querySelector('#workspace-tab-academy') && document.querySelector('#academic-case-load'))`).catch(() => false);
  if (ready) break;
  if (attempt === 44) throw new Error('The main workspace did not finish initializing.');
}
const qaDir = resolve('qa-artifacts/ui-review');
mkdirSync(qaDir, { recursive: true });

// Only the academic tab is captured. Neither protected 3D scene is inspected.
const desktop = await evaluate(`(() => {
  document.querySelector('[data-workspace-tab="academy"]')?.click();
  const academy = document.querySelector('#academy-tab-root');
  const panel = document.querySelector('.academic-case-panel');
  const tab = document.querySelector('#workspace-tab-academy');
  return {
    title: document.title,
    bodyClasses: document.body.className,
    tabs: document.querySelectorAll('.workspace-tabs [role="tab"]').length,
    academyMounted: Boolean(academy?.contains(panel)),
    academyVisible: !document.querySelector('#workspace-panel-academy')?.hidden,
    scenePanelHidden: Boolean(document.querySelector('#workspace-panel-circuit')?.hidden),
    activeTab: tab?.getAttribute('aria-selected'),
    scenarioButtonPx: getComputedStyle(document.querySelector('#scenario-save')).fontSize,
    academicButtonPx: getComputedStyle(document.querySelector('#academic-case-load')).fontSize,
    desktopWidth: window.innerWidth,
  };
})()`);
await new Promise((accept) => setTimeout(accept, 250));
await screenshot(resolve(qaDir, 'academic-desktop.png'));

// User-controlled scenario text must not be inserted as executable markup.
const security = await evaluate(`(() => {
  const name = document.querySelector('#scenario-name');
  name.value = '<img src=x onerror=alert(1)>';
  document.querySelector('#scenario-save-new').click();
  document.querySelector('#scenario-compare').click();
  const heading = document.querySelector('#engineering-comparison strong');
  return {
    nameAsText: heading?.textContent,
    injectedImageCount: document.querySelectorAll('#engineering-comparison img').length,
    saveNotification: document.querySelector('#scenario-status')?.textContent,
  };
})()`);

await send('Emulation.setDeviceMetricsOverride', {
  width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
  screenWidth: 390, screenHeight: 844,
});
await new Promise((accept) => setTimeout(accept, 250));
const mobile = await evaluate(`(() => {
  const sidebar = document.querySelector('#parameters-sidebar');
  const button = document.querySelector('[data-scroll-target="parameters"]');
  const before = getComputedStyle(sidebar).display;
  button.click();
  const after = getComputedStyle(sidebar).display;
  return {
    width: window.innerWidth,
    tabCount: document.querySelectorAll('.workspace-tabs [role="tab"]').length,
    before, after,
    ariaExpanded: button.getAttribute('aria-expanded'),
    academyMounted: document.querySelector('#academy-tab-root')?.contains(document.querySelector('.academic-case-panel')),
    overflowPx: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    overflowCandidates: [...document.querySelectorAll('body *')].filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.right > document.documentElement.clientWidth + 1 && rect.width > 0;
    }).slice(0, 20).map((el) => ({
      selector: el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).join('.') : ''),
      right: Math.round(el.getBoundingClientRect().right),
      width: Math.round(el.getBoundingClientRect().width),
      top: Math.round(el.getBoundingClientRect().top),
    })),
  };
})()`);
// Closing the parameters drawer leaves the academic workspace for its capture.
await evaluate(`document.querySelector('[data-scroll-target="parameters"]').click()`);
await new Promise((accept) => setTimeout(accept, 250));
await screenshot(resolve(qaDir, 'academic-mobile.png'));

const report = { desktop, mobile, security };
writeFileSync(resolve(qaDir, 'browser-smoke.json'), JSON.stringify(report, null, 2));
ws.close();
console.log(JSON.stringify(report, null, 2));
if (!desktop.academyMounted || !desktop.academyVisible || !desktop.scenePanelHidden ||
    desktop.tabs !== 5 || security.injectedImageCount !== 0 ||
    mobile.after === 'none' || mobile.before !== 'none' || mobile.ariaExpanded !== 'true') {
  process.exitCode = 1;
}
