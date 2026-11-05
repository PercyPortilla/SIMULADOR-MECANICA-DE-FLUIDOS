// Reproducible end-to-end QA of scientific workbench only.
// Run against a local Vite preview with a separate Chrome QA profile.
// Override PULPA_QA_PORT, PULPA_QA_CDP_PORT and PULPA_QA_REPORT_DIR when
// validating an isolated integration worktree.
// Does not render, screenshot or modify protected Planta/Euler 3D views.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const previewPort = process.env.PULPA_QA_PORT ?? '8845';
const cdpPort = process.env.PULPA_QA_CDP_PORT ?? '9337';
const pages = await (await fetch(`http://127.0.0.1:${cdpPort}/json`)).json();
const page = pages.find((candidate) => candidate.type === 'page' && candidate.url.startsWith(`http://127.0.0.1:${previewPort}/`));
if (!page) throw new Error('Local Chrome QA page missing.');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((done, fail) => {
  socket.addEventListener('open', done, { once: true });
  socket.addEventListener('error', fail, { once: true });
});
let nextId = 0;
const pending = new Map();
const exceptions = [];
socket.addEventListener('message', ({ data }) => {
  const packet = JSON.parse(data);
  if (packet.method === 'Runtime.exceptionThrown') exceptions.push(packet.params.exceptionDetails.text);
  const resolver = pending.get(packet.id);
  if (!resolver) return;
  pending.delete(packet.id);
  resolver(packet);
});
async function call(method, params = {}) {
  const id = ++nextId;
  const response = new Promise((resolve) => pending.set(id, resolve));
  socket.send(JSON.stringify({ id, method, params }));
  const packet = await response;
  if (packet.error) throw new Error(`${method}: ${JSON.stringify(packet.error)}`);
  return packet.result;
}
async function evaluate(expression) {
  const response = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
  return response.result.value;
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const qaRoot = resolve(process.env.PULPA_QA_REPORT_DIR ?? 'qa-artifacts/ui-transform');
const downloadRoot = join(qaRoot, 't9-temporary-downloads');
mkdirSync(qaRoot, { recursive: true });
mkdirSync(downloadRoot, { recursive: true });
await call('Page.enable');
await call('Runtime.enable');
try {
  await call('Browser.setDownloadBehavior', {
    behavior: 'allow', downloadPath: downloadRoot, eventsEnabled: true,
  });
} catch {
  await call('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadRoot });
}
await call('Page.reload', { ignoreCache: true });
await sleep(1000);
for (let i = 0; i < 80; i += 1) {
  const ready = await evaluate(`Boolean(document.querySelector('#scenario-save-new') && document.querySelector('#balance-tab-root .wb-npsh-diagnostic'))`).catch(() => false);
  if (ready) break;
  if (i === 79) throw new Error('Application startup failed.');
  await sleep(180);
}

const outcome = { tests: {}, downloads: [], runtimeExceptions: exceptions };
function verify(name, result, predicate) {
  outcome.tests[name] = result;
  if (!predicate(result)) throw new Error(`T9 E2E failed: ${name}: ${JSON.stringify(result)}`);
}
verify('npsh', await evaluate(`(() => ({
  visible: Boolean(document.querySelector('#balance-tab-root .wb-npsh-diagnostic')),
  state: document.querySelector('#balance-tab-root .wb-npsh-diagnostic')?.dataset.state,
  disclaimer: document.querySelector('#balance-tab-root .wb-npsh-caveat')?.textContent,
  pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
}))()`), (v) => v.visible && v.disclaimer?.includes('no lecturas de sensores') && v.pageOverflow === 0);

verify('saveAndCompare', await evaluate(`(() => {
  document.querySelector('#wb-command-parameters').click();
  document.querySelector('#scenario-name').value='QA T9 Escenario base';
  document.querySelector('.scenario-more').open=true;
  document.querySelector('#scenario-save-new').click();
  const selected=document.querySelector('#scenario-select').value;
  const input=document.querySelector('#field-transport-pipe1-velocityMps');
  const baseline=Number(input.value);
  input.value=String(baseline+0.32);
  input.dispatchEvent(new Event('change',{bubbles:true}));
  document.querySelector('#scenario-compare').click();
  const root=document.querySelector('#workbench-scenario-comparison');
  return {
    selected, baseline, modified:Number(input.value),
    activeTab:document.body.dataset.workbenchTab,
    visible:Boolean(root&&!root.hidden),
    technicalRows:root?.querySelectorAll(':scope > .wb-scenario-compare-table tbody tr').length,
    changedRows:root?.querySelectorAll('.wb-scenario-compare-inputs tbody tr').length,
    header:root?.querySelector('header h3')?.textContent,
  };
})()`), (v) => v.selected && v.modified > v.baseline && v.activeTab === 'academy'
  && v.visible && v.technicalRows >= 7 && v.changedRows >= 1 && v.header.includes('QA T9'));

verify('loadRestoresAndInvalidPreserves', await evaluate(`(() => {
  document.querySelector('#wb-command-parameters').click();
  document.querySelector('#scenario-load').click();
  const input=document.querySelector('#field-transport-pipe1-velocityMps');
  const restored=Number(input.value);
  const previous=Number(input.value);
  const select=document.querySelector('#scenario-select');
  const libraryKey='pulpa-lab-simulation-scenarios-v2';
  const existing=JSON.parse(localStorage.getItem(libraryKey)||'[]');
  const invalid={id:'qa-t9-invalid',name:'QA invalid',inputs:{slurry:{solidsMassFraction:7}}};
  localStorage.setItem(libraryKey,JSON.stringify([...existing, invalid]));
  select.add(new Option('QA invalid',invalid.id));
  select.value=invalid.id;
  document.querySelector('#scenario-load').click();
  const afterInvalid=Number(document.querySelector('#field-transport-pipe1-velocityMps').value);
  const warning=document.querySelector('#scenario-status').textContent;
  localStorage.setItem(libraryKey,JSON.stringify(existing));
  select.remove(select.selectedIndex);
  select.value=existing.at(-1)?.id||'';
  return {restored,previous,afterInvalid,warning,selected:select.value};
})()`), (v) => Number.isFinite(v.restored) && v.restored === v.afterInvalid
  && v.warning.includes('Escenario incompatible') && v.selected);

verify('scenarioExports', await evaluate(`(() => {
  document.querySelector('#scenario-export-json').click();
  document.querySelector('#scenario-export-csv').click();
  return {status:document.querySelector('#scenario-status').textContent,
    selected:document.querySelector('#scenario-select').value};
})()`), (v) => Boolean(v.selected));

verify('deleteClosesComparison', await evaluate(`(() => {
  window.confirm=()=>true;
  const selected=document.querySelector('#scenario-select').value;
  document.querySelector('#scenario-delete').click();
  const host=document.querySelector('#workbench-scenario-comparison');
  return {
    deleted:selected,
    selectedAfter:document.querySelector('#scenario-select').value,
    comparisonHidden:!host || host.hidden,
    status:document.querySelector('#scenario-status').textContent,
  };
})()`), (v) => v.deleted && !v.selectedAfter && v.comparisonHidden && v.status.includes('eliminado'));

verify('academicCompareAndLab', await evaluate(`(() => {
  const panel=document.querySelector('#academy-tab-root .academic-case-panel');
  document.querySelector('#academic-compare-run').click();
  const compared=document.querySelector('#academic-comparison-result');
  const lab=document.querySelector('#academic-lab');
  lab.open=true;
  const unanswered=document.querySelector('#academic-lab-run');
  unanswered.click();
  const incomplete=document.querySelector('#academic-lab-status')?.textContent;
  for(const select of document.querySelectorAll('#academic-lab-predictions select')) {
    if(select.options.length>1) {select.selectedIndex=1;select.dispatchEvent(new Event('change',{bubbles:true}));}
  }
  document.querySelector('#academic-lab-run').click();
  return {
    mounted:Boolean(panel),comparisonVisible:!compared.hidden,
    compareRows:compared.querySelectorAll('tbody tr').length,
    incomplete,labResultVisible:!document.querySelector('#academic-lab-result').hidden,
    labRows:document.querySelectorAll('#academic-lab-result tbody tr').length,
    reportEnabled:!document.querySelector('#academic-lab-report').disabled,
  };
})()`), (v) => v.mounted && v.comparisonVisible && v.compareRows >= 1
  && v.incomplete && v.labResultVisible && v.labRows >= 1 && v.reportEnabled);
await evaluate(`document.querySelector('#academic-lab-report').click()`);

await evaluate(`document.querySelector('#workspace-tab-memory').click()`);
await sleep(170);
verify('memoryExportButtons', await evaluate(`(() => {
  const html=document.querySelector('#memo-html');
  const csv=document.querySelector('#memo-csv');
  html.click();csv.click();
  return {csv:Boolean(csv),html:Boolean(html),sections:document.querySelectorAll('#memory-tab-root .wb-memory-section').length};
})()`), (v) => v.csv && v.html && v.sections === 7);

await evaluate(`document.querySelector('#workspace-tab-curves').click()`);
await sleep(150);
verify('chartsKeyboardAndExport', await evaluate(`(() => {
  const cards=[...document.querySelectorAll('#curves-tab-root .science-chart')];
  const exports=[...document.querySelectorAll('#curves-tab-root .wb-chart-export')];
  const first=cards[0].querySelector('.science-hit-point[tabindex="0"]');
  const all=cards[0].querySelectorAll('.science-hit-point');
  first?.focus();
  const before=cards[0].querySelector('.science-point-detail').textContent;
  first?.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
  const active=document.activeElement;
  const focusCount=cards[0].querySelectorAll('.science-hit-point[tabindex="0"]').length;
  for(const button of exports) {if (!button.disabled) button.click();}
  return {charts:cards.length,exports:exports.length,enabled:exports.filter((button)=>!button.disabled).length,
    activeMoved:Boolean(first && active!==first && active.classList.contains('science-hit-point')),
    before,focusCount,points:all.length};
})()`), (v) => v.charts === 4 && v.exports === 4 && v.enabled >= 3
  && v.activeMoved && v.focusCount === 1 && v.points > 1);

await call('Emulation.setDeviceMetricsOverride', {
  width: 390, height: 844, deviceScaleFactor: 1, mobile: true, screenWidth: 390, screenHeight: 844,
});
await sleep(270);
verify('mobile', await evaluate(`(() => ({
  viewport:document.documentElement.clientWidth,
  overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
  tab:document.body.dataset.workbenchTab,
  buttons:document.querySelectorAll('#curves-tab-root .wb-chart-export').length,
}))()`), (v) => v.viewport === 390 && v.overflow === 0 && v.buttons === 4);
await call('Emulation.clearDeviceMetricsOverride');

await sleep(1700);
for (const file of readdirSync(downloadRoot)) {
  const path = join(downloadRoot, file);
  if (!statSync(path).isFile()) continue;
  const bytes = readFileSync(path);
  outcome.downloads.push({ name: file, bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    containsActualSvg: file.endsWith('.svg') ? bytes.includes(Buffer.from('<polyline')) : null,
    containsReportSections: file.endsWith('.html') ? bytes.includes(Buffer.from('html')) : null,
    validScenarioJson: file === 'pulpa-lab-scenario.json'
      ? (() => { try { const data = JSON.parse(bytes.toString('utf8')); return !!data.inputs?.transport?.pipe1; } catch { return false; } })()
      : null,
  });
}
verify('downloadFiles', {
  svg: outcome.downloads.filter((item) => item.name.endsWith('.svg') && item.containsActualSvg).length,
  csv: outcome.downloads.filter((item) => item.name.endsWith('.csv')).length,
  html: outcome.downloads.filter((item) => item.name.endsWith('.html')).length,
  scenarioJson: outcome.downloads.some((item) => item.name === 'pulpa-lab-scenario.json' && item.validScenarioJson),
}, (v) => v.svg >= 3 && v.csv >= 2 && v.html >= 2 && v.scenarioJson);

writeFileSync(join(qaRoot, 't9-e2e-qa.json'), JSON.stringify(outcome, null, 2));
rmSync(downloadRoot, { recursive: true, force: true });
socket.close();
console.log(JSON.stringify(outcome, null, 2));
if (exceptions.length) process.exitCode = 1;
