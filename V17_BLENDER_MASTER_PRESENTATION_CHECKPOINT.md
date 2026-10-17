# PULPA LAB V17 — Master Blender actualizado + Modo Presentación

Fecha de cierre: **2026-10-16**

## 1. Objetivo

V17 consolida dos mejoras sobre el checkpoint V16:

1. dejar un **master Blender realmente actualizado** con las correcciones de animación ya verificadas en los GLB runtime;
2. añadir un **Modo Presentación** profesional para exposición académica, reutilizando el modo Inspección y la guía educativa existentes.

La arquitectura no cambia: **Three.js sigue siendo el runtime autoritativo** y Blender continúa como pipeline de modelado industrial. No se migra a Babylon.js en esta versión.

## 2. Master Blender V17

Archivo final:

`blender/PULPA_LAB_BLENDER_MASTER_V17.blend`

Datos:

- tamaño: **688,141 bytes**
- objetos: **998**
- actions: **26**
- frame range: **1..960**
- SHA-256: `E78577DAE8E533429B84FC13FC054036684F6D36AB5F1A3D76AB4CCA787CACA6`

El master se promovió desde la escena de trabajo V16 consolidada que contenía las correcciones post-V15. Se eliminó una Action CIP huérfana con 0 usuarios antes del guardado final.

Las correcciones consolidadas incluyen Actions independientes para APRON-FEEDER, PRIMARY-CRUSHER, CIP-ADSORPTION, MILL-01, SLURRY-PUMP-01, LEACH-REACTOR, SMELTING-FURNACE, MINING-SHOVEL y WHEEL-LOADER.

HAUL-TRUCK mantiene su política correcta: nodos semánticos controlados por Three.js para dump, steering, wheel spin y ore load, sin clip canned obligatorio.

## 3. Cadena Blender reproducible

La cadena que produjo la escena post-V15 verificada fue:

1. `blender_block2_core_assets.py`
2. `blender_block2b_refine.py`
3. `blender_block3_export_glb.py`
4. `blender_block4_leach.py`
5. `blender_block5_recovery.py`
6. `blender_block6_frontend.py`
7. `blender_block8_mobile.py`
8. promoción final a V17.

Debe ejecutarse en **una misma sesión persistente de Blender**, porque varios bloques guardan checkpoints intermedios pero esperan conservar el estado acumulado.

No se debe ejecutar `blender_block9_hybrid_modules.py` dentro de esta cadena: pertenece a la generación V15, abre explícitamente el master V14 y guarda V15. Sus 7 módulos no cambiaron entre V15 y V16/V17, por lo que no requieren regeneración.

V17 añade:

- `blender/scripts/blender_v17_promote_master.py`
- `blender/scripts/blender_v17_master_audit.py`

## 4. Audit del master

Resultado: **PASS**.

El audit verifica:

- 16/16 roots principales presentes;
- cada root del master tiene exactamente el mismo número de nodos que su GLB runtime;
- 26 Actions esperadas;
- 0 Actions inesperadas;
- 0 Actions con 0 usuarios;
- 0 duplicados de nombre en los 16 assets principales;
- nodos semánticos críticos presentes;
- colecciones principales presentes;
- metadata `master_version = V17`;
- frame range `1..960`.

Artefacto: `qa-artifacts/v17-blender-master-audit.json`.

## 5. Modo Presentación

V17 añade una ruta académica reducida de **19 paradas principales**:

EXCAVATOR-01 → TRUCK-01 → ROM-HOPPER → APRON-FEEDER → PRIMARY-CRUSHER → STOCKPILE-RECLAIM → MILL-01 → SUMP-01 → SLURRY-PUMP-01 → CLASS-01 → R-01 → R-02 → R-03 → R-04 → PUMP-01 → CIP-ADSORPTION → ELUTION-SKID → EW-CELLS → SMELTING-FURNACE.

La secuencia es una subsecuencia ordenada del circuito de Inspección de 38 targets y no altera el grafo de proceso.

## 6. Controles

El overlay dentro del viewport incluye:

- Modo presentación;
- Anterior;
- Reproducir / Pausa;
- Siguiente;
- progreso `01 / 19`;
- autoplay cada **7.5 s**.

El autoplay no hace loop infinito, se detiene al final, puede pausarse y retomarse, y si se reproduce desde el final vuelve a la primera parada.

Cada parada reutiliza `setInspectionTarget()`, por lo que el encuadre sigue usando bounds reales, FOV/aspect, OrbitControls target y los límites de navegación ya verificados. No se añadió una segunda implementación de cámaras.

## 7. Ficha académica

Mientras el Modo Presentación está activo, la guía completa de Inspección cambia a una versión resumida:

- nombre del equipo;
- qué hace;
- entrada;
- salida;
- variable clave;
- progreso.

Al salir, vuelve la guía técnica completa de V16, incluyendo impacto en cálculo y anterior/siguiente.

## 8. Pulido visual

Durante la presentación se ocultan temporalmente las etiquetas técnicas grandes de la escena para que no compitan con el equipo y la ficha académica.

Al salir se restaura exactamente el estado previo del toggle **Mostrar etiquetas**. Se mantiene el marco de foco de Inspección para conservar orientación espacial.

## 9. QA del Modo Presentación

Smoke CDP de producción:

- inicio: EXCAVATOR-01 / `01 / 19`;
- siguiente: TRUCK-01 / `02 / 19`;
- autoplay: ROM-HOPPER / `03 / 19`;
- pausa: PASS;
- salida: PASS;
- cámara activa: Inspection;
- runtime errors: **0**;
- network failures: **0**.

Mobile:

- viewport: **390 px**;
- document width: **390 px**;
- overflow horizontal: **0**;
- controles y ficha permanecen dentro del viewport 3D.

Artefactos principales:

- `qa-artifacts/v17-presentation-summary.json`
- `qa-artifacts/v17-presentation-desktop.png`
- `qa-artifacts/v17-presentation-mobile.png`

## 10. Runtime y animaciones

Smoke final sobre build de producción:

- GLB cargados: **23/23**
- runtime exceptions: **0**
- network failures: **0**

El runtime V17 conserva la verificación dinámica de animaciones cerrada en V16 y la suite mantiene pruebas de Blender animation assets, playback, rotor axes, industrial animations y mobile equipment.

Artefacto: `qa-artifacts/v17-animation-smoke-summary.json`.

## 11. Protección de cálculos

Comparación contra checkpoint V16:

- archivos de cálculo comparados: **36**
- archivos cambiados: **0**

No se modificaron reología, hidráulica, cinética de lixiviación, recuperación, solver ni lógica de resultados.

Artefacto: `qa-artifacts/v17-calculation-guard.json`.

## 12. Assets runtime

`public/models/pulpa-blender`:

- 23 GLB
- 5,240,240 bytes

`dist/models/pulpa-blender`:

- 23 GLB
- 5,240,240 bytes

Mismatches public/dist: **0**.

Artefacto: `qa-artifacts/v17-public-dist-glb-hashes.json`.

## 13. Tests y build

Suite final:

- **61 / 61** test files PASS
- **287 / 287** tests PASS
- exit code **0**
- duración: **143.03 s**

Build:

- `npm run build`: **PASS**
- Vite: **100 modules transformed**
- warning del chunk `three` >500 kB: informativo.

## 14. Resultado

V17 deja PULPA LAB V2 listo para una demostración mucho más clara:

- master Blender actualizado y auditable;
- animaciones corregidas consolidadas en la fuente Blender;
- ruta académica de 19 equipos principales;
- navegación automática o manual;
- menor ruido visual durante exposición;
- sin cambios en cálculos ni geometría física autoritativa.

La siguiente fase puede enfocarse en escenarios académicos guiados y, después, en una comparación experimental Three.js vs Babylon.js sin comprometer este checkpoint.

