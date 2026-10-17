# PULPA LAB V2 — Fase V23F

## Alcance
Detalle industrial moderado aplicado únicamente a chancadora, molino, reactores de lixiviación y CLASS-01. No se modificaron cálculos, state, processRoute, cámaras, piping, conveyors, posiciones de equipos ni puertos.

## Cambios

### Chancado
- Motor lateral y acople visual.
- Guarda de acople.
- Plataforma baja de mantenimiento y baranda.
- Arriostres secundarios dentro de la huella existente.

### Molienda
- Baranda de servicio con postes y nivel intermedio.
- Escalera lateral de acceso.
- Gearbox/acople y guarda del accionamiento.

### Reactores R-01…R-04
- Segundo nivel de baranda.
- Escalera vertical de mantenimiento.
- Ménsulas discretas bajo plataforma.
- Sin cambios en inlet/outlet ni dimensiones funcionales.

### Clasificación
- CLASS-01 sigue siendo `genericPlaceholder: true` y `validatedProcessModel: false`.
- Barandas y escalera de servicio.
- Bajantes visuales desde manifold y arriostres.
- No se añade ni se asume un modelo de clasificación real.

## Validación
- Todos los `.js` de `src/` y `tests/` pasan `node --check`.
- 0 solapes significativos entre los 11 equipos principales tras el aumento de detalle.
- Puertos de molino, clasificación y reactor permanecen idénticos al checkpoint V23E.
- State, controller, processRoute, piping y cámaras permanecen sin cambios.
