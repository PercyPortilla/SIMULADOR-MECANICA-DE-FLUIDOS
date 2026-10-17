# PULPA LAB V2

Simulador académico de transporte, bombeo, reología y recuperación de pulpas mineras, con planta 3D industrial integrada.

## Estado actual

**V20 · Laboratorio Académico Interactivo**

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

## Arquitectura

- **Runtime 3D:** Three.js
- **Modelado industrial:** Blender → GLB
- **Frontend/build:** Vite + JavaScript
- **Pruebas:** Vitest

Three.js continúa siendo el runtime autoritativo. Las geometrías paramétricas de conveyors, piping, endpoints, diámetros y topografía no se sustituyen por modelos rígidos cuando dependen del estado del simulador.

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

