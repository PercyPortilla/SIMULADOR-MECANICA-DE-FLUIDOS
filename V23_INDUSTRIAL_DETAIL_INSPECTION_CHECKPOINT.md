# PULPA LAB V23 — Detalle industrial e Inspección

Fecha de cierre: **2026-10-17**

## 1. Objetivo

V23 continúa directamente desde V22 sin modificar el motor de cálculo. La fase se concentró en fidelidad industrial cercana, claridad didáctica de Inspección y robustez de soportes/piping, preservando la topografía y arquitectura ya validadas.

Principios mantenidos:

- Three.js sigue siendo el runtime autoritativo.
- Blender/GLB sigue siendo la capa industrial visual reutilizable.
- No hay migración a Babylon.js.
- No se modifican ecuaciones de reología, hidráulica, energía, lixiviación ni recuperación.
- No se cambian IDs, secuencia de proceso, diámetros físicos, endpoints ni centerlines para resolver problemas visuales.
- CV-01/CV-02/CV-03 siguen siendo paramétricos/híbridos.

## 2. Detalle mecánico de conveyors

Los tres conveyors conservan exactamente su geometría y puertos paramétricos y añaden detalles de lectura industrial:

- feed skirts laterales;
- belt scraper en head;
- bracket de scraper;
- emergency pull-cord;
- estación E-stop y botón de parada.

Estos elementos viajan en el mismo frame local del conveyor y no participan en cálculos ni routing.

Validación:

- los tres conveyors mantienen source/target ports;
- el audit V23 detecta 7 piezas de detalle por conveyor;
- escala Blender principal permanece 16/16 PASS.

## 3. Chancadora primaria

PRIMARY-CRUSHER conserva el GLB y sus clips existentes. V23 añade un overlay procedural mínimo que permanece visible sobre el modelo Blender:

- escalera de servicio;
- guardia visual del flywheel;
- E-stop;
- luz de trabajo.

El overlay no modifica feed/discharge ports, foundation ni pivotes de animación.

## 4. Inspección focal

La auditoría de los 38 targets no encontró un P0 geométrico, pero sí reprodujo siete objetivos donde el bounding box completo alejaba demasiado la cámara.

V23 introduce perfiles de framing sólo para cámara en:

- CV-02-CRUSHER-TO-STOCKPILE;
- STOCKPILE-RECLAIM;
- CV-03-STOCKPILE-TO-GRINDING;
- P-CYCLONE-UNDERFLOW-RETURN;
- P-CLASSIFICATION-TO-LEACH;
- P-LEACHING-TO-PUMP-01;
- P-PUMP-01-TO-CIP.

Los perfiles usan metadata de ruta o un subgrupo ya existente. No cambian transforms, visibilidad persistente, routePoints ni dimensiones físicas.

Spans focales auditados:

- CV-02: 28.00 m;
- STOCKPILE reclaim: 7.62 m;
- CV-03: 26.00 m;
- underflow return: 22.00 m;
- classification → leach: 22.00 m;
- leaching → PUMP-01: 24.00 m;
- PUMP-01 → CIP: 24.00 m.

## 5. Interiores educativos sobre Blender

V23 corrige un problema didáctico: al cargar ciertos GLB, interiores procedurales útiles podían quedar dentro del fallback oculto.

Se preserva únicamente el conjunto mínimo:

### MILL-01

- mill-charge;
- anclado al MILL-01_ROTATING_GROUP importado;
- no se reactiva keepProceduralUpdate;
- no se duplican shell, liner ni trommel.

### SLURRY-PUMP-01 y PUMP-01

- pump-impeller;
- pump-slurry-path;
- impeller anclado al SLURRY-PUMP-01_ROTATING_GROUP;
- no se preserva una segunda carcasa procedural.

### ELUTION-SKID

- solución de columna;
- líquido de tanque;
- 9 tubos internos del HX;
- COLUMN y EXCHANGER importados reciben semántica shell en Inspección.

La lógica de pivotes V21 permanece intacta.

## 6. Piping y ROAD-02

La auditoría V23 detectó que el chequeo histórico basado sólo en ancho de portal podía dar un falso positivo frente a la curva real de ROAD-02.

La corrección:

- mantiene fija la centerline P-PUMP-01-TO-CIP;
- mantiene endpoints y D físico = 0.22 m;
- usa la alineación Catmull-Rom real de ROAD-02 para decidir soporte;
- mantiene footings fuera de carretera + hombros + margen;
- añade X-bracing ligero a soportes local/trestle altos.

Resultado actual:

- 22 footings PUMP-01 → CIP comprobados;
- clearance mínimo: **8.13 m**;
- requisito: **7.95 m**;
- violaciones: **0**;
- road-aware frames: 7;
- ancho máximo: **18.00 m**.

La centerline auditada conserva 6 route points y endpoints con error 0.

## 7. Pipe 1: accesorios visuales

Antes, el renderer añadía una sola válvula visual por layout aunque valvesCount del estado fuese 0, 2 o 3.

V23 separa explícitamente:

- visualValveCount: representación visual;
- codos: siguen derivados de la geometría de routePoints;
- solver: sigue usando la lógica hidráulica preexistente de accesorios y K.

Pruebas específicas:

- valvesCount 0 → 0 válvulas visuales;
- valvesCount 1 → 1 válvula visual;
- valvesCount 3 → 3 válvulas visuales;
- número de codos geométricos permanece idéntico;
- diámetro físico y longitud hidráulica solicitada permanecen separados de la geometría renderizada.

## 8. Protección del cálculo

Comparación contra el staging V22:

- src/controller/: 0 cambios;
- src/core/: 0 cambios;
- src/state/: 0 cambios;
- src/process/: 0 cambios;
- src/reporting/: 0 cambios.

Calculation guard: **PASS**.

## 9. Pruebas y audits

Suite completa:

- **68/68 test files PASS**;
- **363/363 tests PASS**;
- duración: **155.34 s**;
- exit code 0.

Audits:

- terrain/civil V22: **14/14 PASS**;
- industrial detail V23: **24/24 PASS**;
- visual scale: **16/16 PASS**;
- integration clearance: **157/157 PASS**.

Revisión independiente dirigida:

- scene suites: 56/56 PASS;
- core hydraulic circuit: 3/3 PASS;
- 11/11 conexiones hidráulicas mantienen endpoints exactos.

## 10. Build

npm run build:

- Vite 7.3.7;
- 106 módulos transformados;
- PASS.

El warning del chunk Three.js >500 kB continúa siendo informativo y no representa fallo.

## 11. QA de navegador

Se usó una única sesión de Vite Preview + Chrome/CDP.

Resultado:

- release tag: V23 · Detalle industrial e Inspección;
- badge académico: V23;
- 38 targets de Inspección;
- 24 recursos GLB;
- scene error vacío;
- runtime errors: 0;
- network failures: 0.

Capturas relevantes:

- general;
- chancado;
- recuperación;
- PRIMARY-CRUSHER close-up;
- CV-02 focused Inspection;
- P-PUMP-01-TO-CIP focused Inspection;
- PUMP-01 Interior;
- ELUTION-SKID Interior;
- crushing mobile.

Mobile 390 px:

- documentWidth = 390;
- viewportWidth = 390;
- bodyWidth = 390;
- sceneCardWidth = 354;
- sin overflow horizontal.

Artefactos:

- qa-artifacts/v23-industrial-detail/summary.json;
- qa-artifacts/v23-industrial-detail/*.png;
- qa-artifacts/cdp_v23_industrial_detail_probe.mjs.

## 12. Assets y Blender master

No se regeneraron GLB principales en V23.

Guard public/dist:

- public: 24 GLB;
- dist: 24 GLB;
- mismatches: 0.

Master Blender:

- blender/PULPA_LAB_BLENDER_MASTER_V17.blend;
- 688,141 bytes;
- SHA-256 E78577DAE8E533429B84FC13FC054036684F6D36AB5F1A3D76AB4CCA787CACA6;
- sin cambios.

## 13. Resultado

V23 mejora la lectura mecánica y educativa sin desplazar la ingeniería autoritativa. Las fajas y la chancadora ganan detalle de servicio, los objetivos extensos de Inspección se observan a una distancia útil, los interiores esenciales sobreviven al reemplazo Blender, los soportes de recuperación respetan la curva real de ROAD-02 y Pipe 1 representa visualmente sus válvulas sin inventar causalidad ni alterar el solver.

El proceso, rutas, centerlines, endpoints, diámetros físicos, topografía V22, pivotes V21, casos académicos y master Blender permanecen protegidos.

