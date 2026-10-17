# PULPA LAB 3D — V7 Equipment Catalog V1 — Fase Final

## Alcance

Se ejecutó la estrategia aprobada de **modelado aislado antes de integración**. Los nuevos modelos no fueron colocados en la planta, no se movió el masterplan, no se alteraron rutas de trucks, carreteras, piping global ni cámaras principales.

Convención: **1 unidad Three.js = 1 metro**.

## Regla maestra

- Arquitectura Vite + Three.js preservada.
- `package.json` y `package-lock.json` byte-identical al checkpoint de entrada.
- Los assets no contienen `requestAnimationFrame`; solo exponen `update(dt)`.
- Equipment Lab usa un único animation loop.
- Animación OFF congela el estado; ON continúa desde el estado existente.
- Los assets se instancian en `(0,0,0)` y no dependen de terreno, roads, cámaras, state ni rutas de la planta.
- Modos disponibles: `normal`, `transparent`, `cutaway`, `interior`.
- Contrato común: `create`, `update`, `setAnimationEnabled`, `setInspectionMode`, `getPorts`, `getDimensions`, `getBoundingBox`, `updateLOD`, `dispose`.

## Fases ejecutadas

| Fase | Resultado |
|---|---|
| 0 — Equipment Lab | `equipment-lab.html`, grid métrico, OrbitControls, bbox, ports, humano 1.75 m, selector de assets |
| 1 — Material Library | PBR: painted steel, bare/stainless steel, rubber, glass, concrete, ore, slurry, pipe, copper, refractory |
| 2 — Common Components | mining wheel, hydraulic cylinder, motor, gearbox, guard, rails, ladders, platforms, pipes, work lights |
| 3 — Haul Truck | 10.0 × 5.25 × 5.05 m, seis neumáticos, dirección, tolva, hoist, carga mineral |
| 4 — Mining Shovel | 9.9 × 8.0 × 8.1 m, tracks, slew, boom, stick, bucket, mineral |
| 5 — Wheel Loader | 12.0 × 3.75 × 4.25 m, articulación, lift arms, linkage, bucket |
| 6 — ROM Hopper | 11.5 × 9.2 × 7.6 m, grizzly, liners, estructura, mineral interno |
| 7 — Apron Feeder | 8.4 × 2.8 × 1.85 m, pans móviles, shafts, drive y mineral |
| 8 — Jaw Crusher | 5.4 × 4.2 × 4.7 m, fixed/moving jaw, flywheels, eccentric, mineral |
| 9 — Conveyor | generador paramétrico; ejemplo catálogo 16 m, belt/pulleys/idlers/walkway/mineral |
| 10 — Ball Mill | shell Ø4.5 × 7 m; `staticGroup` y `rotatingGroup` explícitos |
| 11 — Slurry Pump | volute, suction/discharge, impeller, shaft, motor y slurry path |
| 12 — Cyclone Cluster | 6 × 500 mm conceptuales, manifold, overflow header, underflow y swirl interno |
| 13 — Leach Reactor | Ø7 m, baffles, agitator, dos impellers, slurry y ports |
| 14 — CIP | cuatro etapas, agitadores, screens, plataformas y piping local |
| 15 — Elution | column, tank, pumps, heat exchanger, local piping y internals |
| 16 — EW | cuatro celdas, electrolyte, cathodes/anodes conceptuales, bus bars y rectifier cabinet |
| 17 — Smelting | furnace inclinable, refractory, melt glow, hood, duct y crucible |
| 18 — LOD | contrato común de LOD0/LOD1/LOD2 mediante `lodTier` y distancia de cámara |
| 19 — QA aislado | selector de los 15 assets, bbox, humano y ports en Equipment Lab |
| 20 — 4K / Close-up | botón de captura 3840×2160 y cámara close-up |
| 21 — Ports | ports locales transformados a world space; tipos de material/slurry/service/electrical |
| 22 — Metadata | id, category, referenceClass, dimensions, capabilities y ports |
| 23 — Isolation | auditoría sin dependencias de terrainHeight/baseEnvironment/haulRoad/cameras/state/processRoute |
| FINAL | freeze del catálogo; **sin integración a planta** |

## Corrección crítica del molino

El nuevo molino aislado separa:

- `mill-static-group`: fundaciones, bearing housings, motor, gearbox, coupling guard, pinion y plataforma.
- `mill-rotating-group`: shell, heads, trunnions rotativos, girth gear, liners/carga y trommel.

La animación aplica únicamente:

`rotatingGroup.rotation.x -= dt * 0.34`

No existe animación sobre `root.rotation` ni sobre `staticGroup`. El eje está elevado a `AXIS_Y = 3.05 m`, con shell de radio 2.25 m, por lo que el shell queda geométricamente por encima del ground de la escena aislada.

## Inventario final

| Asset | Dimensiones objetivo | Animación | Ports | N/T/C/I | LOD | Estado de implementación |
|---|---|---|---|---|---|---|
| Haul Truck | 10.0×5.25×5.05 m | ruedas/steering/dump | — | sí | sí | ✅ implementado |
| Mining Shovel | 9.9×8.0×8.1 m | slew/boom/stick/bucket | — | sí | sí | ✅ implementado |
| Wheel Loader | 12.0×3.75×4.25 m | articulation/arms/bucket | — | sí | sí | ✅ implementado |
| ROM Hopper | 11.5×9.2×7.6 m | material | in/out | sí | base | ✅ implementado |
| Apron Feeder | 8.4×2.8×1.85 m | pans/ore | in/out | sí | sí | ✅ implementado |
| Primary Crusher | 5.4×4.2×4.7 m | jaw/flywheel/ore | in/out | sí | sí | ✅ implementado |
| Conveyor | 16 m ejemplo | belt/pulley/ore | in/out | sí | sí | ✅ implementado |
| Ball Mill | 10.6×6.1×5.65 m envolvente | rotating assembly | feed/slurryOut | sí | sí | ✅ implementado |
| Slurry Pump | 4.8×2.65×2.55 m | impeller/slurry | suction/discharge | sí | sí | ✅ implementado |
| Cyclone Cluster | 5.4×5.4×5.4 m | swirl | feed/overflow/underflow | sí | sí | ✅ implementado |
| Leach Reactor | 7.6×7.6×8.8 m | agitator/slurry | feed/out/drain/reagent | sí | sí | ✅ implementado |
| CIP | 13.8×7.4×6.9 m | agitators/slurry | slurry/carbon | sí | sí | ✅ implementado |
| Elution | 9.4×5.6×6.4 m | pumps/liquid | carbon/solution | sí | sí | ✅ implementado |
| Electrowinning | 10.8×5.8×3.8 m | electrolyte | solution/electrical | sí | sí | ✅ implementado |
| Smelting Furnace | 7.4×5.8×6.6 m | tilt/glow | feed/exhaust/product | sí | sí | ✅ implementado |

## Validación ejecutada

- 102 archivos JS/MJS revisados con `node --check`: **0 errores de sintaxis**.
- 248 imports relativos inspeccionados: **0 imports faltantes**.
- Auditoría específica Equipment Catalog: **129/129 checks estáticos aprobados**.
- 15/15 assets requeridos presentes.
- Assets: **0 `requestAnimationFrame`**.
- Equipment Lab: **1 animation loop**.
- 108 archivos del checkpoint original comparados por SHA-256: **0 modificados, 0 faltantes**. Solo se añadieron los módulos del catálogo/laboratorio/reportes/tests.
- `package.json`: SHA-256 idéntico al original.
- `package-lock.json`: SHA-256 idéntico al original.

## Validación no disponible en este entorno

### `npm test`

**⛔ NO VALIDADO.** Exit 127: `vitest: not found`.

### `npm run build`

**⛔ NO VALIDADO.** Exit 127: `vite: not found`.

### Instalación de dependencias

- `npm ci --offline`: no fue posible porque la caché no contiene todas las dependencias (`ENOTCACHED`).
- acceso a `registry.npmjs.org`: resolución DNS bloqueada/timeout en este entorno.
- no se cambiaron versiones ni archivos package para forzar la instalación.

### Browser/WebGL/4K visual QA

**⛔ NO VALIDADO en ejecución real** por la misma ausencia de dependencias. El Equipment Lab y la captura 4K están implementados, pero no se declara una validación visual que no pudo ejecutarse.

Por esta razón, los assets están **implementados y estáticamente validados**, pero su estado de QA runtime/visual final debe permanecer `⛔ NOT VALIDATED` hasta abrir `equipment-lab.html` con dependencias instaladas.

## Archivos principales nuevos

- `equipment-lab.html`
- `src/equipmentLab.js`
- `src/equipmentLab.css`
- `src/equipment/common/*`
- `src/equipment/mining/*`
- `src/equipment/crushing/*`
- `src/equipment/conveying/*`
- `src/equipment/grinding/*`
- `src/equipment/classification/*`
- `src/equipment/leaching/*`
- `src/equipment/recovery/*`
- `src/equipment/catalog/equipmentCatalog.js`
- `tests/equipment/*`
- `EQUIPMENT_CATALOG_V1.json`
- `EQUIPMENT_LAB_README.md`
- `outputs/EQUIPMENT_STATIC_AUDIT_V1.json`

## Freeze

**DETENIDO EN FASE FINAL.**

No se integraron los nuevos assets en la planta, no se rehicieron carreteras y no se construyó piping global. Esas tareas pertenecen a una futura etapa de integración y quedan deliberadamente fuera de este checkpoint.
