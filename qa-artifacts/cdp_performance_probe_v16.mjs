import fs from 'node:fs/promises';

const port = Number(process.argv[2] || 9223);
const label = process.argv[3] || 'baseline';
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
  if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params?.exceptionDetails?.text || 'Runtime exception');
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

await Promise.all([send('Runtime.enable'), send('Page.enable')]);
await new Promise((resolve) => setTimeout(resolve, 4500));

const summary = await evaluate(`(async () => {
  const module = await import('/src/scene/baseEnvironment.js');
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 720;
  canvas.style.cssText = 'position:fixed;left:-10000px;top:0;width:1280px;height:720px';
  document.body.append(canvas);
  const env = module.createBaseEnvironment({ canvas });
  globalThis.__PULPA_PERF_ENV__ = env;
  await new Promise((resolve) => setTimeout(resolve, 12000));
  env.setCamera('general');
  env.setLabelsVisible(false);
  env.setGeotechnicsVisible(false);
  env.setAnimationsEnabled(false);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  env.renderer.render(env.scene, env.cameras.general);

  const raw = module.collectSceneResourceStats(env.environmentRoot);
  let visibleMeshes = 0;
  let visibleShadowCasters = 0;
  let blenderImportedMeshes = 0;
  let fallbackMeshes = 0;
  let hybridMeshes = 0;
  env.environmentRoot.traverse((object) => {
    if (!object.isMesh) return;
    let visible = object.visible;
    let cursor = object.parent;
    while (visible && cursor) { visible = cursor.visible; cursor = cursor.parent; }
    if (visible) {
      visibleMeshes += 1;
      if (object.castShadow) visibleShadowCasters += 1;
    }
    if (object.userData?.blenderImported) blenderImportedMeshes += 1;
    if (object.parent?.userData?.blenderFallback || object.userData?.blenderFallback) fallbackMeshes += 1;
    if (object.userData?.blenderHybridSource || object.parent?.userData?.blenderHybridImported) hybridMeshes += 1;
  });
  const rendererInfo = {
    memory: { ...env.renderer.info.memory },
    render: { ...env.renderer.info.render },
    programs: env.renderer.info.programs?.length ?? null,
  };
  return { raw, visibleMeshes, visibleShadowCasters, blenderImportedMeshes, fallbackMeshes, hybridMeshes, rendererInfo };
})()`);

const result = { label, runtimeErrors, ...summary };
await fs.writeFile(new URL(`./v16-performance-${label}.json`, import.meta.url), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
await evaluate(`(() => { globalThis.__PULPA_PERF_ENV__?.dispose?.(); globalThis.__PULPA_PERF_ENV__ = null; return true; })()`);
socket.close();
