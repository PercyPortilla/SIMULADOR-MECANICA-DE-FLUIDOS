# V2 Phase V23C — Recepción y maquinaria

## Alcance

Ajuste exclusivamente visual/operativo de la maquinaria móvil de Z1 y del preset de cámara `Recepción / carguío`.

## Cambios

- `TRUCK-01` permanece en ROAD-01 como vehículo de acceso.
- `TRUCK-02` se desplaza ligeramente dentro de ROAD-01 para aumentar el intervalo de cola.
- `TRUCK-03` se coloca como unidad próxima a descarga, fuera de la envolvente física de la tolva/plataforma ROM.
- `LOADER-01` pasa a un apron lateral separado de la cola de camiones.
- La cámara de Recepción se desplaza hacia el corredor ROAD-01/apron y usa FOV 46 para mantener los cuatro vehículos y la recepción dentro del encuadre.

## No modificado

- Topografía y `getTerrainHeight()`.
- Equipos fijos de recepción/chancado/acopio.
- State, cálculos, processRoute.
- Piping y conveyors.
- Geometría/factory de haul truck y wheel loader.

## Objetivo

Reducir congestión visual en Z1 sin cambiar escalas ni añadir maquinaria.

## Validación directa

- 0 solapes significativos entre TRUCK-01, TRUCK-02, TRUCK-03 y LOADER-01.
- 0 penetraciones significativas entre vehículos y mallas físicas de `MINERAL-RECEPTION`.
- Los cuatro vehículos y la recepción quedan dentro del frustum 16:9 del preset `reception`.
- Todos los vehículos mantienen `position.y === getTerrainHeight(x, z)`.
- `scene.fog` permanece `null`.
