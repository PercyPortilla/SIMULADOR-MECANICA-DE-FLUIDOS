const MODEL_LABELS = Object.freeze({
  newtonian: 'Newtoniano',
  hb: 'Herschel–Bulkley',
  bingham: 'Bingham plástico',
  power: 'Ley de potencia',
  casson: 'Casson',
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

function setFollowingNote(selector, value) {
  const node = document.querySelector(selector);
  const note = node?.nextElementSibling;
  if (note?.tagName === 'SMALL') note.textContent = value;
}

function setValidity(selector, label, state = 'pending') {
  const node = document.querySelector(selector);
  if (!node) return;
  node.textContent = label;
  node.dataset.state = state;
}

function hydraulicValidity(results, state) {
  if (!state?.rheology?.model) return ['Hidráulica · sin modelo', 'pending'];
  if (results.transport?.pressureDropPa === undefined) return ['Hidráulica · no calculable', 'invalid'];
  if (results.transport?.resultQuality === 'educational-estimate') return ['Hidráulica · resultado educativo', 'educational'];
  if (results.transport?.resultQuality === 'laminar-profile-only') return ['Hidráulica · alcance limitado', 'limited'];
  return ['Hidráulica · modelo válido', 'valid'];
}

export function renderResultsPanel(results, state) {
  const density = results.slurry?.densityKgM3;
  const phi = results.slurry?.solidVolumeFraction;
  const flow = results.transport?.flowRateM3s;
  const pressureDrop = results.transport?.pressureDropPa;
  const nonNewtonian = Boolean(state?.rheology?.model && state.rheology.model !== 'newtonian');
  const generalizedReynolds = nonNewtonian && results.transport?.reynoldsKind === 'generalized-metzner-reed';
  const equivalentWallStress = results.rheology?.equivalentLaminarWallStressPa ?? results.rheology?.wallStressPa;
  const hydraulicWallStress = results.rheology?.hydraulicWallStressPa;
  const outsideLaminar = nonNewtonian && ['transition', 'turbulent'].includes(results.transport?.flowRegime);
  const displayedWallStress = outsideLaminar && hydraulicWallStress !== undefined
    ? hydraulicWallStress
    : equivalentWallStress;
  const operatingFlow = results.pump?.operatingPoint?.flowRateM3s;
  const energyAtOperatingPoint = results.energy?.basis === 'pump-operating-point';

  setText('#kpi-flow', flow === undefined ? '—' : `${(flow * 3600).toFixed(2)} m³/h`);
  setFollowingNote('#kpi-flow', operatingFlow === undefined
    ? 'Q impuesto por la velocidad'
    : `Q impuesto · Qop ${(operatingFlow * 3600).toFixed(2)} m³/h`);
  setText('#kpi-velocity', state?.transport?.pipe1?.velocityMps === undefined ? '—' : `${state.transport.pipe1.velocityMps.toFixed(3)} m/s`);
  setText('#kpi-reynolds-label', generalizedReynolds ? 'REYNOLDS GENERALIZADO Re*' : 'REYNOLDS Re');
  setText('#kpi-reynolds', results.transport?.reynoldsNumber === undefined ? '—' : results.transport.reynoldsNumber.toFixed(0));
  setText('#kpi-friction-factor', results.transport?.frictionFactor === undefined || results.transport?.frictionFactor === null ? '—' : results.transport.frictionFactor.toFixed(5));
  setText('#kpi-dp', pressureDrop === undefined ? '—' : `${(pressureDrop / 1000).toFixed(2)} kPa`);
  setText('#kpi-dp-note', pressureDrop === undefined ? 'requiere modelo hidráulico aplicable' : results.transport?.calculationMode ?? 'modelo activo');
  setText('#kpi-regime-note', REGIME_LABELS[results.transport?.flowRegime] ?? 'régimen pendiente');
  setText('#kpi-head', results.transport?.totalHeadM === undefined ? '—' : `${results.transport.totalHeadM.toFixed(2)} m`);
  setText('#kpi-power', results.energy?.electricalPowerW === undefined ? '—' : `${(results.energy.electricalPowerW / 1000).toFixed(2)} kW`);
  setFollowingNote('#kpi-power', energyAtOperatingPoint ? 'potencia eléctrica en Qop' : 'potencia eléctrica con Q impuesto');
  setText('#kpi-npsh', results.pump?.npshAvailableM === undefined ? '—' : `${results.pump.npshAvailableM.toFixed(2)} m`);
  setText('#kpi-npsh-note', results.pump?.npsh
    ? `margen ${(results.pump.npsh.marginM ?? 0).toFixed(2)} m`
    : results.pump?.npshAvailableM !== undefined ? 'NPSH-A calculado; falta NPSH-R' : 'requiere evaluación de bomba');
  setText('#result-model', results.rheology ? MODEL_LABELS[results.rheology.model] : 'Pendiente de parámetros');
  setText('#equation-active-model', results.rheology ? MODEL_LABELS[results.rheology.model] : 'pendiente');
  setText('#result-regime', REGIME_LABELS[results.transport?.flowRegime] ?? '—');
  setText('#result-density', density === undefined ? '—' : `${density.toFixed(1)} kg/m³`);
  setText('#result-phi', phi === undefined ? '—' : `${(phi * 100).toFixed(2)} %`);
  setText('#result-wall-stress-label', outsideLaminar ? 'τw hidráulico' : 'Esfuerzo de pared τw');
  setText('#result-wall-stress', displayedWallStress === undefined ? '—' : `${displayedWallStress.toFixed(3)} Pa`);
  setText('#result-wall-stress-note', outsideLaminar && equivalentWallStress !== undefined
    ? `perfil laminar equivalente: ${equivalentWallStress.toFixed(3)} Pa`
    : nonNewtonian && displayedWallStress !== undefined ? 'perfil e hidráulica laminar coherentes' : '');
  setText('#result-pressure-gradient', results.transport?.pressureGradientPaM === undefined ? '—' : `${results.transport.pressureGradientPaM.toFixed(2)} Pa/m`);
  setText('#result-reynolds', results.transport?.reynoldsNumber === undefined ? '—' : results.transport.reynoldsNumber.toFixed(0));
  setText('#result-friction-factor', results.transport?.frictionFactor === undefined || results.transport?.frictionFactor === null ? '—' : results.transport.frictionFactor.toFixed(5));
  setText('#result-local-loss', results.transport?.minorLossPressurePa === undefined ? '—' : `${(results.transport.minorLossPressurePa / 1000).toFixed(2)} kPa`);
  setText('#result-static', results.transport?.staticPressurePa === undefined ? '—' : `${(results.transport.staticPressurePa / 1000).toFixed(2)} kPa`);
  setText('#result-energy', results.energy?.annualEnergyKwh === undefined ? '—' : `${results.energy.annualEnergyKwh.toFixed(1)} kWh/año`);
  setText('#result-cost', results.energy?.annualEnergyCost === undefined ? '—' : `${results.energy.annualEnergyCost.toFixed(2)} /año`);
  setText('#result-residence', results.leaching?.residenceTimeH === undefined ? '—' : `${results.leaching.residenceTimeH.toFixed(2)} h`);
  setText('#result-recovery', results.recovery?.overallRecovery === undefined ? '—' : `${(results.recovery.overallRecovery * 100).toFixed(2)} %`);
  setText('#model-status', results.transport?.modelStatus ?? 'Sin advertencias de aplicabilidad.');

  const [hydraulicLabel, hydraulicState] = hydraulicValidity(results, state);
  setValidity('#validity-hydraulic', hydraulicLabel, hydraulicState);
  setValidity('#validity-rheology', results.rheology
    ? `Reología · ${MODEL_LABELS[results.rheology.model] ?? results.rheology.model}`
    : 'Reología · pendiente', results.rheology ? 'valid' : 'pending');
  setValidity('#validity-pump', results.pump?.operatingPoint
    ? 'Bomba · punto de operación válido'
    : results.pump?.status === 'invalid' ? 'Bomba · no calculable' : 'Bomba · sin curva tabulada',
  results.pump?.operatingPoint ? 'valid' : results.pump?.status === 'invalid' ? 'invalid' : 'pending');
  const processCalculated = Boolean(results.leaching || results.recovery || results.balance);
  setValidity('#validity-process', processCalculated ? 'Proceso · calculado por entradas' : 'Proceso · pendiente', processCalculated ? 'valid' : 'pending');

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
