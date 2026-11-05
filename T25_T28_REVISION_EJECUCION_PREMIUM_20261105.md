# PULPA LAB · Rebranding premium y revisión funcional T25–T28

**Entorno:** DESKTOP-RE0NEVE. **Base integrada:** `54eea9520afa64eb81829bfa36d20b419aebb6bb`. **Producción:** no modificar automáticamente.

## 1. Cambios implementados realmente

| Área | Antes / observación | Implementación actual |
|---|---|---|
| Marca | Cuadrado «PL.» genérico; subtítulo «ENGINEERING WORKSPACE» | Monograma propio de conducto y onda, PULPA **LAB**, nombre «Simulador de Mecánica de Fluidos»; favicon SVG. |
| Sistema visual | Marca sin variantes de informe | SVG compacto + horizontal sobre fondos claros y oscuros; atributos accesibles; tamaños responsive y foco visible. |
| Entradas | 71 controles extensos, agrupados pero sin localizador | Búsqueda de variables, niveles Todos / Esenciales / Proceso metalúrgico / Hidráulica avanzada y botón Restablecer. Controles originales: no se duplican entradas, listeners ni validadores. |
| Interacciones | El filtro podía dejar controles ocultos al salir del módulo | Restitución explícita de secciones originales al volver a Planta General; re-aplica el filtro si el modelo reconstruye campos. |
| Hidráulica | KPIs sin interpretación compacta al inicio | Cuadro con Q, ΔP, estado NPSH derivado de los cálculos existentes y accesos a Entradas/Curvas. Declara N/D si no hay curva/dato. No inventa sensores ni predice cavitación. |
| Gráficos | Guía poco visible, SVG exportado con paleta verde/cobre antigua | Instrucciones plegables, exportación SVG con azul/cian/violeta consistente con la interfaz. Conserva datos y series. |
| Memoria y academia | Usuarios sin secuencia de lectura | Guías de procedencia, hipótesis, contraste A/B y reproducibilidad. Cabecera de memoria HTML imprimible con marca SVG embebida, funciona sin internet. |
| Entornos 3D | Selector real General/Euler sin una ruta introductoria | Guía plegable de 4 etapas de la planta, sin mover geometrías ni suponer conectividad física. |
| Móvil | Podía cambiarse de módulo conservando el scroll de una página larga | La navegación móvil regresa al comienzo del nuevo módulo; sin desbordamiento horizontal. |

## 2. Archivos de identidad

- `public/brand/pulpa-lab-mark.svg` — isotipo pequeño para barra y favicon.
- `public/brand/pulpa-lab-horizontal-dark.svg` — marca horizontal sobre fondo oscuro.
- `public/brand/pulpa-lab-horizontal-light.svg` — marca para portada, informe o papel claro.
- `src/ui/premiumWorkbench.css` — jerarquía y estilos de nueva identidad.
- `src/ui/premiumWorkbench.js` — filtros, guías e interpretación de resultados (DOM/UX, no solver).

## 3. Revisión priorizada: qué conviene mejorar después

**P0 / Integridad física, trabajo distinto del branding.** La interfaz de Euler puede representar conductos fluidos, pero el tramo hidráulico P3→P4 y otras uniones húmedas no deben tratarse como conexiones industriales certificadas hasta resolver sus puertos y la geometría en un bloque CAD autorizado. Mantener visible **NO-GO** y no atribuir soluciones a este rebranding.

**P1 / Diagnóstico de ingeniería.** Es correcto que NPSH se muestre «no disponible» cuando falta dato o curva NPSHr; la mejora futura es facilitar la captura de curvas del fabricante con procedencia, unidades y límites de validez. No sustituir una curva real por valores hipotéticos.

**P1 / Memoria y referencias.** La cabecera imprimible utiliza nueva marca y el contenido técnico persiste; convendría agregar un índice navegable de ecuaciones y un comprobador de versión/escenario antes de exportar PDF desde el navegador. **No se ha implementado generación PDF nativa**.

**P1 / Recorrido de Planta General.** La guía 3D organiza el circuito, pero no corrige el relieve desconectado, posibles penetraciones de soportes ni la calidad de render D5. Ese trabajo pertenece al pipeline de **RTX ANDREA/D5** con controles de cotas, imágenes nativas y comparación desde la misma cámara.

**P2 / Interacción de gráficos.** Las curvas ya permiten puntos con flechas y SVG. Una mejora posterior es una ficha por punto seleccionado con interpretación detallada por curva y exportación de esa selección, sin extrapolaciones fuera del dominio calculado.

**P2 / Móvil y accesibilidad.** La emulación Chrome a 390 px verifica layout y navegación. Faltan pruebas táctiles sobre dispositivo real, revisión completa de lector de pantalla y cierre de foco modal en paneles auxiliares.

**P2 / Consistencia.** Unificar progresivamente iconos y componentes *nativos* de los paneles 3D, sin reemplazar los controladores del laboratorio ni reducir las 34 animaciones y 13 cámaras importadas.

## 4. Criterios de QA

El preview debe cumplir:

1. Logo/favicons SVG cargan con tamaño real y las tres variantes SVG existen en el árbol Git.
2. Búsqueda/filtros de parámetros cambian solo visibilidad; un retorno a circuito restituye todos los grupos.
3. La lectura de Q, ΔP y NPSH conserva los valores y estados derivados del motor.
4. Curvas, memoria, escenarios, exportaciones y comparación de Academia conservan funcionalidad.
5. Planta General conserva nueve cámaras; Euler conserva sus siete vistas de tramo, modos y corte interior 3D; los avisos P3→P4 siguen NO-GO.
6. Build firma B64, 370/370 pruebas de regresión, Chrome E2E científico y 3D, pantalla móvil 390 px sin overflow.
7. Publicación a **preview** solamente; `main` y producción no se modifican.

**Evidencias previstas:** `qa-artifacts/t25-premium/t25-e2e.json`, capturas T25; E2E científico y 3D en `qa-artifacts/t27-scientific/` y `qa-artifacts/t27-3d/`.
