# PULPA LAB | Renovación del simulador · T9–T12

**Fecha:** 5 de noviembre de 2026, Perú
**Equipo:** DESKTOP-RE0NEVE
**Rama de interfaz:** `feature/ui-total-transform-20261105`
**Versión precedente:** `269ea836af1f049766a579b7c404501fd6aeb4f3`

## T9 · Validación end-to-end de la interfaz científica

Se creó `tools/workbenchT9E2EQA.mjs`, una prueba reproducible que utiliza Chrome CDP en la versión **compilada** del simulador, sin abrir, fotografiar ni modificar las vistas Planta General y Bernoulli–Euler. Sus comprobaciones abarcan:

- Guardar un escenario real, modificar velocidad, comparar sus salidas y restaurar el valor mediante «Cargar».
- Inyectar **únicamente en el navegador aislado de QA** una entrada inválida en la biblioteca y comprobar que un error de carga no sobrescribe los parámetros activos.
- Eliminar el escenario comparado y confirmar que la tabla obsoleta se oculta.
- Comparar dos casos académicos, advertir hipótesis incompletas, evaluar una práctica y habilitar su informe.
- Descargar **9 archivos reales**, verificando tamaños y SHA-256: cuatro SVG con polilíneas y ejes reales, CSV y JSON de escenario, CSV/HTML de Memoria y HTML del laboratorio académico.
- Navegar por los puntos de los gráficos mediante flechas y comprobar su contenido accesible, pestañas y móvil a 390 px.
- Comprobar que no existen excepciones JavaScript ni desbordamiento horizontal.

**Evidencia:** `qa-artifacts/ui-transform/t9-e2e-qa.json`. Las descargas temporales y el perfil de Chrome se eliminan al terminar el QA; se conservan únicamente sus registros criptográficos y resultado.

## T10 · Claridad de ingeniería y seguridad funcional

Se agregaron y corrigieron exclusivamente componentes de la interfaz científica:

- `src/ui/npshDiagnostic.js`: análisis visual de NPSHa contra NPSHr calculados por el motor, con estados «no disponible», «incompleto», «cumple comparación básica» y «por debajo», aviso explícito de que **no son sensores ni predicción de cavitación**, y requisito de verificar el criterio del fabricante.
- Comparación A/B de resultados del **mismo solver** en un panel visible dentro de Prácticas académicas; se muestran **todas** las entradas diferentes (sin truncarlas a 20).
- Carga atómica de escenarios: `src/ui/scenarioLoad.js` prepara los valores sobre el estado inicial; la validación estándar de `updateState` los confirma antes de actualizar datos actuales.
- Eliminación de tablas de comparación obsoletas al borrar el escenario correspondiente.
- Manejo de errores a nivel de campo en editores de tramos y curva H–Q; los cambios inválidos no sobrescriben el modelo ni quedan sin mensaje.
- Navegación por gráfica con **un punto tabulable por tarjeta** y flechas para recorrer el resto, sin decenas de paradas de tabulación.
- Revocación diferida de URLs de descarga para escenarios, tras iniciar la descarga real.

Las dos vistas 3D protegidas no fueron rediseñadas ni alteradas. El valor final de GO de integración requiere comprobar compatibilidad con el avance paralelo de E11/D5, no solamente los tests de la rama UI.

## Evidencia de QA antes de integrar

- `npm test`: **366 / 366 PASS**, 98 archivos.
- `npm run build`: **PASS**, Vite 7.3.7, **162 módulos**.
- `tools/workbenchT9E2EQA.mjs`: **PASS** en Chrome local, nueve archivos descargados y cero excepciones JS.
- Modelo V57/B64 firmado: SHA-256 `73826D5CB777ED08CD9F20A9DD3171C1964F1F8DE8C570EDFB9F4A802538E306`.

## T11–T12 · Condición de publicación

Al comenzar T11, `origin/main` estaba en `4f133d6` (producción), mientras `origin/feature/e11-d5-euler-lookdev-20261105` estaba en `f4158b4`; la rama UI deriva del mismo commit base `85a9237` que E11, pero **no contiene todavía sus cambios**. No debe promoverse el preview UI individual como si incluyera la mejora de Euler/D5.

El trabajo de integración se hará en **otro worktree y rama**, sin sobrescribir E11 ni UI. Se comprobarán los contratos existentes de Euler y el sistema 3D sin evaluar ni modificar su apariencia. Solo una fusión revisada, pruebas completas y un preview integrado verificado podrán ser candidatos para una publicación posterior en producción.
