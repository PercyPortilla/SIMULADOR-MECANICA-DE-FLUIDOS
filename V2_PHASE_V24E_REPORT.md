# V24E — Revisión final de sombras y contraste por zona

## Alcance
Se revisaron únicamente Recepción (Z1), Lixiviación (Z6) y Recuperación (Z8) bajo la iluminación introducida en V24D. No se modificaron procesos, geometría, posiciones, cámaras, materiales, puertos ni conexiones.

## Hallazgos
- Recepción ya estaba correctamente integrada al modelo de sombras: todos sus meshes proyectaban y recibían sombra.
- En R-01 y, por extensión, el tren de lixiviación, varios detalles secundarios añadidos en V23F (escalera, gearbox, ménsulas y otros meshes de mantenimiento) no participaban de forma consistente en cast/receive shadows.
- En Recuperación, algunas guardas y barandas añadidas como detalles secundarios tampoco participaban de forma consistente en el modelo de sombras.

## Corrección
Se normalizaron los flags `castShadow` y `receiveShadow` para todos los meshes de reactores y equipos de recuperación. Las líneas `LineLoop` de baranda permanecen como líneas y no se fuerzan a proyectar sombras.

## Validación
- MINERAL-RECEPTION: 29/29 meshes con castShadow y receiveShadow.
- R-01: 41/41 meshes con castShadow y receiveShadow.
- CIP-ADSORPTION: 21/21 meshes con castShadow y receiveShadow.
- ELUTION-SKID: 15/15 meshes con castShadow y receiveShadow.
- EW-CELLS: 21/21 meshes con castShadow y receiveShadow.
- SMELTING-FURNACE: 13/13 meshes con castShadow y receiveShadow.
- `scene.fog` permanece `null`.
- Delta máximo de posiciones de puertos frente a V24D: 0 m.
