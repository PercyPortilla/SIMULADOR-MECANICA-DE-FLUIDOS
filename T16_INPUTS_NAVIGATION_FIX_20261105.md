# T16 · Corrección de «Entradas y modelo» (RENOEVE)

## Problema reproducido

En el preview integrado T12, el elemento de navegación **Entradas y modelo** apuntaba a `workspace-tab-circuit`. La función `activate('circuit')` desactivaba `body.ui-workbench`, por lo que el usuario veía el sitio original de Planta General en vez de una pantalla de edición científica.

## Solución implementada

- Pestaña independiente `inputs` (`?tab=inputs`) con la misma presentación científica que Resultados, Hidráulica, Memoria y Academia.
- **No se duplican formularios ni estado:** se trasladan temporalmente los controles existentes de escenario y las secciones reales de parámetros al área científica, preservando listeners, validación y cálculos.
- Al abrir `circuit` desde el módulo científico, los controles originales vuelven a la barra lateral; se restaura la interfaz protegida sin cambios de modelo 3D, Solver, geometrías o cámaras.
- El acceso a Planta General se diferencia claramente como **Planta general · 3D**.
- Vista adaptativa móvil de parámetros y escenarios, bajo `body.ui-workbench:not(.v57-industrial)`; el laboratorio Euler no recibe nuevos estilos.

## Verificaciones

- `npm run build`: PASS; Vite 163 módulos, guard firmado B64 PASS.
- `tools/workbenchT9E2EQA.mjs` con Chrome CDP: PASS de navegación **inputs → circuit → inputs**, 71 controles enlazados, actualización del indicador al editar la velocidad, retorno de formularios y controles del circuito original.
- Enlace directo `?tab=inputs`: la página científica aparece sin mostrar el circuito, en escritorio 1440 px y móvil 390 px. Overflow horizontal = 0 en ambos.
- Regresiones de escenarios, comparación académica, memoria, cuatro SVG, dos CSV, dos HTML y un JSON descargados y verificados; excepciones de JavaScript = 0.
- Capturas auténticas Chrome CDP: `qa-artifacts/t16-inputs/t16-inputs-desktop.png` y `qa-artifacts/t16-inputs/t16-inputs-mobile.png`.
- Evidencia JSON: `qa-artifacts/t16-inputs/t9-e2e-qa.json`.

## Límites

- No modifica la interfaz protegida de Bernoulli–Euler ni los modelos GLB.
- No edita el solver hidráulico/reológico.
- Corrige la experiencia de navegación del preview integrado; **no implica publicación automática a `main`**.
