# V24F — Revisión final de rendimiento visual

## Alcance
Optimización conservadora de recursos GPU repetidos. No se modificaron geometría visible, transforms, puertos, conexiones, state, cálculos, processRoute ni cámaras.

## Hallazgo
Los equipos de recuperación creaban objetos `BufferGeometry` y `Material` independientes para copias geométricamente idénticas (tanques CIP, barandas y celdas EW). Esto aumenta asignaciones y recursos GPU sin aportar diferencias visuales.

## Corrección
- CIP: reutilización de geometrías/materiales para 3 tanques, 3 tapas, 3 guards, 3 drops y postes de baranda.
- Elución/Fundición: reutilización de recursos de postes de baranda.
- EW: reutilización de geometrías/materiales para 5 celdas, 5 rims, 5 electrodos y 2 bus bars.
- Se mantienen meshes separados, nombres separados y jerarquía idéntica. No se usa `InstancedMesh`, por lo que selección, sombras y debugging siguen funcionando como antes.

## Medición
Antes → después:
- CIP: 21 meshes, geometrías únicas 21 → 11, materiales únicos 21 → 10.
- Elución: 15 meshes, geometrías únicas 15 → 13, materiales únicos 15 → 12.
- EW: 21 meshes, geometrías únicas 21 → 8, materiales únicos 21 → 8.
- Fundición: 13 meshes, geometrías únicas 13 → 11, materiales únicos 13 → 10.

Total en estos cuatro equipos:
- meshes: 70 → 70 (sin cambio visual/jerárquico)
- geometrías únicas: 70 → 43
- materiales únicos: 70 → 40

## Regresión
Comparación directa V24E vs V24F:
- delta máximo de bounding box: 0 m en CIP, Elución, EW y Fundición.
- puertos: idénticos en posición local, dirección y diámetro nominal.
- nombres de meshes: idénticos.
- sombras: se mantienen mediante el mismo recorrido `enableMeshShadows()`.

## Pendiente
No se aplicó cache global de materiales porque las tuberías dinámicas disponen sus materiales al reconstruirse; compartir esos recursos globalmente requeriría una política explícita de ownership/disposal. Se evita esa optimización por seguridad.

## Validación de entorno
- `node --check`: PASS para `src/` y `tests/`.
- `npm test` / `npm run build`: bloqueados antes de ejecutar código por `@rollup/rollup-linux-x64-gnu` ausente en el entorno Linux temporal.
- La regresión geométrica/puertos y la medición de recursos se ejecutaron directamente con Three.js y pasaron.
