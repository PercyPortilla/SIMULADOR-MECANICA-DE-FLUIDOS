// NPSH visualization of values ALREADY computed by simulationController.
// This is a design comparison, never a sensor or cavitation predictor.
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const format = (value) => value.toLocaleString('es-PE', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

export function describeNpsh(pump) {
  const availableM = pump?.npshAvailableM;
  const requiredM = pump?.npsh?.requiredNpshM;
  if (!finite(availableM)) {
    return { state: 'unavailable', availableM: null, requiredM: null,
      explanation: 'No existe un NPSH disponible calculado para este escenario.' };
  }
  if (!finite(requiredM) || requiredM < 0) {
    return { state: 'incomplete', availableM, requiredM: null,
      explanation: 'Falta una curva NPSHr tabulada aplicable al punto de operación. No se puede evaluar el margen.' };
  }
  const marginM = availableM - requiredM;
  const state = marginM < 0 ? 'below' : 'meets';
  const maximum = Math.max(availableM, requiredM, 0, 1);
  return {
    state, availableM, requiredM, marginM,
    availablePercent: Math.max(0, Math.min(100, availableM / maximum * 100)),
    requiredPercent: Math.max(0, Math.min(100, requiredM / maximum * 100)),
    ratio: requiredM > 0 ? availableM / requiredM : null,
    flowM3h: finite(pump?.npshEvaluationFlowRateM3s)
      ? pump.npshEvaluationFlowRateM3s * 3600 : null,
    explanation: state === 'below'
      ? 'NPSHa es menor que NPSHr en el punto evaluado: la comparación NO cumple. Revisar curva, succión y condiciones de operación.'
      : 'NPSHa es al menos igual que NPSHr en el punto evaluado. Este criterio sólo compara magnitudes y no incorpora un margen adicional de diseño.',
  };
}

export function renderNpshDiagnostic(pump) {
  const assessment = describeNpsh(pump);
  const title = '<div class="wb-npsh-heading"><div><span>VERIFICACIÓN DE SUCCIÓN</span>'
    + '<h4>Margen disponible frente al requerido</h4></div>'
    + '<small>Curva de bomba · evaluación académica</small></div>';
  if (assessment.state === 'unavailable' || assessment.state === 'incomplete') {
    const available = assessment.availableM === null ? '—' : `${format(assessment.availableM)} m`;
    return `<section class="wb-npsh-diagnostic" data-state="${assessment.state}" aria-label="Evaluación NPSH">
      ${title}<div class="wb-npsh-message" role="status"><strong>Comparación no disponible</strong>
      <p>${assessment.explanation}</p><p>NPSHa calculado: <b>${available}</b></p></div>
      <p class="wb-npsh-caveat">Los valores mostrados son cálculos del modelo, no lecturas de sensores ni predicción de cavitación.</p>
    </section>`;
  }
  const stateLabel = assessment.state === 'below'
    ? 'Por debajo del NPSHr' : 'Cumple comparación básica';
  const signedMargin = `${assessment.marginM > 0 ? '+' : ''}${format(assessment.marginM)}`;
  const flowLabel = assessment.flowM3h === null ? 'Punto no especificado'
    : `Evaluado en Qop ${format(assessment.flowM3h)} m³/h`;
  return `<section class="wb-npsh-diagnostic" data-state="${assessment.state}" aria-label="Evaluación NPSH">
    ${title}
    <div class="wb-npsh-headline"><div class="wb-npsh-state" role="status"><span class="wb-npsh-indicator" aria-hidden="true"></span><strong>${stateLabel}</strong></div>
      <div class="wb-npsh-margin">Margen calculado <strong>${signedMargin} <em>m</em></strong></div></div>
    <div class="wb-npsh-bars" role="img" aria-label="NPSH disponible ${format(assessment.availableM)} metros frente a NPSH requerido ${format(assessment.requiredM)} metros">
      <div class="wb-npsh-bar-row"><span>NPSHa · disponible</span><div class="wb-npsh-track"><i class="wb-npsh-available" style="width:${assessment.availablePercent.toFixed(3)}%"></i></div><strong>${format(assessment.availableM)} m</strong></div>
      <div class="wb-npsh-bar-row"><span>NPSHr · requerido</span><div class="wb-npsh-track"><i class="wb-npsh-required" style="width:${assessment.requiredPercent.toFixed(3)}%"></i></div><strong>${format(assessment.requiredM)} m</strong></div>
    </div><p class="wb-npsh-footnote">${flowLabel} · ${assessment.explanation}</p>
    <p class="wb-npsh-caveat">Comparación académica, no sensor ni predicción de cavitación. Verificar criterio del fabricante y margen de diseño correspondiente.</p>
  </section>`;
}
