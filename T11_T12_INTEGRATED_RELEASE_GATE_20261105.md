# PULPA LAB | T11–T12 · Integración verificable y gate de publicación

**Equipo:** DESKTOP-RE0NEVE
**Rama integrada:** `feature/integration-ui-e11-t12-20261105`
**Fecha:** 5 de noviembre de 2026 (Perú)

## Procedencia reproducible

La rama se creó mediante un worktree independiente y fusión Git automática
sin conflictos:

- UI rediseñada y QA T9–T10: `ba860b2b1bd89e2c304d8003848cfc8f869865dd`.
- E11/D5 de trabajo paralelo: `f4158b4c04bc24f600b2380f87ee8352641a11ca`.
- Merge local: `0043ccc350a79e462efa30a97e1f8a60fe254cc0`.
- Ambos trabajos descienden del commit base `85a9237`.

No se editaron a mano los archivos de E11 ni se sobrescribió el trabajo
original. E11 aporta exclusivamente su avance paralelo de lookdev ya aprobado
en esa rama, sin que esta integración rediseñe su UI ni cambie el solver.

## Resultados de certificación

| Prueba | Evidencia | Resultado |
| --- | --- | --- |
| Fusión Git | `git merge --no-ff origin/feature/e11-d5-euler-lookdev-20261105` | **PASS**, cero conflictos |
| Tests dirigidos | UI/NPSH/carga atómica/E11/pump inspector | **16/16 PASS** |
| Suite de regresión completa | `npm test` | **370/370 PASS**, 99 archivos |
| Compilación | `npm run build` | **PASS**, Vite 7.3.7, 163 módulos |
| Proceso GLB E11 sin screenshots | `node tools/e11EulerD5RealAssetQA.mjs` | **PASS** |
| Recorrido de UI científica real | `tools/workbenchT9E2EQA.mjs` en Chrome aislado | **PASS** |
| Descargas verificadas | `qa-artifacts/t11-integration/t9-e2e-qa.json` | 4 SVG + 2 CSV + 1 JSON + 2 HTML |
| Uso móvil | Chrome a 390 px | **PASS**, sin desbordamiento |
| Excepciones JS | `runtimeExceptions` del informe E2E | **0** |

El GLB educativo Euler real conservó SHA-256
`3ea34050240b310a6fe8663d6b66c8f1f07b69b23c4e2473f93819ead33fcf3e`
(21 018 796 bytes), **34 animaciones, 13 cámaras y 4 CAD nativos**. La prueba
E11 comprobó la reversibilidad de cámara, mallas e iluminación del anfitrión
mediante Babylon NullEngine, no mediante alteraciones de UI o screenshots.

El guard del build verificó otra vez V57/B64 SHA-256
`73826D5CB777ED08CD9F20A9DD3171C1964F1F8DE8C570EDFB9F4A802538E306`.

## Evidencias guardadas

- `qa-artifacts/t11-integration/t9-e2e-qa.json`: ejecución del workbench,
  escenarios, prácticas, archivos descargados con SHA-256 y ausencia de fallos.
- `qa-artifacts/e11/e11-real-glb-regression.json`: comprobación de estado de
  GLB y restitución de escena y cámara de E11 (se conserva el reporte E11 firmado).
- `tools/workbenchT9E2EQA.mjs`: admite puertos CDP/preview y ubicación de QA
  alternativos por variables de entorno, sin cambiar parámetros ni escenas 3D.

## Decisión de publicación

**GO para una vista previa integrada** con commit trazable de ambas ramas.

**NO-GO automático para reemplazar `main`**: el entorno de producción estaba
en `4f133d6` y las ramas UI/E11 parten de funciones posteriores de Euler que
se desarrollaron de forma paralela. Promover sin una revisión explícita de
ese cambio de alcance publicaría también cambios de Euler, una vista que el
usuario excluyó del rediseño de UI.

Por tanto, T12 se completa mediante commit, push y preview combinado READY,
con un gate de publicación de producción claramente documentado y sin
reemplazar involuntariamente el circuito principal ni la UI de Euler.

No se declara una inspección visual completa de las cámaras o animaciones de
Euler; la preservación se sustenta en su GLB firmado y pruebas de contratos,
porque el usuario pidió excluir esa vista del rediseño.
