# PULPA LAB 3D — Inventario post-video

Checkpoint de entrada: **PULPA-LAB-INTEGRATED-V1 FINAL CLOSED**  
Contrato aplicado: **PULPA-LAB-INDUSTRIAL-3D-V1**

| Problema observado | Zona | Severidad | Causa técnica reconciliada | Tratamiento aplicado |
|---|---|---:|---|---|
| Barandas/pasarelas desfasadas | Fajas y proceso | Alta | Componentes visuales no compartían un marco local suficientemente coherente con la pendiente | Belt, idlers, walkway, handrails y drive pasan a un único `conveyor-local-frame`; reactor recibe walkway real bajo rail |
| Fajas visualmente extrañas | CV-01/02/03 | Alta | Referencias geométricas y puertos no seguían una única línea de centro | Conveyor reconstruido dentro de su módulo: head/tail pulleys, carrying/return idlers, trestles, bracing, walkway, rail y cama de mineral |
| Stockpile demasiado perfecto | Acopio | Media | Conos simétricos + pad circular muy visible | Geometría irregular determinista y pad compacto rectangular |
| Piping parece líneas flotantes | Clasificación/leach/recovery | Alta | Falta de soportes/fittings/jerarquía visual | Soportes, shoes, flanges, válvula visual, colores por servicio y rutas port-to-port |
| Pulpa poco legible | Piping/sump/pump/cyclones/reactores | Media | Interior continuo sin sólidos suspendidos visibles | `THREE.Points` preasignados con brillo discreto; no se crean por frame |
| Overflow/underflow poco claros | Clasificación | Alta | Trazados visualmente similares | Overflow y underflow diferenciados; ambos se mantienen físicamente conectados |
| Batería R-01..R-04 poco legible | Lixiviación | Alta | Header elevado dominaba la lectura | Interstage routes locales y cercanas + fases de agitación desincronizadas |
| Recuperación demasiado simple | CIP/Elution/EW/Smelting | Alta | Poca infraestructura auxiliar | Plataformas, escaleras/rails, pumps, headers, electrical cabinets, busbars, hood/stack y foundations locales |
| Terreno/tajo demasiado procedural | Mina | Media | Bancos excesivamente regulares | Irregularidad angular controlada conservando diseño del pit |
| Roads parecen cintas | Mina/ROM | Media | Poca señal visual de rodadura e integración | Wheel tracks terrain-following y conservación de berms/shoulders existentes |
| Loader entra visualmente al stockpile | Acopio | Alta | Ruta de retorno demasiado próxima al volumen de pila | Ruta centralizada corregida y auditada contra elipse del stockpile |
| Shovel orientada fuera del punto de carga | Pit | Alta | Heading inicial incoherente | Pose corregida hacia truck loading spot |
| Riesgo de recursos no liberados | Assets con Lines/Points | Media | `dispose()` solo recogía Mesh | Dispose ampliado a cualquier renderable con geometry/material |
| Asignaciones temporales en frame | Slurry/loader | Baja | `Vector3` temporales en actualización | Scratch vectors preasignados para flujo y loader |
