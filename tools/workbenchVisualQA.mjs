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
async function captureSection(selector, name) {
  await evalJs(`(() => {
    const section=document.querySelector(${JSON.stringify(selector)});
    if (!section) throw new Error('Missing screenshot target');
    section.scrollIntoView({block:'start',behavior:'instant'});
    window.scrollBy({top:-92,behavior:'instant'});
  })()`);
  await new Promise((r) => setTimeout(r, 230));
  const frame = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(resolve('qa-artifacts/ui-transform', name), Buffer.from(frame.data, 'base64'));
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
  calculatedPressureMap:Boolean(document.querySelector('#balance-tab-root .wb-pressure-viz .wb-pressure-bar')),
  pressureLegendItems:document.querySelectorAll('#balance-tab-root .wb-pressure-legend-item').length,
  metrics:document.querySelectorAll('#balance-summary .wb-metric').length,
  railDisplay:getComputedStyle(document.querySelector('.wb-rail')).display,
  topbarDisplay:getComputedStyle(document.querySelector('.topbar')).display,
  modelText:document.querySelector('#balance-summary .wb-metric-reading')?.textContent?.trim(),
  contentBackground:getComputedStyle(document.querySelector('.content')).backgroundColor,
  viewportWidth:document.documentElement.clientWidth,
  pageOverflow:document.documentElement.scrollWidth - document.documentElement.clientWidth,
}))()`);
await image('01-hydraulic-desktop.png');
await captureSection('#balance-tab-root .wb-pressure-viz', '08-pressure-breakdown-desktop.png');

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
      graphExportActions:document.querySelectorAll('#curves-tab-root .wb-chart-export').length,
      memoSections:document.querySelectorAll('#memory-tab-root .wb-memory-section').length,
      academicColumns:document.querySelectorAll('#academy-tab-root .wb-academic-select, #academy-tab-root .wb-academic-experiments').length,
      pageOverflow:document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  })()`);
  await image(filename);
  if (tab === 'curves') {
    await captureSection('#curves-tab-root .wb-section', '09-graphs-export-desktop.png');
  }
}
state.drawer = await evalJs(`(() => {
  document.querySelector('#wb-command-parameters').click();
  const sidebar=document.querySelector('#parameters-sidebar');
  const open=getComputedStyle(sidebar).display;
  document.querySelector('.wb-parameters-close').click();
  return {open,close:getComputedStyle(sidebar).display,
    remainingClass:document.body.classList.contains('wb-parameters-open'),
    restoredFocus:document.activeElement.id};
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
// Verify a saved library name does not silently misidentify changed inputs
// in memory or its generated report. Scenario edits use the actual UI events.
await evalJs(`document.querySelector('#workspace-tab-memory').click()`);
await new Promise((done) => setTimeout(done, 200));
state.memorySaved = await evalJs(`(() => {
  const name = document.querySelector('#scenario-name');
  name.value='QA - Scenario origin';
  document.querySelector('.scenario-more').open=true;
  document.querySelector('#scenario-save-new').click();
  const input=document.querySelector('#field-transport-pipe1-velocityMps');
  const before=input?.value;
  return {
    before,
    savedId:document.querySelector('#scenario-select').value,
    provenance:document.querySelector('.wb-memory-overview dd')?.textContent?.trim(),
    note:document.querySelector('.wb-memory-provenance')?.textContent?.trim(),
  };
})()`);
state.memoryDirty = await evalJs(`(() => {
  const input=document.querySelector('#field-transport-pipe1-velocityMps');
  if (!input) return {inputMissing:true};
  input.value=String(Number(input.value) + 0.3);
  input.dispatchEvent(new Event('change',{bubbles:true}));
  return {inputMissing:false, currentValue:input.value};
})()`);
await new Promise((done) => setTimeout(done, 200));
state.memoryDirty = {
  ...state.memoryDirty,
  ...await evalJs(`(() => ({
    provenance:document.querySelector('.wb-memory-overview dd')?.textContent?.trim(),
    warning:document.querySelector('.wb-memory-provenance')?.textContent?.trim(),
    savedFlag:document.querySelector('.wb-memory-provenance')?.dataset.saved,
  }))()`),
};
await image('07-memory-unsaved-scenario-desktop.png');
state.circuitPreservation = await evalJs(`(() => {
  document.querySelector('#workspace-tab-circuit').click();
  const academic=document.querySelector('.academic-case-panel');
  const sidebar=document.querySelector('#parameters-sidebar');
  return {active:document.body.dataset.workbenchTab,
    redesignClass:document.body.classList.contains('ui-workbench'),
    railDisplay:getComputedStyle(document.querySelector('.wb-rail')).display,
    sceneCanvasPresent:Boolean(document.querySelector('#environment-canvas')),
    academicCasesRestored:sidebar.contains(academic),
    originalCaseSelectDirect:academic.querySelector(':scope > #academic-case-select') !== null,
    originalCompareDirect:academic.querySelector(':scope > #academic-comparator') !== null,
    originalLabDirect:academic.querySelector(':scope > #academic-lab') !== null,
  };
})()`);
state.academicRoundTrip = await evalJs(`(() => {
  document.querySelector('#workspace-tab-academy').click();
  const panel=document.querySelector('#academy-tab-root .academic-case-panel');
  return {
    restoredToAcademy:Boolean(panel),
    caseSelectInFirstColumn:Boolean(panel?.querySelector('.wb-academic-select #academic-case-select')),
    compareInSecondColumn:Boolean(panel?.querySelector('.wb-academic-experiments #academic-comparator')),
    labInSecondColumn:Boolean(panel?.querySelector('.wb-academic-experiments #academic-lab')),
  };
})()`);
const report = { state, runtimeExceptions: errors };
writeFileSync(resolve(dest, 'visual-qa.json'), JSON.stringify(report, null, 2));
ws.close();
console.log(JSON.stringify(report, null, 2));
if (!state.start.workbench || state.start.activeSections < 4 ||
    !state.start.calculatedPressureMap || state.start.pressureLegendItems !== 3 ||
    state.start.metrics !== 4 || state.start.railDisplay !== 'flex' ||
    state.start.topbarDisplay !== 'none' || state.curves.curves !== 4 ||
    state.curves.graphExportActions !== 4 ||
    state.memory.memoSections !== 7 || state.academy.academicColumns !== 2 ||
    state.drawer.open === 'none' || state.drawer.close !== 'none' ||
    state.drawer.restoredFocus !== 'wb-command-parameters' ||
    state.mobileCurves.charts !== 4 || !state.mobile.activeNavigationVisible ||
    !state.circuitPreservation.redesignClass ||
    !state.circuitPreservation.academicCasesRestored ||
    !state.circuitPreservation.originalCaseSelectDirect ||
    !state.circuitPreservation.originalCompareDirect ||
    !state.circuitPreservation.originalLabDirect ||
    !state.academicRoundTrip.caseSelectInFirstColumn ||
    !state.academicRoundTrip.compareInSecondColumn ||
    !state.academicRoundTrip.labInSecondColumn ||
    !state.memorySaved.savedId || state.memorySaved.provenance !== 'QA - Scenario origin' ||
    state.memoryDirty.inputMissing || state.memoryDirty.savedFlag !== 'false' ||
    !state.memoryDirty.provenance?.includes('borrador') ||
    state.circuitPreservation.railDisplay !== 'flex') {
  process.exitCode = 1;
}
