# V23D — Labels más discretos

## Alcance
Se ajustó exclusivamente la presentación del sistema existente de labels de planta. No se alteraron equipos, geometría, cámaras, topografía, rutas, state, cálculos ni processRoute.

## Cambios
- Se redujo el tamaño base de las etiquetas.
- Se redujo la opacidad del fondo y del borde de las tarjetas.
- Se elevaron ligeramente para disminuir interferencia con equipos.
- Planta general, Top y Oblicua mantienen las 8 etiquetas con menor protagonismo.
- Las vistas específicas priorizan las zonas activas y atenúan las etiquetas alejadas.
- Inspección continúa ocultando las etiquetas.
- Se mantiene el toggle existente `Mostrar etiquetas`.

## Perfiles por cámara
- Overview (`general`, `top`, `oblique`): todas visibles, escala contenida y opacidad moderada.
- Recepción: Z1 prioritaria.
- Chancado/acopio: Z2 y Z3 prioritarias.
- Molienda/clasificación: Z4 y Z5 prioritarias.
- Lixiviación: Z6 y Z7 prioritarias.
- Recuperación: Z8 y Z7 prioritarias.
- Inspección: ocultas.

## Restricciones respetadas
No se creó un segundo sistema de labels ni se modificó geometría funcional.
