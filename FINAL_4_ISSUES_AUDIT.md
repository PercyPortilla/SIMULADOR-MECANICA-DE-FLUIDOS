# FINAL 4 ISSUES AUDIT

Checkpoint base: `PULPA-LAB-INDUSTRIAL-REFINED-V1`

| Defecto | Síntoma | Causa raíz encontrada | Archivo principal | Severidad |
|---|---|---|---|---|
| Partículas de pulpa fuera del tubo | Los puntos pueden separarse visualmente del volumen interno en codos/transiciones | Las partículas siguen un `CatmullRomCurve3` suavizado mientras la tubería real está construida por tramos rectos + joints. La curva puede cortar/abrirse respecto al volumen real. Además no existe confinamiento radial explícito al radio del fluido. | `src/scene/piping/pipingEngine.js`, `src/scene/integration/integratedAnimations.js` | CRÍTICO |
| Ruedas del haul truck giran extraño | Giro visual acumulado/no físico | La integración recorre por nombre (`truck-wheel-`) y rota no solo el conjunto de rueda sino también hijos cuyos nombres coinciden, produciendo rotaciones anidadas. No existe separación explícita `steerPivot -> spinPivot`. | `src/equipment/mining/haulTruck.js`, `src/scene/integration/integratedMobile.js` | CRÍTICO |
| Tolva descarga hacia el lado equivocado | El dump body levanta en el sentido opuesto al esperado | El pivote está correctamente situado en la parte trasera (`x < 0`), pero el signo aplicado a `rotation.z` es negativo. Con el frente del truck en `+X`, el signo positivo es el que eleva el frente de la tolva. | `src/equipment/mining/haulTruck.js` | CRÍTICO |
| Haul roads se ven artificiales | Parecen cintas pegadas/dibujadas sobre el terreno y bermas repetitivas | La calzada toma la altura de terreno independientemente en cada borde, por lo que no existe una rasante transversal verdaderamente ingenieril; las bermas son rocas instanciadas separadas en ambos lados y las huellas son tubos redondos, lo que refuerza el aspecto artificial. | `src/scene/environment/haulRoads.js` | ALTO |

## Criterio de cierre

No declarar cierre hasta que:

1. Las partículas se generen/animen sobre la ruta física real y estén confinadas al radio interno del fluido.
2. El truck use pivotes independientes para dirección y rodadura, y la integración rote únicamente el `spinPivot`.
3. La tolva levante el frente respecto a la bisagra trasera y descargue hacia atrás sobre ROM.
4. Los roads usen una rasante central suavizada, crown/crossfall controlado, shoulders y transiciones continuas; huellas planas y bermas continuas, no “tubos” o rocas repetidas.
