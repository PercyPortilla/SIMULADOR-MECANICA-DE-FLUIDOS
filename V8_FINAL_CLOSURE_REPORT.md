# PULPA-LAB-INTEGRATED-V1 — Cierre real de Fase Final

Fecha: 2026-10-10

## Alcance

Este cierre continúa únicamente desde `PULPA-LAB-INTEGRATED-V1`. No se inició Etapa 3 ni se añadieron funciones nuevas. Los assets aprobados permanecen como módulos independientes.

## Reconciliación del entorno

- `package.json` SHA-256: `d8c70b9af27e5d4d4ff0cabad42d57382a468f549f489bdfcf9c62402c3cb3bf`
- `package-lock.json` SHA-256: `388ad48b259bcc317bffd619a5afa657b757e90f814c33b338afb8bd6c5eaa99`
- Ambos hashes son idénticos antes y después de los intentos de instalación.
- No había `node_modules` en el checkpoint.
- Se revisaron cachés npm de `/home/oai/.npm` y `/root/.npm`, configuración npm, variables proxy/mirror, globals del sistema y todos los checkpoints ZIP locales.
- La caché root contiene 340 objetos, pero solo 3 de 102 tarballs exactos del lockfile; faltan 99.
- `registry.npmjs.org` no resuelve por DNS y el entorno no tiene conectividad externa directa utilizable.
- `npm ci --offline` falla con `ENOTCACHED` en `why-is-node-running@2.3.0`.

## npm test / npm run build

Los comandos se intentaron después de agotar recuperación local:

- `npm test` -> exit 127, `vitest: not found`.
- `npm run build` -> exit 127, `vite: not found`.

Estado: **⛔ NO VALIDADO** por imposibilidad técnica de disponer de dependencias, no por cambio de versiones ni por modificación forzada del proyecto.

## Navegador / WebGL

Se verificó Chromium 144. Con Xvfb + SwiftShader el entorno sí puede crear `WebGL` y `WebGL2` en una página en blanco. Sin embargo, la política del navegador bloquea tanto `http://127.0.0.1:4173/...` (`ERR_BLOCKED_BY_ADMINISTRATOR`) como URLs `file://`. Sin Vite/Three instalados tampoco existe un bundle ejecutable alternativo.

Estado de validación visual real de la aplicación: **⛔ NO VALIDADO** por bloqueo administrativo del navegador + dependencias no disponibles.

## Defecto real encontrado y corregido

Durante la revisión de la lógica integrada del truck se detectó una regresión concreta en `src/scene/integration/integratedMobile.js`:

1. En el estado de descarga se orientaba el truck con `rotation.y = Math.PI` para dejar la parte trasera hacia el ROM.
2. Al final del mismo frame se llamaba siempre a `orientAlong(truck.root, tangent)`.
3. Esa llamada anulaba la orientación de descarga.

Corrección mínima aplicada:

- se añadió `preserveDumpHeading` únicamente para la fase de dump;
- `orientAlong()` ya no sobrescribe la orientación mientras el truck descarga;
- no se modificó el asset `haulTruck`, el masterplan, la carretera ni ningún otro sistema.

Solo un archivo fuente cambió respecto al checkpoint de entrada: `src/scene/integration/integratedMobile.js`.

## Revalidación después de la corrección

- Equipment catalog static audit: **129/129 PASS**.
- Integration static audit: **34/34 PASS**.
- Integration clearance audit: **135/135 PASS**.
- Sintaxis JS/MJS: **111 archivos, 0 errores**.
- Imports relativos: **188, 0 faltantes**.
- Check dedicado de heading de descarga: PASS.
- `scene.fog = null`: confirmado estáticamente.
- `recoveryModel = null`: confirmado; topología renderizable y cálculo de recuperación aún no validado.
- Cámaras declaradas: **9**.
- Camera far plane: `1600`.
- Inspection maxDistance: `700`.
- Loop principal: solo `baseEnvironment.js` programa el loop recurrente de la escena; `Equipment Lab` conserva su loop aislado y no se monta en la escena principal.
- `integratedAnimations.js`: no crea geometrías ni materiales dentro de `update()`.
- `integratedMobile.js`: no crea geometrías ni materiales dentro del loop de actualización.
- Archivos activos de animación integrada: 0 `addEventListener`.

## Matriz final

| Sistema / requisito | Estado | Evidencia real disponible |
|---|---|---|
| Catálogo de assets independiente | ✅ Cumple | Equipment audit 129/129 + integration audit |
| Sintaxis | ✅ Cumple | 111/111 archivos pasan `node --check` |
| Imports relativos | ✅ Cumple | 188/188 resueltos |
| Masterplan / clearances estáticos | ✅ Cumple | Clearance audit 135/135 |
| Haul road principal | ✅ Cumple | 18.5 m; ratio road/truck 3.524x; grade muestreado 9.127% |
| Truck: orientación durante dump | ✅ Corregido | Fix mínimo + check dedicado PASS |
| Truck/loader: no colisión según rutas calculadas | ✅ Cumple estáticamente | Integration + clearance audits |
| Truck/loader: no flotación o clipping visual | ⛔ NO VALIDADO | Requiere navegador/WebGL de la aplicación |
| Molino: `staticGroup` / `rotatingGroup` | ✅ Cumple | Integration audit confirma ambos y root no animado |
| Molino: no se hunde/desplaza visualmente | ⛔ NO VALIDADO | Requiere render WebGL real |
| Mill → sump → pump → cyclones | ✅ Cumple estáticamente | IDs/conexiones presentes en audit 34/34 |
| Cyclone overflow → R-01 | ✅ Cumple estáticamente | `P-CLASSIFICATION-TO-LEACH` |
| Cyclone underflow → molienda | ✅ Cumple estáticamente | `P-CYCLONE-UNDERFLOW-RETURN` |
| R-01 → R-02 → R-03 → R-04 | ✅ Cumple estáticamente | Tres conexiones verificadas |
| Reactores: animación visual coherente | ⛔ NO VALIDADO | Requiere render real |
| R-04 → CIP → Elution → EW → Smelting | ✅ Cumple topológicamente | Conexiones de proceso/material verificadas |
| Recuperación: presencia industrial visual | ⛔ NO VALIDADO | Evaluación visual real bloqueada |
| Piping: endpoints port-to-port | ✅ Cumple estáticamente | Motor de piping + integration audit |
| Piping: sin penetraciones/floating perceptibles | ⛔ NO VALIDADO | Necesita inspección WebGL real |
| Terrain / pads / roads: clearances calculados | ✅ Cumple estáticamente | Clearance audit 135/135 |
| Terrain / pads / roads: integración visual | ⛔ NO VALIDADO | Navegador bloqueado |
| 9 cámaras configuradas | ✅ Cumple | 9 presets, near 0.1 / far 1600 |
| 9 cámaras sin clipping visible | ⛔ NO VALIDADO | Necesita render real |
| Animaciones ON/OFF: contrato de estado | ✅ Cumple estáticamente | `setEnabled()` + único update integrado |
| Animaciones ON/OFF: comportamiento visual | ⛔ NO VALIDADO | Necesita navegador |
| Normal / Transparent / Cutaway / Interior: implementación | ✅ Cumple estáticamente | Inspection controller y clipping real presentes |
| Modos de inspección: resultado visual | ⛔ NO VALIDADO | Necesita WebGL real |
| `scene.fog === null` | ✅ Cumple | Confirmado en `baseEnvironment.js` |
| `recoveryModel === null` | ✅ Cumple | Import directo de `processRoute.js` |
| Loops secundarios en escena principal | ✅ Cumple | Un loop recurrente de escena; lab aislado |
| Geometría/material por frame en integración activa | ✅ Cumple | Escaneo de `integratedAnimations` / `integratedMobile` |
| Listeners acumulativos en animación integrada | ✅ Cumple | 0 listeners en archivos activos de integración |
| `npm test` | ⛔ NO VALIDADO | `vitest` no disponible; instalación imposible |
| `npm run build` | ⛔ NO VALIDADO | `vite` no disponible; instalación imposible |
| Consola real de la aplicación | ⛔ NO VALIDADO | Navegación local bloqueada por política del navegador |

## Estado final

La única regresión concreta encontrada en las comprobaciones ejecutables fue la orientación del truck durante descarga y quedó corregida. Todas las auditorías estáticas afectadas volvieron a pasar. Los puntos marcados **⛔ NO VALIDADO** requieren ejecución real de la aplicación y siguen técnicamente bloqueados por el entorno, después de agotar caché, mirror/proxy, backups, instalación offline/normal y rutas de navegador disponibles.

**FASE FINAL CERRADA. DETENERSE.**
