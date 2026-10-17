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
  root.innerHTML = `<div class="balance-dashboard">
    <article class="balance-card"><div class="science-card-head"><strong>Continuidad del proceso</strong><small>${continuity ? (continuity.withinTolerance ? 'DENTRO DE TOLERANCIA' : 'FUERA DE TOLERANCIA') : 'ENTRADA DE TANQUE NO DEFINIDA'}</small></div>${row('Descarga tanque', continuity ? fmt(continuity.inletFlowM3s * 3600) : '—', 'm³/h')}${row('Salida por tubería', balance ? fmt(balance.outletFlowM3h) : '—', 'm³/h')}${row('Acumulación / déficit', continuity ? fmt(continuity.accumulationKgS, 3) : '—', 'kg/s')}${row('Error relativo', continuity ? fmt(continuity.relativeDifference * 100, 3) : '—', '%')}<p class="balance-note">No se integra dinámicamente el nivel del tanque.</p></article>
    <article class="balance-card"><div class="science-card-head"><strong>Balance de masa</strong><small>estado estacionario</small></div>${row('Pulpa', balance ? fmt(balance.slurryMassFlowKgS, 3) : '—', 'kg/s')}${row('Sólidos', balance ? fmt(balance.solidsMassFlowTh, 3) : '—', 't/h')}${row('Líquido', balance ? fmt(balance.liquidMassFlowKgS, 3) : '—', 'kg/s')}${row('Agua / líquido', balance ? fmt(balance.liquidVolumetricFlowM3h, 2) : '—', 'm³/h')}</article>
    <article class="balance-card"><div class="science-card-head"><strong>Consumo y costo</strong><small>${energy?.resultQuality ?? 'sin cálculo'}</small></div>${row('Potencia hidráulica', energy ? fmt(energy.hydraulicPowerW / 1000) : '—', 'kW')}${row('Potencia eléctrica', energy ? fmt(energy.electricalPowerW / 1000) : '—', 'kW')}${row('Energía anual', energy ? fmt(energy.annualEnergyKwh, 1) : '—', 'kWh/año')}${row('OPEX energético', energy ? fmt(energy.annualEnergyCost, 2) : '—', 'moneda/año')}</article>
    <article class="balance-card"><div class="science-card-head"><strong>Estado operacional</strong><small>${settling?.status ?? 'sin evaluación'}</small></div>${row('Velocidad crítica', settling ? fmt(settling.criticalVelocityMps) : '—', 'm/s')}${row('V / Vcrit', settling ? fmt(settling.velocityRatio, 3) : '—')}${row('Segmento limitante', settling?.limitingSegmentId ?? '—')}${pump ? row('Punto bomba', pump.operatingPoint ? `${fmt(pump.operatingPoint.flowRateM3s * 3600)} m³/h · ${fmt(pump.operatingPoint.pumpHeadM)} m` : pump.status) : row('Punto bomba', '—')}<p class="balance-note">${settling?.note ?? 'Ingrese densidades y Fl para evaluar asentamiento.'}</p></article>
  </div><section class="balance-table-card"><div class="science-card-head"><strong>Desglose de presión</strong><small>kPa por tramo</small></div><div class="science-table-wrap"><table><thead><tr><th>Tramo</th><th>Distribuida</th><th>Menores</th><th>Estática</th><th>Total</th></tr></thead><tbody>${pressureRows(results)}</tbody></table></div></section><section class="balance-table-card"><div class="science-card-head"><strong>Accesorios de la línea</strong><small>Σ(N·K)</small></div><div class="science-table-wrap"><table><thead><tr><th>Tramo</th><th>Accesorio</th><th>N</th><th>K</th><th>Subtotal</th></tr></thead><tbody>${accessoryRows(results)}</tbody></table></div></section><div id="sensitivity-root"></div>`;
}
