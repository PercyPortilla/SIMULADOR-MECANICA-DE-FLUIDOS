# V23A — Ajuste de escala global, caminos y cámaras

## Alcance
Solo presentación global: ancho de haul roads y presets General/Top/Oblicua.

## Cambios
- `HAUL_ROAD_WIDTH`: 7.5 m → 7.0 m.
- Planta general: cámara acercada aproximadamente 20–25 % manteniendo las 8 huellas de zona dentro del frustum 16:9.
- Top: altura reducida para que la planta ocupe más viewport sin recortar zonas.
- Oblicua: cámara acercada manteniendo las 8 huellas de zona visibles.
- No se movió ningún equipo, vehículo, puerto, pipe, conveyor ni zona.
- No se modificó `getTerrainHeight()` ni `scene.fog`.

## Validación
- 8/8 huellas de zona dentro de General a 16:9.
- 8/8 huellas de zona dentro de Top a 16:9.
- 8/8 huellas de zona dentro de Oblicua a 16:9.
- El ancho de camino sigue siendo >= 7.0 m, coherente con el ancho visual máximo del haul truck simplificado.
- Todos los JS pasan `node --check`.

## Entorno de tests
La ejecución de Vitest no llegó a cargar los tests por el bloqueo externo ya conocido: falta `@rollup/rollup-linux-x64-gnu` en el `node_modules` temporal del contenedor. No apareció un error atribuible a V23A. Las validaciones directas de frustum y `node --check` sí pasaron.
