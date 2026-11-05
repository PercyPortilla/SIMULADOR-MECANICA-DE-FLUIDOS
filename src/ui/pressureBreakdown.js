// Deterministic view model for the STATIC pressure budget. No solver changes.
// Values are in Pa as produced by simulationController. Negative elevation
// terms must stay negative: a downhill segment may reduce required head.
const PARTS = Object.freeze([
  ['distributed', 'Pérdidas distribuidas', 'Fricción en la tubería', 'distributedPressureDropPa'],
  ['local', 'Pérdidas locales', 'Accesorios y singularidades', 'minorLossPressurePa'],
  ['static', 'Componente estática', 'Diferencia de elevación', 'staticPressurePa'],
]);

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value);

export function buildPressureBreakdown(transport) {
  if (!transport || !PARTS.every(([, , , key]) => isNumber(transport[key]))) return null;
  const components = PARTS.map(([id, label, detail, key]) => ({
    id, label, detail, pascal: transport[key], kpa: transport[key] / 1000,
  }));
  const positivePa = components.reduce((sum, part) => sum + Math.max(0, part.pascal), 0);
  const negativePa = components.reduce((sum, part) => sum + Math.max(0, -part.pascal), 0);
  const domainPa = positivePa + negativePa;
  const baseline = domainPa ? negativePa / domainPa * 100 : 50;
  let positiveOffset = baseline;
  let negativeOffset = baseline;
  const bars = components.map((part) => {
    const widthPercent = domainPa ? Math.abs(part.pascal) / domainPa * 100 : 0;
    const leftPercent = part.pascal < 0 ? (negativeOffset -= widthPercent) : positiveOffset;
    if (part.pascal >= 0) positiveOffset += widthPercent;
    return { ...part, widthPercent, leftPercent };
  });
  const sumPa = components.reduce((sum, part) => sum + part.pascal, 0);
  const expectedPa = transport.pressureDropPa;
  const discrepancyPa = isNumber(expectedPa) ? expectedPa - sumPa : null;
  // Keep the tolerance proportional to floating-point integration outputs;
  // never silently claim component reconciliation on a materially different sum.
  const reconciled = discrepancyPa === null
    ? null
    : Math.abs(discrepancyPa) <= Math.max(1, Math.abs(expectedPa) * 0.001);
  return {
    bars,
    totalPa: sumPa,
    baselinePercent: baseline,
    hasMagnitude: domainPa > 0,
    expectedPa: isNumber(expectedPa) ? expectedPa : null,
    discrepancyPa,
    reconciled,
    elevationEffect: components[2].pascal < 0 ? 'downhill'
      : components[2].pascal > 0 ? 'uphill' : 'level',
  };
}

function number(value) {
  return value.toLocaleString('es-PE', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

export function renderPressureBreakdown(transport) {
  const result = buildPressureBreakdown(transport);
  if (!result) {
    return '<section class="wb-pressure-viz wb-pressure-viz-unavailable" aria-label="Visualización del balance de presión">'
      + '<div class="wb-pressure-viz-heading"><strong>Mapa de contribuciones de presión</strong><small>Sin datos calculables</small></div>'
      + '<p>No se dispone de un desglose completo. Ajusta el modelo para obtener las contribuciones calculadas.</p></section>';
  }

  const note = result.elevationEffect === 'downhill'
    ? 'La componente estática es negativa: el desnivel descendente reduce la presión requerida.'
    : result.elevationEffect === 'uphill'
      ? 'La componente estática es positiva: elevar la descarga aumenta la presión requerida.'
      : 'La componente estática es cero: no hay diferencia neta de elevación.';
  const integrity = result.reconciled === false
    ? '<p class="wb-pressure-discrepancy" role="status">Atención: la suma de estas contribuciones no coincide exactamente con la presión total del modelo. Revisa el escenario y los supuestos.</p>'
    : '';
  const segments = result.bars
    .filter((part) => part.widthPercent > 0)
    .map((part) => '<span class="wb-pressure-segment wb-pressure-segment-' + part.id
      + '" style="left:' + part.leftPercent.toFixed(4) + '%;width:' + part.widthPercent.toFixed(4)
      + '%" aria-hidden="true"></span>').join('');
  const legend = result.bars.map((part) => '<div class="wb-pressure-legend-item">'
    + '<span class="wb-pressure-legend-icon wb-pressure-segment-' + part.id + '" aria-hidden="true"></span>'
    + '<div><span>' + part.label + '</span><small>' + part.detail + '</small></div>'
    + '<strong>' + (part.kpa > 0 ? '+' : '') + number(part.kpa) + ' <em>kPa</em></strong></div>').join('');
  const bar = result.hasMagnitude
    ? '<div class="wb-pressure-bar" role="img" aria-label="Contribuciones de presión negativas a la izquierda del cero y positivas a la derecha">'
      + '<span class="wb-pressure-zero" style="left:' + result.baselinePercent.toFixed(4) + '%" aria-hidden="true"></span>'
      + segments + '</div>'
    : '<div class="wb-pressure-bar wb-pressure-bar-zero"><span>0,00 kPa · sin contribuciones</span></div>';
  return '<section class="wb-pressure-viz" aria-label="Mapa calculado de contribuciones de presión">'
    + '<div class="wb-pressure-viz-heading"><div><span>DESCOMPOSICIÓN DE ΔP</span>'
    + '<h4>¿De dónde viene la presión requerida?</h4></div>'
    + '<div class="wb-pressure-viz-total"><span>SUMA DE COMPONENTES</span><strong>'
    + number(result.totalPa / 1000) + ' <em>kPa</em></strong></div></div>'
    + '<div class="wb-pressure-scale"><span>− presión favorable</span><span>+ presión requerida</span></div>'
    + bar + '<div class="wb-pressure-legend">' + legend + '</div>'
    + '<p class="wb-pressure-note">' + note + ' <strong>Modelo calculado, no medición de sensores.</strong></p>'
    + integrity + '</section>';
}
