# PULPA LAB — V12 Environment 3D phased checkpoint

**Fecha:** 2026-10-12  
**Estado:** correcciones de código fuente completadas hasta fase final.  
**Base:** checkpoint V11 auditado del entorno 3D.

## Regla maestra aplicada

Las mejoras se implementaron por capas, conservando la física, cálculos hidráulicos/metalúrgicos, estado y reporting existentes. El trabajo de V12 se limitó al entorno 3D, interacción de inspección, lectura visual, red vial, conexiones visuales, iluminación, rendimiento y pruebas asociadas.

No se modificaron `src/core`, `src/controller`, `src/state` ni `src/reporting` frente al checkpoint V11 usado como base.

## Fase A — Base visual y minera

### Terreno y materiales

- Se redujo la repetición visible del microrelieve procedural.
- Se introdujo variación macro, media y fina en la textura de suelo.
- Se ajustaron repeats anisotrópicos para terreno, caminos y concreto.
- Se reforzó la lectura mate/rugosa del terreno y la compactación de caminos.
- Se añadieron sectores visuales del tajo: piso, frente activo, pared final y bancos.
- Se añadieron trazas geológicas/meteorización de baja intensidad mediante `InstancedMesh`, explícitamente marcadas como recurso visual y no como modelo de mineralización.

### Caminos y topografía

- ROAD-01 conserva su función de haul road principal mina → ROM.
- ROAD-02/03/04 se mantienen como red de servicio, bypass y acceso a recuperación.
- Las vías secundarias ahora se remuestrean sobre la topografía a lo largo de toda su trayectoria, reduciendo segmentos flotantes o enterrados entre nodos.
- Se incorporaron metadatos de diseño por vía: pendiente máxima, radio mínimo y velocidad de diseño.
- Se añadieron métricas auditables de longitud, pendiente y radio.
- Se incorporaron junctions explícitos derivados de nodos compartidos.
- Se añadió ensanchamiento moderado en terminales/intersecciones de vías de servicio.
- Se añadieron cunetas laterales suaves en ROAD-02/03/04 sin duplicar la ingeniería propia de ROAD-01.

### Seguridad vial

Se añadió señalización industrial/minera mínima y semántica en puntos justificados: prioridad del haul road, velocidad en ROM, acceso a planta, acceso a recuperación y advertencia de equipos pesados. Se evitó una estética urbana o exceso de señales.

## Fase B — Experiencia técnica

### Etiquetas LOD

El sistema de etiquetas ahora diferencia tres niveles semánticos:

1. zona;
2. equipo;
3. componente.

La presentación depende de distancia, cámara y modo de inspección. Las etiquetas de componentes solo aparecen durante inspección a distancia razonable. La etiqueta del objeto seleccionado permanece prioritaria y con mayor contraste.

### Inspección

- El encuadre de inspección se calcula con bounding box/bounding sphere y FOV, en vez de depender únicamente de offsets manuales.
- Los límites de OrbitControls y planos de cámara se adaptan al tamaño del equipo.
- Se conserva la etiqueta del equipo seleccionado.
- Se generan etiquetas de componentes útiles cuando existen nombres/roles identificables.
- El contexto visual sigue al objeto si este se mueve o anima.

### Orden de circuito

La selección no depende de orden alfabético ni del scene graph. Se conserva un orden explícito del proceso, incluyendo mina/ROM, alimentación, chancado, stockpile, molienda, sump/bombeo, clasificación, lixiviación y recuperación hasta fundición.

Se incorporaron botones **Anterior** y **Siguiente** que recorren esa misma secuencia.

### Contexto upstream/downstream

Durante inspección se puede representar:

- seleccionado: máxima prioridad;
- upstream inmediato: prioridad secundaria;
- downstream inmediato: prioridad secundaria.

El sistema utiliza helpers reversibles y se refresca con la escena, evitando alterar permanentemente los materiales originales.

## Fase C — Integridad 3D

### Conexiones físicas

`integratedPiping` expone una auditoría de endpoints que compara el primer/último punto de cada ruta con los puertos reales de origen y destino del equipo. Esto permite detectar programáticamente tuberías que dejen de coincidir con los equipos al modificar layout o rutas.

### Iluminación

- La luz solar principal se centra sobre el conjunto mina + planta en vez de un sector arbitrario.
- El volumen de sombras usa los bounds generales del sitio.
- Se mantuvo una iluminación diurna técnica, sin bloom ni atmósfera cinematográfica añadida.
- Se etiquetaron roles de iluminación para hacerlos auditables.

## Fase D — Rendimiento

- Se añadió conteo de recursos de escena: objetos, meshes, instancias, sprites, geometrías/materiales únicos y objetos con sombras.
- Las nuevas trazas del tajo usan instancing.
- Se redujo el límite de `devicePixelRatio` del renderer a 1.6 para contener carga GPU en pantallas de alta densidad.
- La escena deja de mantener un render loop continuo cuando no hay animación y los controles de inspección están inactivos; las actualizaciones explícitas siguen renderizando cuando cambia estado/cámara.
- Las etiquetas vuelven a aprovechar frustum culling.

## Archivos fuente modificados

- `src/main.js`
- `src/styles.css`
- `src/scene/baseEnvironment.js`
- `src/scene/config/siteDesign.js`
- `src/scene/environment/civilInfrastructure.js`
- `src/scene/environment/haulRoads.js`
- `src/scene/environment/mineProps.js`
- `src/scene/environment/terrain.js`
- `src/scene/inspection/equipmentInspection.js`
- `src/scene/integration/integratedPiping.js`
- `src/scene/labels/plantLabels.js`
- `src/scene/materials/industrialMaterials.js`

## Pruebas actualizadas o añadidas

- `tests/scene/industrialMaterials.test.js`
- `tests/scene/infrastructure.test.js`
- `tests/scene/inspectionModes.test.js`
- `tests/scene/lightingReadability.test.js`
- `tests/scene/performanceResources.test.js`
- `tests/scene/plantLabels.test.js`
- `tests/scene/terrain.test.js`

Las pruebas cubren, entre otros puntos, materiales, drenaje, junctions, señalización, sectores del tajo, instancing, orden/contexto de inspección, framing por tamaño, etiquetas de componentes, iluminación, auditoría de endpoints y recursos de escena.

## Validación ejecutada en V12

- **165/165 archivos JS/MJS:** `node --check` PASS.
- **JSON del proyecto:** parseo PASS.
- **Invariantes estáticos del circuito:** PASS; la secuencia crítica mantiene ROM → feeder → crusher → stockpile → mill → sump → bombeo → clasificación → lixiviación → recuperación.
- **Invariantes de red vial:** PASS; ROAD-01/02, ROAD-02/03 y ROAD-02/04 conservan nodos de conexión compartidos y metadatos de diseño.
- **Alcance:** 19 archivos de código/tests cambiaron respecto de la base V11 antes de este informe/checkpoint.
- **Separación de física:** `src/core`, `src/controller`, `src/state` y `src/reporting` permanecieron sin cambios.

## Limitación de validación del entorno

La suite completa de Vitest y el build Vite **no pudieron reejecutarse para V12** porque el entorno no pudo resolver `registry.npmjs.org`; `npm ci` y una consulta directa al registro fallaron con `EAI_AGAIN`.

El checkpoint V11 de partida indicaba **41 archivos / 161 tests PASS**, build PASS y browser QA PASS antes de estas modificaciones. Ese resultado previo no se presenta como validación de V12.

El directorio `dist` incluido corresponde al build previo. Antes de desplegar V12 en producción debe ejecutarse, con conectividad disponible:

```bash
npm ci
npm test
npm run build
```

Después debe hacerse una pasada visual real en navegador por vista general, tajo, ROM/chancado, molienda, lixiviación, recuperación, inspección de equipos pequeños/grandes y recorrido de ROAD-01/red interna.

## Criterio de cierre

El objetivo solicitado de edición fase a fase se considera alcanzado a nivel de código fuente y validación estática. No se declaran como completadas las pruebas/runtime que el entorno actual no pudo ejecutar.
