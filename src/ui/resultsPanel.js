const MODEL_LABELS = Object.freeze({
  newtonian: 'Newtoniano',
  hb: 'Herschel–Bulkley',
  bingham: 'Bingham plástico',
  power: 'Ley de potencia',
});

const REGIME_LABELS = Object.freeze({
  stagnant: 'Sin flujo',
  laminar: 'Laminar',
  transition: 'Transición',
  turbulent: 'Turbulento',
  'laminar-model-only': 'Laminar · alcance del modelo',
});

function setText(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
}

export function renderResultsPanel(results, state) {
  const density = results.slurry?.densityKgM3;
  const phi = results.slurry?.solidVolumeFraction;
  const flow = results.transport?.flowRateM3s;
  const pressureDrop = results.transport?.pressureDropPa;
  const wallStress = results.rheology?.wallStressPa;

  setText('#kpi-density', density === undefined ? '—' : `${density.toFixed(1)} kg/m³`);
  setText('#kpi-flow', flow === undefined ? '—' : `${(flow * 3600).toFixed(2)} m³/h`);
  setText('#kpi-phi', phi === undefined ? '—' : `${(phi * 100).toFixed(2)} %`);
  setText('#kpi-dp', pressureDrop === undefined ? '—' : `${(pressureDrop / 1000).toFixed(2)} kPa`);
  setText('#kpi-dp-note', pressureDrop === undefined ? 'requiere modelo hidráulico aplicable' : results.transport?.calculationMode ?? 'modelo activo');
  setText('#kpi-regime', REGIME_LABELS[results.transport?.flowRegime] ?? '—');
  setText('#kpi-head', results.transport?.totalHeadM === undefined ? '—' : `${results.transport.totalHeadM.toFixed(2)} m`);
  setText('#kpi-power', results.energy?.electricalPowerW === undefined ? '—' : `${(results.energy.electricalPowerW / 1000).toFixed(2)} kW`);
  setText('#kpi-recovery', results.recovery?.overallRecovery === undefined ? '—' : `${(results.recovery.overallRecovery * 100).toFixed(2)} %`);
  setText('#result-model', results.rheology ? MODEL_LABELS[results.rheology.model] : 'Pendiente de parámetros');
  setText('#result-wall-stress', wallStress === undefined ? '—' : `${wallStress.toFixed(3)} Pa`);
  setText('#result-pressure-gradient', results.transport?.pressureGradientPaM === undefined ? '—' : `${results.transport.pressureGradientPaM.toFixed(2)} Pa/m`);
  setText('#result-reynolds', results.transport?.reynoldsNumber === undefined ? '—' : results.transport.reynoldsNumber.toFixed(0));
  setText('#result-friction-factor', results.transport?.frictionFactor === undefined || results.transport?.frictionFactor === null ? '—' : results.transport.frictionFactor.toFixed(5));
  setText('#result-local-loss', results.transport?.minorLossPressurePa === undefined ? '—' : `${(results.transport.minorLossPressurePa / 1000).toFixed(2)} kPa`);
  setText('#result-static', results.transport?.staticPressurePa === undefined ? '—' : `${(results.transport.staticPressurePa / 1000).toFixed(2)} kPa`);
  setText('#result-energy', results.energy?.annualEnergyKwh === undefined ? '—' : `${results.energy.annualEnergyKwh.toFixed(1)} kWh/año`);
  setText('#result-cost', results.energy?.annualEnergyCost === undefined ? '—' : `${results.energy.annualEnergyCost.toFixed(2)} /año`);
  setText('#result-residence', results.leaching?.residenceTimeH === undefined ? '—' : `${results.leaching.residenceTimeH.toFixed(2)} h`);
  setText('#result-leach-conversion', results.leaching?.conversion === undefined ? '—' : `${(results.leaching.conversion * 100).toFixed(2)} %`);
  setText('#result-gold', results.recovery?.finalMetalKgH === undefined ? '—' : `${results.recovery.finalMetalKgH.toFixed(4)} kg/h`);
  setText('#model-status', results.transport?.modelStatus ?? 'Sin advertencias de aplicabilidad.');

  const status = document.querySelector('.status-dot');
  if (status) {
    const modelSelected = Boolean(state?.rheology?.model);
    status.textContent = pressureDrop !== undefined
      ? '● CÁLCULO LISTO'
      : modelSelected
        ? '● DATOS INCOMPLETOS'
        : '● ESPERANDO PARÁMETROS';
    status.classList.toggle('warning', pressureDrop === undefined && modelSelected);
  }
  renderRheologyChart(results.rheology?.profile);
  renderPressureChart(results.transport?.pressureProfile);
}

function renderPressureChart(profile) {
  const host = document.querySelector('#pressure-chart');
  if (!host) return;
  if (!profile?.distanceM?.length || !profile?.requiredPressurePa?.length) {
    host.innerHTML = '<div class="chart-empty">El perfil de presión aparece cuando la hidráulica tiene un modelo aplicable.</div>';
    return;
  }
  const width = 420;
  const height = 150;
  const left = 38;
  const right = 12;
  const top = 12;
  const bottom = 26;
  const xMax = Math.max(...profile.distanceM, 1e-12);
  const yMax = Math.max(0, ...profile.requiredPressurePa);
  const ySpan = Math.max(yMax, 1e-12);
  const points = profile.distanceM.map((distance, index) => {
    const x = left + distance / xMax * (width - left - right);
    const y = top + (1 - profile.requiredPressurePa[index] / ySpan) * (height - top - bottom);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
  host.innerHTML = `
    <div class="chart-head"><span>Pérdida distribuida acumulada</span><small>solo fricción a lo largo de L</small></div>
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Perfil de pérdida distribuida">
      <line class="chart-axis" x1="${left}" y1="${top}" x2="${left}" y2="${height - bottom}" />
      <line class="chart-axis" x1="${left}" y1="${height - bottom}" x2="${width - right}" y2="${height - bottom}" />
      <polyline class="chart-line" points="${points}" />
      <text class="chart-label" x="${left}" y="${height - 7}">0 m</text>
      <text class="chart-label" x="${width - right}" y="${height - 7}" text-anchor="end">${xMax.toFixed(1)} m</text>
      <text class="chart-label" x="${left + 4}" y="${top + 10}">${(yMax / 1000).toFixed(1)} kPa máx</text>
    </svg>`;
}

function renderRheologyChart(profile) {
  const host = document.querySelector('#rheology-chart');
  if (!host) return;
  if (!profile?.radiusM?.length || !profile?.velocityMps?.length) {
    host.innerHTML = '<div class="chart-empty">Los modelos no newtonianos muestran aquí su perfil laminar validado.</div>';
    return;
  }
  const radiusMax = Math.max(...profile.radiusM, 1e-12);
  const velocityMax = Math.max(...profile.velocityMps, 1e-12);
  const width = 420;
  const height = 150;
  const left = 34;
  const right = 12;
  const top = 12;
  const bottom = 26;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const points = profile.radiusM.map((radius, index) => {
    const x = left + (radius / radiusMax) * chartWidth;
    const y = top + (1 - profile.velocityMps[index] / velocityMax) * chartHeight;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
  host.innerHTML = `
    <div class="chart-head"><span>Perfil radial de velocidad</span><small>modelo laminar activo</small></div>
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Perfil radial de velocidad">
      <line class="chart-axis" x1="${left}" y1="${top}" x2="${left}" y2="${height - bottom}" />
      <line class="chart-axis" x1="${left}" y1="${height - bottom}" x2="${width - right}" y2="${height - bottom}" />
      <polyline class="chart-line" points="${points}" />
      <text class="chart-label" x="${left}" y="${height - 7}">centro</text>
      <text class="chart-label" x="${width - right}" y="${height - 7}" text-anchor="end">pared · r=${radiusMax.toFixed(3)} m</text>
      <text class="chart-label" x="${left + 4}" y="${top + 10}">v máx ${velocityMax.toFixed(2)} m/s</text>
    </svg>`;
}
