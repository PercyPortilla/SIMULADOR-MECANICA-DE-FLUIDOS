# PULPA LAB V19 — Comparador académico A vs B

Fecha de cierre: **2026-10-17**

## 1. Objetivo

V19 añade un comparador didáctico entre los seis casos académicos de V18 sin modificar el motor físico. El alumno puede seleccionar un Caso A y un Caso B, ver qué resultados cambian, cuánto cambian y por qué cambian según las entradas realmente codificadas por el simulador.

La arquitectura se conserva:

- Three.js sigue siendo el runtime autoritativo;
- Blender sigue siendo el pipeline de modelado industrial;
- PULPA_LAB_BLENDER_MASTER_V17.blend continúa como master consolidado;
- no se migra a Babylon.js;
- no se alteran ecuaciones, rutas físicas, endpoints, diámetros ni lógica de recuperación.

## 2. Comparador académico

Módulo principal: src/ui/academicComparison.js.

El comparador parte de getInitialState(), aplica independientemente los inputs de cada caso y ejecuta calculateSimulationResults() sobre dos estados separados. No modifica el escenario activo del usuario.

Los seis casos de V18 siguen siendo la fuente de escenarios:

1. Alcance metalúrgico.
2. Referencia Newtoniana.
3. Mayor concentración de sólidos / Bingham.
4. Herschel–Bulkley shear-thinning.
5. Ley de Potencia y límite de alcance.
6. Elevación y consumo energético.

## 3. Métricas comparadas

La matriz interna cubre once resultados:

- densidad de pulpa;
- caudal;
- Reynolds / Reynolds generalizado;
- presión requerida;
- carga total;
- potencia eléctrica;
- energía anual;
- residencia de lixiviación;
- conversión CSTR;
- recuperación global;
- oro final.

La UI muestra únicamente las métricas que realmente difieren entre A y B, evitando ruido. Cada fila presenta valor A, valor B, delta B − A y porcentaje relativo cuando el valor A permite calcularlo.

## 4. Explicación automática “¿Por qué cambia?”

Las explicaciones se generan únicamente cuando cambian entradas que el solver usa explícitamente.

- **Constitución de pulpa:** Cw, densidad del sólido o densidad del líquido.
- **Reología:** modelo y parámetros constitutivos expuestos.
- **Velocidad y caudal:** Q = V·πD²/4.
- **Diámetro:** afecta área de flujo y pérdidas.
- **Longitud hidráulica:** afecta pérdida distribuida.
- **Carga estática:** rho·g·dz.
- **Rugosidad:** sólo se atribuye directamente a la rama Newtoniana donde corresponde.
- **Pérdidas locales:** coeficiente K.
- **Eficiencias de bomba y motor:** modifican demanda eléctrica sin cambiar la hidráulica requerida.
- **Volumen útil de lixiviación:** modifica residencia y conversión CSTR.
- **k / número de reactores:** modifica la conversión del modelo de lixiviación.
- **Eficiencias de recuperación:** adsorción, elución, EW y fundición.
- **feedGoldKgH:** entrada explícita independiente del bloque de lixiviación.

No se fabrican causalidades que el solver no contiene.

En particular:

- PULPA LAB no infiere automáticamente tau0, K, n o mu_p desde Cw;
- feedGoldKgH no se deriva automáticamente de la conversión de lixiviación;
- L y dz hidráulicos no desplazan equipos en el 3D;
- una correlación fuera de su rama validada no se presenta como un resultado de alta confianza.

## 5. Calidad y alcance del modelo

La cabecera A/B muestra régimen de flujo y resultQuality.

Si cualquiera de los dos casos cae en educational-estimate, se agrega una advertencia de Límite de aplicabilidad y se indica al usuario priorizar modelStatus / resultQuality antes que interpretar el valor numérico de dP.

## 6. Integración de UI

El panel de V18 conserva sus controles originales y añade un bloque colapsable llamado Comparar dos casos.

Incluye:

- selector Caso A;
- selector Caso B;
- botón Comparar A vs B;
- tabla compacta de deltas;
- tarjetas causales.

La comparación no ejecuta Cargar caso, no modifica los inputs visibles del escenario activo y no altera escenarios guardados.

## 7. QA de navegador

El probe final se ejecutó sobre el build de producción servido con Vite preview.

Resultado:

- HTTP 200;
- runtime errors: 0;
- network failures: 0;
- viewport móvil: 390 px;
- document width: 390 px;
- sin overflow horizontal del panel/comparador.

Comparaciones verificadas:

### Newtoniano vs Sólidos altos

- densidad: 1278.6 → 1452.1 kg/m³ (+13.6%);
- presión: 79.57 → 128.4 kPa (+61.4%);
- potencia: 2.351 → 2.846 kW (+21.0%).

El comparador explica constitución de pulpa, reología y velocidad/caudal.

### Newtoniano vs Carga estática

- se conserva el caudal;
- dP: 79.57 → 279.7 kPa;
- potencia: 2.351 → 8.265 kW;
- las causas reportadas son exclusivamente longitud hidráulica y carga estática.

### Herschel–Bulkley vs Power Law

- HB queda validated-laminar;
- Power Law queda educational-estimate;
- la UI muestra explícitamente el límite de aplicabilidad.

Artefactos:

- qa-artifacts/v19-academic-comparator-summary.json;
- qa-artifacts/v19-academic-comparator-desktop.png;
- qa-artifacts/v19-academic-comparator-mobile.png;
- qa-artifacts/cdp_academic_comparator_probe_v19.mjs.

## 8. Protección del motor y del 3D

Comparación byte a byte contra el ZIP V18:

- modificados: src/main.js, src/styles.css;
- añadido: src/ui/academicComparison.js;
- archivos src eliminados: 0;
- cambios en src/controller/: 0;
- cambios en src/core/: 0;
- cambios en src/state/: 0;
- cambios en src/process/: 0;
- cambios en src/reporting/: 0.

Por tanto, V19 no modifica reología, hidráulica, energía, lixiviación, recuperación, simulation state ni el solver.

Artefactos:

- qa-artifacts/v19-source-diff-v18.json;
- qa-artifacts/v19-calculation-guard.json.

## 9. Blender y assets runtime

public/models/pulpa-blender:

- 23 GLB;
- 5,240,240 bytes.

dist/models/pulpa-blender:

- 23 GLB;
- 5,240,240 bytes;
- mismatches SHA-256 public/dist: 0.

Master Blender sin cambios:

blender/PULPA_LAB_BLENDER_MASTER_V17.blend

- tamaño: 688,141 bytes;
- SHA-256: E78577DAE8E533429B84FC13FC054036684F6D36AB5F1A3D76AB4CCA787CACA6.

## 10. Tests y build

Suite final:

- **63 / 63** test files PASS;
- **300 / 300** tests PASS;
- exit code 0;
- duración: 186.33 s.

Incluye:

- tests/ui/academicComparison.test.js;
- pruebas V18 de casos académicos;
- presentación / inspección;
- playback y assets Blender;
- mobile equipment;
- infraestructura / piping / conveyors;
- regresión geométrica;
- cálculo, estado, hidráulica, reología, lixiviación y recuperación;
- pruebas ampliadas de shared geometry/material y disposal seguro de módulos Blender.

Build:

- npm run build: PASS;
- Vite: 102 modules transformed;
- warning de three >500 kB: informativo.

## 11. Resultado

V19 convierte la biblioteca de casos de V18 en una herramienta de comparación directa para clase:

- A vs B en una sola vista;
- deltas numéricos y porcentuales;
- contexto de régimen/calidad;
- explicación causal defendible;
- sin inventar acoplamientos no presentes;
- sin tocar cálculos ni geometría física;
- responsive y validado sobre build de producción.

El siguiente avance debe partir de este checkpoint y no reabrir V16/V17/V18 salvo que aparezca una regresión concreta.
