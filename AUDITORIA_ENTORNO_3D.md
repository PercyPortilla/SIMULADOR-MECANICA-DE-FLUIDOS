# Auditoría del entorno 3D — PULPA LAB

## Objetivo

Auditar y mejorar la coherencia visual y operativa del entorno 3D, con foco en terreno/tajo, etiquetas, modo inspección, caminos y orden de selección de equipos según el circuito.

## Hallazgos principales

### 1. Suelo y tajo

El terreno usaba texturas procedurales basadas en distribuciones periódicas de puntos. A corta distancia aparecían patrones repetitivos y poco naturales. Además, el tajo dependía principalmente de un mismo material base y de coloración por pendiente, por lo que bancos, caras rocosas y piso operativo no se diferenciaban suficientemente.

La representación visual más coherente para este tipo de escena es:

- terreno natural: granular, mate, con variación de escala amplia y fina, sin patrón evidente;
- bancos: superficies relativamente planas, polvorientas y algo más claras;
- caras de banco/taludes: más oscuras, grises-marrones y rocosas;
- piso del tajo: compactado y algo más uniforme;
- zona del sump: más oscura por humedad;
- caminos: material compactado distinto del terreno circundante, con huellas longitudinales tenues;
- bermas/cortes/rellenos: tonos próximos al terreno, pero claramente separados del firme de rodadura.

### 2. Etiquetas

Las etiquetas tenían tres problemas:

- su escala estaba definida en metros de mundo, por lo que desde una cámara lejana podían volverse demasiado pequeñas;
- `depthTest` permitía que quedaran ocultas por geometría;
- en cámara `inspection` se desactivaban explícitamente.

Además, el conjunto de etiquetas de equipo estaba concentrado en lixiviación/recuperación y faltaban equipos importantes del frente de proceso.

### 3. Modo inspección

El sistema de inspección ordenaba los objetivos con `localeCompare`, es decir, alfabéticamente. Eso no representa el circuito.

También seleccionar un equipo no llevaba automáticamente a la cámara de inspección ni generaba una identificación visual específica sobre el objetivo seleccionado.

### 4. Caminos

ROAD-01 ya funcionaba como camino de acarreo principal y conserva su perfil controlado para camión minero.

El problema estaba principalmente en las vías secundarias: ROAD-02, ROAD-03 y ROAD-04 se percibían como trazos independientes/decorativos, con empalmes poco claros y una gran envolvente de ROAD-03 que no respondía a una lógica de circulación de planta.

## Cambios implementados

### Texturas y terreno

- Se reemplazó el patrón procedural de puntos por ruido determinista multiescala.
- Se eliminó la lectura visual de “rejilla de puntos” al acercarse al suelo.
- Se suavizó la textura de color para que la paleta de escena siga controlando el tono general sin duplicar una coloración marrón excesiva.
- Se mejoró la diferenciación por pendiente dentro del tajo:
  - bancos/piso: tonos terrosos y polvorientos;
  - caras: tonos rocosos más oscuros y neutros;
  - piso profundo: tratamiento distinto;
  - entorno del sump: oscurecimiento local por humedad.
- Se oscurecieron bermas, transiciones de corte/relleno y huellas del camino para aumentar lectura de profundidad.

### Etiquetas

- Mayor contraste, borde y sombra.
- `depthTest: false` y orden de render alto para que funcionen como señalización técnica legible.
- Escala adaptativa según distancia a la cámara.
- Etiquetas añadidas para:
  - ROM-HOPPER;
  - APRON-FEEDER;
  - PRIMARY-CRUSHER;
  - STOCKPILE-RECLAIM;
  - MILL-01;
  - SLURRY-PUMP-01;
  - CLASS-01;
  - R-01 a R-04;
  - PUMP-01;
  - CIP;
  - ELUTION;
  - EW;
  - SMELTING.
- En inspección se ocultan etiquetas de zona para evitar ruido, pero se conserva contexto de equipo.
- El objetivo seleccionado recibe una etiqueta destacada color cian y se actualiza con su posición.

### Inspección y orden del circuito

Se sustituyó el orden alfabético por una secuencia de proceso explícita. El orden comienza por equipos de mina y recepción y continúa por chancado, stockpile, molienda, clasificación, lixiviación, bombeo y recuperación.

La secuencia considera también las líneas principales y el retorno de underflow de ciclones al molino.

El selector ahora muestra numeración visible (`01 ·`, `02 ·`, etc.) y nombres más descriptivos.

Al seleccionar un objetivo, la interfaz entra automáticamente a la cámara `inspection`.

### Caminos

- ROAD-01 se conserva como camino de acarreo principal entre tajo y recepción ROM.
- ROAD-02 se redefinió como espina principal de servicio al sur de la planta y arranca en un nodo real de ROAD-01.
- ROAD-03 se convirtió en bypass norte con dos empalmes reales a ROAD-02, evitando el antiguo gran lazo decorativo.
- ROAD-04 se convirtió en acceso de recuperación con dos conexiones a ROAD-02 y recorrido por el lado sur del tren metalúrgico.
- Los nodos compartidos son coordenadas idénticas, no simples aproximaciones visuales.

## Archivos modificados

- `src/main.js`
- `src/styles.css`
- `src/scene/baseEnvironment.js`
- `src/scene/config/siteDesign.js`
- `src/scene/environment/haulRoads.js`
- `src/scene/environment/terrain.js`
- `src/scene/inspection/equipmentInspection.js`
- `src/scene/labels/plantLabels.js`
- `src/scene/materials/industrialMaterials.js`
- `tests/scene/infrastructure.test.js`
- `tests/scene/inspectionModes.test.js`
- `tests/scene/plantLabels.test.js`

## Validación realizada

Se ejecutó validación sintáctica con `node --check` sobre todos los archivos JavaScript de `src` y `tests`, sin errores.

No fue posible ejecutar Vitest en este entorno porque el ZIP no incluía `node_modules` y la instalación de dependencias por red no se completó. Los tests de regresión fueron actualizados para cubrir el nuevo orden de inspección, la visibilidad de etiquetas en inspección y las intersecciones reales entre caminos de servicio.

## Siguientes mejoras recomendadas

1. Añadir texturas PBR reales o fotogrametría ligera para roca, terreno compactado y mineral, con `normalMap`, `roughnessMap` y escalado métrico.
2. Separar visualmente sectores “pared final” y “frente activo” con litología/color/fragmentación diferentes.
3. Añadir señalización vial funcional: cruces, bermas críticas, acceso restringido y zonas de giro, sin usar pintura de carretera urbana.
4. Incorporar un modo de etiquetas por nivel de detalle: zona → equipo → componente.
5. Añadir resaltado temporal del recorrido del circuito cuando se selecciona un equipo, mostrando upstream/downstream inmediato.
6. Verificar visualmente el resultado final en navegador después de instalar dependencias y regenerar `dist`.
