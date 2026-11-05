/** T19–T21: real Chrome/CDP checks of the shared 3D page shell.
 * Reuse one externally running Chrome QA process (no browser spawning here).
 * No scene/solver/GLB writes; viewport screenshots are Chrome captures only.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const port = process.env.PULPA_QA_PORT ?? '8848';
const cdp = process.env.PULPA_QA_CDP_PORT ?? '9340';
const output = resolve(process.env.PULPA_QA_REPORT_DIR ?? 'qa-artifacts/t19-3d');
mkdirSync(output, { recursive: true });
const pages = await (await fetch(`http://127.0.0.1:${cdp}/json/list`)).json();
const page = pages.find((item) => item.type === 'page' && item.url.startsWith(`http://127.0.0.1:${port}/`));
if (!page) throw new Error('T19_CHROME_PAGE_MISSING');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});
let nextId = 0;
const pending = new Map();
const runtimeExceptions = [];
ws.addEventListener('message', ({ data }) => {
  const packet = JSON.parse(data);
  if (packet.method === 'Runtime.exceptionThrown') runtimeExceptions.push(packet.params?.exceptionDetails?.text ?? 'JS_ERROR');
  const resolver = pending.get(packet.id);
  if (resolver) {
    pending.delete(packet.id);
    packet.error ? resolver.reject(new Error(packet.error.message)) : resolver.resolve(packet.result);
  }
});
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
async function evaluate(expression) {
  const packet = await call('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (packet.exceptionDetails) throw new Error(packet.exceptionDetails.text ?? 'T19_EVALUATION_ERROR');
  return packet.result?.value;
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(expression, max = 75, intervalMs = 400) {
  for (let i = 0; i < max; i += 1) {
    const value = await evaluate(expression).catch(() => false);
    if (value) return value;
    await delay(intervalMs);
  }
  throw new Error(`T19_WAIT_EXHAUSTED ${expression}`);
}
async function shot(name) {
  const packet = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  writeFileSync(join(output, name), Buffer.from(packet.data, 'base64'));
}
const report = { checks: {}, screenshots: [], runtimeExceptions, started: new Date().toISOString() };
function check(name, data, predicate) {
  report.checks[name] = data;
  if (!predicate(data)) throw new Error(`T19_CHECK_FAILED: ${name}: ${JSON.stringify(data)}`);
}
try {
  await call('Page.enable');
  await call('Runtime.enable');
  await call('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 900, deviceScaleFactor: 1, mobile: false,
  });
  await call('Page.navigate', { url: `http://127.0.0.1:${port}/?tab=circuit` });
  await until(`Boolean(document.querySelector('#environment-canvas') && document.querySelector('#workspace-tab-circuit') && document.body.classList.contains('wb-3d-workspace'))`);
  await delay(450);
  check('generalDesktop', await evaluate(`(() => {
    const canvas=document.querySelector('#environment-canvas');
    const area=canvas?.getBoundingClientRect();
    return {
      tab:document.body.dataset.workbenchTab,
      unified:document.body.classList.contains('ui-workbench'),
      railDisplay:getComputedStyle(document.querySelector('.wb-rail')).display,
      heading:document.querySelector('.wb-3d-intro h2')?.textContent,
      views:document.querySelectorAll('.wb-3d-selector button').length,
      cameras:document.querySelectorAll('#camera-switcher [data-camera]').length,
      sceneCanvasWidth:area?.width,sceneCanvasHeight:area?.height,
      sceneCardVisible:!document.querySelector('#workspace-panel-circuit').hidden,
      responsiveOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
    };
  })()`), (v) => v.tab === 'circuit' && v.unified && v.railDisplay === 'flex'
    && v.views === 2 && v.cameras >= 8 && v.sceneCanvasWidth > 300
    && v.sceneCanvasHeight > 280 && v.sceneCardVisible && v.responsiveOverflow === 0);
  await shot('01-general-workbench-desktop.png');report.screenshots.push('01-general-workbench-desktop.png');

  await until(`Boolean(document.querySelector('#v57EnterEulerLab') && !document.querySelector('#v57EnterEulerLab').disabled && !document.querySelector('.wb-3d-selector [data-wb-3d-mode="euler"]').disabled)`, 120, 500);
  check('generalCameraSwitch', await evaluate(`(() => {
    const choices=[...document.querySelectorAll('#camera-switcher [data-camera]')];
    const other=choices.find((b)=>b.dataset.camera!=='general');
    other?.click();
    const switched=other?.classList.contains('active')===true;
    const restored=choices.find((b)=>b.dataset.camera==='general');
    restored?.click();
    return { switched,restored:restored?.classList.contains('active')===true,buttons:choices.length };
  })()`), (v) => v.switched && v.restored && v.buttons >= 8);
  report.checks.beforeEnterEuler = await evaluate(`(() => ({
    nativeDisabled:document.querySelector('#v57EnterEulerLab').disabled,
    selectorDisabled:document.querySelector('.wb-3d-selector [data-wb-3d-mode="euler"]').disabled,
    labReady:window.__PULPA_MAIN_PRESENTATION_QA__?.().labReady,
    labActive:window.__PULPA_MAIN_PRESENTATION_QA__?.().labActive,
  }))()`);
  await evaluate(`document.querySelector('.wb-3d-selector [data-wb-3d-mode="euler"]').click()`);
  report.checks.afterEnterEuler = await evaluate(`(() => ({
    nativeDisabled:document.querySelector('#v57EnterEulerLab').disabled,
    selectorDisabled:document.querySelector('.wb-3d-selector [data-wb-3d-mode="euler"]').disabled,
    bodyClasses:document.body.className,
    labActive:window.__PULPA_MAIN_PRESENTATION_QA__?.().labActive,
    tab:document.body.dataset.workbenchTab,
  }))()`);
  await until(`Boolean(document.body.classList.contains('v57-industrial'))`);
  await delay(550);
  check('eulerDesktop', await evaluate(`(() => {
    const panel=document.querySelector('#workspace-panel-circuit').getBoundingClientRect();
    const canvas=document.querySelector('#environment-canvas').getBoundingClientRect();
    const rail=document.querySelector('.wb-rail').getBoundingClientRect();
    const top=document.querySelector('.topbar').getBoundingClientRect();
    const state=window.__PULPA_MAIN_PRESENTATION_QA__?.();
    return {
      labActive:document.body.classList.contains('v57-industrial'),
      railDisplay:getComputedStyle(document.querySelector('.wb-rail')).display,
      modeButtonActive:document.querySelector('.wb-3d-selector [data-wb-3d-mode="euler"]').getAttribute('aria-pressed'),
      nativeViewOptions:document.querySelectorAll('#v57View option').length,
      nativeControls:['#v57Realista','#v57Transparencia','#v57GuideAnimation','#v57OpenPipeInspector','#v57InspectP3P4','#v57RailPipe','#v57ExitEulerLab'].every(s=>Boolean(document.querySelector(s))),
      panelWidth:panel.width,panelHeight:panel.height,canvasWidth:canvas.width,canvasHeight:canvas.height,
      railWidth:rail.width,topbarWidth:top.width,
      originalSidebarRelocated:Boolean(document.querySelector('.v57-right-stage .sidebar')),
      labReady:state?.labReady,labState:state?.labActive,
      renderer:state?.model,
      noDocumentOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth===0,
    };
  })()`), (v) => v.labActive && v.railDisplay === 'flex' && v.modeButtonActive === 'true'
    && v.nativeViewOptions >= 6 && v.nativeControls && v.panelWidth > 300 && v.panelHeight > 250
    && v.canvasWidth > 300 && v.canvasHeight > 250 && v.railWidth > 170
    && v.topbarWidth > 300 && v.originalSidebarRelocated && v.labReady && v.labState && v.noDocumentOverflow);
  await shot('02-euler-workbench-desktop.png');report.screenshots.push('02-euler-workbench-desktop.png');

  check('eulerNativeControls', await evaluate(`(() => {
    const transparent=document.querySelector('#v57Transparencia');
    const realistic=document.querySelector('#v57Realista');
    transparent.click();
    const transparentSelected=transparent.classList.contains('selected');
    realistic.click();
    const realisticRestored=realistic.classList.contains('selected');
    document.querySelector('#v57InspectP3P4').click();
    const auditVisible=!document.querySelector('#v57PumpP3P4Audit').hidden;
    const noWetCertification=window.__PULPA_MAIN_PRESENTATION_QA__?.().p3p4?.certifiedWetMate===false;
    document.querySelector('#v57CloseP3P4Audit').click();
    const auditClosed=document.querySelector('#v57PumpP3P4Audit').hidden;
    return {transparentSelected,realisticRestored,auditVisible,auditClosed,noWetCertification};
  })()`), (v) => Object.values(v).every(Boolean));

  // Validate a real native route view and the independent 3D interior inspection.
  await evaluate(`(() => {const s=document.querySelector('#v57View');s.value='pump';s.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
  await delay(220);
  await evaluate(`document.querySelector('#v57OpenPipeInspector').click()`);
  await until(`Boolean(window.__PULPA_MAIN_PRESENTATION_QA__?.().pipeInspector?.render3DReady || window.__PULPA_MAIN_PRESENTATION_QA__?.().pipeInspector?.render3DError)`, 100, 300).catch(() => false);
  await delay(350);
  check('nativeInterior', await evaluate(`(() => {
    const s=window.__PULPA_MAIN_PRESENTATION_QA__?.();
    const c=document.querySelector('#v57Pipe3DCanvas');
    return {
      labActive:document.body.classList.contains('v57-industrial'),
      pipeCanvasExists:Boolean(c),
      inspectorOpen:s?.pipeInspector?.open,
      pipeReady:s?.pipeInspector?.render3DReady,
      pipeError:s?.pipeInspector?.render3DError,
      pipeVisualization:s?.pipeInspector?.visualization,
      selectedRoute:document.querySelector('#v57View')?.value,
      originalEulerCanvasPresent:Boolean(document.querySelector('#environment-canvas')),
    };
  })()`), (v) => v.labActive && v.pipeCanvasExists && v.inspectorOpen && v.selectedRoute === 'pump' && v.originalEulerCanvasPresent);
  await shot('03-euler-pipe-interior.png');report.screenshots.push('03-euler-pipe-interior.png');

  await evaluate(`document.querySelector('.wb-3d-selector [data-wb-3d-mode="mine"]').click()`);
  await until(`!document.body.classList.contains('v57-industrial')`);
  check('mineRestored', await evaluate(`(() => ({
    tab:document.body.dataset.workbenchTab,
    unified:document.body.classList.contains('ui-workbench'),
    mineSelected:document.querySelector('.wb-3d-selector [data-wb-3d-mode="mine"]').getAttribute('aria-pressed'),
    originalSidebarParent:document.querySelector('.workspace > #parameters-sidebar')!==null,
    nativeLabInactive:window.__PULPA_MAIN_PRESENTATION_QA__?.().labActive===false,
    cameraButtons:document.querySelectorAll('#camera-switcher [data-camera]').length,
    sceneCanvasPresent:Boolean(document.querySelector('#environment-canvas')),
  }))()`), (v) => v.tab === 'circuit' && v.unified && v.mineSelected === 'true'
    && v.originalSidebarParent && v.nativeLabInactive && v.cameraButtons >= 8 && v.sceneCanvasPresent);

  await evaluate(`document.querySelector('.wb-3d-selector [data-wb-3d-mode="euler"]').click()`);
  await until(`document.body.classList.contains('v57-industrial')`);
  await evaluate(`document.querySelector('#workspace-tab-balance').click()`);
  check('moduleSwitchExitsEuler', await evaluate(`(() => ({
    tab:document.body.dataset.workbenchTab,
    labInactive:!document.body.classList.contains('v57-industrial'),
    balanceVisible:!document.querySelector('#workspace-panel-balance').hidden,
    viewportHidden:document.querySelector('#workspace-panel-circuit').hidden,
  }))()`), (v) => v.tab === 'balance' && v.labInactive && v.balanceVisible && v.viewportHidden);

  await call('Emulation.setDeviceMetricsOverride', {
    width: 390,height:844,deviceScaleFactor:1,mobile:true,screenWidth:390,screenHeight:844,
  });
  await delay(280);
  await evaluate(`document.querySelector('#workspace-tab-circuit').click()`);
  check('generalMobile', await evaluate(`(() => ({
    tab:document.body.dataset.workbenchTab,
    width:document.documentElement.clientWidth,
    horizontalOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
    navVisible:getComputedStyle(document.querySelector('.wb-rail')).display,
    canvasWidth:document.querySelector('#environment-canvas').getBoundingClientRect().width,
  }))()`), (v) => v.tab === 'circuit' && v.width === 390 && v.horizontalOverflow === 0 && v.navVisible === 'flex' && v.canvasWidth > 300);
  await shot('04-general-workbench-mobile.png');report.screenshots.push('04-general-workbench-mobile.png');

  await evaluate(`document.querySelector('.wb-3d-selector [data-wb-3d-mode="euler"]').click()`);
  await until(`document.body.classList.contains('v57-industrial')`);
  await delay(350);
  check('eulerMobile', await evaluate(`(() => {
    const canvas=document.querySelector('#environment-canvas').getBoundingClientRect();
    const rail=document.querySelector('.wb-rail').getBoundingClientRect();
    const top=document.querySelector('.topbar').getBoundingClientRect();
    return {
      labActive:document.body.classList.contains('v57-industrial'),
      width:document.documentElement.clientWidth,
      horizontalOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      railVisible:rail.height>100 && rail.width>300,
      topbarVisible:top.height>=55 && top.top>=rail.bottom-2,
      canvasHeight:canvas.height,canvasWidth:canvas.width,
      canvasStartsAfterTopbar:canvas.top>=top.bottom-2,
      nativeViewStillExists:Boolean(document.querySelector('#v57View')),
      nativePipeStillExists:Boolean(document.querySelector('#v57Pipe3DCanvas')),
      rightPanelInitiallyClosed:document.querySelector('#v57RightWorkspace')?.hidden === true,
      rightReopenAvailable:document.querySelector('#v57ReopenIndicators')?.hidden === false,
    };
  })()`), (v) => v.labActive && v.width === 390 && v.horizontalOverflow === 0
    && v.railVisible && v.topbarVisible && v.canvasWidth > 300 && v.canvasHeight > 250
    && v.canvasStartsAfterTopbar && v.nativeViewStillExists && v.nativePipeStillExists
    && v.rightPanelInitiallyClosed && v.rightReopenAvailable);
  await evaluate(`document.querySelector('#v57ReopenIndicators').click()`);
  check('eulerMobileNativePanelReopens', await evaluate(`(() => ({
    rightPanelVisible:!document.querySelector('#v57RightWorkspace').hidden,
    nativeIndicatorsPresent:Boolean(document.querySelector('#v57Flow')),
  }))()`), (v) => v.rightPanelVisible && v.nativeIndicatorsPresent);
  await evaluate(`document.querySelector('#v57CloseRightWorkspace').click()`);
  await shot('05-euler-workbench-mobile.png');report.screenshots.push('05-euler-workbench-mobile.png');
  await call('Emulation.clearDeviceMetricsOverride');
  report.result = runtimeExceptions.length === 0 ? 'PASS' : 'JS_EXCEPTIONS';
} catch (error) {
  report.result = 'FAIL';
  report.failure = String(error?.stack ?? error);
  process.exitCode = 1;
} finally {
  report.finished = new Date().toISOString();
  writeFileSync(join(output, 't19-3d-e2e.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ result: report.result, checks: report.checks, screenshots: report.screenshots, exceptions: runtimeExceptions, failure: report.failure }, null, 2));
  if (report.result !== 'PASS') process.exitCode = 1;
  ws.close();
}
