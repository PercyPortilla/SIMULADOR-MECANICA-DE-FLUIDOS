# PULPA LAB V25 — Rendimiento y Fidelidad Operacional

Fecha de cierre técnico: **2026-10-17**

## Objetivo

V25 parte del checkpoint V24 publicado y mejora el costo de mantenimiento visual de la escena y la fidelidad de ciclos operacionales sin modificar la ingeniería autoritativa. Three.js sigue siendo el runtime; Blender/GLB sigue siendo la capa industrial híbrida. No se migró a Babylon.js, no se regeneraron GLB y no se tocaron ecuaciones para resolver aspectos visuales.

## Bloques cerrados

1. **LOD adaptativo + Inspection seguro.** El refresco LOD responde cada 0.125 s cuando la cámara cambia, baja a un safety refresh de 2 s en cámara estática y fuerza refresh al cambiar preset. Inspection sigue actualizando LOD con `Animaciones` desactivado. Se sincroniza `inspectionMode` para impedir que un refresh vuelva a mostrar shells ocultas en Interior.
2. **Fidelidad de animación.** `SMELTING-FURNACE` conserva el GLB existente pero mapea su clip de tilt al ciclo operacional de 16 s, con ventana activa 8.8–13.12 s y dwell el resto del ciclo. Shovel y loader importados arrancan con el mineral del balde oculto hasta que el ciclo operacional lo carga.
3. **Inspection y contratos híbridos.** EW-CELLS y SMELTING-FURNACE reciben hotspots educativos de componentes. Las estaciones HEAD/TAIL de conveyor se validan cargando los GLB reales y conservan el marcador rotatorio procedural sin duplicar la polea. R-01..04 conservan desfases de agitador sobre el GLB real.
4. **Rendimiento interno y QA.** Cada handle cachea su estado LOD por tier, modo de Inspection, estado visual y revisión de contenido. Los fallbacks procedurales Blender ocultos se podan del recorrido. La llegada asíncrona de módulos Blender incrementa una revisión LOD y fuerza reevaluación segura.

## Resultado de rendimiento

En la planta integrada procedural, un harness de V25 registró 1,943 lecturas de mesh en el primer pase LOD; 20 pases con el mismo estado realizaron 0 lecturas adicionales. Tras un cambio real de tier se reevaluaron 492 meshes y otros 20 pases sin cambio volvieron a 0. La política no elimina el safety refresh global: reduce el trabajo interno cuando el estado visible de cada equipo no cambia.

## Protecciones de ingeniería

- `src/controller/`, `src/core/`, `src/state/`, `src/process/` y `src/reporting/`: **0 diferencias frente al V24 publicado** (`8812f8b75f90059b2f55fc06455fe8ecab3c954f`).
- No se modificaron reología, hidráulica, bombeo, energía, lixiviación ni recuperación.
- No se modificó la secuencia del proceso.
- No se cambiaron centerlines, endpoints, diámetros físicos o longitudes hidráulicas para resolver visuales.
- `getTerrainHeight()` continúa como autoridad de terreno y `scene.fog = null` se conserva.
- Se mantienen 38 targets de Inspection y 7 focus profiles.
- `PULPA_LAB_BLENDER_MASTER_V17.blend` y `RECEPTION-EARTHWORK-V21.glb` permanecen sin regeneración.

## Validación

- Bloque 1: **28/28** pruebas dirigidas PASS; build y audit heredado PASS.
- Bloque 2: **47/47** pruebas específicas PASS; regresión combinada Bloques 1–2 **75/75** PASS.
- Bloque 3: **67/67** pruebas dirigidas PASS.
- Bloque 4: **35/35** pruebas dirigidas PASS; audit V25 **13/13** PASS.
- Full suite después de metadata V25: **77/77 files, 393/393 tests PASS**, 148.63 s.
- Clon de publicación antes de commit/push: **77/77 files, 393/393 tests PASS**, 147.46 s.
- Build final: **PASS**, Vite 7.3.7, 111 módulos transformados.
- Audit de compatibilidad V24: **34/34 PASS**.
- Terrain/civil V22: **14/14 PASS**.
- Escala visual V21: **16/16 PASS**.
- Integration/clearance: **157/157 PASS**.
- Public GLB vs dist: **24/24**, mismatches **0**.
- Calculation guard frente a V24: **0 diferencias** en los cinco directorios protegidos.

El warning del chunk Three.js >500 kB continúa siendo informativo. V25 evita una reestructuración agresiva o upgrades de dependencias únicamente para silenciarlo.

## Caveat de navegador

No se repitió el intento de navegador headless local que en el cierre V24 falló consistentemente con exit code 13. En V25, la fidelidad visual nueva se valida con cargas reales de `SMELTING-FURNACE.glb`, `LEACH-REACTOR.glb` y módulos HEAD/TAIL de conveyor dentro de Vitest, además de audits de runtime. La comprobación final de producción se realiza por HTTP, bundle y hashes después del despliegue.

## Assets protegidos

- `blender/PULPA_LAB_BLENDER_MASTER_V17.blend`: SHA-256 `E78577DAE8E533429B84FC13FC054036684F6D36AB5F1A3D76AB4CCA787CACA6`.
- `public/models/pulpa-blender/RECEPTION-EARTHWORK-V21.glb`: SHA-256 `59CB2AE7471EE5DE85A7E1186243C5C4D0D68E826897C4A8DF4DC6BE928FBA6A`.

## Resultado

V25 mantiene V24 como rollback limpio y añade rendimiento LOD medible, mayor fidelidad en fundición y equipos móviles, contratos híbridos verificables y extensión educativa de Inspection. El cambio sigue limitado a runtime/visualización/QA: la física y el proceso calculado permanecen protegidos.
