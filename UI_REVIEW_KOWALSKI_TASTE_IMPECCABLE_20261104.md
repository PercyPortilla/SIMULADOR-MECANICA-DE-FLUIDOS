# PULPA LAB · Renovación UX de interfaz estándar

**Fecha:** 2026-11-04 (Perú)
**Fases:** F0–F5 · Kowalski / Taste / Impeccable
**Base protegida:** `308b12110092d5aae3f928fef212248282d18a79`
**Rama:** `feature/ui-kowalski-taste-impeccable-20261104`
**Worktree aislado:** `PULPA_LAB_UI_REVIEW_20261104`

## Alcance y restricciones

- Renovar exclusivamente el puesto de trabajo estándar: parámetros, escenarios, casos académicos, resultados, sensibilidad, curvas y memoria.
- **No modificar** las vistas Planta General y Laboratorio Bernoulli–Euler, sus escenas, cámaras, geometrías, CAD, materiales/animaciones 3D o solver.
- Mantener todas las funciones existentes. No sustituir algoritmos por visualizaciones simuladas.
- La nueva hoja `src/ui/uiReview.css` se aplica sólo cuando `body` **no** lleva `.v57-industrial` (modo laboratorio); no contiene selectores `.scene-*` ni cambia los visores.

## Trabajo realizado por bloque

| Bloque | Resultado | Evidencia |
|---|---|---|
| F0 · Protección | Worktree y rama separados; original intacto | `git diff 308b121 --name-only` |
| F1 · Integridad | Escape de nombres y valores en comparación; confirmación para eliminar/restablecer; guardar como nuevo; impresión de memoria con fallback HTML; barrido de sensibilidad conservado y marcado como obsoleto si cambian parámetros | `src/ui/safeHtml.js`, `src/main.js`, `src/ui/memoryPanel.js`, `src/ui/sensitivityPanel.js` |
| F2 · Accesibilidad | Pestañas con roles/teclado, editor H–Q nombrado por variable y punto, mensajes de error cercanos al campo, curvas con selección por teclado/toque y datos legibles, sonda r/R normalizada; panel móvil plegable con orden DOM/visual coherente | `src/main.js`, `src/ui/curvesPanel.js`, `src/ui/uiReview.css` |
| F3 · UX visual | Cinco áreas de trabajo, incluida **Prácticas académicas**; moved existing academic panel from 332 px sidebar to wide workspace without dropping IDs, controls or handlers; hierarchy, typography and 40–44px controls scoped to standard workspace | `src/main.js`, `src/ui/uiReview.css` |
| F4 · Pruebas | `npm test`: **345/345 PASS**, 91 archivos; `npm run build`: **PASS**, 157 módulos; V57/B64 digest verificado; Chrome CDP en versión compilada comprobó 5 pestañas, academia visible, sidebar móvil, nombre HTML mostrado como texto y **0 imágenes inyectadas** | `tests/ui/uiReview.test.js`, `qa-artifacts/ui-review/browser-smoke.json`, capturas de desktop/móvil |
| F5 · Entrega | Commit aislado y rama preparada para revisión/preview, sin modificar rama principal de producción | `git log` de esta rama |

## Evidencia de preservación

- Preparación y postbuild verificaron SHA-256 V57/B64: `73826D5CB777ED08CD9F20A9DD3171C1964F1F8DE8C570EDFB9F4A802538E306`.
- No existen cambios Git bajo `src/babylon/`, `src/controller/`, `src/core/`, `public/models/`, `blender/`, `src/ui/industrialV57Presentation.*`, `src/ui/eulerLayoutCompact.css` ni `src/ui/slurryPipe*`.
- No se cambió la configuración de Vercel ni se desplegó a producción.

## Hallazgos del smoke test visual

- Escritorio (1424 px de área visible): cinco pestañas de espacio de trabajo, resultados académicos montados y visibles en su propia pestaña, panel de escena excluido de la captura.
- Móvil (emulación 390 px): parámetros ocultos inicialmente y accesibles por botón; la interacción devuelve `aria-expanded=true` y despliega el panel.
- La página muestra un **desbordamiento residual de 19 px** atribuido a `#v57EnterEulerLab` (botón que pertenece a la vista protegida), que termina en x=409 px. **No se modificó** por exclusión expresa de la UI del laboratorio. Las pestañas se desplazan horizontalmente dentro de su propio contenedor.
- Las capturas `academic-desktop.png` y `academic-mobile.png` documentan únicamente el espacio académico de la página; no se reevalúan vistas 3D.

## Regresión y publicación

La rama contiene únicamente cambios de experiencia de la interfaz estándar, tests, script de QA y documentación. Para producción se recomienda una revisión final de la rama en preview; no promover desde esta rama de trabajo sin un merge deliberado a la rama de publicación.
