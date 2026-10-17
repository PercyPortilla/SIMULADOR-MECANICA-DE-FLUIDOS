# PULPA LAB V13 — Geotecnia 3D por fases

**Fecha:** 2026-10-12  
**Base:** `PULPA_LAB_CHECKPOINT_V12_ENTORNO_3D_FASES_COMPLETAS(2).zip`  
**Alcance:** representación geotécnica visual/didáctica. La física de proceso, hidráulica, reología, estado y reporting se mantiene fuera de este cambio.

## Resultado por bloques

| Bloque | Estado | Implementación |
|---|---|---|
| 0 — Regla maestra | COMPLETO | Auditoría de arquitectura, circuito y límites de no regresión. `src/core`, `src/controller`, `src/state` y `src/reporting` quedan protegidos. |
| 1 — Arquitectura geotécnica | COMPLETO | Nuevo subsistema modular en `src/scene/geotech/` con unidades naturales, ingenieriles e hidrogeológicas. |
| 2 — Estratigrafía natural | COMPLETO | Topsoil, suelo granular/cohesivo, roca meteorizada y macizo rocoso con interfaces suaves; dentro del tajo la excavación revela roca. |
| 3 — Modo Geotecnia | COMPLETO | Toggle `Geotecnia / subsuelo`, OFF por defecto, persistencia de sesión, transparencia selectiva de terreno/pads/roads y leyenda conceptual. |
| 4 — Conminución | COMPLETO | Cimentaciones visuales de `PRIMARY-CRUSHER` y `MILL-01`, con relleno estructural y contacto competente derivado del perfil natural. |
| 5 — ROAD-01 / Stockpile | COMPLETO | ROAD-01 muestra rodadura, base, subbase y relleno; stockpile muestra plataforma granular y drenante sin modificar su trazado operativo. |
| 6 — Suelo blando / purga | COMPLETO | Dominio cohesivo localizado junto a R-04, excavación conceptual y reemplazo con relleno estructural. |
| 7 — Nivel freático | COMPLETO | Superficie freática conceptual variable y deprimida hacia el tajo/pit sump; explícitamente no calibrada. |
| 8 — Contención | COMPLETO | Contención secundaria conceptual bajo reactores y recuperación. No se creó heap-leach pad ni flotación. |
| 9 — Etiquetas / inspección | COMPLETO | Etiquetas geotécnicas con LOD por cámara y compatibilidad con el control global de labels. |
| 10 — Calidad visual | COMPLETO | Materiales/texturas procedurales por unidad, transparencias y diferenciación natural vs construida. |
| 11 — Regresión | COMPLETO CON LIMITACIÓN DE ENTORNO | Sintaxis, imports, JSON, alcance de cambios y hashes de física verificados. Vitest/build no pueden ejecutarse sin dependencias instaladas. |
| 12 — Auditoría final | COMPLETO | Revisión de tajo, ROAD-01, chancadora, stockpile, molino, sump, bomba, clasificación, R-01…R-04, CIP, elución, EW y fundición. |

## Arquitectura añadida

- `src/scene/geotech/geotechModel.js`: definición conceptual de unidades, estratigrafía, dominio cohesivo y nivel freático.
- `src/scene/geotech/geotechMaterials.js`: materiales y texturas procedurales para unidades naturales/ingenieriles.
- `src/scene/geotech/geotechnicalSystem.js`: geometrías, cimentaciones, ROAD-01, stockpile, purga, contención, freático, labels y lifecycle.
- `src/scene/baseEnvironment.js`: integración, visibilidad, actualización por cámara y dispose.
- `src/main.js` / `src/styles.css`: control UI y leyenda.
- `tests/scene/geotechnics.test.js`: pruebas específicas del nuevo módulo; `baseEnvironment.test.js` ampliado.

## Auditoría de áreas

| Elemento | Estado | Revisión |
|---|---|---|
| Tajo abierto | PASS | La excavación revela roca; el freático conceptual baja hacia el pit sump. |
| ROAD-01 | PASS | Capas constructivas visuales; ruta existente preservada. |
| PRIMARY-CRUSHER | PASS | Cimentación visual profunda sin mover el equipo. |
| Stockpile | PASS | Plataforma granular/drenante y relleno estructural. |
| MILL-01 | PASS | Cimentación conceptual para cargas severas, separada de la geología natural. |
| SUMP-01 | PASS | Geometría/lógica existente preservada. |
| SLURRY-PUMP-01 | PASS | Hidráulica y posición no modificadas. |
| CLASS-01 | PASS | Proceso y posición no modificados. |
| R-01…R-04 | PASS | Contención secundaria; R-04 incorpora purga localizada. |
| CIP / Elución / EW | PASS | Áreas preservadas con tratamiento de contención conceptual. |
| Fundición | PASS | Área existente preservada; sin procesos ficticios añadidos. |

## Validación final

- `node --check`: **170 archivos JS/MJS PASS** (excluyendo `dist` y `node_modules`).
- Imports relativos: **357 comprobados, 0 faltantes**.
- JSON: **31 archivos PASS**.
- Invariantes estáticos V13: **21/21 PASS**.
- Hashes de `src/core`, `src/controller`, `src/state`, `src/reporting`: **sin cambios frente a V12**.
- Cambios de fuente limitados a los 8 archivos/carpetas esperados para integración geotécnica y tests.

### Limitación de runtime

`node_modules` no está incluido en el checkpoint. Los intentos previos de `npm ci` no pudieron recuperar las dependencias porque el registro npm falló con `EAI_AGAIN`. Por ello, el intento final de `npm test` termina con `vitest: not found` y `npm run build` con `vite: not found`. **No se declara falsamente un PASS de Vitest ni de build.**

El `dist` incluido sigue correspondiendo al checkpoint previamente compilado y **no** representa los cambios V13. Debe regenerarse en un entorno con las dependencias disponibles antes de despliegue de producción.

## Criterio técnico final

La geología natural existe independientemente del layout. Las soluciones de ingeniería —purga, rellenos, bases, cimentaciones y contención— se superponen como obras civiles. La nueva capa es explícitamente conceptual y visual: no agrega propiedades geomecánicas inexistentes ni altera resultados de transporte, bombeo, reología o recuperación.
