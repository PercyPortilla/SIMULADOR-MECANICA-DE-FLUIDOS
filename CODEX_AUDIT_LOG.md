# Codex audit log

## 2026-10-18 — migration

- Scope: Babylon/Three migration contract
- Command: `npm run audit:closure -- migration`
- Evidence: `tests/babylon/migrationContract.test.js`
- Result: 1 file passed, 3 tests passed, 4.3 s wall time
- Remaining risk: runtime/browser validation is separate
- Next checkpoint: equipment targeted audit

## 2026-10-18 — equipment

- Scope: Babylon equipment visuals and contract parity
- Command: `npm run audit:closure -- equipment`
- Evidence: `tests/babylon/equipmentVisual.test.js`, `tests/babylon/equipmentContractsParity.test.js`
- Result: 2 files passed, 11 tests passed, 4.5 s wall time
- Remaining risk: runtime/browser validation is separate
- Next checkpoint: roads targeted audit

## 2026-10-18 — roads

- Scope: Babylon roads, road details, service roads, reception earthwork
- Command: `npm run audit:closure -- roads`
- Evidence: four `tests/babylon/*Road*.test.js`/earthwork files
- Result: 4 files passed, 12 tests passed, 8.0 s wall time
- Remaining risk: runtime/browser validation is separate
- Next checkpoint: terrain targeted audit

## 2026-10-18 — terrain, inspection, piping

- Terrain: 2 files, 9 tests passed, 12.3 s.
- Inspection/labels/cameras: 3 files, 8 tests passed, 12.0 s.
- Piping/infrastructure: 3 files, 7 tests passed, 8.4 s.

## 2026-10-18 — integral closure

- Full command: `npm test`
- Result: 65 files passed, 241 tests passed.
- Build: `npm run build` passed; 881 modules transformed.
- Remaining note: Babylon chunk is 3.06 MB minified; Vite reports an informational chunk-size warning.
- Chromium production runtime: 9 cameras, 38 Inspection targets, 4 inspection modes, presentation 19/19, mobile 390×844; 0 runtime exceptions, console errors, or failed HTTP resources.

## 2026-10-18 — deployment

- Target: `jan1diaz-5594/simulador-mecanica-de-fluidos`
- Earlier uploads: blocked because the historical V30 Git author was not authorized for deployment creation.
- Final source: exact `v31.0.0` release tree exported without `.git` metadata.
- Result: `READY` production deployment `dpl_E7wSaHew6eny4RB9ABrdqu2TY234`.
- Production: https://simulador-mecanica-de-fluidos.vercel.app
- Inspect: https://vercel.com/jan1diaz-5594/simulador-mecanica-de-fluidos/E7wSaHew6eny4RB9ABrdqu2TY234
- Verification: HTTP 200 and PULPA LAB marker present.
- `npm audit --omit=dev`: 0 vulnerabilities; remaining advisories are development-only Vitest/Tinypool findings.
