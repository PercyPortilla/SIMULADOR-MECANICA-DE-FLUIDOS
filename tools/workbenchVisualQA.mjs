// PULPA LAB — CDP screenshot and functional smoke of SCIENTIFIC modules only.
// Requires local Vite preview 127.0.0.1:8844 and one Chrome QA process on :9336.
// Does not inspect or modify Planta General / Bernoulli-Euler scenes.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const endpoint = 'http://127.0.0.1:9336/json';
const target = (await (await fetch(endpoint)).json())
  .find((candidate) => candidate.type === 'page' && candidate.url.includes('127.0.0.1:8844/'));
if (!target) throw new Error('Chrome QA page unavailable');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((done, fail) => {
  ws.addEventListener('open', done, { once: true });
  ws.addEventListener('error', fail, { once: true });
});
const callbacks = new Map();
let seq = 0;
const errors = [];
ws.addEventListener('message', (event) => {
  const packet = JSON.parse(event.data);
  if (packet.method === 'Runtime.exceptionThrown') {
    errors.push(packet.params.exceptionDetails.text);
  }
  if (!callbacks.has(packet.id)) return;
  const resolve = callbacks.get(packet.id);
  callbacks.delete(packet.id);
  resolve(packet);
});
async function call(method, params = {}) {
  const id = ++seq;
  const result = new Promise((done) => callbacks.set(id, done));
  ws.send(JSON.stringify({ id, method, params }));
  const packet = await result;
  if (packet.error) throw new Error(JSON.stringify(packet.error));
  return packet.result;
}
async function evalJs(expression) {
  const result = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function image(name) {
  await evalJs('window.scrollTo({top:0,behavior:"instant"})');
  await new Promise((r) => setTimeout(r, 160));
  const screenshot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(resolve('qa-artifacts/ui-transform', name), Buffer.from(screenshot.data, 'base64'));
}
await call('Page.enable');
await call('Runtime.enable');
await call('Page.reload', { ignoreCache: true });
await new Promise((done) => setTimeout(done, 900));
const dest = resolve('qa-artifacts/ui-transform');
mkdirSync(dest, { recursive: true });
const state = {};
for (let n = 0; n < 65; n++) {
  await new Promise((done) => setTimeout(done, 200));
  const ready = await evalJs("Boolean(document.body.classList.contains('ui-workbench') && document.querySelector('#balance-tab-root .wb-section') && document.querySelector('#balance-summary .wb-metric'))").catch(() => false);
  if (ready) break;
  if (n === 64) throw new Error('UI did not start in the scientific balance tab');
}
state.start = await evalJs(`(() => ({
  title:document.title, tab:document.body.dataset.workbenchTab,
  workbench:document.body.classList.contains('ui-workbench'),
  activeSections:document.querySelectorAll('#balance-tab-root .wb-section').length,
  metrics:document.querySelectorAll('#balance-summary .wb-metric').length,
  railDisplay:getComputedStyle(document.querySelector('.wb-rail')).display,
  topbarDisplay:getComputedStyle(document.querySelector('.topbar')).display,
  modelText:document.querySelector('#balance-summary .wb-metric-reading')?.textContent?.trim(),
  contentBackground:getComputedStyle(document.querySelector('.content')).backgroundColor,
  viewportWidth:document.documentElement.clientWidth,
  pageOverflow:document.documentElement.scrollWidth - document.documentElement.clientWidth,
}))()`);
await image('01-hydraulic-desktop.png');

for (const [tab, filename] of [
  ['curves','02-results-desktop.png'],
  ['memory','03-memory-desktop.png'],
  ['academy','04-academy-desktop.png'],
]) {
  await evalJs(`document.querySelector('#workspace-tab-${tab}').click()`);
  await new Promise((r) => setTimeout(r, 250));
  state[tab] = await evalJs(`(() => {
    return {
      selected:document.querySelector('#workspace-tab-${tab}').getAttribute('aria-selected'),
      title:document.querySelector('#workspace-panel-${tab} h2')?.textContent,
      metrics:document.querySelectorAll('#${tab}-summary .wb-metric').length,
      curves:document.querySelectorAll('#curves-tab-root .science-chart').length,
      memoSections:document.querySelectorAll('#memory-tab-root .wb-memory-section').length,
      academicColumns:document.querySelectorAll('#academy-tab-root .wb-academic-select, #academy-tab-root .wb-academic-experiments').length,
      pageOverflow:document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()`);
  await image(filename);
}
state.drawer = await evalJs(`(() => {
  document.querySelector('#wb-command-parameters').click();
  const sidebar=document.querySelector('#parameters-sidebar');
  const open=getComputedStyle(sidebar).display;
  document.querySelector('.wb-parameters-close').click();
  return {open,close:getComputedStyle(sidebar).display,
    remainingClass:document.body.classList.contains('wb-parameters-open')};
})()`);
await call('Emulation.setDeviceMetricsOverride', {
  width: 390, height: 844, deviceScaleFactor: 1, mobile: true,
  screenWidth: 390, screenHeight: 844,
});
await new Promise((r) => setTimeout(r, 350));
state.mobile = await evalJs(`(() => ({
  selected:document.body.dataset.workbenchTab,
  viewportWidth:document.documentElement.clientWidth,
  pageOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
  railPosition:getComputedStyle(document.querySelector('.wb-rail')).position,
  gridColumns:getComputedStyle(document.querySelector('.content')).gridTemplateColumns,
  academicColumns:getComputedStyle(document.querySelector('#academy-tab-root .academic-case-panel')).gridTemplateColumns,
  activeNavigationVisible:(() => {
    const nav=document.querySelector('.workspace-tabs');
    const active=nav.querySelector('[aria-selected="true"]');
    const outer=nav.getBoundingClientRect(), inner=active.getBoundingClientRect();
    return inner.left >= outer.left - 2 && inner.right <= outer.right + 2;
  })(),
}))()`);
await image('05-academy-mobile.png');
state.mobileCurves = await evalJs(`(() => {
  document.querySelector('#workspace-tab-curves').click();
  return {selected:document.body.dataset.workbenchTab, charts:document.querySelectorAll('#curves-tab-root .science-chart').length};
})()`);
await image('06-results-mobile.png');
await call('Emulation.clearDeviceMetricsOverride');
state.circuitPreservation = await evalJs(`(() => {
  document.querySelector('#workspace-tab-circuit').click();
  return {active:document.body.dataset.workbenchTab,
    redesignClass:document.body.classList.contains('ui-workbench'),
    railDisplay:getComputedStyle(document.querySelector('.wb-rail')).display,
    sceneCanvasPresent:Boolean(document.querySelector('#environment-canvas'))};
})()`);
const report = { state, runtimeExceptions: errors };
writeFileSync(resolve(dest, 'visual-qa.json'), JSON.stringify(report, null, 2));
ws.close();
console.log(JSON.stringify(report, null, 2));
if (!state.start.workbench || state.start.activeSections < 4 ||
    state.start.metrics !== 4 || state.start.railDisplay !== 'flex' ||
    state.start.topbarDisplay !== 'none' || state.curves.curves !== 4 ||
    state.memory.memoSections !== 7 || state.academy.academicColumns !== 2 ||
    state.drawer.open === 'none' || state.drawer.close !== 'none' ||
    state.mobileCurves.charts !== 4 || !state.mobile.activeNavigationVisible ||
    state.circuitPreservation.redesignClass ||
    state.circuitPreservation.railDisplay !== 'contents') {
  process.exitCode = 1;
}
