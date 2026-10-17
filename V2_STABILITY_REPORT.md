# PULPA LAB V2 — Stability Report

## Alcance
Auditoría final de arquitectura, regresión y estabilidad realizada sobre el checkpoint `PULPA-LAB-V2-17C-ANIMATIONS.zip`. No se agregaron nuevos procesos ni features de proceso. Solo se corrigieron problemas demostrables encontrados durante la auditoría.

## Resultado ejecutivo
- Sintaxis JavaScript: **PASS** (`node --check` sobre `src/` y `tests/`).
- Estado central: **PASS**. No se detectó cálculo desde DOM; `simulationState` sigue siendo la fuente de parámetros.
- Equipment/ports: **PASS**. 7 equipos registrados, 0 IDs duplicados, 14 puertos válidos y finitos.
- Piping/conveyors: **PASS estructural**. 7 objetos con rutas, sin NaN ni segmentos de longitud cero en la auditoría directa.
- Topografía: **PASS estructural**. Muestras de `getTerrainHeight()` finitas; caminos/equipos continúan ligados a la superficie.
- Cámaras: **PASS estructural**. 9 presets; ninguna cámara auditada queda por debajo del terreno.
- Fog: **PASS**. `scene.fog = null`.
- Layout temporal: **CORREGIDO**. Los volúmenes temporales de Fase 6C seguían visibles y ahora quedan ocultos por defecto.
- Regresión dinámica de lixiviación: **CORREGIDA**. `leachingTrainPiping.groups` ahora se actualiza al regenerar las conexiones.
- Pipe racks dinámicos: **CORREGIDOS**. Los racks se regeneran cuando cambia la geometría de las líneas asociadas.
- Marcadores de flujo dinámicos: **CORREGIDOS**. Las animaciones vuelven a leer rutas después de un cambio de Pipe 1; Pipe 1 aparece en los marcadores cuando pasa de longitud 0 a longitud válida.
- `npm test`: **BLOQUEADO POR ENTORNO**. Vitest no puede arrancar en este contenedor sin `@rollup/rollup-linux-x64-gnu`.
- `npm run build`: **BLOQUEADO POR ENTORNO** por la misma dependencia nativa de Rollup.

## Problemas demostrables corregidos

### 1. Referencias obsoletas en el tren de lixiviación
`refresh()` reconstruía R-02→R-03 y R-03→R-04, pero la propiedad pública `groups` seguía apuntando a los grupos Three.js anteriores. Esto podía dejar consumidores secundarios trabajando con geometría obsoleta.

**Corrección:** `groups` conserva la misma colección pública pero sustituye su contenido en cada `refresh()`.

### 2. Pipe racks desalineados después de modificar Pipe 1
Pipe 1 puede reposicionar R-02. Las líneas inter-etapa se regeneraban, pero los racks de Fase 15A permanecían en la ruta antigua.

**Corrección:** `processPipeRacks` dispone ahora de `refresh()` y se ejecuta después de refrescar el piping dinámico.

### 3. Marcadores de flujo desactualizados
Los marcadores de Fase 17C se construían una única vez al crear la escena. Como Pipe 1 inicia con longitud/diámetro 0, no tenía marcador; si después el usuario introducía valores válidos, la animación no reflejaba la nueva tubería.

**Corrección:** `industrialAnimations.refreshRoutes()` reconstruye los marcadores desde las rutas actualmente presentes. En validación directa, los marcadores de pipes pasaron de 4 a 5 al activar Pipe 1.

### 4. Placeholders de layout aún visibles en la planta final
Los volúmenes coloreados de validación de Fase 6C seguían activos después de existir equipos reales.

**Corrección:** el grupo `plant-layout-placeholders` se conserva para arquitectura/debug, pero queda `visible = false` por defecto.

## Auditoría por área

### STATE
- Fuente central: `src/state/simulationState.js`.
- `updateState()` valida forma conocida y números finitos/no negativos.
- No se encontraron consultas DOM dentro de `src/state`, `src/core` o `src/controller` usadas para calcular resultados.

### CORE
- Funciones matemáticas separadas de escena/UI.
- Las unidades internas declaradas permanecen SI.
- Recuperación continúa sin ecuaciones validadas; no se inventó un modelo.

### PROCESS
- Layout centralizado en `plantLayout.js`.
- `processRoute` único para recuperación.
- Recuperación sigue correctamente en `RECOVERY-PENDING-VALIDATION` con `stages = []`, `recoveryModel = null` y `finalProduct = null`.

### EQUIPMENT
IDs registrados durante la auditoría:
- R-01
- R-02
- R-03
- R-04
- MILL-01
- CLASS-01
- PUMP-01

Resultado: 7 IDs, 0 duplicados, 14 puertos auditados.

### PIPING
- Conexiones principales port-to-port.
- No se detectaron puntos no finitos en las rutas auditadas.
- No se detectaron segmentos consecutivos de longitud cero.
- Reducers siguen siendo explícitos, no inferidos visualmente.
- Pipe 1 mantiene separación entre diámetro físico y diámetro renderizado.

### TOPOGRAFÍA
- `getTerrainHeight(x,z)` sigue siendo la fuente central.
- Muestreo de la extensión de terreno: sin valores NaN/Infinity.
- Los volúmenes temporales de layout ahora están ocultos en la vista final.

### PLANTA
Presentes en la escena:
- recepción;
- chancado;
- stockpile;
- molienda;
- clasificación genérica no validada;
- tren de lixiviación R-01→R-04;
- bombeo PUMP-01;
- Z8 reservada para recuperación pendiente de validación.

### VISUAL
- Sin fog.
- 9 presets de cámara.
- 3 haul trucks y 1 wheel loader.
- Labels definitivos separados de placeholders.
- Materiales industriales centralizados.
- Animaciones industriales pausables.

### PERFORMANCE / LIFECYCLE
- Un único `requestAnimationFrame` en `createBaseEnvironment()`.
- `dispose()` cancela frame, desconecta `ResizeObserver`, desuscribe state y libera geometrías/materiales.
- No se detectaron `setInterval` ni loops adicionales.
- Los listeners de UI se crean una vez durante el arranque de la SPA; no se encontró duplicación demostrable en el flujo actual.

### UI
- Breakpoints responsive presentes en 980, 700, 520 y 440 px.
- Los errores de inicialización 3D se capturan en `main.js` y se muestran en `#scene-error`.

## Verificación de dependencias
El ZIP final no contiene `node_modules`. Esto es deliberado y portable. Debe instalarse en el entorno destino con:

```bash
npm ci
npm test
npm run build
```

En el contenedor de auditoría, `npm ci` no pudo completar una instalación limpia por disponibilidad/red del registry. Una instalación local reutilizada sigue careciendo del paquete nativo Linux `@rollup/rollup-linux-x64-gnu`, por lo que Vitest y Vite fallan antes de cargar el código del proyecto. El `package-lock.json` sí declara `@rollup/rollup-linux-x64-gnu@4.64.3`.

Este punto debe comprobarse en Windows/Codex o en cualquier entorno con acceso normal a npm antes de considerar la build de producción formalmente verde.

## Deuda técnica pendiente
1. **Recuperación metalúrgica:** Z8 no debe modelarse hasta validar una ruta y ecuaciones reales.
2. **Clasificación:** `CLASS-01` continúa siendo una representación genérica; el proceso no está matemáticamente validado todavía.
3. **Pipe 1 / layout:** actualmente `lengthM` puede reposicionar R-02 horizontalmente. Conviene establecer límites físicos o desacoplar longitud hidráulica de distancia geométrica antes de permitir rangos grandes al usuario.
4. **Validación CI:** agregar un pipeline limpio que ejecute `npm ci`, `npm test` y `npm run build` en un runner controlado para eliminar diferencias de plataforma.

## Archivos modificados durante Fase 18
- `src/scene/piping/leachingTrainPiping.js`
- `src/scene/infrastructure/pipeRacks.js`
- `src/scene/animations/industrialAnimations.js`
- `src/scene/layout/plantLayoutVisuals.js`
- `src/scene/baseEnvironment.js`
- `tests/scene/infrastructure.test.js`
- `tests/scene/industrialAnimations.test.js`
- `tests/scene/baseEnvironment.test.js`
- `V2_STABILITY_REPORT.md`

## Conclusión
La arquitectura 3D queda más estable frente a cambios dinámicos de Pipe 1 y ya no muestra los placeholders temporales de layout. No se detectaron errores estructurales de NaN, IDs de Equipment duplicados, cámaras bajo terreno ni rutas de longitud cero. La única validación no cerrada es la ejecución formal de Vitest/Vite por el paquete nativo de Rollup del entorno; debe repetirse tras `npm ci` en el equipo destino.
