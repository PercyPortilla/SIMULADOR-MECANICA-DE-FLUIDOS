# V24D — Iluminación, sombras y legibilidad

## Alcance
Ajustes exclusivos de iluminación/render. No se modificaron geometría, equipos, posiciones, puertos, conexiones, procesos, state ni cálculos.

## Cambios
- Hemisphere light más neutra y ligeramente menos intensa para evitar lavado plano.
- Key light ligeramente reforzada para conservar modelado direccional.
- Frustum de sombras ampliado de ±35 m a ±70 m y far plane a 160 m para cubrir la planta completa.
- `normalBias` añadido para reducir acne/autosombra en acero y geometría fina.
- Fill light suave y sin sombras desde el lado opuesto para recuperar lectura en caras oscuras.
- Tone mapping exposure: 1.05 → 1.10.

## Restricciones preservadas
- `scene.fog = null`.
- Sin luces decorativas por equipo.
- Sin cambios de materiales.
- Sin cambios de geometría o conexiones.
