# PULPA LAB V2 — Fase 19A

## Ruta de recuperación definida

Topología de proceso seleccionada para representación:

1. Adsorción con carbón (CIP)
2. Elución
3. Electrowinning
4. Fundición
5. Producto final: barra doré

## Separación de validaciones

- `topologyValidated = true`: la secuencia puede alimentar UI, diagramas y escena 3D.
- `calculationValidated = false`: no existen todavía ecuaciones verificables de recuperación en `src/core/recovery`.
- `canRender3D = true`.
- `canCalculateRecovery = false`.
- `recoveryModel = null`.

`assertRenderableProcessRoute()` permite consumir la topología en la siguiente fase 3D.
`assertValidatedProcessRoute()` continúa bloqueando cualquier cálculo de recuperación no validado.

## Archivos modificados

- `src/process/processRoute.js`
- `src/scene/baseEnvironment.js`
- `tests/processRoute.test.js`
- `tests/scene/baseEnvironment.test.js`

No se modificaron `simulationState`, `simulationController`, `core/recovery`, HTML ni manifests de dependencias.
