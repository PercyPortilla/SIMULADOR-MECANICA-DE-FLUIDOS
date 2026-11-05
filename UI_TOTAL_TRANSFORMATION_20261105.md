# PULPA LAB · Transformación integral del espacio científico

**Entrega:** 5 de noviembre de 2026 · RENOEVE

## Objetivo

El usuario solicitó una transformación visual real de la página del simulador,
excluyendo expresamente **Planta General** y **Laboratorio Bernoulli–Euler**,
sin perder las herramientas, datos, procesos, animaciones ni cálculos existentes.

## Base y aislamiento

- Base: `85a9237803c74808d9cdab2c26b7e08518365faa`.
- Rama: `feature/ui-total-transform-20261105`.
- Worktree aislado: `PULPA_LAB_UI_TRANSFORM_20261105`.
- Otra tarea E11/D5 estaba utilizando el worktree anterior. No se tocó.
- Solver, controlador, Babylon, CAD, GLB y componentes de ambas vistas protegidas no cambiaron.
- El nuevo aspecto está condicionado a `body.ui-workbench:not(.v57-industrial)`;
  al volver a `circuit`, el shell clásico recupera su distribución.

## Cambio visible por módulo

| Área | Nuevo diseño | Funciones preservadas |
| --- | --- | --- |
| Marco científico | Barra lateral persistente oscura, área clara de gran formato, comando superior, cuatro lecturas operativas derivadas de `getResults`, panel lateral de edición de parámetros | Selección de áreas, escenarios, edición, navegación, validez del modelo |
| Resultados y curvas | Secciones temáticas de reología, transporte y bomba, gráficos amplios, sonda radial en zona separada | Cuatro gráficas, perfiles, selección de puntos, CSV, cálculo real |
| Análisis hidráulico | Diagnóstico por presión/NPSH, energía, presión por tramos, sensibilidad y continuidad | Modelo reológico/hidráulico, tablas, NPSH, análisis de sensibilidad, exportación |
| Memoria y supuestos | Expediente científico de siete capítulos, portada con metadatos, índice lateral, tablas legibles, notas y exportaciones | Cálculos, ecuaciones, advertencias, CSV, HTML, imprimir/guardar PDF |
| Prácticas académicas | Dos columnas: preparación del caso y comparación/experimento; jerarquía didáctica | Biblioteca, comparador A/B, hipótesis, evaluación, informes |
| Móvil | Barra horizontal, layout de una columna, indicadores adaptables y panel de parámetros mediante comando | Acceso a cada módulo y a cada entrada |

## Enlaces profundos de prueba

- `/?tab=balance` — versión de prueba abierta directamente en el nuevo diagnóstico.
- `/?tab=curves` — gráficas y resultados.
- `/?tab=memory` — memoria científica.
- `/?tab=academy` — prácticas académicas.
- La ruta sin `tab` continúa iniciando en Planta General sin rediseñarla.

## Criterios de aceptación

1. **Protección 3D:** ningún cambio en los archivos protegidos; reingreso al circuito debe quitar `ui-workbench` y restablecer `display:contents` del contenedor de navegación.
2. **Datos reales:** las cuatro tarjetas principales leen `getResults()` y presentan `N/D` cuando faltan datos; nunca inventar sensores.
3. **QA navegador:** las cuatro pestañas se renderizan; 4 gráficas, 5 bloques hidráulicos, 7 secciones de memoria y 2 columnas de academia; panel de parámetros abre/cierra.
4. **Escritorio/móvil:** ancho de página sin overflow y sin excepciones JS de la aplicación.
5. **Vitest y build:** ejecutar `npm test` y `npm run build` sin degradación.

## Evidencia generada

- `tools/workbenchVisualQA.mjs` — inspección CDP de los cuatro módulos y retorno a circuito protegido.
- `qa-artifacts/ui-transform/visual-qa.json` — valores y comprobaciones medidos.
- `qa-artifacts/ui-transform/01-hydraulic-desktop.png`.
- `qa-artifacts/ui-transform/02-results-desktop.png`.
- `qa-artifacts/ui-transform/03-memory-desktop.png`.
- `qa-artifacts/ui-transform/04-academy-desktop.png`.
- `qa-artifacts/ui-transform/05-academy-mobile.png`.
- `qa-artifacts/ui-transform/06-results-mobile.png`.

## Resultados comprobados en RENOEVE

- `npm test`: **348/348 casos PASS**, 92 archivos de pruebas (incluidas regresiones Babylon/Euler).
- `npm run build`: **PASS**, 158 módulos transformados en Vite 7.3.7.
- `tools/workbenchVisualQA.mjs`: **PASS**, sin excepciones del runtime, sin desbordamiento horizontal en 1505 px y 390 px.
- El visor de Planta General permanece presente y se restaura cuando se vuelve al área `circuit`.
- Documento V57/B64 verificado con SHA-256:
  `73826D5CB777ED08CD9F20A9DD3171C1964F1F8DE8C570EDFB9F4A802538E306`.
- Ningún cambio Git en `src/babylon/`, `src/controller/`, `src/core/`,
  `src/ui/industrialV57Presentation.*`, `src/ui/eulerLayoutCompact.css`,
  `src/ui/slurryPipe*`, `blender/` o `public/models/`.

## Restricciones explícitas de publicación

La rama de transformación se prepara para *preview*. No se debe mezclar con
las tareas E11/D5, no se debe desplegar directamente sobre producción ni
publicar una versión que modifique archivos de las vistas protegidas.

## Continuación T5–T8 · Ingeniería y experiencia de usuario

La segunda revisión se basó en interacciones reales, no en una auditoría
cosmética. Se aplicaron las siguientes correcciones:

1. **Contribuciones reales de presión:** `src/ui/pressureBreakdown.js` añade
   un balance gráfico de términos distribuidos, locales y estáticos sin alterar
   el solver. Las presiones negativas por descenso se representan del lado
   negativo del eje, sin convertirlas en pérdidas positivas. Ante datos
   incompletos muestra «Sin datos calculables» y alerta si la suma no concilia
   con el total.
2. **Gráficas SVG exportables:** los cuatro SVG científicos originales
   (constitutiva, viscosidad, bomba/sistema y perfil) incluyen «Descargar SVG»,
   un archivo distinto por gráfico con ejes, series, anotaciones y estilos
   incorporados. No se exportan imágenes ilustrativas ajenas al cálculo.
3. **Seguridad de HTML:** los identificadores de segmentos, accesorios,
   estados de bomba y notas de sedimentación se escapan antes de utilizar
   `innerHTML`. Se probó con etiquetas maliciosas de prueba.
4. **Trazabilidad de informes:** la memoria identifica un escenario guardado
   **sólo si coincide con el estado activo**. Si los parámetros difieren,
   se etiqueta «Escenario actual · borrador no guardado» y se explica el motivo
   antes de generar HTML, CSV o imprimir/PDF.
5. **No pérdida de controles del circuito:** cuando se elige «Entradas y
   modelo», el bloque de casos académicos vuelve a su ubicación original en
   la barra lateral, conservando el comparador y laboratorio. Cuando se vuelve
   a «Prácticas académicas», los mismos controles existentes recuperan las
   dos columnas sin duplicar IDs ni perder eventos.
6. **Foco accesible:** al cerrar el editor de parámetros, el teclado retorna
   al control que lo abrió. Los botones SVG se deshabilitan con estilo visible
   cuando su gráfica no tiene datos.

**Evidencia adicional:** `qa-artifacts/ui-transform/07-memory-unsaved-scenario-desktop.png`,
`08-pressure-breakdown-desktop.png` y
`09-graphs-export-desktop.png` documentan los casos críticos.

**Cobertura adicional:** `tests/ui/pressureBreakdown.test.js`,
`tests/ui/workbenchCurvesExport.test.js`,
`tests/ui/scenarioProvenance.test.js` y
`tests/ui/workbenchBalanceSecurity.test.js`.

**Límite de esta QA:** se verificó el retorno al DOM del circuito protegido
y la ausencia de cambios en archivos de Euler; no se afirma haber validado
visualmente todas las animaciones/cámaras de Bernoulli–Euler, que quedaron
fuera de alcance por decisión del usuario.

### Validación de continuidad T5–T8

- **Suite completa:** `npm test` — **360/360 PASS**, 96 archivos (Vite/Vitest y regresión de escenas Babylon).
- **Compilación final:** `npm run build` — **PASS**, 160 módulos, verificación postbuild SHA-256 V57/B64 y sin alteración del solver.
- **Pruebas dirigidas:** 15/15 PASS para presión, exportación SVG, nombres/escape de tablas, memoria de cálculo y procedencia de escenarios.
- **Chrome de escritorio y móvil:** prueba de edición de velocidad, aviso de memoria no guardada, restauración de selector/comparador/laboratorio en la barra lateral de Planta General y vuelta a la Academia con IDs y eventos conservados; regreso del foco al botón de parámetros al cerrar el panel.
- El QA del navegador valida además cuatro acciones SVG de exportación, tres componentes visuales de presión, y reingreso a circuito sin estilos del workbench.
- **QA de navegador final:** `visual-qa.json` sin excepciones JS y sin desbordamiento en 1505 y 390 px; capturas `08-pressure-breakdown-desktop.png` y `09-graphs-export-desktop.png` inspeccionadas visualmente.
- La validación 3D sigue basada en pruebas y hash firmados, **sin afirmar render nuevo de Euler**.
