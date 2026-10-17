# PULPA LAB V2 — V10 Full Phased Completion Report

## Regla maestra

- No se inventan correlaciones ni eficiencias.
- El estado físico, los resultados derivados y la apariencia permanecen separados.
- Los modelos no newtonianos se limitan al perfil laminar validado existente; no se extrapolan a turbulencia.
- El modelo Newtoniano usa Reynolds, Darcy-Weisbach y Colebrook-White; la zona de transición 2300–4000 queda explícitamente sin interpolar.
- Lixiviación y recuperación solo calculan cuando el usuario selecciona el modelo y aporta los parámetros que el modelo requiere.

## Fases cerradas

1. **Hidráulica V2**: Reynolds, régimen, Darcy, Colebrook, pérdidas distribuidas, ΣK, Δz, ΔP total y carga.
2. **Potencia y energía**: potencia hidráulica, al eje y eléctrica; energía/costo anual con eficiencias, horas y tarifa explícitas.
3. **UI hidráulica avanzada**: KPIs, aplicabilidad, desglose hidráulico y gráficos de perfil reológico/pérdida distribuida.
4. **Resultados ↔ 3D**: velocidad visual de flujo y estado operativo de PUMP-01 derivados de resultados sin retroalimentar la física.
5. **Lixiviación**: residencia V/Q y, solo bajo selección explícita, CSTRs iguales en serie con cinética de primer orden y k proporcionada por el usuario.
6. **Recuperación**: balance secuencial CIP→Elución→EW→Fundición con eficiencias de etapa explícitas; no se predicen eficiencias intrínsecas.
7. **Escenarios/exportación**: biblioteca nombrada, guardar/cargar/actualizar/eliminar, comparar y exportar JSON/CSV; propiedades visuales excluidas de los inputs físicos.
8. **Paleta 3D**: roles visuales semánticos persistentes y separados del tema UI y de las propiedades físicas.
9. **Arquitectura/rendimiento**: schema y panel de resultados modularizados, metadata de cámaras sin Three, carga dinámica del 3D, referencias stale corregidas, cache de texturas y code splitting.
10. **QA final**: suite, build y navegador real cerrados.

## Gates finales

- `npm test`: **40 archivos / 154 tests PASS**.
- `npm run build`: **PASS**.
- Build dividido en chunk inicial (~46 kB), entorno 3D (~134 kB) y Three (~537 kB). Persiste únicamente el warning informativo de Vite por el tamaño del chunk de Three.
- Navegador real: **PASS**.
  - Canvas WebGL: 1096×520.
  - Error de escena: ninguno.
  - PUMP-01 disponible en Inspection.
  - Caso Newtoniano QA: densidad 1000 kg/m³, Q 28.27 m³/h, Re 100000, régimen turbulento, f Darcy 0.02217, ΔP total 61.12 kPa, carga 6.23 m, potencia eléctrica 0.67 kW.
  - Lixiviación QA: residencia 12.73 h, conversión CSTR 66.89 % con k explícita.
  - Recuperación QA: 67.03 % global y 6.7032 kg/h final con eficiencias explícitas 90/80/95/98 %.
  - Gráfico hidráulico: 21 puntos.
  - Escenario: guardar/cargar restaura el valor físico probado.
  - Tema UI y paleta 3D: edición y persistencia verificadas.

## Alcance técnico explícito

El simulador no predice por sí mismo constantes cinéticas de lixiviación ni eficiencias metalúrgicas de CIP, elución, electrowinning o fundición. Tampoco extrapola los modelos HB/Bingham/ley de potencia a régimen turbulento. Esos límites se muestran como contrato técnico, no se ocultan con valores por defecto.

**Estado: OBJETIVO COMPLETADO.**
