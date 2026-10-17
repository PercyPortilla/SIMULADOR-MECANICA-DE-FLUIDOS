# PULPA LAB V2 — V11 Visual QA Corrections

## Motivo

Corrección del feedback visual proporcionado por el usuario sobre terreno/rocas,
recepción y chancado, conveyors, piping/supports, recuperación, navegación orbital
y parámetros iniciales.

## Correcciones cerradas

- Rocas decorativas limitadas al mesh real de terreno y excluidas de carreteras y zonas operativas.
- Mineral del apron feeder apoyado sobre las pans en vez de quedar suspendido.
- Mineral de ROM dejó de oscilar/rotar como un bloque rígido; liners del hopper quedan dentro de la carcasa.
- Recepción usa losa local bajo ROM Hopper y base local de crusher; la faja/feeder ya no atraviesan una losa sobredimensionada.
- Terraplén y turning apron de recepción compactados y suavizados.
- Apron feeder recibió skirts laterales; jaw crusher recibió guards y una animación de mineral continua sin salto visible de reset.
- P-PUMP-01-TO-CIP dejó de desviarse a x=246 y volver sobre sí misma; se eliminó el tramo redundante/solapado.
- Succión R-04→PUMP-01 llega con descenso gradual; descarga PUMP-01→CIP queda como riser separado y legible.
- Pipes entre R-01/R-02/R-03/R-04 ya no crean soportes automáticos innecesarios entre reactores.
- Racks dedicados apoyan en terreno real y su viga se deriva de la cota real del pipe.
- Transferencias de carbón/cátodo se representan como transporte sólido, no como tubería hidráulica.
- EW ahora expone `cathodeOut`; el transfer EW→Smelting sale de ese puerto y no de `electrolyteOut`.
- Cámara Recovery orientada para leer CIP→Elución→EW→Fundición de izquierda a derecha.
- Inspection centra automáticamente el equipo seleccionado, amplía rango orbital y permite zoom cercano (~0.8 m mínimo).
- Wheel/zoom de Inspection verificado en Chrome: `INSPECTION_ZOOM_CHANGED=True`.
- Caso de parámetros de ejemplo precargado al iniciar/resetear el simulador: Bingham, 35 % sólidos, Pipe 1, energía, lixiviación y recuperación.

## Regresiones cubiertas

- ROM concrete pad no intersecta APRON-FEEDER ni CV-01.
- PUMP-01→CIP no introduce overshoot/backtracking artificial en X.
- Interstage leach pipes no añaden postes automáticos.
- EW→Smelting parte del puerto `cathodeOut` materialOut.
- Decorative rocks permanecen dentro del terreno renderizado.

## Gates finales

- `npm test`: **41 files / 161 tests PASS**.
- `npm run build`: **PASS**.
- Browser real: **PASS**, canvas 1096×520, sin `scene-error`.
- Parámetros al abrir: Bingham / 35 % sólidos / velocidad 1.2 m/s verificados antes de cualquier mutación del harness.
- Inspection: PUMP-01 disponible, centrado y zoom operativo.

## Capturas de QA

- `outputs/browser-reception.png`
- `outputs/browser-leaching.png`
- `outputs/browser-recovery.png`
- `outputs/browser-inspection-pump.png`
- `outputs/browser-inspection-pump-zoomed.png`

**Estado: CORRECCIONES DE LAS CAPTURAS DEL USUARIO COMPLETADAS Y VALIDADAS.**
