# PULPA LAB — Cierre definitivo de 4 defectos

Checkpoint de entrada: `PULPA-LAB-INDUSTRIAL-REFINED-V1`

Checkpoint de salida: `PULPA-LAB-FINAL-4-ISSUES-CLOSED`

Alcance cerrado exclusivamente a:

1. partículas/sólidos de pulpa fuera del tubo;
2. cinemática de ruedas del haul truck;
3. dirección de descarga de la tolva;
4. geometría/lectura de haul roads y service roads.

## Fase 0 — Diagnóstico

Se identificaron cuatro causas raíz concretas:

- Las partículas seguían una spline Catmull-Rom distinta de la geometría física recta + joints del pipe.
- La integración rotaba por regex grupos de rueda y children internos simultáneamente.
- El pivote de la tolva estaba en el lugar correcto, pero el signo de `rotation.z` era incorrecto.
- Los caminos obtenían elevación independiente por borde, usaban bermas de rocas repetidas y huellas redondas con `TubeGeometry`.

## Fase 1 — Pulpa

Archivos:

- `src/scene/piping/pipingEngine.js`
- `src/scene/integration/integratedAnimations.js`

Corrección:

- Se sustituyó la spline de partículas por `CurvePath + LineCurve3` siguiendo exactamente la ruta segmentada del pipe.
- Se añadió confinamiento radial explícito.
- El centro de partícula queda como máximo a `0.42 × radio del core de pulpa`.
- El tamaño de sprite se redujo y se eliminó el `AdditiveBlending` que acentuaba el efecto de puntos fuera del tubo.
- El movimiento usa tangente/normal/binormal locales sin crear geometría por frame.

Para el diámetro visual mínimo de 0.40 m:

- radio del core de pulpa = 0.124 m;
- extensión radial máxima de partícula + sprite ≈ 0.063 m;
- margen interno ≈ 0.061 m.

Estado técnico: **✅ CORREGIDO**.

## Fase 2 — Ruedas del truck

Archivos:

- `src/equipment/mining/haulTruck.js`
- `src/scene/integration/integratedMobile.js`

Nueva jerarquía:

`steerPivot -> spinPivot -> wheelMesh`

- Steering actúa únicamente en Y sobre `steerPivot`.
- Rolling actúa únicamente en Z sobre `spinPivot`.
- El mesh de rueda tiene su cilindro orientado sobre Z.
- Se eliminó la rotación recursiva por nombre que podía rotar grupo + tyre + hub + children.
- La rodadura integrada se calcula como `distanceM / radiusM`.

Estado técnico: **✅ CORREGIDO**.

## Fase 3 — Tolva

Archivo:

- `src/equipment/mining/haulTruck.js`

La bisagra está en la parte trasera (`local X < 0`). El frente del truck es `local +X`, por lo que el giro positivo sobre Z eleva el frente y descarga hacia atrás.

Se corrigió tanto la animación autónoma del asset como `setDumpAngle()`.

El heading de descarga de la integración sigue fijando la parte trasera hacia el ROM durante el dump.

Estado técnico: **✅ CORREGIDO**.

## Fase 4 — Caminos

Archivo:

- `src/scene/environment/haulRoads.js`

Se reemplazó la construcción anterior por:

- rasante/alineamiento continuo;
- crown/crossfall controlado (2.2% haul road, 1.8% service road);
- ensanche local en curvas del haul road;
- shoulders explícitos;
- transición cut/fill entre shoulder y terreno;
- bermas continuas trianguladas;
- huellas planas tipo ribbon;
- eliminación de bermas de rocas repetidas;
- eliminación de huellas circulares tipo tubo.

Además el truck usa una cota de ruta ligeramente elevada respecto al terrain mesh para asentarse sobre la nueva superficie de road y no quedar enterrado visualmente.

Estado técnico: **✅ RECONSTRUIDO**.

## Fase 5 — Validación integrada

- `FINAL4_STATIC_AUDIT`: **29/29 PASS**
- Equipment Catalog: **129/129 PASS**
- Integration audit: **34/34 PASS**
- Clearance audit: **139/139 PASS**
- Sintaxis JS/MJS: **113/113 PASS**
- Imports relativos: **194/194 PASS**
- `package.json`: hash sin cambios
- `package-lock.json`: hash sin cambios

## Validación npm/browser

La instalación limpia no puede completarse en este entorno:

- `registry=https://registry.npmjs.org/`
- no proxy configurado;
- no `https-proxy` configurado;
- resolución DNS de `registry.npmjs.org` falla;
- caché npm sin paquetes utilizables;
- `npm ci --offline` falla por `why-is-node-running@2.3.0` no cacheado.

Por ello:

- `npm test`: **⛔ NO VALIDADO** (`vitest: not found`)
- `npm run build`: **⛔ NO VALIDADO** (`vite: not found`)
- navegador/WebGL post-corrección: **⛔ NO VALIDADO** en este entorno.

No se modificaron versiones ni manifests para forzar una instalación.

## Archivos fuente modificados

- `src/equipment/mining/haulTruck.js`
- `src/scene/environment/haulRoads.js`
- `src/scene/integration/integratedAnimations.js`
- `src/scene/integration/integratedMobile.js`
- `src/scene/piping/pipingEngine.js`

No se alteró el resto de la arquitectura de planta.

## Freeze

Fase Final alcanzada. No se inicia otra etapa.
