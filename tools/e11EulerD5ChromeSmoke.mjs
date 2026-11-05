/** E11 one-page CDP smoke. Reuses ONE externally started Chrome process. */
import fs from 'node:fs';

const site = process.env.SITE_PORT || '8843';
const cdp = process.env.CDP_PORT || '9337';
const targets = await (await fetch(`http://127.0.0.1:${cdp}/json/list`)).json();
const target = targets.find(item => item.type === 'page' && item.webSocketDebuggerUrl);
if (!target) throw Error('E11_NO_EXISTING_CDP_PAGE');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});
let seq = 0;
const pending = new Map();
const runtimeErrors = [];
ws.addEventListener('message', ({ data }) => {
  const result = JSON.parse(data);
  if (result.method === 'Runtime.exceptionThrown')
    runtimeErrors.push(result.params?.exceptionDetails?.text ?? 'Runtime error');
  const request = pending.get(result.id);
  if (request) {
    pending.delete(result.id);
    result.error ? request.reject(Error(result.error.message)) : request.resolve(result.result);
  }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const value = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (value.exceptionDetails) throw Error(value.exceptionDetails.text ?? 'E11_JS_ERROR');
  return value.result?.value;
};
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const saveScreenshot = async filename => {
  const image = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(`qa-artifacts/e11/${filename}`, Buffer.from(image.data, 'base64'));
};

try {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: `http://127.0.0.1:${site}/?view=lab` });
  for (let i = 0; i < 55; i++) {
    const ready = await evaluate('Boolean(document.querySelector("#v57EnterEulerLab") && !document.querySelector("#v57EnterEulerLab").disabled)').catch(() => false);
    if (ready) break;
    if (i === 54) throw Error('E11_BROWSER_V57_NOT_READY');
    await pause(500);
  }
  await evaluate('if(!document.body.classList.contains("v57-industrial"))document.querySelector("#v57EnterEulerLab")?.click()');
  let lab = null;
  for (let i = 0; i < 45; i++) {
    lab = await evaluate('window.__PULPA_MAIN_PRESENTATION_QA__?.().fullEulerLab');
    if (lab?.active) break;
    if (lab?.loadState === 'error') throw Error(`E11_BROWSER_GLTF_${lab.loadError}`);
    await pause(700);
  }
  await pause(800);
  await saveScreenshot('e11-euler-real-scene.png');
  const before = await evaluate(`(() => {
    const s=window.__PULPA_MAIN_PRESENTATION_QA__?.();
    return {labActive:s?.labActive,fullEulerLab:s?.fullEulerLab,
      uiControls:['#v57Velocity','#v57Solids','#v57Rheology','#v57GuideAnimation',
        '#v57View','#v57OpenPipeInspector','#v57Pipe3DCanvas'].map(id=>({id,exists:!!document.querySelector(id)})),
      route:location.href,bodyClass:document.body.className};
  })()`);
  await evaluate('document.querySelector("#v57OpenPipeInspector")?.click()');
  for (let i = 0; i < 25; i++) {
    const open = await evaluate('window.__PULPA_MAIN_PRESENTATION_QA__?.().pipeInspector?.render3DReady');
    if (open) break;
    await pause(500);
  }
  await pause(300);
  await saveScreenshot('e11-interior-tube-3d.png');
  const after = await evaluate(`(() => {
    const s=window.__PULPA_MAIN_PRESENTATION_QA__?.();
    return {pipeInspector:s?.pipeInspector,fullEulerLab:s?.fullEulerLab,
      pipe3DVisible:!document.querySelector('#v57Pipe3DCanvas')?.hidden,
      labActive:s?.labActive};
  })()`);
  const report = {before, after, runtimeErrors,
    sceneScreenshot:'qa-artifacts/e11/e11-euler-real-scene.png',
    pipeScreenshot:'qa-artifacts/e11/e11-interior-tube-3d.png',
    result: before.fullEulerLab?.e11D5Lookdev?.active && after.pipeInspector?.render3DReady &&
      before.uiControls.every(x => x.exists) ? 'PASS' : 'VISUAL_QA_NEEDS_REVIEW'};
  fs.writeFileSync('qa-artifacts/e11/e11-browser-smoke.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({result:report.result,labActive:before.fullEulerLab?.active,
    lookdev:before.fullEulerLab?.e11D5Lookdev,pipe3DReady:after.pipeInspector?.render3DReady,
    errors:runtimeErrors.length,controlsPresent:before.uiControls.every(x=>x.exists)},null,2));
  if (report.result !== 'PASS') process.exitCode = 2;
} finally {
  ws.close();
}
