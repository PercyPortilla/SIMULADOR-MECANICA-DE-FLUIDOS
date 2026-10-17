# V2 Phase V24A — Post-polish visual regression

Scope: regression review after V23A–V23F. No new process features.

## Demonstrable issue found
At 16:9, the `crushing` preset contained only 7 of 8 corners of the real `PRIMARY-CRUSHING` world-space bounding box after V23F detail was added.

## Correction
Only the `crushing` camera FOV was changed from 42° to 44°. No equipment, zone, terrain, piping, conveyor, state or process-route transform was changed.

## Validation target
`PRIMARY-CRUSHING` must have 8/8 bounding-box corners inside the 16:9 crushing-camera frustum. Grinding, leaching and recovery views remain unchanged.
