# PULPA LAB V24 — Operación y Realismo Industrial

Fecha de cierre: **2026-10-17**

## Objetivo

V24 parte del checkpoint V23 y hace que la planta 3D pase de una instalación estática bien detallada a una instalación visualmente operativa, manteniendo Three.js como runtime autoritativo y Blender/GLB como pipeline industrial. Los cambios de V24 son visuales, educativos u operacionales; no modifican el motor de cálculo.

## Bloques cerrados

1. **Vida operativa básica:** TRUCK-01..03 coordinados sobre ROAD-01, ruedas ligadas a distancia recorrida, pausas/aceleración/frenado visuales, excavadora y loader/reclaim bajo el toggle global.
2. **Flujo visible de mineral:** continuidad visual ROM → apron → chancadora → CV-02 → stockpile/reclaim → CV-03 → MILL-01 mediante overlays y cascadas ligeras/instanciadas.
3. **Realismo mecánico:** se reutiliza el detalle ya presente en crusher/apron/conveyors/mill/pumps/reactores y se añaden únicamente accesos/hardware faltante en CLASS-01 y CIP.
4. **Instrumentación:** PI/PT/FT/LT y ramas locales marcadas como visual-only y solverCoupled=false.
5. **Seguridad industrial:** señalización, extintores, eyewash, cercos/gate y referencias peatonales en ubicaciones compatibles con la operación.
6. **Infraestructura industrial:** transformer yard, workshop, cable tray, pickup y escala humana; se reutilizan MCC/control y luminarias existentes. Los conflictos previos de MCC/lighting-pole con caminos fueron corregidos.
7. **Terreno y huellas:** desgaste, finos, scuffs y spills controlados como overlays superficiales; no se cambia getTerrainHeight() ni ROAD-01..04.
8. **Planta de proceso viva:** cues neutros de líquido/agitación/glow desde molienda hasta fundición. Son representación educativa, no CFD.
9. **Inspection educativa avanzada:** hotspots compactos en MILL-01, SLURRY-PUMP-01, CLASS-01, PRIMARY-CRUSHER, CIP-ADSORPTION y ELUTION-SKID. Se conservan 38 targets y 7 focus profiles V23.
10. **Iluminación/acabado:** sun key centrado en el sitio, fill frío, ground bounce, ACES y PCFSoftShadowMap; scene.fog=null. Night mode se omitió por ser opcional y no justificar el costo/riesgo.
11. **Optimización:** política de sombras secundarias para detalles repetidos; recursos GLB siguen cacheados y compartidos. No se hicieron upgrades de dependencias ni reestructuración agresiva.

## Protecciones de ingeniería

- `src/controller/`, `src/core/`, `src/state/`, `src/process/` y `src/reporting/`: **sin cambios frente a V23 publicado**.
- No se modifican ecuaciones de reología, hidráulica, bombeo, energía, lixiviación o recuperación.
- No se cambia la secuencia del proceso.
- No se cambian diámetros físicos, endpoints o centerlines para resolver estética.
- Pipe 1 conserva separación entre geometría renderizada y longitud/accesorios del solver.
- `getTerrainHeight()` sigue siendo autoridad de terreno.
- `scene.fog = null` se mantiene.
- Blender master V17 y `RECEPTION-EARTHWORK-V21.glb` permanecen sin regeneración.

## Validación por bloque

- Bloque 1: 68/68 pruebas dirigidas PASS en el cierre inicial.
- Bloque 2: 28/28 PASS.
- Bloque 3: 48/48 PASS.
- Bloque 4: 36/36 PASS.
- Bloque 5: 28/28 PASS.
- Bloque 6: 26/26 PASS.
- Bloque 7: 19/19 PASS.
- Bloque 8: 62/62 PASS.
- Bloque 9: 39/39 PASS.
- Bloque 10: 9/9 PASS + build.
- Bloque 11: 21/21 PASS + build.
- Full suite final, después de marcar el release V24: **76/76 files, 384/384 tests PASS**, 153.44 s.
- Clon de publicación antes de commit/push: **76/76 files, 384/384 tests PASS**, 174.05 s.
- Build final: **PASS**, Vite 7.3.7, 111 módulos transformados.

El warning del chunk de Three.js >500 kB sigue siendo informativo; Three.js ya está separado como chunk obligatorio y no se aplicó una reestructuración de riesgo sólo para silenciarlo.

## Rendimiento

Auditoría V24 Block 11 registró como baseline aproximada: 4,998 objetos, 4,313 meshes, 13 InstancedMesh y 3,871 shadow casters en escena procedural. La política de sombras secundarias reduce los casters a aproximadamente 2,665 (~31% menos) sin retirar sombras a equipo mayor. En el path híbrido real se mantiene cache de GLB por URL y no se duplican descargas para reactores, camiones o bombas repetidos.

## Assets protegidos

- `blender/PULPA_LAB_BLENDER_MASTER_V17.blend`: SHA-256 `E78577DAE8E533429B84FC13FC054036684F6D36AB5F1A3D76AB4CCA787CACA6`.
- `public/models/pulpa-blender/RECEPTION-EARTHWORK-V21.glb`: SHA-256 `59CB2AE7471EE5DE85A7E1186243C5C4D0D68E826897C4A8DF4DC6BE928FBA6A`.

## Resultado

V24 conserva la ingeniería validada de V23 y añade operación visible, detalle industrial, contexto de planta, cues de flujo/proceso, instrumentación, seguridad, Inspection educativa y un ajuste de rendimiento de bajo riesgo. El simulador sigue diferenciando explícitamente entre cálculo autoritativo y visualización educativa.
