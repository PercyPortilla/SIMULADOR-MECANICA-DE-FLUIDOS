# PULPA LAB V16 — Rendimiento, UX educativa y animaciones verificadas

Fecha de cierre: **2026-10-16**

## 1. Objetivo de V16

V16 parte del checkpoint V15 y conserva la arquitectura **Three.js + Blender híbrida**. No migra a Babylon.js y no modifica las ecuaciones de reología, hidráulica, lixiviación, recuperación ni la lógica de resultados.

El trabajo de esta versión se concentró en tres objetivos:

1. verificar animaciones en runtime real, no sólo la existencia de clips GLB;
2. reducir costes de escena de forma segura sin rigidizar geometría paramétrica;
3. convertir el modo Inspección en una herramienta educativa ligada al flujo de proceso.

## 2. Verificación y corrección de animaciones

La auditoría final cubre los activos con movimiento Blender, las animaciones procedurales de Three.js y el control semántico del camión.

Se verificaron en close-up de producción:

- APRON-FEEDER
- PRIMARY-CRUSHER
- MILL-01
- SLURRY-PUMP-01
- CLASS-01
- R-01
- CIP-ADSORPTION
- SMELTING-FURNACE
- EXCAVATOR-01
- LOADER-01
- TRUCK-01

Los **11/11** pares de capturas A/B presentan cambios de píxel medibles. El control con el toggle global **Animaciones OFF** produce **0 píxeles cambiados**, confirmando pausa real.

La prueba de producción final también reporta:

- HTTP **200**
- runtime exceptions: **0**
- network failures: **0**
- GLB cargados: **23**

El camión conserva movimiento operacional controlado por Three.js mediante sus nodos semánticos de dump, dirección, giro de ruedas y carga; no se convirtió en una animación canned de GLB.

## 3. Recursos Blender y cache GLTF

### Módulos híbridos repetidos

Los módulos estáticos reutilizables se aplanan por material antes de instanciarse. Sus objetos siguen teniendo transforms independientes, mientras geometrías y materiales inmutables se comparten.

Esto se aplica a módulos de:

- head/tail/idlers/hood de conveyors;
- flanges;
- valves;
- saddles.

El dispose de una instancia no destruye recursos compartidos usados por otras instancias.

### Equipos GLB principales

blenderVisualReplacement.js incorpora cache de GLTF por URL. Equipos repetidos como los reactores de lixiviación o las bombas ya no necesitan parsear el mismo GLB de manera independiente.

Cada instancia se clona con SkeletonUtils, por lo que:

- sus transforms son independientes;
- sus AnimationMixer son independientes;
- geometrías/materiales inmutables pueden compartirse;
- un error de carga no envenena permanentemente el cache;
- el fallback procedural continúa disponible.

## 4. Optimización de sombras y hot paths

V16 mantiene sombras en las masas y siluetas importantes, pero evita que detalles repetitivos pequeños —por ejemplo ladder rungs, rail posts, motor fins, flywheel spokes y jaw ribs— entren innecesariamente al shadow pass.

También se optimizó el loop:

- updateLOD se limita a aproximadamente **8 Hz** en lugar de recorrer todos los assets cada frame;
- cuando el caudal de proceso es cero, las partículas y texturas de flujo no recalculan curvas, tangentes ni buffers;
- al reactivar caudal, el movimiento visual continúa normalmente.

No se cambió el caudal físico ni ningún resultado hidráulico.

## 5. Medición de rendimiento

La comparación se ejecutó sobre la misma escena general mediante CDP, con labels/geotecnia/animaciones desactivados para una base repetible.

| Métrica | Baseline V16 | V16 final | Cambio |
| --- | ---: | ---: | ---: |
| Renderer calls | 3164 | 2376 | -24.9% |
| GPU geometries | 5451 | 4172 | -23.5% |
| Meshes visibles | 3192 | 2395 | -25.0% |
| Shadow casters visibles | 3103 | 1865 | -39.9% |
| Unique geometries escena | 5470 | 4191 | -23.4% |
| Unique materials escena | 3757 | 2626 | -30.1% |
| Triángulos renderizados | 363032 | 363008 | prácticamente igual |

La reducción no proviene de quitar la geometría industrial esencial, sino de reutilizar recursos, aplanar detalle estático repetido y eliminar trabajo redundante.

### Optimización diferida

No se aplicó un merge/instancing agresivo a conveyors, pipe racks ni piping paramétrico. Esos sistemas aún contienen muchos objetos, pero alterar su granularidad tiene mayor riesgo porque deben preservar:

- span e incline de conveyors;
- belt/mineral motion;
- topographic grounding;
- pipe centerlines;
- endpoints;
- diámetros físicos;
- inspection semantics.

Ese bloque se deja deliberadamente para una fase posterior con QA específico.

## 6. UX educativa de Inspección

La lista anterior contenía **196 targets**, porque además de los equipos aparecían 158 hijos técnicos como flanges, supports, solids, racks y piezas internas.

V16 restringe el selector a los **38 targets explícitos** de INSPECTION_CIRCUIT_ORDER, manteniendo el orden real del recorrido.

Al seleccionar un elemento aparece una ficha compacta dentro del viewport con:

- qué hace el equipo o conexión;
- entrada;
- salida;
- variable clave;
- qué cambia realmente en el cálculo;
- anterior y siguiente dentro del recorrido.

La ficha distingue alcance físico de representación visual. En particular, sólo P-LEACH-R01-R02 se presenta como el **Pipe 1** ligado al cálculo hidráulico D/L/ε/v/Δz/K. Las demás tuberías 3D no se presentan falsamente como líneas hidráulicas independientes.

La guía cubre los **38/38 targets**, incluyendo mina, chancado, molienda, clasificación, lixiviación, bombeo, CIP, elución, EW y fundición.

## 7. QA de interfaz

Prueba CDP de MILL-01:

- selector: 38 targets + 1 placeholder;
- cámara cambia correctamente a inspection;
- ficha visible con contenido técnico;
- desktop sin errores runtime;
- viewport móvil de 390 px sin overflow horizontal;
- la ficha permanece contenida dentro del viewport.

## 8. Protección de cálculos y geometría física

Guard contra V15:

- archivos de cálculo comparados: **36**
- archivos cambiados: **0**

También se verificó:

- public/models/pulpa-blender: **23 GLB / 5,240,240 bytes**
- dist/models/pulpa-blender: **23 GLB / 5,240,240 bytes**
- mismatches de hash: **0**

No se cambiaron pipe diameters, centerlines, endpoints, puertos de equipo ni la geometría paramétrica autoritativa.

## 9. Suite y build

Suite final V16:

- **61 / 61** test files PASS
- **285 / 285** tests PASS
- exit code **0**
- duración: **142.78 s**

Incluye pruebas específicas nuevas de:

- cache/reutilización GLTF;
- independencia de transforms con recursos compartidos;
- shadow policy;
- throttling de LOD;
- no-op de flujo en Q=0;
- playback Blender;
- circuito exacto de inspección;
- cobertura educativa 38/38.

Build:

- npm run build: **PASS**
- Vite: **100 modules transformed**
- warning three > 500 kB: informativo, no error.

## 10. Blender y activos de release

Runtime V16:

- 16 GLB principales;
- 7 módulos híbridos reutilizables;
- total **23 GLB / 5,240,240 bytes**.

El archivo consolidado blender/PULPA_LAB_BLENDER_MASTER_V15.blend se conserva como master baseline de la arquitectura. Los GLB V16 incluyen regeneraciones/correcciones de animación producidas por los scripts Blender actualizados, especialmente Blocks 5/6 y los assets corregidos durante la auditoría.

No se renombró ni se presentó falsamente el master V15 como un master V16.

## 11. Evidencia de QA

Artefactos principales:

- qa-artifacts/v16-performance-baseline.json
- qa-artifacts/v16-performance-final.json
- qa-artifacts/v16-animation-runtime/probe-summary.json
- qa-artifacts/v16-animation-closeups/closeup-summary.json
- qa-artifacts/v16-animation-final-diff-summary.json
- qa-artifacts/v16-ux-summary.json
- qa-artifacts/v16-calculation-guard.json
- qa-artifacts/v16-public-dist-glb-hashes.json
- qa-artifacts/v16-glb-validation-final.json

## 12. Resultado

V16 queda cerrado como una versión más ligera y didáctica sin sacrificar fidelidad física: las animaciones críticas fueron verificadas en runtime, el coste de render y recursos se redujo de forma medible, el modo Inspección ahora sigue únicamente el circuito real y explica el vínculo equipo → variable → cálculo, y la suite completa permanece verde.

Three.js continúa como runtime autoritativo y la migración a Babylon.js sigue reservada para una experimentación posterior, no para este checkpoint.
