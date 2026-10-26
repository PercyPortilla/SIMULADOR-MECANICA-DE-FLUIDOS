function fmt(value, digits = 2) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—';
}

function row(label, value, unit = '') {
  return `<div class="balance-row"><span>${label}</span><strong>${value}${unit ? ` ${unit}` : ''}</strong></div>`;
}

function pressureRows(results) {
  const segments = results.transport?.segments;
  if (Array.isArray(segments) && segments.length) return segments.map((segment) => `<tr><td>${segment.id}</td><td>${fmt(segment.distributedPressureDropPa / 1000)}</td><td>${fmt(segment.minorLossPressurePa / 1000)}</td><td>${fmt(segment.staticPressurePa / 1000)}</td><td>${fmt(segment.pressureDropPa / 1000)}</td></tr>`).join('');
  const t = results.transport ?? {};
  return `<tr><td>Pipe 1</td><td>${fmt(t.distributedPressureDropPa / 1000)}</td><td>${fmt(t.minorLossPressurePa / 1000)}</td><td>${fmt(t.staticPressurePa / 1000)}</td><td>${fmt(t.pressureDropPa / 1000)}</td></tr>`;
}

function accessoryRows(results) {
  const segments = results.transport?.segments;
  const rows = [];
  if (Array.isArray(segments) && segments.length) {
    segments.forEach((segment) => (segment.accessoryBreakdown ?? []).filter((item) => item.subtotal > 0).forEach((item) => rows.push(`<tr><td>${segment.id}</td><td>${item.type}</td><td>${item.count}</td><td>${fmt(item.k, 3)}</td><td>${fmt(item.subtotal, 3)}</td></tr>`)));
  } else {
    (results.transport?.accessoryBreakdown ?? []).filter((item) => item.subtotal > 0).forEach((item) => rows.push(`<tr><td>Pipe 1</td><td>${item.type}</td><td>${item.count}</td><td>${fmt(item.k, 3)}</td><td>${fmt(item.subtotal, 3)}</td></tr>`));
  }
  return rows.length ? rows.join('') : '<tr><td colspan="5">Sin accesorios explícitos activos.</td></tr>';
}

export function renderBalanceAndEnergy(root, { state, results }) {
  if (!root) return;
  const balance = results.balance;
  const continuity = balance?.continuity;
  const energy = results.energy;
  const settling = results.transport?.settling;
  const pump = results.pump;
  const transport = results.transport ?? {};
  const npsh = pump?.npsh;
  const imposedFlowM3h = transport.flowRateM3s === undefined ? null : transport.flowRateM3s * 3600;
  const operatingFlowM3h = pump?.operatingPoint?.flowRateM3s === undefined ? null : pump.operatingPoint.flowRateM3s * 3600;
  root.innerHTML = `<section class="analysis-domain analysis-domain-hydraulic"><div class="analysis-domain-head"><div><span>MECÁNICA DE FLUIDOS</span><strong>Análisis hidráulico y bombeo</strong></div><small>Núcleo académico del simulador</small></div><div class="balance-dashboard">
    <article class="balance-card"><div class="science-card-head"><strong>Presión requerida</strong><small>${transport.resultQuality ?? 'sin cálculo'}</small></div>${row('Distribuida', transport.distributedPressureDropPa === undefined ? '—' : fmt(transport.distributedPressureDropPa / 1000), 'kPa')}${row('Pérdidas locales', transport.minorLossPressurePa === undefined ? '—' : fmt(transport.minorLossPressurePa / 1000), 'kPa')}${row('Componente estática', transport.staticPressurePa === undefined ? '—' : fmt(transport.staticPressurePa / 1000), 'kPa')}${row('Total requerida', transport.pressureDropPa === undefined ? '—' : fmt(transport.pressureDropPa / 1000), 'kPa')}</article>
    <article class="balance-card"><div class="science-card-head"><strong>Bomba y NPSH</strong><small>${pump?.modelStatus ?? 'sin curva tabulada'}</small></div>${row('Q impuesto', imposedFlowM3h === null ? '—' : fmt(imposedFlowM3h), 'm³/h')}${row('Qop', operatingFlowM3h === null ? '—' : fmt(operatingFlowM3h), 'm³/h')}${pump?.operatingPoint ? row('H bomba / H sistema', `${fmt(pump.operatingPoint.pumpHeadM)} / ${fmt(pump.operatingPoint.systemHeadM)}`, 'm') : row('H bomba / H sistema', '—')}${row('NPSH disponible', pump?.npshAvailableM === undefined ? '—' : fmt(pump.npshAvailableM), 'm')}${row('NPSH requerido @ Qop', npsh?.requiredNpshM === undefined ? '—' : fmt(npsh.requiredNpshM), 'm')}${row('Margen NPSH', npsh?.marginM === undefined ? '—' : fmt(npsh.marginM), 'm')}</article>
    <article class="balance-card"><div class="science-card-head"><strong>Potencia y energía</strong><small>${energy?.basis === 'pump-operating-point' ? 'evaluada en Qop' : energy?.resultQuality ?? 'sin cálculo'}</small></div>${row('Caudal base', energy?.flowRateM3s === undefined ? '—' : fmt(energy.flowRateM3s * 3600), 'm³/h')}${row('Potencia hidráulica', energy?.hydraulicPowerW === undefined ? '—' : fmt(energy.hydraulicPowerW / 1000), 'kW')}${row('Potencia eléctrica', energy?.electricalPowerW === undefined ? '—' : fmt(energy.electricalPowerW / 1000), 'kW')}${row('Energía anual', energy?.annualEnergyKwh === undefined ? '—' : fmt(energy.annualEnergyKwh, 1), 'kWh/año')}${row('OPEX energético', energy?.annualEnergyCost === undefined ? '—' : fmt(energy.annualEnergyCost, 2), 'moneda/año')}</article>
    <article class="balance-card"><div class="science-card-head"><strong>Estado operacional</strong><small>${settling?.status ?? 'sin evaluación'}</small></div>${row('Velocidad crítica', settling ? fmt(settling.criticalVelocityMps) : '—', 'm/s')}${row('V / Vcrit', settling ? fmt(settling.velocityRatio, 3) : '—')}${row('Segmento limitante', settling?.limitingSegmentId ?? '—')}${row('Régimen', transport.flowRegime ?? '—')}<p class="balance-note">${settling?.note ?? 'Ingrese densidades y Fl para evaluar asentamiento.'}</p></article>
  </div><section class="balance-table-card"><div class="science-card-head"><strong>Desglose de presión</strong><small>kPa por tramo</small></div><div class="science-table-wrap"><table><thead><tr><th>Tramo</th><th>Distribuida</th><th>Menores</th><th>Estática</th><th>Total</th></tr></thead><tbody>${pressureRows(results)}</tbody></table></div></section><section class="balance-table-card"><div class="science-card-head"><strong>Accesorios de la línea</strong><small>Σ(N·K)</small></div><div class="science-table-wrap"><table><thead><tr><th>Tramo</th><th>Accesorio</th><th>N</th><th>K</th><th>Subtotal</th></tr></thead><tbody>${accessoryRows(results)}</tbody></table></div></section><div id="sensitivity-root"></div></section>
  <section class="analysis-domain analysis-domain-process"><div class="analysis-domain-head"><div><span>PROCESO MINERO COMPLEMENTARIO</span><strong>Balance de masa y continuidad</strong></div><small>Contexto metalúrgico separado de la hidráulica</small></div><div class="balance-dashboard">
    <article class="balance-card"><div class="science-card-head"><strong>Continuidad del proceso</strong><small>${continuity ? (continuity.withinTolerance ? 'DENTRO DE TOLERANCIA' : 'FUERA DE TOLERANCIA') : 'ENTRADA DE TANQUE NO DEFINIDA'}</small></div>${row('Descarga tanque', continuity ? fmt(continuity.inletFlowM3s * 3600) : '—', 'm³/h')}${row('Salida por tubería', balance ? fmt(balance.outletFlowM3h) : '—', 'm³/h')}${row('Acumulación / déficit', continuity ? fmt(continuity.accumulationKgS, 3) : '—', 'kg/s')}${row('Error relativo', continuity ? fmt(continuity.relativeDifference * 100, 3) : '—', '%')}<p class="balance-note">No se integra dinámicamente el nivel del tanque.</p></article>
    <article class="balance-card"><div class="science-card-head"><strong>Balance de masa</strong><small>estado estacionario</small></div>${row('Pulpa', balance ? fmt(balance.slurryMassFlowKgS, 3) : '—', 'kg/s')}${row('Sólidos', balance ? fmt(balance.solidsMassFlowTh, 3) : '—', 't/h')}${row('Líquido', balance ? fmt(balance.liquidMassFlowKgS, 3) : '—', 'kg/s')}${row('Agua / líquido', balance ? fmt(balance.liquidVolumetricFlowM3h, 2) : '—', 'm³/h')}</article>
  </div></section>`;
}
