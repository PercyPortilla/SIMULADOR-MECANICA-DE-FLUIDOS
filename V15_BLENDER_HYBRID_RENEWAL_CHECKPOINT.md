# PULPA LAB V15 — Renovación 3D híbrida Blender + Three.js

Fecha de cierre: **2026-10-16**

## 1. Objetivo cerrado

V15 completa la renovación 3D pendiente sobre el checkpoint V14 **sin migrar a Babylon.js**. Three.js continúa siendo el motor runtime y Blender se usa como pipeline de modelado industrial para los activos que pueden desacoplarse de la geometría funcional.

No se sustituyeron por GLB rígidos las geometrías cuya longitud, pendiente, ruta, diámetro, endpoint, contacto con topografía o movimiento deben seguir respondiendo al simulador.

## 2. Arquitectura híbrida final

### Conveyors CV-01 / CV-02 / CV-03

Los tres conveyors conservan su span paramétrico, pendiente real, belt animation, mineral en movimiento, endpoints y footings derivados de topografía. Sobre esa base se añadieron módulos Blender reutilizables:

- `CONVEYOR-HEAD-MODULE.glb`
- `CONVEYOR-TAIL-MODULE.glb`
- `CONVEYOR-IDLER-MODULE.glb`
- `CONVEYOR-TRANSFER-HOOD.glb`

El detalle procedural/híbrido añade trough wings, cleats en CV-01, trestles, baseplates, bracing, walkway y soportes aterrizados individualmente. El fallback procedural sólo se oculta cuando el módulo Blender correspondiente termina de cargar.

### Chutes y transferencias

- ROM → apron feeder: chute fabricado paramétrico con stiffeners, skirt y flujo visual de mineral, complementado por hood Blender.
- CV-02 → stockpile: nueva torre de transferencia industrial terrain-aware, con cuatro footings independientes, baseplates, legs, bracing, deck y guardrails. El endpoint de `STOCKPILE-RECLAIM.feedIn` no cambia.
- Las transferencias mantienen su lógica/material path existente; V15 sólo altera su representación visual/estructural.

### Piping, fittings y racks

La línea hidráulica autoritativa no se modifica. Permanecen intactos centerlines, diámetros, puertos, rutas y metadata física. V15 añade/mejora:

- codos con `TubeGeometry` sobre la ruta real;
- `PIPE-FLANGE-MODULE.glb`;
- `PIPE-VALVE-MODULE.glb`;
- `PIPE-SADDLE-MODULE.glb`;
- pipe racks paramétricos con baseplates, saddles y bracing;
- muestreo topográfico independiente por footing izquierdo/derecho para evitar flotación o enterramiento en pendientes laterales.

## 3. Estructuras auxiliares corregidas

- Las grandes losas Z4/Z5 quedan enterradas bajo el datum y ya no sepultan la parte inferior de `MILL-01` ni `CLASS-01`.
- Las fundaciones locales por equipo permanecen visibles como plinths industriales.
- La malla técnica de molienda/clasificación se reposicionó al datum para eliminar el moiré/z-fighting detectado en QA.
- La torre CV-02 → stockpile sostiene visualmente el head/hood de transferencia sin alterar el conveyor ni el feed port.

## 4. Assets Blender

### 16 GLB principales

`ROM-HOPPER`, `APRON-FEEDER`, `PRIMARY-CRUSHER`, `STOCKPILE-RECLAIM`, `MILL-01`, `SUMP-01`, `SLURRY-PUMP-01`, `CLASS-01`, `LEACH-REACTOR`, `CIP-ADSORPTION`, `ELUTION-SKID`, `EW-CELLS`, `SMELTING-FURNACE`, `HAUL-TRUCK`, `MINING-SHOVEL` y `WHEEL-LOADER`.

### 7 módulos V15 reutilizables

Los cuatro módulos de conveyor indicados arriba más `PIPE-FLANGE-MODULE`, `PIPE-VALVE-MODULE` y `PIPE-SADDLE-MODULE`.

**Total runtime:** 23 GLB / **5,230,200 bytes**.

El conjunto de `public/models/pulpa-blender` y el de `dist/models/pulpa-blender` son byte-idénticos en el cierre.

## 5. Master Blender reproducible

Master final incluido:

`blender/PULPA_LAB_BLENDER_MASTER_V15.blend`

- Tamaño: **677,636 bytes**
- Objetos en la escena consolidada: **1002**
- Actions: **21**
- Colecciones verificadas: `PULPA_LAB_ASSETS`, `PROCESS_PLANT`, `MINE_EQUIPMENT`, `V15_HYBRID_MODULES`
- SHA-256: `7230363C8917188692DD13A1248AF99B46D282E9E1BDF6BF8319A1E9A755045F`

Los scripts finales usados para regenerar los assets están en `blender/scripts/`. V15 sincroniza las versiones corregidas de Blocks 4/5/6/8 y añade Block 9, los audits V15 y el validador completo de 23 GLB. El bridge local se archiva en `blender/tools/blender_bridge.py`.

## 6. Auditoría de Blender y GLB

- `validate_pulpa_v15_release.py`: **23/23 GLB v2 válidos**, sin archivos requeridos ausentes y con los nodos semánticos críticos presentes.
- Asset audit Blender: **0 assets principales marcados como suspicious**.
- Animation audit: **0 grounding warnings** entre los 9 assets animados auditados.
- El camión mantiene nodos semánticos de dump/steering/wheel spin/ore y Three.js conserva el control operacional.
- Los nombres de clips exportados pueden quedar como `Animation.*`; el loader mantiene el fallback ya validado para reproducir el primer clip o todos los clips configurados.

## 7. QA visual del circuito

Se ejecutó QA automatizado y visual sobre el build de producción en:

- Planta general
- Recepción / carguío
- Chancado / acopio
- Molienda / clasificación
- Lixiviación
- Recuperación
- Inspección de `MILL-01`

Resultado del smoke CDP final:

- HTTP preview: **200**
- Runtime exceptions: **0**
- Network failures: **0**
- Módulos híbridos V15 cargados: **7/7**

Las capturas y resúmenes se conservan en `qa-artifacts/v15-zones/`.

## 8. Pruebas y build

Suite completa final:

- Test files: **57 passed / 57**
- Tests: **251 passed / 251**
- Exit code: **0**
- Duración del run final: ~143 s

Build final:

- `npm run build`: **PASS**
- Vite: **98 modules transformed**
- `dist/models/pulpa-blender`: **23 GLB / 5,230,200 bytes**
- Hash comparison `public ↔ dist`: **0 mismatches / 0 extras**

Vite conserva el warning informativo de chunk `three` >500 kB. No es un error de build y los GLB siguen externos al bundle JavaScript.

## 9. Protección de cálculos

La comparación de `src/` contra V14 muestra cambios únicamente en visualización/integración 3D:

- conveyor visual/estructural;
- base environment;
- camera preset visual;
- pipe racks;
- Blender module loader;
- integrated piping;
- integrated plant;
- piping visual engine.

El filtro de archivos de cálculo (`rheology`, `hydraulics`, `leaching`, `recovery`, `solver`, `calculation`) arroja **0 cambios** respecto al checkpoint V14 usado como referencia.

No se modificaron deliberadamente ecuaciones reológicas, hidráulica física, cinética de lixiviación, recuperación metalúrgica ni lógica de resultados.

## 10. Resultado de V15

V15 queda cerrado como checkpoint híbrido Three.js + Blender: los activos industriales principales están renovados, los elementos que deben seguir siendo paramétricos conservan su función, el circuito mantiene IDs/puertos/inspección/labels/cámaras/fallback, y el release dispone de source, `dist`, GLB finales, master Blender y scripts de generación/auditoría.
