# PULPA LAB 3D — Checkpoint Fase 11

Fecha de ejecución: 2026-10-10

## Alcance

Se aplicó la secuencia autorizada desde reglas generales hasta Fase 11, conservando la arquitectura Vite + Three.js, `package.json`, `package-lock.json`, IDs de equipos y separación entre cálculo físico y representación 3D.

## Estado por fase

| Fase | Estado | Resultado |
|---|---|---|
| 0 — Línea base | ✅ | Se inventariaron módulos, tests y discrepancias iniciales. |
| 1 — Escena/tests | ✅ | `scene.fog = null`; cámara General alineada a FOV 45. |
| 2 — Roads/Inspección | ✅ | `HAUL_ROAD_WIDTH = 9.0`; Inspección `minDistance=2.5`, `maxDistance=110`. |
| 3 — TRUCK-01 | ✅ | Movimiento integrado al lifecycle, altura por `getTerrainHeight()`, velocidad definida y ruta continua. |
| 4 — CV-01/02/03 | ✅ | Belt con flujo visual y mineral mediante `InstancedMesh`; sin crear geometría por frame. |
| 5 — Piping | ✅ | Auditoría: endpoints port-to-port y diámetros físico/visual ya estaban correctamente separados; no se alteraron diámetros físicos ni `recoveryModel`. |
| 6 — Animaciones globales | ✅ | Un único controlador pausa molino, agitadores, TRUCK-01, belts, mineral y marcadores; al pausar quedan visibles y congelados. |
| 7 — Coherencia industrial | ✅ | TRUCK-01 usa `ROAD-03` cerrado para evitar giro instantáneo; TRUCK-02/03 quedan en apartaderos y no bloquean su corredor. |
| 8 — 9 cámaras | ✅ | Nueve presets conservados; solo Inspección marcada como `orbit-pan-zoom`, las demás como `fixed-preset`. |
| 9 — Rendimiento | ✅ | Mineral instanciado; longitudes de ruta cacheadas; limpieza de markers mediante `Object3D.remove()`. |
| 10 — Validación integrada | ⚠️ | Contratos estáticos y sintaxis pasan. Tests/build/navegador quedan bloqueados por ausencia de dependencias instalables en este entorno. |
| 11 — Checkpoint | ✅ | Proyecto limpio preparado para empaquetado; dependencias y modelos físicos no fueron alterados. |

## Contratos finales verificados

- `scene.fog === null`.
- Haul roads: 9.0 m.
- Inspección: zoom 2.5 m a 110 m.
- 9 cámaras conservadas.
- TRUCK-01 animado mediante el mismo lifecycle global y pegado al terreno.
- TRUCK-01 utiliza `ROAD-03`, un circuito cerrado, evitando inversión instantánea de 180°.
- TRUCK-02 y TRUCK-03 permanecen estacionarios fuera del corredor animado.
- CV-01, CV-02 y CV-03 conservan estructura/rodillos/belt y ahora incorporan belt visualmente móvil y mineral móvil.
- Molino y agitadores siguen integrados al controlador global.
- Toggle Animaciones congela la lógica animada sin ocultar los indicadores.
- Piping mantiene endpoints y nominalDiameterM; el mínimo de representación visual sigue separado del diámetro físico.
- Ruta CIP → Elución → EW → Fundición conservada.
- `recoveryModel = null` conservado.
- Un solo loop principal de `requestAnimationFrame`; las dos apariciones corresponden a iniciar y reprogramar el mismo loop.

## Archivos funcionales modificados

- `src/scene/baseEnvironment.js`
- `src/scene/cameras/cameraPresets.js`
- `src/scene/environment/haulRoads.js`
- `src/scene/vehicles/mobileEquipment.js`
- `src/scene/conveyors/conveyorEngine.js`
- `src/scene/animations/industrialAnimations.js`

## Tests actualizados

- `tests/scene/baseEnvironment.test.js`
- `tests/scene/cameraPresets.test.js`
- `tests/scene/industrialAnimations.test.js`
- `tests/scene/mobileEquipment.test.js`
- `tests/scene/terrain.test.js`

## Validaciones ejecutadas

### Sintaxis

Se ejecutó `node --check` sobre todos los archivos JavaScript bajo `src` y `tests`.

Resultado: **0 fallos de sintaxis**.

### Integridad de dependencias

`package.json` y `package-lock.json` conservan exactamente los mismos SHA-256 que en el ZIP original.

### npm / build

La instalación offline falla con `ENOTCACHED`, por ejemplo para `why-is-node-running-2.3.0.tgz`. La caché npm está vacía y el entorno no puede resolver DNS hacia `registry.npmjs.org`.

Por esa razón no se declara como ejecutado exitosamente:

```bash
npm test
npm run build
```

Tampoco se declara una validación visual real de navegador que no haya podido realizarse.

## Pendiente para una máquina con acceso a npm

1. Ejecutar `npm ci` sin modificar versiones.
2. Ejecutar `npm test`.
3. Ejecutar `npm run build`.
4. Levantar `npm run dev` y validar visualmente las 9 cámaras, consola, clipping, sombras y movimiento integrado.
5. Corregir únicamente cualquier regresión observada; no añadir nuevas funciones durante esa validación.

## Modelos físicos deliberadamente no implementados

Este checkpoint sigue preparado para futuras fases de:

- ΔP;
- pérdidas por fricción;
- altura estática;
- potencia de bombeo;
- reología avanzada;
- lixiviación;
- recuperación metalúrgica.

No se inventaron ecuaciones para completar esas áreas.
