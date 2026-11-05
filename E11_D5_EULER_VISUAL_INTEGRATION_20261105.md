# E11 · Integración visual D5 → Laboratorio Bernoulli–Euler (5 noviembre 2026)

## Alcance aplicado

**Vista real** `/?view=lab` del simulador. Se trabaja sobre el GLB firmado
`L394_L384_EULER_34_ANIM_FULL_LAB.glb` (21 018 796 bytes), no sobre un mockup ni una segunda
escena. La malla GLB, las trayectorias de proceso y el solver se mantienen exactamente iguales.

La integración E11 recupera la referencia de aspecto D5 mediante lookdev PBR de Babylon:

- Control de brillo en acero galvanizado, acero estructural, superficies metálicas satinadas,
  pintura, concreto, revestimientos y superficies CAD educativas.
- Clonación de materiales **solo del contenedor Euler**, sin sobrescribir materiales fuente,
  texturas existentes, señales de pulpa, transparencias ni efectos de animación.
- Iluminación y curva fotográfica ACES adaptadas durante Euler y **restauradas al salir**.
  No se modifica iluminación de la mina fuera de esta vista. Fog continúa desactivado.
- Sección ampliada del tubo: nuevos acabados de acero/liner/flanges, pulpa y áridos,
  luz de borde y ACES, manteniendo 410 partículas GPU, depósitos, perfiles, modos y datos.
- Evita intentar asignar materiales por instancia Babylon: se trabaja únicamente sobre
  las mallas fuente y se reutilizan clones de material.

## Protección de funciones y alcance

- **Cero cambios a:** `src/main.js`, `src/styles.css`,
  `src/ui/industrialV57Presentation.js`, `src/ui/industrialV57Presentation.css`,
  `src/ui/slurryPipeInspector.js`, solvers `src/core`, cámaras, puertos, geometría CAD,
  políticas de caudal efectivo, 34 animaciones y 13 cámaras Blender.
- El material se clona cuando entra Euler, se restaura al pasar a Mina completa; la
  transparencia CAD se aplica encima de los clones y se retira antes de restaurarlos.
- El modo educativo, los valores de caudal/ΔP/potencia y las advertencias NO-GO
  siguen mostrando exclusivamente la información del solver existente.

## Verificaciones efectuadas

| Comprobación | Resultado |
|---|---|
| `npm test` completo | **PASS: 348 pruebas / 92 archivos** |
| Target E11 tras optimización de instancias | **PASS: 19 pruebas / 3 archivos** |
| `npm run build` Vite 7.3.7 | **PASS: 158 módulos, 7.72 s** |
| Carga Babylon real GLB L384 (NullEngine) | **PASS** |
| Integridad SHA-256 original GLB | `3ea34050240b310a6fe8663d6b66c8f1f07b69b23c4e2473f93819ead33fcf3e` |
| Cantidad de animaciones / cámaras / CAD | **34 / 13 / 4** |
| Materiales de la vista ajustados | **174 mallas fuente / 41 materiales clonados** |
| Transparencia educativa y reentrada sin descarga extra | **PASS** |
| Restauración de cámara V57, host, luz, ACES y mallas | **PASS** |
| Chrome real en `/?view=lab` y tubo 3D | **PASS**, 0 errores JS, controles presentes |

Archivos de evidencia:

- `qa-artifacts/e11/e11-real-glb-regression.json`
- `qa-artifacts/e11/e11-browser-smoke.json`
- `qa-artifacts/e11/e11-euler-real-scene.png`
- `qa-artifacts/e11/e11-interior-tube-3d.png`

## Límites honestos de esta fase

Se trata de una **transferencia de criterio visual D5 al renderer web Babylon**, no
una ejecución de D5 Render dentro de la web. Los materiales nativos/texturas finales
del proyecto D5 de la laptop RTX no estaban disponibles en el workspace RENOEVE,
por lo que E11 no sustituye las PBR por exportaciones texturizadas 1:1 del D5 original.
Para alcanzar equivalencia fotográfica será necesario disponer de los mapas PBR
(albedo/normal/roughness/metallic) exportados desde la laptop y validarlos sin afectar
la malla L384 ni la interfaz Euler. No hay certificación hidráulica de uniones B64.

**Estado:** E11-lookdev funcional y visual verificado en staging local.
No se desplegó a producción ni se realizaron cambios en Supabase.
