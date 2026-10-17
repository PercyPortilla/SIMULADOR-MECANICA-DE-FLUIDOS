# PULPA LAB V22 — Realismo industrial y topografía

Fecha de cierre: **2026-10-17**

## 1. Objetivo

V22 continúa desde V21 sin modificar el motor de cálculo. El objetivo es que la planta se lea menos como una maqueta sobre una superficie uniforme y más como un emplazamiento minero-industrial coherente: terreno natural con variación contenida, movimiento de tierras legible, transición vial realista, materiales menos repetitivos, accesos libres y vistas de Inspección que distinguen correctamente estructura, carcasa e interiores.

Se mantiene la arquitectura acordada:

- Three.js conserva autoridad sobre runtime, topografía, coordenadas, carreteras, piping, endpoints y conveyors paramétricos.
- Blender conserva el pipeline de activos industriales y el overlay visual del earthwork de recepción.
- No hay migración a Babylon.js.
- No se modifican ecuaciones de reología, hidráulica, energía, lixiviación ni recuperación.
- No se cambian IDs, diámetros físicos, endpoints ni secuencia de proceso.

## 2. Terreno natural y movimiento de tierras

`terrainHeight.js` añade microrelieve determinista de varias escalas con amplitud acotada. Su función es romper superficies matemáticamente perfectas sin convertir pads o carreteras en geometría ondulada.

Auditoría V22:

- máximo |microrelief| muestreado: **0.1197 m**;
- límite de aceptación: **0.13 m**.

Los datums de ingeniería siguen dominando al relieve natural.

### Recepción

El terraplén V21 se conserva, pero su hombro sur se desvanece progresivamente en los últimos **16 m** del borde este. Esto evita que la plataforma de ROM cree un montículo artificial al acercarse a la terraza de chancado.

### Chancado primario

Se incorporó una lectura civil explícita al sur de la terraza:

- cut face: 5.0 m de desarrollo;
- catch berm: 3.0 m;
- elevación adicional de berma: 0.70 m;
- transición de pie: 7.0 m.

Perfil auditado de sur de chancado: **6.000 → 6.454 → 6.700 → 6.620 → 6.510 m**. El antiguo hump cercano a ~7.9 m queda eliminado.

## 3. ROAD-01 y tie-in de recepción

La centerline autoritativa de ROAD-01 no se cambia. V22 modifica sólo su detalle civil transversal cerca de recepción:

- cut/fill transition: **5.2 → 9.2 m** al llegar al tie-in;
- berma de seguridad: **1.2 → 0.0 m** antes de entrar al apron;
- error máximo terreno/centerline en el tie-in: **0.000152 m**;
- pendiente máxima ROAD-01: **8.30%**, dentro del máximo de diseño de 10%.

Las rutas ROAD-02/03/04 no se reubicaron. Sus pendientes metadata preexistentes continúan fuera del alcance de esta fase porque el usuario pidió preservar rutas y coordenadas.

## 4. Infraestructura civil de recepción

Se eliminó `reception-engineered-embankment`, un volumen decorativo heredado que duplicaba un movimiento de tierras ya contenido en `getTerrainHeight()` y producía intersecciones visuales en el acceso.

Se conservan los elementos funcionales:

- turning apron;
- tres safety berms de borde;
- retaining wall;
- drenajes y señalización.

La fuente de verdad del terraplén queda registrada como `terrainHeight`.

## 5. Materiales y atmósfera

El terreno base dejó de usar una textura pálida tipo arena y ahora emplea una base de suelo/roca meteorizada compactada. La paleta de vértices continúa distinguiendo bancos, caras activas, pared final, material húmedo, rellenos y bermas.

`industrialMaterials.js` incorpora perfiles multiescala independientes para terreno, camino y concreto. Cada rol usa repeticiones distintas en albedo, roughness y bump para evitar que las tres superficies repitan el mismo patrón:

- terrain: albedo 7×5, roughness 5×4, bump 9×6, bumpScale 0.078;
- road: 9×4, 7×3, 12×4, 0.050;
- concrete: 4×3, 3×3, 5×4, 0.040.

El cielo pasa a un perfil `clear-highland-blue`: horizonte claro, azul intermedio y zenith más profundo, sin fog.

Estas propiedades son exclusivamente visuales y no alimentan ninguna rugosidad hidráulica ni cálculo físico.

## 6. Pórticos de recuperación y ROAD-02

La auditoría de clearance histórica tenía dos problemas: no incluía dimensiones de PUMP-01 y, al corregir eso, reveló que el tramo elevado PUMP-01 → CIP compartía corredor con ROAD-02 usando frames de sólo 3.8 m.

V22 no mueve la tubería ni cambia endpoints. El tramo elevado de segmentIndex 2 conserva centerline en z=-62 y y=8.4 m, pero sus frames son pórticos de **18.0 m**. Los footings caen a ambos lados del corredor vial, aproximadamente en z=-53 y z=-71.

Resultado del auditor de integración:

- **156/156 checks PASS**;
- carretera + hombros + margen requerido: 17 m;
- pórtico disponible: 18 m.

## 7. Inspección de activos Blender

El loader legacy asignaba una metadata demasiado amplia a meshes importados. Un nombre como `SLURRY-PUMP-01_BASEPLATE` podía heredarse como interior sólo por contener el identificador del equipo.

V22 clasifica componentes por tokens semánticos sólo dentro del sistema de Inspección:

- interior: slurry, fluid, ore, liner, impeller, shaft, vortex, baffle, blade, screen, electrolyte, cathode, melt, refractory, jaw, etc.;
- shell: shell, casing, wall, barrel, cone, hopper, tank, cover, volute, cell, crucible, etc.;
- lo restante se trata como estructura.

Esto mejora `Transparent`, `Cutaway` e `Interior` sin modificar los GLB ni su comportamiento normal.

## 8. Blender terrain overlay

El overlay `RECEPTION-EARTHWORK-V21.glb` conserva su nombre de asset por compatibilidad, pero `terrainRealismRevision` es V22. Fue regenerado con Blender 5.2.2 a partir del contrato actual muestreado desde `getTerrainHeight()`.

- contrato: `blender/generated/v21-reception-earthwork-contract.json`;
- contrato SHA-256: `C56C9436A41433129DAD8046885109887018CB2672DB8930784AA2C54B0A55FC`;
- GLB: 463,792 bytes;
- GLB SHA-256: `59CB2AE7471EE5DE85A7E1186243C5C4D0D68E826897C4A8DF4DC6BE928FBA6A`;
- sigue siendo visual-only y fallback-safe.

## 9. Escala industrial

Se mantuvo el contrato **1 unidad = 1 m**. La auditoría de envelopes de 16 activos Blender principales permanece:

- **16/16 PASS**;
- no se aplicó rescale global;
- mining shovel se evalúa como envelope articulado, no como longitud de cuerpo.

## 10. QA de navegador

El build de producción se sirvió con Vite Preview y se inspeccionó mediante Chrome/CDP.

Resultado:

- release tag: `V22 · Realismo industrial y topografía`;
- badge didáctico: V22;
- 38 targets de Inspección;
- 24 recursos GLB detectados;
- scene error: vacío;
- runtime errors: **0**;
- network failures: **0**.

Se capturaron vistas:

- Planta general;
- Recepción/carguío;
- Chancado/acopio;
- Molienda/clasificación;
- Recuperación;
- Inspección MILL-01;
- PUMP-01 en modo Interior;
- CLASS-01 en modo Interior.

Mobile 390 px:

- viewport width 390;
- document width 390;
- body width 390;
- sin overflow horizontal.

Artefactos:

- `qa-artifacts/v22-visual-realism/summary.json`;
- `qa-artifacts/v22-visual-realism/http-smoke.json`;
- `qa-artifacts/v22-visual-realism/reception-desktop.png`;
- `qa-artifacts/v22-visual-realism/crushing-desktop.png`;
- `qa-artifacts/v22-visual-realism/recovery-desktop.png`;
- `qa-artifacts/v22-visual-realism/pump-interior-inspection.png`;
- `qa-artifacts/v22-visual-realism/reception-mobile.png`;
- `qa-artifacts/cdp_v22_visual_realism_probe.mjs`.

## 11. Protección del cálculo

Comparación byte a byte contra V21:

- `src/controller/`: 0 cambios;
- `src/core/`: 0 cambios;
- `src/state/`: 0 cambios;
- `src/process/`: 0 cambios;
- `src/reporting/`: 0 cambios.

Calculation guard: **PASS**.

## 12. Pruebas, audits y build

Suite completa:

- **68/68 test files PASS**;
- **351/351 tests PASS**;
- duración: **207.45 s**;
- exit code 0.

Audits adicionales:

- terrain/civil: **14/14 PASS**;
- visual scale: **16/16 PASS**;
- integration clearance: **156/156 PASS**.

Build:

- `npm run build`: PASS;
- Vite 7.3.7;
- **106 modules transformed**;
- warning Three.js >500 kB: informativo.

## 13. Assets y master Blender

Después del build:

- public: **24 GLB / 5,704,032 bytes**;
- dist: **24 GLB / 5,704,032 bytes**;
- mismatches: **0**.

Master Blender sin cambios:

- `blender/PULPA_LAB_BLENDER_MASTER_V17.blend`;
- 688,141 bytes;
- SHA-256 `E78577DAE8E533429B84FC13FC054036684F6D36AB5F1A3D76AB4CCA787CACA6`.

## 14. Resultado

V22 aumenta el realismo sin desplazar la ingeniería autoritativa. El terreno deja de ser una superficie uniforme, la recepción conecta mejor con chancado, la carretera se integra civilmente al terraplén, la recuperación libera el corredor vial con pórticos adecuados y las vistas interiores de Blender son semánticamente más útiles. El solver, los endpoints, diámetros y rutas de proceso permanecen intactos.
