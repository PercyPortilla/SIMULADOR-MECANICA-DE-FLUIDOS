# PULPA LAB V21 — Terreno, animaciones y hardening de release

Fecha de cierre: **2026-10-17**

## 1. Objetivo

V21 corrige regresiones visuales reales del runtime 3D y fortalece la publicación sin tocar el motor de cálculo. El trabajo se concentra en cuatro puntos: grounding/pivotes de molino y bombas, movimiento visible donde existe una parte mecánica o proceso dinámico, coherencia métrica de los activos y un terreno de recepción con ingeniería de tierras explícita y apoyo Blender.

La arquitectura permanece híbrida:

- Three.js es la autoridad para escena, topografía, coordenadas, rutas, endpoints y elementos paramétricos.
- Blender genera activos industriales y una capa visual del terraplén de recepción.
- No hay migración a Babylon.js.
- No se modifican ecuaciones de reología, hidráulica, energía, lixiviación ni recuperación.
- No se cambian centerlines, diámetros físicos, endpoints ni el orden del circuito.

## 2. Corrección del molino y las bombas

La causa del hundimiento no era la cota del equipo sino el pivote importado de la parte rotante. El nodo animado estaba en el origen mientras su geometría se encontraba desplazada verticalmente; al rotar, el conjunto describía una órbita alrededor de un eje incorrecto y cruzaba el terreno/layout.

`src/scene/integration/blenderVisualReplacement.js` incorpora `stabilizeImportedRotationPivot()`:

- calcula el centro renderizado del conjunto rotante;
- recentra únicamente las coordenadas transversales al eje de giro;
- conserva exactamente la pose de reposo mediante reparentado con transformación mundial preservada;
- mantiene el mismo nombre del nodo, por lo que los tracks GLB siguen siendo válidos;
- no mueve el equipo, sus puertos ni sus conexiones.

Se aplica a:

- MILL-01;
- SLURRY-PUMP-01;
- PUMP-01, que reutiliza el activo de bomba de pulpa.

Muestreo GLTF/Three.js a lo largo del ciclo:

- MILL-01: borde inferior del rotating group ≈ **0.510 m** como mínimo;
- bomba: borde inferior del rotating group ≈ **0.940 m** como mínimo.

El molino y las bombas ya no cruzan el datum local durante la rotación.

## 3. Animaciones añadidas y preservadas

V21 no hace mover estructuras que físicamente deben permanecer estáticas. Se animan sólo partes con sentido mecánico o de proceso:

- **ROM-HOPPER:** el grizzly vibra suavemente y se conserva como overlay procedural sobre el shell Blender.
- **STOCKPILE-RECLAIM:** feeder de reclaim, grizzly y mineral se mueven; hopper, pilas y pad quedan estáticos.
- **SUMP-01:** sólo el líquido y los sólidos suspendidos presentan movimiento; el root del sump nunca se desplaza ni gira.
- **APRON-FEEDER:** el activo actual mantiene pans y rotores hasta el final del clip de 1.6 s.
- **PRIMARY-CRUSHER:** jaw, eccentric y flywheels mantienen tracks hasta el final del clip de 1.2 s.
- **Conveyors:** los módulos Blender no eliminan el marcador procedural rotante que expresa el movimiento de poleas/banda.

Todos los movimientos quedan sometidos a `Animaciones`. La QA visual de PUMP-01 produjo **0 píxeles cambiados** entre dos capturas separadas cuando el toggle estaba OFF.

## 4. Terreno y recepción

La recepción se modela como una plataforma elevada real de movimiento de tierras, no como una planicie arbitraria.

Contrato V21:

- centro de recepción: `[-110, -30]` m;
- cresta/plataforma: **58 × 48 m**;
- cota de cresta: **8.5 m**;
- talud superior: **5 m** de desarrollo;
- berma de captura: **5 m** de ancho con 1.0 m de descenso;
- transición de pie: **10 m**;
- el costado este queda abierto a la transición existente hacia chancado.

`getTerrainHeight()` continúa siendo la única autoridad de elevación. Caminos, pads, cimentaciones y equipos siguen tomando sus cotas de Three.js.

## 5. Capa Blender del terraplén

El flujo es reproducible:

1. `tools/exportV21TerrainContract.mjs` muestrea `getTerrainHeight()` cada 1 m.
2. Se genera `blender/generated/v21-reception-earthwork-contract.json`.
3. `blender/scripts/blender_v21_reception_earthwork.py` lee ese contrato en Blender 5.2.2 LTS.
4. Se exporta `public/models/pulpa-blender/RECEPTION-EARTHWORK-V21.glb`.
5. `blenderTerrainOverlay.js` lo carga como **visual-only**; SSR o error de carga dejan activo el terreno procedural.

El GLB contiene cuatro mallas semánticas: crest, upper-slope, berm y toe-slope. No contiene animaciones ni una segunda función de elevación.

Activo:

- 463,796 bytes;
- SHA-256 `FADC04494AFDD938CBFD74319C8D5A1950FD481732C6DA51E446842417DC6115`;
- bounds GLTF: X -159..-81 m, Z -74..-6 m;
- planta: 78 × 68 m.

## 6. Escalas industriales

V21 conserva el contrato **1 unidad de mundo = 1 metro**. La auditoría `tools/v21VisualScaleAudit.mjs` compara el envelope de los GLB contra referencias métricas usando el mapeo correcto de ejes Blender/glTF → Three.js:

- Three X = longitud;
- Three Z = ancho;
- Three Y = altura.

Resultado: **16/16 activos auditados PASS** dentro del envelope razonable 0.65–1.65 por dimensión. No se aplicó un escalado global porque eso habría deformado activos que ya son coherentes. El mining shovel se evalúa como envelope articulado completo; su alcance de boom/stick no se confunde con la longitud del cuerpo.

Ejemplos de razón medido/referencia (L/W/H):

- MILL-01: 0.867 / 1.076 / 1.025;
- SLURRY-PUMP-01: 1.120 / 0.774 / 1.116;
- HAUL-TRUCK: 0.878 / 1.092 / 0.962;
- WHEEL-LOADER: 1.048 / 1.144 / 0.960.

La decisión técnica es conservar la escala métrica real en vez de igualar visualmente equipos de clases distintas.

## 7. QA visual de navegador

El build de producción fue servido con Vite Preview y probado mediante Chrome/CDP:

- runtime errors: **0**;
- network failures: **0**;
- scene error: vacío;
- viewport 1440 px, document width 1425 px: sin overflow horizontal;
- GLB clave y nuevo terraplén: HTTP 200.

Movimiento detectado entre capturas con Animaciones ON:

- ROM-HOPPER: 21,110 píxeles;
- STOCKPILE-RECLAIM: 5,343;
- MILL-01: 45,470;
- SLURRY-PUMP-01: 407;
- PUMP-01: 100;
- SUMP-01: 12,554.

Control OFF:

- PUMP-01: **0 píxeles cambiados**.

Artefactos principales:

- `qa-artifacts/v21-terrain-animation/summary.json`;
- `qa-artifacts/v21-terrain-animation/pixel-diff.json`;
- `qa-artifacts/v21-terrain-animation/http-smoke.json`;
- `qa-artifacts/v21-terrain-animation/reception-earthwork.png`;
- `qa-artifacts/v21-terrain-animation/MILL-01-on-a.png`;
- `qa-artifacts/v21-terrain-animation/PUMP-01-on-a.png`;
- `qa-artifacts/cdp_v21_terrain_animation_probe.mjs`.

## 8. Protección del motor de cálculo

Comparación byte a byte contra el checkpoint V20:

- `src/controller/`: 0 cambios;
- `src/core/`: 0 cambios;
- `src/state/`: 0 cambios;
- `src/process/`: 0 cambios;
- `src/reporting/`: 0 cambios.

Resultado: **calculation guard PASS**.

Artefactos:

- `qa-artifacts/v21-calculation-guard.json`;
- `qa-artifacts/v21-source-diff-v20.json`.

## 9. Blender y GLB

Después del build:

- public: **24 GLB / 5,704,036 bytes**;
- dist: **24 GLB / 5,704,036 bytes**;
- mismatches public/dist: **0**.

Master Blender consolidado sin cambios:

- `blender/PULPA_LAB_BLENDER_MASTER_V17.blend`;
- 688,141 bytes;
- SHA-256 `E78577DAE8E533429B84FC13FC054036684F6D36AB5F1A3D76AB4CCA787CACA6`.

## 10. Pruebas y build

Suite final:

- **66/66 test files PASS**;
- **340/340 tests PASS**;
- exit code 0;
- duración **223.30 s**.

Build final:

- `npm run build`: PASS;
- Vite 7.3.7;
- **105 modules transformed**;
- warning Three.js >500 kB: informativo.

La suite cubre cálculo académico y físico preexistente, rutas/endpoints, infraestructura, grounding, clips Blender, toggle de animaciones, terreno, escala métrica, Blender terrain overlay, inspección, mobile equipment y regresión geométrica.

## 11. CI y publicación

`.github/workflows/ci.yml` ejecuta en `main` y pull requests:

- `npm ci`;
- `npm test`;
- `npm run build`.

Destino GitHub: `PercyPortilla/SIMULADOR-MECANICA-DE-FLUIDOS`.

Destino Vercel: `https://simulador-mecanica-de-fluidos.vercel.app`.

La publicación se realiza sólo después de generar y verificar el checkpoint V21; la conexión GitHub → Vercel permanece configurada para desplegar automáticamente `main`.

## 12. Resultado

V21 corrige los defectos visuales reportados sin esconderlos con offsets arbitrarios: repara la causa de los pivotes, añade movimiento sólo donde tiene sentido físico, valida la escala en metros y reemplaza la recepción plana por una plataforma elevada con talud, berma y pie. Blender mejora la lectura visual del movimiento de tierras sin convertirse en una segunda fuente de verdad geométrica.
