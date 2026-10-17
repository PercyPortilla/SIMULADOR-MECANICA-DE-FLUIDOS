# PULPA LAB V18 — Casos académicos guiados

Fecha de cierre: **2026-10-16**

## 1. Objetivo

V18 convierte el simulador en una herramienta de enseñanza más directa sin alterar el motor físico. Se añade una biblioteca de casos académicos que carga parámetros válidos, explica qué observar y puede iniciar automáticamente el recorrido 3D de V17 en el equipo relacionado.

La arquitectura se mantiene: Three.js sigue siendo el runtime y Blender continúa como pipeline de activos industriales. El master Blender V17 permanece sin cambios.

## 2. Biblioteca de casos

V18 incorpora seis casos guiados:

1. **Alcance metalúrgico**
   - duplica el volumen útil de lixiviación a 720 m3;
   - aumenta eficiencia de elución a 0.95;
   - enseña tiempo de residencia, conversión CSTR y balance de recuperación;
   - enfatiza que k, feedGoldKgH y eficiencias son entradas explícitas y no forman un predictor metalúrgico end-to-end.

2. **Referencia Newtoniana**
   - viscosidad didáctica 0.008 Pa·s;
   - usa Reynolds y Darcy/Colebrook;
   - sirve como referencia frente a modelos con esfuerzo de cedencia.

3. **Mayor concentración de sólidos**
   - Cw = 50%;
   - Bingham con tau0 = 12 Pa y mu_p = 0.12 Pa·s;
   - velocidad 0.9 m/s;
   - muestra aumento de densidad y demanda hidráulica aun con menor velocidad.

4. **Herschel–Bulkley shear-thinning**
   - Cw = 45%;
   - tau0 = 6 Pa;
   - K = 0.18 Pa·s^n;
   - n = 0.55;
   - velocidad 0.9 m/s;
   - permanece en la rama laminar validada.

5. **Ley de Potencia y límite de alcance**
   - Cw = 40%;
   - K = 0.12;
   - n = 0.65;
   - velocidad 1.0 m/s;
   - configurado deliberadamente para mostrar resultQuality = educational-estimate fuera de laminar.

6. **Elevación y consumo energético**
   - referencia Newtoniana;
   - L = 180 m;
   - delta z = 20 m;
   - velocidad conservada en 1.2 m/s;
   - aísla el efecto de longitud y carga estática.

## 3. Resultados de referencia

Resultados calculados por el mismo motor del simulador:

- Metallurgical scope: residencia 9.4314 h, conversión 57.12%, recuperación 79.60%, oro final 7.96005 kg/h.
- Newtonian reference: dP 79.57 kPa, potencia 2.35 kW.
- High-solids Bingham: densidad 1452.05 kg/m3, dP 128.42 kPa, potencia 2.85 kW.
- Herschel–Bulkley: laminar validado, dP 92.24 kPa, potencia 2.04 kW.
- Power Law: régimen generalizado turbulento, quality educational-estimate, dP 78.61 kPa, potencia 1.94 kW.
- Static head: dP 279.69 kPa, potencia 8.26 kW manteniendo el mismo caudal que la referencia Newtoniana.

Artefacto: qa-artifacts/v18-academic-case-results.json.

## 4. Panel de casos académicos

La barra lateral ahora contiene un bloque independiente llamado Casos académicos.

Incluye:

- selector de caso;
- botón Cargar caso;
- botón Cargar + presentar;
- objetivo de aprendizaje;
- pregunta guía;
- variables que el alumno debe observar;
- advertencia de alcance;
- advertencia permanente sobre el método Durand legado.

Seleccionar un caso sólo muestra su guía. No cambia ningún parámetro hasta que el usuario pulse Cargar caso.

## 5. Integración con Presentación

Cargar + presentar reutiliza el Modo Presentación V17; no duplica cámaras ni lógica 3D.

Cada caso tiene un presentationStartId válido dentro de las 19 paradas de Presentación.

Ejemplo verificado:

- Static-head/energy inicia en SLURRY-PUMP-01;
- el contador muestra 09 / 19;
- se activa cámara Inspection;
- las etiquetas técnicas grandes se ocultan durante la presentación;
- la ficha educativa sigue mostrando entrada, salida y variable clave.

## 6. Protección de escenarios personales

Al cargar un caso académico se limpia la selección de un escenario personal guardado.

Esto evita que el botón Guardar / actualizar sobrescriba accidentalmente un escenario anterior. El caso académico puede modificarse y luego guardarse como un escenario nuevo.

El botón Cargar + presentar nace deshabilitado y sólo se habilita cuando el entorno 3D instala el handle de Presentación.

## 7. Alcance del modelo

V18 hace explícitas varias limitaciones importantes:

- Cw y parámetros reológicos son entradas independientes salvo que el usuario active un escalado empírico calibrable;
- fuera de laminar, la hidráulica no Newtoniana se marca como estimación educativa;
- el perfil radial mostrado fuera de laminar no es CFD turbulento;
- k de lixiviación requiere prueba/calibración;
- recuperación usa eficiencias de etapa explícitas;
- feedGoldKgH no se deriva automáticamente de conversión de lixiviación;
- Durand F_L es orientativo, no calibrado, y no usa d50/d80 en la correlación actual;
- longitud hidráulica y desnivel no desplazan equipos 3D.

## 8. QA de navegador

Producción local:

- HTTP 200;
- runtime errors: 0;
- network failures: 0.

Flujo verificado:

- seleccionar High-solids sólo previsualiza la guía y mantiene Cw en 35%;
- Cargar caso cambia Cw a 50%;
- KPI densidad = 1452.1 kg/m3;
- KPI dP = 128.42 kPa;
- KPI potencia = 2.85 kW;
- Metallurgical scope muestra 9.43 h, 57.12%, 79.60% y 7.9600 kg/h;
- Cargar + presentar en Static-head salta a SLURRY-PUMP-01, 09 / 19.

Mobile:

- viewport 390 px;
- document width 390 px;
- sin overflow horizontal;
- panel académico dentro del ancho disponible.

Artefactos:

- qa-artifacts/v18-academic-cases-summary.json
- qa-artifacts/v18-academic-cases-desktop.png
- qa-artifacts/v18-academic-cases-mobile.png
- qa-artifacts/cdp_academic_cases_probe_v18.mjs

## 9. Protección del motor

Comparación contra V17:

- archivos de cálculo comparados: 36;
- archivos modificados: 0.

No cambiaron reología, hidráulica, solver, lixiviación, recuperación, simulationState ni simulationController.

Artefacto: qa-artifacts/v18-calculation-guard.json.

## 10. Assets y Blender

Assets runtime:

- public/models/pulpa-blender: 23 GLB / 5,240,240 bytes;
- dist/models/pulpa-blender: 23 GLB / 5,240,240 bytes;
- mismatches: 0.

Master Blender:

- blender/PULPA_LAB_BLENDER_MASTER_V17.blend;
- 688,141 bytes;
- SHA-256 E78577DAE8E533429B84FC13FC054036684F6D36AB5F1A3D76AB4CCA787CACA6.

V18 no modifica activos Blender ni geometría física.

## 11. Tests y build

Suite final:

- **62 / 62** test files PASS;
- **293 / 293** tests PASS;
- exit code 0;
- duración 205.36 s.

Build:

- npm run build: PASS;
- Vite: 101 modules transformed;
- warning del chunk Three.js mayor a 500 kB: informativo.

## 12. Resultado

V18 añade una capa docente real sobre el simulador:

- casos listos para clase;
- preguntas de ingeniería;
- variables concretas que observar;
- limitaciones explícitas;
- resultados comparables;
- conexión directa con el recorrido 3D;
- protección de escenarios personales;
- cero cambios en el motor de cálculo.

El siguiente avance recomendado es V19: comparador didáctico lado a lado entre dos casos, con deltas de parámetros, KPIs y una explicación automática de por qué cambió cada resultado.

