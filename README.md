# PULPA LAB V2

Simulador académico de transporte, bombeo, reología y recuperación de pulpas mineras, con planta 3D industrial integrada.

## Estado actual

**V23 · Detalle industrial e Inspección**

La versión actual integra:

- circuito minero 3D desde carguío/ROM hasta fundición;
- modelos Newtoniano, Bingham, Herschel–Bulkley y Ley de Potencia con alcance explícito;
- hidráulica, pérdidas, carga estática, bombeo y energía;
- lixiviación CSTR y recuperación CIP → elución → EW → fundición;
- activos industriales Blender/GLB sobre runtime Three.js;
- animaciones, cámaras, Inspección y Modo Presentación;
- casos académicos guiados;
- comparador A vs B con explicación causal;
- laboratorio interactivo con hipótesis previa, contraste contra el solver y conclusión;
- informe HTML autónomo e imprimible de cada práctica.
- pivotes de animación estabilizados para molino y bombas, sin alterar posiciones físicas ni endpoints;
- grizzly ROM, reclaim de stockpile y contenido del sump con movimiento visible gobernado por el toggle global de animaciones;
- recepción sobre terraplén industrial con desniveles, talud, berma y transición de pie;
- overlay Blender visual del terraplén generado desde la misma topografía autoritativa de Three.js;
- contrato métrico 1 unidad = 1 m y auditoría de escala industrial sobre los GLB principales;
- CI en GitHub para ejecutar pruebas y build antes de aceptar regresiones.
- microrelieve natural acotado y lectura diferenciada de bancos, cortes, rellenos y bermas;
- transición ROM → chancado sin el antiguo hombro/hump visual en el borde este del terraplén;
- talud de corte, berma de captura y pie al sur de chancado primario;
- transición vial ROAD-01 ensanchada en el tie-in de recepción y berma de seguridad que se desvanece antes del apron;
- materiales multiescala independientes para terreno, camino y concreto, con cielo altoandino más limpio;
- pórticos de 18 m en el tramo elevado PUMP-01 → CIP que comparte corredor aéreo con ROAD-02, sin mover la tubería;
- clasificación shell/interior/structure más precisa para activos Blender durante Inspección.
- detalle mecánico y safety en los tres conveyors paramétricos y en la chancadora primaria sin reemplazar su geometría autoritativa;
- encuadre focal de Inspección para siete objetivos extensos, preservando transforms, rutas y metadatos físicos;
- soportes PUMP-01 → CIP comprobados contra la curva real de ROAD-02, con footings fuera del corredor y arriostramiento en soportes altos;
- Pipe 1 refleja visualmente su `valvesCount` sin modificar codos geométricos ni lógica hidráulica;
- interiores educativos mínimos preservados sobre GLB en MILL-01, bombas y ELUTION-SKID sin duplicar shells ni reactivar animación procedural.

## Arquitectura

- **Runtime 3D:** Three.js
- **Modelado industrial:** Blender → GLB
- **Frontend/build:** Vite + JavaScript
- **Pruebas:** Vitest

Three.js continúa siendo el runtime autoritativo. Las geometrías paramétricas de conveyors, piping, endpoints, diámetros y topografía no se sustituyen por modelos rígidos cuando dependen del estado del simulador.

El terreno Blender es una capa visual opcional. El overlay de recepción regenerado en V22 se conserva sin cambios en V23. La elevación que gobierna equipos, caminos y cimentaciones sigue proviniendo de `getTerrainHeight()`; si el GLB no carga, el terreno procedural conserva toda la geometría funcional.

## Circuito principal

Mina → ROM → apron feeder → chancado primario → stockpile → molienda → sump → bombeo → ciclones → lixiviación → CIP → elución → electrowinning → fundición.

## Ejecutar localmente

```bash
npm install
npm run dev
```

Build de producción:

```bash
npm run build
```

Pruebas:

```bash
npm test
```

## Alcance académico

PULPA LAB diferencia explícitamente entre resultados validados y estimaciones educativas. Entre otras limitaciones:

- los parámetros reológicos no se infieren automáticamente desde el porcentaje de sólidos;
- la rama no Newtoniana validada se restringe al alcance implementado;
- la visualización de flujo no es CFD;
- la constante cinética de lixiviación requiere ensayo/calibración;
- la recuperación usa eficiencias de etapa explícitas;
- el caudal/alimentación de oro no se deriva automáticamente de la conversión de lixiviación;
- la correlación Durand mostrada es orientativa y no calibrada.

## Checkpoints

Cada versión académica cerrada mantiene reporte, guards de cálculo, pruebas y manifest SHA-256. El checkpoint vigente se identifica en `CHECKPOINT.txt`.

