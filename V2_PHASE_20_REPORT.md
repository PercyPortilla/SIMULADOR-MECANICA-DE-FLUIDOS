# PULPA LAB V2 — Fase 20

## Integración final de recuperación

- Las tres conexiones hidráulicas de Z8 se integraron al sistema existente de pipe racks.
- Se añadió validación explícita de diámetro nominal entre source port, conexión y target port.
- En la ruta actual no se requiere ningún reducer: 0.05 m en PUMP-01→CIP y 0.04 m en CIP→Elución→EW coinciden extremo a extremo.
- No se introducen reducers implícitos ni cambios visuales de diámetro para ocultar incompatibilidades.
- La transferencia EW→Fundición continúa siendo `solid-product` y no una tubería hidráulica.
- No se agregaron procesos ni cálculos de recuperación.

## Verificaciones directas

- Racks totales tras integrar Z8: 12 marcos; 5 corresponden a las nuevas líneas de recuperación.
- Clearance mínimo muestreado respecto al terreno: 1.63 m (PUMP→CIP), 1.63 m (CIP→Elución), 1.08 m (Elución→EW).
- Distancia mínima a ejes de caminos: 9.87 m, superior al semiancho vial de 3.75 m; no se detectaron cruces con ROAD-01..04.
- `scene.fog` permanece `null`.
- `npm test`/`npm run build` no pudieron ejecutarse en este contenedor por `@rollup/rollup-linux-x64-gnu` ausente antes de cargar el código.
