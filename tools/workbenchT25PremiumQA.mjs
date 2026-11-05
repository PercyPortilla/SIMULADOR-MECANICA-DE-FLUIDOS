/** Reproducible browser QA for T25–T27 premium identity and workflow usability.
 * One existing Chrome CDP instance; uses no mock server and changes no solver.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const previewPort = process.env.PULPA_QA_PORT ?? '8850';
const cdpPort = process.env.PULPA_QA_CDP_PORT ?? '9342';
const dir = resolve(process.env.PULPA_QA_REPORT_DIR ?? 'qa-artifacts/t25-premium');
mkdirSync(dir, { recursive: true });
const pages = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json();
const page = pages.find((entry) => entry.type === 'page' && entry.url.includes(`127.0.0.1:${previewPort}/`));
if (!page) throw new Error('T25 browser page was not found.');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolveOpen, reject) => {
  socket.addEventListener('open', resolveOpen, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
const callbacks = new Map();
const exceptions = [];
let sequence = 0;
socket.addEventListener('message', ({ data }) => {
  const event = JSON.parse(data);
  if (event.method === 'Runtime.exceptionThrown') exceptions.push(event.params?.exceptionDetails?.text ?? 'JavaScript exception');
  const listener = callbacks.get(event.id);
  if (!listener) return;
  callbacks.delete(event.id);
  event.error ? listener.reject(new Error(event.error.message)) : listener.resolve(event.result);
});
const call = (method, params = {}) => new Promise((resolveCall, reject) => {
  const id = ++sequence;
  callbacks.set(id, { resolve: resolveCall, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const data = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (data.exceptionDetails) throw new Error(data.exceptionDetails.text ?? 'T25 expression failed');
  return data.result?.value;
};
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
async function awaitCondition(expression, max = 80) {
  for (let i = 0; i < max; i += 1) {
    if (await evaluate(expression).catch(() => false)) return;
    await sleep(250);
  }
  throw new Error(`Wait expired: ${expression}`);
}
async function capture(name) {
  const data = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(join(dir, name), Buffer.from(data.data, 'base64'));
}
const outcome = { checks: {}, screenshots: [], exceptions, date: new Date().toISOString() };
function verify(name, result, predicate) {
  outcome.checks[name] = result;
  if (!predicate(result)) throw new Error(`T25 check failed: ${name} ${JSON.stringify(result)}`);
}
try {
  await call('Page.enable');
  await call('Runtime.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await call('Page.navigate', { url: `http://127.0.0.1:${previewPort}/?tab=inputs` });
  await awaitCondition(`Boolean(document.querySelector('.wb-brand-mark img')?.complete && document.querySelector('#wb-parameter-search'))`);
  verify('premiumBrand', await evaluate(`(() => {
    const img=document.querySelector('.wb-brand-mark img');
    const mark=img.getBoundingClientRect();
    return {
      tab:document.body.dataset.workbenchTab,
      logoSrc:img.getAttribute('src'),logoLoaded:img.naturalWidth>0,
      markW:mark.width,markH:mark.height,
      wordmark:document.querySelector('.wb-brand-copy strong')?.innerText,
      tagline:document.querySelector('.wb-brand-copy small')?.innerText,
      oldPlMark:document.querySelector('.wb-brand-mark')?.textContent?.trim(),
      favicon:document.querySelector('link[rel="icon"]')?.getAttribute('href'),
      overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
    };
  })()`), (v) => v.tab === 'inputs' && v.logoLoaded && v.logoSrc.includes('/brand/pulpa-lab-mark.svg')
    && v.markW >= 35 && v.markH >= 35 && v.wordmark.includes('PULPA') && v.wordmark.includes('LAB')
    && v.oldPlMark === '' && v.favicon.includes('/brand/pulpa-lab-mark.svg') && v.overflow === 0);
  await capture('01-premium-brand-inputs-desktop.png');outcome.screenshots.push('01-premium-brand-inputs-desktop.png');

  verify('parameterSearchAndLevels', await evaluate(`(() => {
    const host=document.querySelector('#inputs-tab-root');
    const search=host.querySelector('#wb-parameter-search');
    const level=host.querySelector('#wb-parameter-level');
    const total=host.querySelectorAll('#sections > details.parameter-section').length;
    level.value='basic';level.dispatchEvent(new Event('change',{bubbles:true}));
    const basicVisible=[...host.querySelectorAll('#sections > details.parameter-section:not([hidden])')].map(node=>node.dataset.sectionId);
    search.value='velocidad';search.dispatchEvent(new Event('input',{bubbles:true}));
    const searched=[...host.querySelectorAll('#sections > details.parameter-section:not([hidden])')].map(node=>node.dataset.sectionId);
    const matchCount=host.querySelectorAll('#sections > details.parameter-section:not([hidden]) .parameter-field:not([hidden])').length;
    search.value='término-inexistente-1234';search.dispatchEvent(new Event('input',{bubbles:true}));
    const empty=host.querySelector('#wb-parameter-count')?.textContent;
    host.querySelector('#wb-parameter-reset').click();
    const restored=host.querySelectorAll('#sections > details.parameter-section:not([hidden])').length;
    level.value='process';level.dispatchEvent(new Event('change',{bubbles:true}));
    const processVisible=[...host.querySelectorAll('#sections > details.parameter-section:not([hidden])')].map(node=>node.dataset.sectionId);
    host.querySelector('#wb-parameter-reset').click();
    return {total,basicVisible,searched,matchCount,empty,restored,processVisible,levelReset:level.value};
  })()`), (v) => v.total >= 8 && v.basicVisible.length === 4 && v.searched.includes('transport')
    && v.matchCount >= 1 && /No se encontraron/.test(v.empty) && v.restored === v.total
    && v.processVisible.some((id)=>id==='leaching') && v.levelReset === 'all');
  await evaluate(`document.querySelector('.wb-premium-filter').scrollIntoView({block:'start',behavior:'instant'})`);
  await sleep(140);
  await capture('01b-premium-parameter-filters.png');outcome.screenshots.push('01b-premium-parameter-filters.png');

  await evaluate(`document.querySelector('#workspace-tab-circuit').click()`);
  verify('inputsRestoredTo3D', await evaluate(`(() => ({
    tab:document.body.dataset.workbenchTab,
    originalSections:document.querySelectorAll('#parameters-sidebar #sections > details.parameter-section').length,
    hiddenSections:document.querySelectorAll('#parameters-sidebar #sections > details.parameter-section[hidden]').length,
    sceneGuide:Boolean(document.querySelector('.wb-3d-tour-guide summary')),
    cameraCount:document.querySelectorAll('#camera-switcher [data-camera]').length,
  }))()`), (v) => v.tab==='circuit' && v.originalSections>=8 && v.hiddenSections===0 && v.sceneGuide && v.cameraCount>=8);
  await evaluate(`document.querySelector('.wb-3d-tour-guide summary').click()`);
  verify('threeDGuide', await evaluate(`(() => ({ open:document.querySelector('.wb-3d-tour-guide').open, steps:document.querySelectorAll('.wb-3d-tour-guide ol li').length }))()`), (v) => v.open && v.steps===4);
  await capture('02-premium-general-desktop.png');outcome.screenshots.push('02-premium-general-desktop.png');

  await evaluate(`document.querySelector('#workspace-tab-balance').click()`);
  await awaitCondition(`Boolean(document.querySelector('#wb-premium-insight #wb-premium-insight-flow')?.textContent)`);
  verify('engineeringInsight', await evaluate(`(() => ({
    tab:document.body.dataset.workbenchTab,
    flow:document.querySelector('#wb-premium-insight-flow')?.textContent,
    npsh:document.querySelector('#wb-premium-insight-npsh')?.textContent,
    npshState:document.querySelector('#wb-premium-insight')?.dataset.npshState,
    disclaimer:document.querySelector('#wb-premium-insight small')?.textContent,
    guide:document.querySelector('#workspace-panel-balance .wb-premium-guide summary')?.textContent,
    actions:document.querySelectorAll('#wb-premium-insight [data-premium-go]').length,
  }))()`), (v) => v.tab==='balance' && v.flow.includes('Q =') && v.flow.includes('ΔP =')
    && v.npsh.length>12 && v.disclaimer.includes('no lecturas de sensores')
    && v.guide.length>10 && v.actions===2);
  await evaluate(`document.querySelector('#wb-premium-insight').scrollIntoView({block:'center',behavior:'instant'})`);
  await sleep(140);
  await capture('03-premium-analysis-desktop.png');outcome.screenshots.push('03-premium-analysis-desktop.png');
  await evaluate(`document.querySelector('#wb-premium-insight [data-premium-go="curves"]').click()`);
  verify('scientificJumpAndGuides', await evaluate(`(() => {
    const curves= document.body.dataset.workbenchTab==='curves';
    const charts=document.querySelectorAll('#curves-tab-root article.science-chart').length;
    const curveGuide=Boolean(document.querySelector('#workspace-panel-curves .wb-premium-guide'));
    document.querySelector('#workspace-tab-memory').click();
    const memoryGuide=Boolean(document.querySelector('#workspace-panel-memory .wb-premium-guide'));
    document.querySelector('#workspace-tab-academy').click();
    const academyGuide=Boolean(document.querySelector('#workspace-panel-academy .wb-premium-guide'));
    return {curves,charts,curveGuide,memoryGuide,academyGuide,finalTab:document.body.dataset.workbenchTab};
  })()`), (v) => v.curves && v.charts>=4 && v.curveGuide && v.memoryGuide && v.academyGuide && v.finalTab==='academy');

  await call('Emulation.setDeviceMetricsOverride', { width: 390,height:844,deviceScaleFactor:1,mobile:true,screenWidth:390,screenHeight:844 });
  await evaluate(`document.querySelector('#workspace-tab-inputs').click()`);
  await sleep(130);
  verify('mobilePremiumInputs', await evaluate(`(() => {
    const img=document.querySelector('.wb-brand-mark img');
    const search=document.querySelector('#wb-parameter-search').getBoundingClientRect();
    return { tab:document.body.dataset.workbenchTab,logoLoaded:img.complete&&img.naturalWidth>0,
      overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      searchWidth:search.width, filtersVisible:search.height>0,
      sections:document.querySelectorAll('#inputs-tab-root #sections > details.parameter-section:not([hidden])').length };
  })()`), (v) => v.tab==='inputs' && v.logoLoaded && v.overflow===0 && v.filtersVisible && v.searchWidth>220 && v.sections>=8);
  await evaluate(`window.scrollTo({top:0,behavior:'instant'})`);
  await capture('04-premium-inputs-mobile.png');outcome.screenshots.push('04-premium-inputs-mobile.png');
  await call('Emulation.clearDeviceMetricsOverride');
  outcome.result = exceptions.length===0 ? 'PASS' : 'JS_EXCEPTIONS';
} catch (error) {
  outcome.result='FAIL';outcome.error=String(error?.stack ?? error);process.exitCode=1;
} finally {
  outcome.finished=new Date().toISOString();
  writeFileSync(join(dir,'t25-e2e.json'),JSON.stringify(outcome,null,2)+'\n');
  console.log(JSON.stringify(outcome,null,2));
  if(outcome.result!=='PASS')process.exitCode=1;
  socket.close();
}
