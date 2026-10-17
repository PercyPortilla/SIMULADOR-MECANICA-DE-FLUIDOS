# PULPA LAB 3D — PULPA-LAB-INTEGRATED-V1

## Alcance

Integración controlada del Equipment Catalog V1 sobre la escena principal, ejecutada desde la Regla Maestra hasta la Fase Final. Los módulos internos de los assets aprobados permanecen aislados; la escena principal los instancia mediante una capa de integración.

## Resultado de implementación

### Arquitectura

- Nueva capa `src/scene/integration/assetIntegrationLayer.js`.
- Nuevo masterplan `src/scene/integration/finalLayout.js`.
- Nueva composición de equipos `src/scene/integration/integratedPlant.js`.
- Nuevos equipos auxiliares de integración `supportEquipment.js` para sump y stockpile/reclaim.
- Nuevo piping global `integratedPiping.js`.
- Nueva coordinación móvil `integratedMobile.js`.
- Nuevo coordinador de animación `integratedAnimations.js`.
- `baseEnvironment.js` dejó de instanciar el `createEquipmentSystem()` legacy y usa `createIntegratedPlant()`.
- El catálogo original no se incrustó en `scene.js`.

### Flujo sólido integrado

`ROM-HOPPER → APRON-FEEDER → CV-01 → PRIMARY-CRUSHER → CV-02 → STOCKPILE-RECLAIM → CV-03 → MILL-01`.

### Molienda y clasificación

`MILL-01 → SUMP-01 → SLURRY-PUMP-01 → CLASS-01`.

- Underflow: `CLASS-01 → MILL-01`.
- Overflow: `CLASS-01 → R-01`.

### Lixiviación

Conexiones port-to-port:

`R-01 → R-02 → R-03 → R-04`.

### Recuperación

- `R-04 → CIP-ADSORPTION` mediante línea de slurry.
- `CIP → ELUTION` mediante transferencia conceptual de carbón cargado.
- Retorno conceptual de carbón barren `ELUTION → CIP`.
- `ELUTION → EW` mediante solución de proceso.
- `EW → SMELTING` mediante transferencia conceptual de producto/cátodo.
- `recoveryModel = null` se conserva.

### Piping

- Piping generado desde ports de equipo.
- Diámetro físico separado del diámetro visual por el `pipingEngine` existente.
- Flanges, elbows, valve assemblies e interior de slurry conservados.
- Corredor de recuperación movido fuera del plant service road.
- Pipe racks de recuperación y header de lixiviación añadidos como infraestructura externa.
- `state.transport.pipe1.innerDiameterM` controla la reconstrucción visual de `P-LEACH-R01-R02` sin mover reactores.

### Molino

El asset aprobado conserva:

- `mill-static-group`.
- `mill-rotating-group`.
- Solo `rotatingGroup.rotation.x` recibe la rotación del shell.
- Foundations, bearing housings, motor, gearbox y service platform permanecen en el grupo estático.
- La integración mueve únicamente el root del asset completo; no modifica pivots internos.

### Vehículos

- `EXCAVATOR-01`, `TRUCK-01` y `LOADER-01` provienen del catálogo.
- `TRUCK-01` usa `ROAD-01` rediseñado y dos carriles visuales offset para haul/return.
- Estados coordinados: loading → loaded haul → dumping → empty return.
- En dumping, la parte trasera del truck se orienta hacia ROM.
- Loader tiene ciclo local stockpile → reclaim hopper → return.
- Shovel permanece en el working face del pit.

### Roads / terreno

- Sitio: 860 × 560 m.
- ROAD-01: 18.5 m de ancho + 2.2 m shoulders.
- Relación road/truck: 3.524×.
- Máxima pendiente de segmentos centrales muestreados: 9.127%.
- ROAD-01 llega al ROM desde el oeste sin atravesar chancado/proceso.
- ROAD-02 queda al sur de la planta como service road.
- ROAD-04 fue desplazado al sur de Recovery para no pasar bajo equipos.
- Topografía natural suavizada: menor ruido procedural y formas geológicas de longitud de onda mayor.

### Inspección

`equipmentInspection.js` reconoce tanto el esquema legacy como los roles del Equipment Catalog:

- `inspectionRole: shell`
- `inspectionRole: interior`

Se preservan Normal / Transparent / Cutaway / Interior.

### Cámaras

Se conservaron 9 presets y se reajustó la escala de overview. Inspection permite hasta 700 m de distancia para el sitio ampliado.

## QA estático final

- JS/MJS comprobados con `node --check`: **111 / 111 sin errores**.
- Imports relativos: **186**, faltantes: **0**.
- Asset audit: **129 / 129 PASS**.
- Integration static audit: **34 / 34 PASS**.
- Clearance audit: **135 / 135 PASS**.
- `scene.fog = null`: PASS estático.
- `recoveryModel = null`: PASS estático.
- Loop principal: PASS estático; no se añadieron `requestAnimationFrame` dentro de assets/integration.
- Fixed equipment AABB 2D overlap audit: PASS.
- ROAD-02/03/04 vs fixed equipment clearance audit: PASS.
- Recovery pipe rack vs service-road clearance: PASS.

## Dependencias / build / browser

Se verificó la posibilidad de restaurar dependencias sin modificar versiones:

1. `npm ci --offline`: **falló** por `ENOTCACHED` (`why-is-node-running` no estaba en cache).
2. Intento de `npm ci` con registry configurado: no pudo completarse dentro del entorno; dejó una instalación parcial no utilizable.
3. `npm test`: **⛔ NO VALIDADO** — `vitest: not found`.
4. `npm run build`: **⛔ NO VALIDADO** — `vite: not found`.
5. Navegador real / consola WebGL: **⛔ NO VALIDADO** porque no se pudo obtener una instalación limpia de Vite/Three/Vitest.

No se modificaron versiones ni archivos fuente para fingir la instalación.

## Integridad de dependencias declaradas

`package.json` SHA-256: `d8c70b9af27e5d4d4ff0cabad42d57382a468f549f489bdfcf9c62402c3cb3bf`

`package-lock.json` SHA-256: `388ad48b259bcc317bffd619a5afa657b757e90f814c33b338afb8bd6c5eaa99`

Ambos hashes son idénticos al checkpoint de entrada.

## Matriz final

| Sistema | Estado | Evidencia | Observación |
|---|---|---|---|
| Catálogo modular | ✅ | asset audit 129/129 | Assets siguen separados |
| Masterplan | ✅ | integration audit | Módulos redistribuidos |
| ROM / feeder / crusher | ✅ | ports + CV-01 | Integración port-to-port |
| Conveyors | ✅ | CV-01/02/03 | Generados según endpoints finales |
| Stockpile / reclaim | ✅ | support equipment | Patio separado de proceso |
| Molino | ✅ estático | static/rotating group audit | Browser ⛔ |
| Clasificación | ✅ | mill→sump→pump→cyclones | Overflow y underflow cerrados |
| Clasificación → lixiviación | ✅ | P-CLASSIFICATION-TO-LEACH | Ya no queda circuito abierto |
| R-01 → R-04 | ✅ | tres líneas dedicadas | Batería conectada |
| Recovery | ✅ | R04→CIP→Elution→EW→Smelting | Más assets del catálogo |
| Piping | ✅ estático | integratedPiping + clearance audit | Visual browser ⛔ |
| Truck route | ✅ estático | redesigned ROAD-01 + clearance audit | Driving browser ⛔ |
| Loader route | ✅ estático | explicit loader cycle | Browser ⛔ |
| Roads | ✅ estático | width/grade/clearance audits | Render browser ⛔ |
| Terrain | ✅ implementado | terrainHeight redesign | Render browser ⛔ |
| Inspection modes | ✅ implementado | role bridge | WebGL browser ⛔ |
| 9 cámaras | ✅ implementado | camera presets retained | Browser ⛔ |
| Syntax | ✅ | 111/111 | 0 errores |
| Imports | ✅ | 186/186 | 0 faltantes |
| npm test | ⛔ | vitest missing | Dependencias no recuperadas completamente |
| npm build | ⛔ | vite missing | Dependencias no recuperadas completamente |
| Browser / console | ⛔ | Vite unavailable | No afirmar validación visual |

## Fase Final

Checkpoint: **PULPA-LAB-INTEGRATED-V1**.

La Etapa 2 termina aquí. No se inició una Etapa 3 ni se realizaron mejoras posteriores a la validación final.
