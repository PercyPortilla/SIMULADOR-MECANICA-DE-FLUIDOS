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
- Result: 64 files passed, 235 tests passed, 79.1 s.
- Build: `npm run build` passed; 881 modules transformed.
- Remaining note: Babylon chunk is 3.06 MB minified; Vite reports an informational chunk-size warning.

## 2026-10-18 — deployment

- Target: `jan1diaz-5594/simulador-mecanica-de-fluidos`
- Result: uploaded, then `BLOCKED` by Vercel team configuration.
- Inspect: https://vercel.com/jan1diaz-5594/simulador-mecanica-de-fluidos/kqWqJNgNMk58CbNGXVqx7RztgFiY
