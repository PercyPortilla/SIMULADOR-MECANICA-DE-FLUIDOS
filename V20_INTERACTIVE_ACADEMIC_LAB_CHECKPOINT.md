# PULPA LAB V20 — Laboratorio Académico Interactivo

Fecha de cierre: **2026-10-17**

## 1. Objetivo

V20 convierte los casos académicos y el comparador A-vs-B de V18/V19 en una práctica guiada completa: el alumno formula una hipótesis antes de ejecutar, contrasta su predicción con los resultados del mismo solver, revisa el alcance del modelo y genera un informe imprimible.

La arquitectura se mantiene sin migración a Babylon.js:

- Three.js continúa como runtime 3D autoritativo.
- Blender continúa como pipeline de activos industriales.
- El master consolidado sigue siendo blender/PULPA_LAB_BLENDER_MASTER_V17.blend.
- No se modifican ecuaciones de reología, hidráulica, energía, lixiviación o recuperación.
- No se modifican centerlines, diámetros físicos, endpoints, conveyors ni topografía autoritativa.

## 2. Laboratorio interactivo

Módulo principal: src/ui/academicLab.js.

V20 incorpora cinco experimentos:

1. **Carga estática y energía** — referencia Newtoniana vs carga estática; entrena el efecto de L y Δz manteniendo el caudal.
2. **Sólidos, reología y bombeo** — referencia Newtoniana vs sólidos altos/Bingham; distingue composición, reología y velocidad sin asumir que Cw determina automáticamente los parámetros reológicos.
3. **Bingham vs Herschel–Bulkley** — contrasta dos formulaciones no Newtonianas dentro del alcance laminar validado.
4. **Dominio validado vs estimación** — Herschel–Bulkley vs Power Law fuera de la rama validada; obliga a leer resultQuality y modelStatus.
5. **Residencia y recuperación explícita** — contrasta residencia, conversión y recuperación sin inventar un acoplamiento metalúrgico end-to-end que el solver no contiene.

## 3. Hipótesis antes de ejecutar

Cada experimento expone métricas concretas. Antes de evaluar, el alumno debe elegir para cada una:

- Sube.
- Baja.
- Igual.
- No sé.

No sé se trata como una hipótesis válida y evaluable, no como un error de formulario.

La función evaluateAcademicHypotheses() reutiliza compareAcademicCases() y clasifica los deltas reales con tolerancia numérica. Devuelve predicción, comportamiento real, valores A/B, delta, delta porcentual, score, flowRegime, resultQuality, modelStatus, límite de aplicabilidad y conclusión causal.

## 4. Causalidad defendible

La conclusión del laboratorio se construye únicamente con los comparison.insights ya validados en V19.

No se introducen causas nuevas. El sistema conserva las relaciones explícitas codificadas: constitución de pulpa, ley reológica, velocidad/caudal, diámetro, longitud, rugosidad, carga estática, pérdidas locales, eficiencias de bombeo, volumen/cinética de lixiviación y eficiencias de recuperación. Fuera de la rama validada se conserva la advertencia educational-estimate.

## 5. Informe de práctica

Módulo: src/ui/academicLabReport.js.

El laboratorio genera un HTML autónomo e imprimible con:

- título y fecha local;
- hipótesis;
- Caso A / Caso B;
- métricas cambiadas;
- deltas absolutos y porcentuales;
- explicación causal;
- resultQuality, modelStatus y advertencias de alcance;
- conclusión.

El documento no requiere backend, red ni generador PDF. Incluye estilos de impresión y escapa el contenido dinámico antes de insertarlo en HTML.

## 6. UX educativa

V20 cierra tres pendientes pedagógicos anteriores:

### Orden de lectura

En Circuito 3D se presenta ahora escena 3D → KPIs → resultados detallados.

### Ficha de Inspección

La ficha añade Etapa y Resultado relacionado, conservando Qué hace, Entrada, Salida, Variable clave, Qué cambia en el cálculo y Anterior/Siguiente.

### Leyenda de contexto

La guía muestra:

- Anterior — naranja #f0b35a.
- Seleccionado — cyan #7de3ed.
- Siguiente — verde #a8d18d.

Los colores coinciden con los Box3Helper usados por equipmentInspection.js.

## 7. QA de navegador

El smoke final se ejecutó sobre el build de producción:

- HTTP 200;
- runtime errors: 0;
- network failures: 0;
- badge V20 visible;
- escena 3D antes de KPIs y resultados: PASS.

Experimento verificado: **Carga estática y energía**.

Hipótesis:

- caudal: igual;
- presión: sube;
- carga: sube;
- potencia: sube;
- energía anual: sube.

Resultado:

- score 5/5;
- A: turbulent · validated;
- B: turbulent · validated;
- conclusión causal: longitud hidráulica + carga estática;
- informe HTML generado;
- Caso B cargado correctamente.

Después de cargar B:

- L = 180 m;
- Δz = 20 m;
- V = 1.2 m/s.

Inspección de MILL-01:

- cámara activa: Inspection;
- etapa: Molienda · bombeo · clasificación;
- resultado relacionado: Densidad de pulpa · comportamiento reológico;
- leyenda Anterior/Seleccionado/Siguiente visible.

Mobile:

- viewport 390 px;
- document width 390 px;
- panel académico 350 px;
- laboratorio 328 px;
- wrapper de tabla 328 px;
- overflow horizontal 0.

Artefactos:

- qa-artifacts/v20-academic-lab-summary.json
- qa-artifacts/v20-academic-lab-desktop.png
- qa-artifacts/v20-academic-lab-mobile.png
- qa-artifacts/cdp_academic_lab_probe_v20.mjs

## 8. Protección del motor

Comparación byte a byte contra V19:

Modificados:

- src/main.js
- src/styles.css
- src/ui/inspectionGuide.js

Añadidos:

- src/ui/academicLab.js
- src/ui/academicLabReport.js

Eliminados: ninguno.

Cambios en rutas de cálculo:

- src/controller/: 0
- src/core/: 0
- src/state/: 0
- src/process/: 0
- src/reporting/: 0

Artefactos:

- qa-artifacts/v20-source-diff-v19.json
- qa-artifacts/v20-calculation-guard.json

## 9. Blender y GLB

public/models/pulpa-blender:

- 23 GLB;
- 5,240,240 bytes.

dist/models/pulpa-blender:

- 23 GLB;
- 5,240,240 bytes;
- mismatches public/dist: 0.

Master Blender: blender/PULPA_LAB_BLENDER_MASTER_V17.blend

- 688,141 bytes;
- SHA-256 E78577DAE8E533429B84FC13FC054036684F6D36AB5F1A3D76AB4CCA787CACA6.

V20 no regenera activos Blender ni modifica geometría física.

## 10. Pruebas y build

Pruebas dirigidas V20:

- 6 archivos PASS;
- 40/40 tests PASS.

Suite final:

- **65/65 test files PASS**;
- **316/316 tests PASS**;
- exit code 0;
- duración **172.04 s**.

Build:

- npm run build: PASS;
- Vite: **104 modules transformed**;
- warning de Three.js >500 kB: informativo.

La suite conserva pruebas de reología, hidráulica, energía, lixiviación, recuperación, estado/controlador, infraestructura/endpoints, conveyors/piping, Blender/GLB, animaciones, mobile equipment, inspección/presentación, regresión geométrica y rendimiento.

## 11. Publicación

Repositorio objetivo: PercyPortilla/SIMULADOR-MECANICA-DE-FLUIDOS.

V20 añade README.md público y .gitignore para excluir node_modules, dist, cachés, archivos .vercel y ZIPs locales. La publicación remota se ejecuta sólo después de cerrar y verificar este checkpoint.

## 12. Resultado

V20 transforma PULPA LAB V2 de un simulador con casos didácticos en un laboratorio interactivo: el alumno predice, el mismo solver calcula, la aplicación contrasta hipótesis vs resultado, explica por qué cambió, conserva el alcance del modelo y genera una evidencia de práctica, manteniendo el 3D integrado sin alterar la física.

