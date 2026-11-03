# L394 — Full L384 Euler loader in the existing Babylon V57 application

**RESULT: PASS REAL BABYLON NullEngine / 13 targeted Vitest mocks; NO-GO INDUSTRIAL WET SOURCE.**

## New isolated materials in feature/euler-pulpa-inspector-20261102

- `public/models/euler/L394_L384_EULER_34_ANIM_FULL_LAB.glb` — exact immutable copy of signed L384 original: **21,018,796 bytes**; SHA-256 `3ea34050240b310a6fe8663d6b66c8f1f07b69b23c4e2473f93819ead33fcf3e`.
- `src/babylon/assets/l394EulerFullLab.js` — real `loadBabylonAssetContainer` Euler-only factory. Validates **34 actual imported `animationGroups`, 13 authored cameras and four renderable native SolidWorks mesh names**, then and only then disables the preloaded V57 host. Uses the **same Babylon scene and camera**; no second canvas or solver. Enter/exit is asynchronous-race-safe. On exit, removes L384 container from scene, restores the exact original V57 host/camera/animations and **keeps the 21 MB asset detached in cache** for re-entry without download; `dispose()` truly frees it. A broken or incomplete GLB fails closed with V57 still enabled.
- `tests/ui/l394EulerFullLab.test.js` — **13/13 PASS**: signed actual 21 MB GLB metadata; 4/34/13 fail-closed validation; scenario/cause test; hidden V57 and preserved camera; normal exit and original disabled host restore; invalid/network error; async loading race; cached re-entry; pump ON/OFF and actual Qout effect on authored clips; dispose; transparent educational CAD material clone.
- `tools/_qa_l394_real_babylon_full_l384.mjs` — **real Babylon v9.31.0 NullEngine test**: imports the actual 21 MB binary from a base64 `data:model/gltf-binary` URI through the genuine glTF 2.0 asset loader and inspects **four real CAD meshes** (L370 304 triangles; L358 564; L364 464; L374B 1538), **34 actual AnimationGroups, 13 cameras**. V57 retained, camera retained, one original probe mesh before and after Euler, L384 container genuinely removed, 2 consecutive enter/leave cycles using **one cached load**, no hierarchy warnings after fixing parenting order. Evidence `qa-artifacts/L394_REAL_BABYLON_NULLENGINE_CACHE_QA.json` and original run `L394_REAL_BABYLON_NULLENGINE_QA.json`.

## UI wiring API — owned by prime; this worker did not edit UI

```js
import {createEulerFullLabL394} from './babylon/assets/l394EulerFullLab.js';
const eulerFull = createEulerFullLabL394({
  scene: environment.scene,
  v57SiteVisual: environment.v57SiteVisual,
  invalidate: ms => environment.invalidateRender?.(ms),
});

await eulerFull.setActive(true);       // only after user enters Euler
eulerFull.setPlaying(true);            // existing animations toggle
eulerFull.setScenario({
  pumpOn: knownPumpOn,
  rpm: knownRpm,                        // omit if unavailable
  qInM3h: knownInletQ,                  // omit if unavailable
  qOutActualM3h: knownEffectiveQ,       // NOT requested slider Q
  speedRatio: knownAnimationSpeed,
});
eulerFull.setTransparency(true);       // optional; only four native CAD meshes
await eulerFull.setActive(false);      // restores same V57 host, retains cache
eulerFull.dispose();                   // permanent unload when page is disposed
```

`setScenario` **does not** estimate Qout/RPM from unrelated data. The main V57 solver exposes some calculated hydraulic results but **not necessarily actual effective pump Qout/RPM**; in that case pump-dependent clips remain safely paused, while unrelated educational mechanical/mill animation may continue. No live sensors, CFD, manufacturer wet-mate, pressure rating or real discharge predictions are inferred.

`setTransparency(bool)` clones and fades **only the four authentic SolidWorks CAD materials** to alpha 0.34; never makes the original HUB, mallas B64 or motor transparent and never edits signed GLB. On off/leave it restores the original material objects; four-material scope and lifecycle are verified by mock test. It is an **educational optical effect**, not a real section plane or wet flow prediction.

## Pending integration gates (not claimed as passed)

- Prime owns `src/ui/industrialV57Presentation.js`: call L394 enter/leave only in the optional Euler tab and **disable L392 fallback while L394 active**; avoid allowing `bernoulliEulerScope`'s V57-only whitelist to hide the new L384 nodes. Keep existing controls and solver intact. This worker did not edit UI, `l392EulerNativeCadOverlay.js`, `vite.config.js`, original V57/L59 or production.
- A real browser WebGL screenshot and integrated main UI workflow are still **NO-GO/unverified**. NullEngine proves real Babylon loading, groups and reversible lifecycle but is **not** a GPU screenshot or end-to-end click test. The previous L386 headless/build stalls were not repeated.
- Even if the user successfully enters/exits Euler and sees the native L384, **B64 original SEG02/HUB/discharge are capped** and the four SolidWorks parts are educational replacements only, with unapproved industrial ID and pressure. **0/15 original industrial wet interfaces certified** remains the honest state.

## Integrity and dependencies

Original V57 remains the authoritative full mine visual. The L394 asset is only loaded after Euler entry. The one-real-NullEngine and 13-unit-test evidence plus SHA receipt identify exactly what is verified. Worker-1 L392 source remains an independent fallback and was not edited. Files from L391 are separately signed in `ENGINEERING_SKILLS/lab_bernoulli_euler_20261031/scope/L391_EULER_WEB_WET_GATE_20261103/`.
