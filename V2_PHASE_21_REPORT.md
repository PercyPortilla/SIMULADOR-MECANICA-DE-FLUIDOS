# PULPA LAB V2 — Fase 21: validación visual/operativa

## Alcance
Validación geométrica y operativa de la escena completa sin añadir procesos nuevos.

## Problemas reales encontrados y corregidos
1. `CIP-ADSORPTION` y `ELUTION-SKID` se solapaban aproximadamente 0.37 m en X. Se desplazó mínimamente el skid de elución dentro de Z8, manteniendo la ruta y regeneración de conexiones/racks.
2. `TRUCK-02`, `TRUCK-03` y `LOADER-01` se solapaban entre sí y/o penetraban físicamente la estructura `MINERAL-RECEPTION`. Se reposicionaron sobre el corredor de acceso y el apron de carguío, manteniendo apoyo con `getTerrainHeight()`.
3. Se añadió `tests/scene/visualRegression.test.js` para impedir que vuelvan a aparecer esos solapes de envolventes.

## Verificaciones finales
- 11 equipos registrados; sin solapes significativos entre envolventes de equipos.
- 3 haul trucks + 1 wheel loader; sin solapes significativos entre vehículos.
- Ningún vehículo penetra los meshes físicos de recepción (se excluyen expresamente las superficies marcadoras de zonas operativas).
- Todos los vehículos conservan Y = `getTerrainHeight(x,z)`.
- `scene.fog === null`.
- 9 cámaras por encima del terreno.
- Recepción, Chancado/Acopio, Molienda/Clasificación, Lixiviación y Recuperación mantienen sus equipos objetivo dentro del frustum 16:9 de sus presets.
- Todos los archivos `.js` de `src/` y `tests/` pasan `node --check`.

## Limitación de esta validación
No se realizó una inspección humana rasterizada del WebGL final dentro de este contenedor. La validación de Fase 21 se hizo mediante escena Three.js real, matrices mundiales, `Box3`, frustums de cámara y comprobaciones de topografía. El ZIP final se entrega sin `node_modules` para evitar incompatibilidad de binarios entre Windows/Linux.
