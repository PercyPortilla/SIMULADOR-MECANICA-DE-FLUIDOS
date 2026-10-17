# PULPA LAB V2 — Fase 19B Recovery 3D

## Alcance
Se materializó únicamente Z8 usando la topología validada en `processRoute`.
No se habilitaron ni inventaron cálculos metalúrgicos de recuperación.

## Equipos 3D
- `CIP-ADSORPTION`: tren de adsorción simplificado de tres tanques.
- `ELUTION-SKID`: columna de elución, calentador y tanque de solución.
- `EW-CELLS`: banco simplificado de tres celdas de electrowinning.
- `SMELTING-FURNACE`: horno, campana/chimenea y producto doré identificable.

## Conexiones
- `PUMP-01.discharge` → `CIP-ADSORPTION.inlet`.
- `CIP-ADSORPTION.outlet` → `ELUTION-SKID.inlet`.
- `ELUTION-SKID.outlet` → `EW-CELLS.inlet`.
- `EW-CELLS.productOutlet` → `SMELTING-FURNACE.productInlet` mediante transferencia de producto no hidráulica.

## Restricción conservada
`processRoute.validation.canCalculateRecovery` continúa en `false` y `recoveryModel` continúa en `null`.
La geometría 3D representa la topología del proceso, no un cálculo de recuperación validado.
