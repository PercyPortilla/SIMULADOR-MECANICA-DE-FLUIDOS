# PULPA LAB 3D · Equipment Lab

Esta etapa mantiene todos los equipos nuevos **fuera de la planta principal**. El objetivo es aprobar geometría, escala, materiales, pivotes, animación, internals y ports antes de cualquier integración futura.

## Abrir el laboratorio

Con las dependencias instaladas normalmente:

```bash
npm install
npm run dev
```

Abrir `http://localhost:5173/equipment-lab.html` (el puerto puede variar).

## Controles

- Selector de los 15 assets del catálogo.
- `Normal / Transparente / Corte / Interior`.
- Animación ON/OFF con congelamiento del estado actual.
- Bounding box.
- Ports de conexión y dirección local transformada al mundo.
- Referencia humana de 1.75 m.
- Reset de cámara y close-up.
- Captura 4K a 3840×2160.

## Contrato de asset

Cada asset expone:

- `create()`
- `update(dt)`
- `setAnimationEnabled(enabled)`
- `setInspectionMode(mode)`
- `getPorts()`
- `getDimensions()`
- `getBoundingBox()`
- `updateLOD(camera)`
- `dispose()`

Los assets no contienen `requestAnimationFrame`; el único loop del Equipment Lab vive en `src/equipmentLab.js`.

## Molino

El molino usa dos grupos explícitos:

- `mill-static-group`: fundaciones, bearings, motor, gearbox, plataforma y elementos fijos.
- `mill-rotating-group`: shell, heads, trunnions rotativos, girth gear, internals y trommel.

Solo `rotatingGroup.rotation.x` se anima. El root y el grupo estático no rotan.

## Estado de validación en este checkpoint

La auditoría estática y la sintaxis fueron verificadas. `npm test` y `npm run build` no pudieron ejecutarse en el entorno de edición porque `vite`/`vitest` no están instalados y el acceso DNS a npm está bloqueado. Por tanto, la validación real WebGL/browser queda marcada como **NO VALIDADA**, no como éxito inventado.
