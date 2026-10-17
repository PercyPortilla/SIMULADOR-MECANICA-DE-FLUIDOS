# Estado central

`simulationState.js` es la única fuente de verdad de los datos de simulación.
No lee ni escribe el DOM y no depende de Three.js.

## Unidades internas

| Dato | Unidad interna |
| --- | --- |
| `solidsMassFraction` | Fracción adimensional de 0 a 1 |
| Densidades | kg/m³ |
| `yieldStressPa` | Pa |
| `consistencyIndex` | Pa·s^n |
| `flowIndex` | Adimensional |
| Viscosidades | Pa·s |
| Diámetro, longitud y rugosidad | m |
| Velocidad | m/s |

Las secciones aún no definidas por el proyecto se mantienen como objetos vacíos;
no se agregan parámetros antes de que una fase los especifique.

La API pública consta de `getState`, `updateState`, `subscribe` y `resetState`.
`getState` entrega una copia para impedir mutaciones externas de la fuente de verdad.
