# V24C — Revisión final de Planta general / Top / Oblicua

## Alcance
Revisión exclusiva de los tres presets globales después de V23A–V23F y V24A–V24B. No se movieron equipos, zonas, caminos, tuberías, conveyors ni topografía.

## Hallazgo
- `Top`: la huella real de las 8 zonas ya estaba centrada y con margen suficiente. Sin cambios.
- `Oblicua`: las 8 zonas ya estaban dentro del frustum con una ocupación equilibrada. Sin cambios.
- `Planta general`: las 8 zonas estaban dentro del frustum, pero la perspectiva desplazaba la huella hacia la derecha y hacia abajo del viewport.

## Corrección
Se mantuvieron exactamente la posición y el FOV (`45°`) de Planta general. Solo se aplicó un `visualCenter` al target de cámara, desplazado respecto del centro geométrico del layout para compensar la perspectiva.

## Validación
Con viewport 16:9 y envolventes de zona hasta 8 m de altura:
- las 8 zonas permanecen dentro del frustum;
- el centro proyectado horizontal queda dentro de ±0.12 NDC;
- el centro proyectado vertical queda dentro de ±0.08 NDC;
- Top y Oblicua no se modificaron.
