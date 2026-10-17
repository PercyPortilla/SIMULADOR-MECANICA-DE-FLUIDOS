# PULPA LAB V14 — Blender Integration Checkpoint

Fecha de cierre: 2026-10-16

## Base

Este checkpoint parte de PULPA_LAB_CHECKPOINT_V13_GEOTECNIA_3D_COMPLETA y conserva su circuito, hidráulica, reología, geotecnia, cámaras, inspección, rutas y lógica de proceso.

## Estrategia de integración

La migración visual no reemplaza la lógica del simulador. Los activos Blender se cargan con GLTFLoader sobre los mismos roots lógicos que ya usa PULPA LAB.

- El modelo procedural se conserva como fallback.
- El fallback solo se oculta cuando el GLB termina de cargar correctamente.
- Si un GLB falla, el equipo procedural sigue visible y funcional.
- Puertos, endpoints, diámetros, rutas, IDs e integración hidráulica no cambian.
- Los paths de modelos son relativos (models/pulpa-blender/...) para mantener compatibilidad con despliegue raíz o subruta.

## Activos Blender integrados

Recepción y manejo de sólidos:

- ROM-HOPPER.glb
- APRON-FEEDER.glb
- PRIMARY-CRUSHER.glb
- STOCKPILE-RECLAIM.glb

Núcleo reológico:

- MILL-01.glb
- SUMP-01.glb
- SLURRY-PUMP-01.glb
- CLASS-01.glb

Lixiviación y recuperación:

- LEACH-REACTOR.glb, instanciado para R-01 a R-04
- SLURRY-PUMP-01.glb, reutilizado para PUMP-01
- CIP-ADSORPTION.glb
- ELUTION-SKID.glb
- EW-CELLS.glb
- SMELTING-FURNACE.glb

Minería móvil:

- HAUL-TRUCK.glb
- MINING-SHOVEL.glb
- WHEEL-LOADER.glb

Total: 16 GLB, 6,787,244 bytes.

## Animación

- Molino: cuerpo rotatorio Blender.
- Bomba de pulpa: eje/acople rotatorio Blender.
- Reactores: agitador Blender.
- CIP: agitadores Blender.
- Apron feeder: loop de pans + sprockets.
- Chancadora: mandíbula móvil + flywheels.
- Fundición: tilt de horno.
- Excavadora y loader: ciclos mecánicos Blender.
- TRUCK-01: no usa una animación pregrabada para la dinámica principal. Three.js continúa gobernando ruta, dirección, giro de ruedas, carga y volteo mediante nodos semánticos Blender.

El camión exporta y conserva:

- HAUL-TRUCK_DUMP_PIVOT
- HAUL-TRUCK_WHEEL_STEER_FL
- HAUL-TRUCK_WHEEL_STEER_FR
- HAUL-TRUCK_WHEEL_SPIN_FL/FR/RL1/RL2/RR1/RR2
- HAUL-TRUCK_ORE_LOAD

## Conveyors

CV-01, CV-02 y CV-03 permanecen paramétricos por diseño. Su longitud, inclinación, soportes y contacto con la topografía se derivan de los endpoints reales del circuito. Convertirlos en GLB rígidos rompería esa propiedad.

Se conserva:

- cinta animada;
- mineral en movimiento;
- poleas;
- idlers;
- drive;
- walkway;
- soportes aterrizados individualmente;
- endpoints autoritativos.

## Correcciones adicionales heredadas V13

- terrain.bumpScale explícito en 0.085 para mantener rugosidad dentro de criterio.
- Shadow frustum vertical con mínimo de 250 m para cubrir la expansión mina + planta.

## Validación

Suite completa:

- Test Files: **56 passed / 56**
- Tests: **246 passed / 246**
- Exit code: **0**

Build:

- npm run build: PASS
- Vite: 97 modules transformed
- dist/models/pulpa-blender: 16 GLB presentes
- tamaño total GLB en build: 6,787,244 bytes

Validación GLB:

- 16/16 archivos con header GLB 2 válido.
- nodos semánticos de camión presentes.
- nodos rotatorios críticos de molino, bomba, feeder y crusher presentes.
- ningún archivo requerido ausente.

## Fuente Blender

El checkpoint incluye:

blender/PULPA_LAB_BLENDER_MASTER_V14.blend

También incluye los scripts de generación por bloques en:

blender/scripts/

## Alcance que no fue alterado

No se modificaron deliberadamente las ecuaciones reológicas, hidráulicas, balances metalúrgicos, cinética de lixiviación, recuperación ni lógica de resultados. La intervención se limita a visualización 3D, integración de assets, animación y dos correcciones de QA de terreno/iluminación.

## Nota de rendimiento

El bundle de Three.js sigue generando el warning de chunk >500 kB de Vite. No es un error de build. Los GLB se cargan como assets externos y no se incrustan dentro del JavaScript principal.
