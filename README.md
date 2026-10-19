# PULPA LAB V2

Simulador académico de transporte, bombeo, reología y recuperación de pulpas mineras, con planta 3D industrial integrada.

## Estado actual

**V57 · Acabado industrial de planta**

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
- flota operativa coordinada con TRUCK-01..03 sobre ROAD-01, excavadora y loader/reclaim gobernados por `Animaciones`;
- flujo visual de mineral ROM → apron → chancadora → CV-02 → stockpile/reclaim → CV-03 → molino, sin convertirlo en simulación granular;
- realismo mecánico híbrido adicional en clasificación/CIP y preservación de motores, reductores, guards, plataformas y accesos existentes;
- instrumentación PI/PT/FT/LT y piping secundario estrictamente visual, sin alterar solver, longitudes hidráulicas, centerlines, endpoints ni diámetros físicos;
- seguridad industrial, MCC/utilidades, transformadores, cable trays, taller, pickup y escala humana sin invadir caminos ni corredores operativos;
- desgaste superficial, finos y spills controlados como overlays visuales, manteniendo `getTerrainHeight()` como autoridad;
- cues educativos de operación desde molienda hasta fundición, explícitamente no-CFD y sin inventar acoplamientos de proceso;
- hotspots educativos compactos en equipos prioritarios, manteniendo los 38 targets y 7 focus profiles de Inspection;
- iluminación diurna industrial consistente y política de sombras secundarias de bajo riesgo para reducir trabajo de shadow-map.
- LOD adaptativo: responde con rapidez al movimiento de cámara, reduce recorridos repetidos en vista estática y mantiene un refresh de seguridad para assets asíncronos;
- caché LOD por equipo con poda segura de fallbacks Blender ocultos e invalidación cuando llegan módulos híbridos, preservando Inspection y `Animaciones`;
- fundición importada con pacing operacional de 16 s y dwell, en lugar de repetir continuamente el clip de inclinación de 5 s;
- shovel y loader importados arrancan con el mineral del balde oculto hasta que su ciclo operacional realmente lo carga;
- desfase reproducible de R-01..04 sobre la animación Blender y contrato real-loaded para estaciones HEAD/TAIL de conveyors;
- hotspots educativos ampliados a EW-CELLS y SMELTING-FURNACE sin cambiar los 38 targets ni los 7 focus profiles.
- capa de acabado V57 sobre Blender V56 con pórticos de servicio, headers de tubería, tanques auxiliares, iluminación de operación y beacon conectado al toggle `Animaciones`;
- encuadres general y oblicuo ajustados para mostrar la planta con mayor escala visual, conservando el contexto de terreno y tajo.

## Arquitectura

- **Runtime 3D:** Three.js
- **Modelado industrial:** Blender → GLB
- **Frontend/build:** Vite + JavaScript
- **Pruebas:** Vitest

Three.js continúa siendo el runtime autoritativo. Las geometrías paramétricas de conveyors, piping, endpoints, diámetros y topografía no se sustituyen por modelos rígidos cuando dependen del estado del simulador.

El terreno Blender es una capa visual opcional. El overlay de recepción regenerado en V22 se conserva sin cambios en V25. La elevación que gobierna equipos, caminos y cimentaciones sigue proviniendo de `getTerrainHeight()`; si el GLB no carga, el terreno procedural conserva toda la geometría funcional.

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

