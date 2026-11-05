# T22–T24 · Paleta azul industrial para PULPA LAB

## Requerimiento del usuario

El usuario manifestó que **no le gustaba la paleta de colores** de la UI unificada T19–T21. No indicó colores concretos. Se implementó una propuesta visual distinta y verificable: **Azul Grafito / Azul Acero / Cian**, sustituyendo la combinación verde oscuro, marfil y cobre de los seis módulos.

## Paleta aplicada

| Rol | Hex |
|---|---|
| Barra de navegación permanente | `#0C1C36` |
| Fondo científico | `#EEF3FA` |
| Superficie de tarjetas | `#FFFFFF` |
| Azul activo del menú | `#174678` |
| Resaltado de gráficos y botones | `#1672C9` |
| Azul de encabezados y textos | `#122135` |
| Azul profundo para KPI destacado | `#123C70` |
| Línea / segundo conjunto de datos | `#7B65D8` |
| Advertencias y peligro | Semántica ámbar/rojo original preservada |

## Implementación

- Recoloración exhaustiva de `src/ui/workbenchTransform.css` y `src/ui/threeDWorkbench.css` y ajuste de la cinta informativa del laboratorio.
- Se conservan estrictamente los controles originales, clases de estado y los modelos V57/E11. No se han editado materiales de las mallas GLB ni el solver.
- Script de migración reproducible, con marca que impide volver a recolorear de forma accidental: `tools/t22IndustrialAzurePalette.mjs`.
- `tools/workbenchVisualQA.mjs` admite puertos y directorio de evidencia de QA independientes y comprueba que la nueva paleta está realmente aplicada en Chrome.

## Evidencia visual y funcional

- Escritorio Chrome 1440×900: `qa-artifacts/t22-palette/01-hydraulic-desktop.png`, `02-results-desktop.png`, `03-memory-desktop.png`, `04-academy-desktop.png`, así como capturas de otras secciones en la misma carpeta.
- Planta General / Euler (escritorio y móvil): `qa-artifacts/t22-3d/01-general-workbench-desktop.png`, `02-euler-workbench-desktop.png`, `04-general-workbench-mobile.png`, `05-euler-workbench-mobile.png`.
- Tubería interior real Babylon: `qa-artifacts/t22-3d/03-euler-pipe-interior.png`.
- E2E científico: `qa-artifacts/t22-scientific/t9-e2e-qa.json`; verificadas 71 entradas reales, memoria, Academia, nueve exportaciones (4 SVG, 2 CSV, 2 HTML, 1 JSON) y cero excepciones.
- E2E 3D: `qa-artifacts/t22-3d/t19-3d-e2e.json`; nueve cámaras de mina, siete vistas Euler, tubería interior 3D real, modos Realista/Transparencia, retorno a módulos, móvil 390 px sin overflow, cero excepciones.
- QA visual: `qa-artifacts/t22-palette/visual-qa.json` (colores computados, escritorio y móvil).

## Alcance y seguridad

Es una revisión **cromática de la página**, no una reinterpretación de resultados físicos ni un render nativo de D5. Se preservan las señales de riesgo y el aviso de conectividad P3–P4 NO-GO. Debe publicarse en Vercel como vista previa; no actualizar automáticamente `main` ni el dominio de producción.
