# V9 — PULPA LAB 3D Industrial Refinement Final Report

## Alcance

Se continuó exclusivamente desde **PULPA-LAB-INTEGRATED-V1 FINAL CLOSED** y se aplicó la especificación **PULPA-LAB-INDUSTRIAL-3D-V1**. Esta pasada no cambia el flowsheet, no inicia una etapa posterior y no modifica `package.json` ni `package-lock.json`.

Objetivo: cerrar los defectos pendientes de la última grabación: montaje/colisiones, conveyors, stockpile, piping, lectura de pulpa, clasificación→lixiviación, tren R-01..R-04, recuperación, terreno/caminos, móviles, render, cámaras, QA y performance.

## Ejecución fase por fase

| Fase | Resultado | Evidencia principal |
|---|---|---|
| Regla maestra | ✅ | Escala métrica, assets modulares, port→route→port, un loop principal y contratos `scene.fog=null` / `recoveryModel=null` preservados |
| 0 — Auditoría post-video | ✅ | `POST_VIDEO_ISSUE_INVENTORY.md` |
| 1 — Montaje/colisiones estructurales | ✅ | Marco local único para fajas; rail de reactor respaldado por walkway; dispose de Lines/Points corregido |
| 2 — Conveyors | ✅ | Head/tail pulleys, idlers de carga/retorno, trestles, bracing, walkway, handrails y mineral coherentes con pendiente y ports |
| 3 — Stockpile/reclaim | ✅ | Pila irregular determinista, pad compacto, rutas loader ajustadas |
| 4 — Piping industrial | ✅ | Soportes/shoes, flanges, válvulas, jerarquía por servicio, rutas port-to-port |
| 5 — Pulpa/partículas | ✅ | Core de slurry existente + `THREE.Points` discretos y preasignados en pipes/sump/pump/cyclones/reactores |
| 6 — Clasificación→lixiviación | ✅ | `P-CLASSIFICATION-TO-LEACH`; `P-CYCLONE-UNDERFLOW-RETURN` |
| 7 — Reactores | ✅ | R-01→R-02→R-03→R-04 localmente trazable; agitadores con phase offset; walkway/rail corregidos |
| 8 — Recuperación | ✅ | CIP/Elution/EW/Smelting conservan sus módulos y reciben infraestructura industrial adicional |
| 9 — Terreno | ✅ estático | Bancos con irregularidad controlada; layout no alterado |
| 10 — Roads | ✅ estático | Wheel tracks terrain-following; haul/service road architecture preservada |
| 11 — Móviles/colisiones | ✅ estático/geométrico | Loader route fuera del stockpile, dump standoff y shovel/truck spacing auditados |
| 12 — Render/materiales | ✅ estático | Menor predominio de losas blancas, foundations locales y exposición global ajustada |
| 13 — Cámaras | ✅ configuración / ⛔ visual | 9 presets y frustum 0.1–1600 confirmados; clipping visual requiere navegador real |
| 14 — Lectura de proceso | ✅ estático | Conexiones completas y `flowDirection=source-to-target` en piping/material links |
| 15 — Collision QA | ✅ estático | 139/139 checks de clearances/solapes calculados |
| 16 — Performance | ✅ estático | Un solo rAF de planta; no creación geometry/material/listeners en frame loop; scratch vectors; Points preasignados |
| 17 — QA real | ⚠️ parcial | Static QA completo; test/build/browser bloqueados por dependencias/red |
| Final — Freeze | ✅ | Checkpoint `PULPA-LAB-INDUSTRIAL-REFINED-V1`; no etapa adicional iniciada |

## Cambios técnicos de mayor impacto

### Conveyors

`src/equipment/conveying/conveyor.js` usa ahora un `conveyor-local-frame` autoritativo. Belt, pulleys, carrying/return idlers, stringers, trestles, braces, walkway, rails y drive comparten el mismo marco de pendiente. Los ports se calculan desde los endpoints reales y `assetIntegrationLayer.js` coloca el root sobre el punto medio 3D de source/target.

### Piping y pulpa

`pipingEngine.js` conserva `physicalDiameterM` separado de `visualDiameterM`, añade soportes y shoes a tramos horizontales largos, flanges de extremos, aislamiento visual y un stream de sólidos suspendidos preasignado. `integratedPiping.js` diferencia slurry, overflow, underflow, interstage y solution.

Las partículas brillantes representan **sólidos/mineral suspendido**, no oro macroscópico. Se redujo la opacidad para evitar apariencia de glitter. No son luces ni se crean por frame.

### Lixiviación

Las líneas interstage ya no dependen de un gran header elevado compartido: R-01→R-02→R-03→R-04 se enruta cerca de los ports de cada reactor. Los cuatro agitadores reciben offsets de fase para evitar sincronía artificial.

### Recuperación

Los assets siguen siendo independientes. CIP recibe ladder/pumps/header; Elution refuerza platform/rails/header; EW añade service walkway/electrical cabinet manteniendo busbars; Smelting añade exhaust stack, hood y rails. Las grandes losas de leach/recovery se sustituyen por foundations locales embebidas.

### Mina/civil/móviles

El pit conserva el diseño base pero sus bancos dejan de ser perfectamente concéntricos. El haul road recibe marcas de rodadura discretas. La ruta del loader se separó del volumen del stockpile y la shovel se reorientó al punto de carga.

## Evidencia automática final

| Auditoría | Resultado |
|---|---:|
| Sintaxis proyecto completo | **112/112 PASS** |
| Imports relativos | **263/263 PASS** |
| Equipment Catalog static audit | **129/129 PASS** |
| Integration static audit | **34/34 PASS** |
| Clearance/collision audit | **139/139 PASS** |
| Post-video refinement audit | **56/56 PASS** |
| `git diff --check` | **PASS** |
| `package.json` hash | `d8c70b9af27e5d4d4ff0cabad42d57382a468f549f489bdfcf9c62402c3cb3bf` |
| `package-lock.json` hash | `388ad48b259bcc317bffd619a5afa657b757e90f814c33b338afb8bd6c5eaa99` |

Los hashes de los dos manifests son los mismos que en el checkpoint de entrada.

## Instalación / test / build / navegador

Se volvió a intentar una instalación limpia sin modificar versiones ni manifests.

- Caché npm utilizable: insuficiente; `npm ci --offline` falla por ausencia de `why-is-node-running@2.3.0`.
- Registry: `https://registry.npmjs.org/`.
- Proxy: `null`.
- HTTPS proxy: `null`.
- Dependencias recuperables en checkpoints locales: no se encontró un `node_modules` completo ni tarballs locales suficientes.
- `npm ci` de red: falla con `EAI_AGAIN` para paquetes como `three`, `vite`, `vitest` y dependencias asociadas.
- `npm test`: **⛔ NO VALIDADO** — `vitest: not found`.
- `npm run build`: **⛔ NO VALIDADO** — `vite: not found`.
- Navegador/WebGL del simulador: **⛔ NO VALIDADO** — sin build/dev server ejecutable no es posible cargar esta revisión real de la aplicación en navegador.

No se cambió código, versiones o manifests para forzar la instalación.

## Matriz final

| Sistema | Estado | Evidencia | Límite |
|---|---|---|---|
| Montaje de barandas/plataformas | ✅ | Jerarquías locales y walkthrough estático | Confirmación visual final requiere navegador |
| CV-01/CV-02/CV-03 | ✅ | Ports/marco local + static audit | Render real ⛔ |
| Stockpile/reclaim | ✅ | Geometría/ruta + clearance audit | Render real ⛔ |
| Piping port-to-port | ✅ | Topología + engine | Interferencias sub-mesh puramente visuales: navegador ⛔ |
| Slurry con partículas discretas | ✅ implementación | Points preasignados | Calidad perceptual exacta: navegador ⛔ |
| Mill→Sump→Pump→Cyclones | ✅ | IDs/conexiones auditadas | Movimiento visible real ⛔ |
| Underflow→Mill | ✅ | `P-CYCLONE-UNDERFLOW-RETURN` | Browser ⛔ |
| Overflow→R-01 | ✅ | `P-CLASSIFICATION-TO-LEACH` | Browser ⛔ |
| R-01→R-04 | ✅ | 3 conexiones interstage | Browser ⛔ |
| R-04→CIP→Elution→EW→Smelting | ✅ | Slurry/solution/material links | Browser ⛔ |
| Recovery industrial presence | ✅ implementación | módulos enriquecidos | Evaluación visual final ⛔ |
| Truck/loader/shovel clearances | ✅ estático | 139/139 clearance audit | No-flotación/intersección durante render ⛔ |
| Molino hierarchy | ✅ | `staticGroup` / `rotatingGroup`; root no animado | No-hundimiento visible durante ciclo real ⛔ |
| Terrain/pads/roads | ✅ estático | terreno/civil actualizado | QA visual ⛔ |
| 9 cámaras | ✅ configuración | 9 presets, near/far verificados | Clipping visual ⛔ |
| Animaciones ON/OFF | ✅ contrato | loop/control conservado | Interacción real ⛔ |
| Normal/Transparent/Cutaway/Interior | ✅ contrato | sistema de inspección conservado | Interacción real ⛔ |
| `scene.fog === null` | ✅ | static audit | — |
| `recoveryModel === null` | ✅ | static audit | — |
| Loop principal | ✅ | solo `baseEnvironment.js` en runtime de planta | Equipment Lab tiene loop aislado |
| Geometría/material por frame | ✅ | performance audit | `pipe1.update()` es state-driven, no frame-driven |
| Listeners acumulativos | ✅ | performance audit | listeners solo en inicialización UI |
| npm test | ⛔ | `vitest: not found` | dependencia no recuperable |
| npm build | ⛔ | `vite: not found` | dependencia no recuperable |
| Browser/WebGL end-to-end | ⛔ | no app ejecutable sin deps | bloqueo de instalación |

## Freeze

Nombre del checkpoint: **PULPA-LAB-INDUSTRIAL-REFINED-V1**.

La Fase Final termina aquí. No se inicia ninguna fase o etapa posterior.
