# T19–T21 · Módulo 06 unificado: Planta General + Laboratorio Bernoulli–Euler

## Autorización y alcance

El usuario pidió expresamente incorporar los entornos y vistas de **Planta General** y **Laboratorio Euler** al diseño de página científico de PULPA LAB. Esta instrucción amplía el alcance anterior que excluía el rediseño de ambas vistas. Se permite cambiar exclusivamente su presentación y navegación, sin alterar solver, equipos, cotas, cámaras, mallas GLB ni modificar geometrías para aparentar conexiones físicas.

## Implementación

- El módulo `06` se titula **Entornos 3D**. Su selector distingue **Planta general** y **Laboratorio Euler**.
- Planta General: navegación lateral oscura, encabezado editorial científico, canvas real V57/B64, **nueve cámaras**, menús originales de inspección, animaciones, etiquetas y modo presentación.
- Bernoulli–Euler: comparte el mismo menú lateral, pero mantiene la **barra nativa del laboratorio**, el tramo molino → SUMP → bomba → ocho ciclones, sus modos Realista/Transparencia, siete selecciones de enfoque, análisis P3→P4, barra de control inferior y panel derecho.
- Inspección interior: continúa utilizando `#v57Pipe3DCanvas` y el mismo `createSlurryPipe3DScene`; no es una simulación CFD ni altera la pieza CAD de origen.
- Cambio a un módulo científico: sale de la vista Euler mediante el evento original y restaura la escena/cámara de mina antes de ocultar el panel. No deja activo el laboratorio detrás de otra pestaña.
- En pantallas estrechas el panel derecho de Euler inicia contraído para dejar ver el entorno y es reabrible mediante el botón nativo **Panel**. No se eliminan controles, solo se modifica el estado inicial de presentación móvil.
- La interfaz original de Euler se reutiliza dentro del shell, sin reconstruir sus controles ni duplicar el estado físico.

## Archivos

- `src/main.js`: selector real de entornos, navegación, clases de shell, salida y reentrada reversibles.
- `src/ui/threeDWorkbench.css`: estilos de Planta General y Euler para escritorio/móvil; no modifica las escenas Babylon.
- `tools/workbenchT19ThreeDQA.mjs`: E2E Chrome CDP de ambos entornos, selector, estado de canvas, cámara, laboratorio, tubería interior, movilidad y salida a ciencia.
- `tools/workbenchT9E2EQA.mjs`: regresión científica adaptada a la nueva autorización y enlace directo a Balance.
- `tools/workbenchVisualQA.mjs`: aserciones históricas actualizadas para el nuevo alcance visual permitido.

## Evidencias

- Compilación Vite: 164 módulos transformados, guard V57/B64 firmado PASS.
- `npm test -- tests`: **370/370 PASS** en 99 archivos (solver, Babylon, Euler, escenarios y regresión UI).
- E2E científico `tools/workbenchT9E2EQA.mjs`: PASS de Entradas, análisis, memoria, prácticas, móvil y 9 exportaciones reales (4 SVG, 2 CSV, 2 HTML, 1 JSON), 0 excepciones JS.
- Chrome CDP real: acceso a Planta General, entrada/salida de Euler, función de inspector de tubería y regreso a otras pestañas PASS; cero excepciones JavaScript.
- E2E T19 adicional: cambio y restauración de cámara de mina, modos Realista/Transparencia de Euler, apertura y cierre de auditoría P3→P4 con `certifiedWetMate=false`, y recuperación de panel nativo de indicadores en móvil: PASS.
- Una inspección realmente confirmó `pipeInspector.render3DReady=true`, `render3DError=null`, visualización `babylon 3D educational cutaway`.
- `node tools/e11EulerD5RealAssetQA.mjs`: PASS, GLB original 21 018 796 bytes con SHA-256 `3ea34050240b310a6fe8663d6b66c8f1f07b69b23c4e2473f93819ead33fcf3e`; 34 animaciones, 13 cámaras importadas, cuatro CAD. La salida regenerada se restaura tras la prueba, sin alterar el artefacto firmado.
- Estado hidráulico de P3→P4: **NO-GO de uniones húmedas**; la apariencia 3D no constituye una certificación industrial.
- Móvil 390 px: entornos visibles, sin desbordamiento horizontal, panel Euler contraído y reabrible.
- Capturas reales, sin denominarlas renders D5: `qa-artifacts/t19-3d/01-general-workbench-desktop.png`, `02-euler-workbench-desktop.png`, `03-euler-pipe-interior.png`, `04-general-workbench-mobile.png`, `05-euler-workbench-mobile.png`.
- Reporte reproducible: `qa-artifacts/t19-3d/t19-3d-e2e.json`.

## Restricciones y publicación

El lookdev de Euler proviene del avance E11 ya integrado y no se ha generado un nuevo render de D5 Render en este bloque. El GLB firmado, mallas, centros, puertos, cámaras y lógica de cálculo no se editan. No debe confundirse un test del canvas con certificación de interfaces hidráulicas reales.

El despliegue de esta rama debe hacerse como **preview**, sin fusionar automáticamente el PR borrador de producción.
