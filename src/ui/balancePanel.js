import { renderPressureBreakdown } from './pressureBreakdown.js';
import { renderNpshDiagnostic } from './npshDiagnostic.js';
import { escapeHtml } from './safeHtml.js';

function fmt(value, digits = 2) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—';
}

function qualityLabel(value) {
  return ({
    validated: 'Modelo validado',
    'validated-laminar': 'Régimen laminar validado',
    'educational-estimate': 'Estimación educativa',
    'laminar-profile-only': 'Solo perfil laminar',
  })[value] ?? (value || 'Sin evaluación');
}

function row(label, value, unit = '', emphasized = false) {
  return `<div class="balance-row wb-data-row${emphasized ? ' wb-data-row--key' : ''}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}${unit ? ` ${escapeHtml(unit)}` : ''}</strong></div>`;
}

function pressureRows(results) {
  const segments = results.transport?.segments;
  if (Array.isArray(segments) && segments.length) return segments.map((segment) => `<tr><td>${escapeHtml(segment.id)}</td><td>${fmt(segment.distributedPressureDropPa / 1000)}</td><td>${fmt(segment.minorLossPressurePa / 1000)}</td><td>${fmt(segment.staticPressurePa / 1000)}</td><td>${fmt(segment.pressureDropPa / 1000)}</td></tr>`).join('');
  const t = results.transport ?? {};
  return `<tr><td>Tramo inicial</td><td>${fmt(t.distributedPressureDropPa / 1000)}</td><td>${fmt(t.minorLossPressurePa / 1000)}</td><td>${fmt(t.staticPressurePa / 1000)}</td><td>${fmt(t.pressureDropPa / 1000)}</td></tr>`;
}

function accessoryRows(results) {
  const segments = results.transport?.segments;
  const rows = [];
  if (Array.isArray(segments) && segments.length) {
    segments.forEach((segment) => (segment.accessoryBreakdown ?? []).filter((item) => item.subtotal > 0).forEach((item) => rows.push(`<tr><td>${escapeHtml(segment.id)}</td><td>${escapeHtml(item.type)}</td><td>${escapeHtml(item.count)}</td><td>${fmt(item.k, 3)}</td><td>${fmt(item.subtotal, 3)}</td></tr>`)));
  } else {
    (results.transport?.accessoryBreakdown ?? []).filter((item) => item.subtotal > 0).forEach((item) => rows.push(`<tr><td>Tramo inicial</td><td>${escapeHtml(item.type)}</td><td>${escapeHtml(item.count)}</td><td>${fmt(item.k, 3)}</td><td>${fmt(item.subtotal, 3)}</td></tr>`));
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
  root.innerHTML = `
    <section class="analysis-domain analysis-domain-hydraulic wb-domain" aria-labelledby="wb-hydraulic-title">
      <header class="analysis-domain-head wb-domain-head">
        <div>
          <span>MECÁNICA DE FLUIDOS</span>
          <strong id="wb-hydraulic-title">Análisis hidráulico y bombeo</strong>
        </div>
        <small>${escapeHtml(qualityLabel(transport.resultQuality))}</small>
      </header>

      <section class="wb-section wb-section-hydraulic" aria-labelledby="wb-pressure-section-title">
        <header class="wb-section-head">
          <span class="wb-section-index" aria-hidden="true">01</span>
          <div>
            <p class="wb-section-kicker">DEMANDA DEL CIRCUITO</p>
            <h3 id="wb-pressure-section-title" class="wb-section-title">Presión y punto de operación</h3>
            <p class="wb-section-description">Compara las pérdidas del circuito con la altura entregada por la bomba y el margen de NPSH.</p>
          </div>
        </header>
        <div class="balance-dashboard wb-analysis-grid wb-analysis-grid-primary">
          <article class="balance-card wb-data-card wb-data-card-featured">
            <div class="science-card-head"><strong>Presión requerida</strong><small>${escapeHtml(qualityLabel(transport.resultQuality))}</small></div>
            ${row('Distribuida', transport.distributedPressureDropPa === undefined ? '—' : fmt(transport.distributedPressureDropPa / 1000), 'kPa')}
            ${row('Pérdidas locales', transport.minorLossPressurePa === undefined ? '—' : fmt(transport.minorLossPressurePa / 1000), 'kPa')}
            ${row('Componente estática', transport.staticPressurePa === undefined ? '—' : fmt(transport.staticPressurePa / 1000), 'kPa')}
            ${row('Total requerida', transport.pressureDropPa === undefined ? '—' : fmt(transport.pressureDropPa / 1000), 'kPa', true)}
          </article>
          <article class="balance-card wb-data-card">
            <div class="science-card-head"><strong>Bomba y NPSH</strong><small>${escapeHtml(pump?.modelStatus ?? 'sin curva tabulada')}</small></div>
            ${row('Q impuesto', imposedFlowM3h === null ? '—' : fmt(imposedFlowM3h), 'm³/h')}
            ${row('Qop', operatingFlowM3h === null ? '—' : fmt(operatingFlowM3h), 'm³/h', true)}
            ${pump?.operatingPoint ? row('H bomba / H sistema', `${fmt(pump.operatingPoint.pumpHeadM)} / ${fmt(pump.operatingPoint.systemHeadM)}`, 'm') : row('H bomba / H sistema', '—')}
            ${row('NPSH disponible', pump?.npshAvailableM === undefined ? '—' : fmt(pump.npshAvailableM), 'm')}
            ${row('NPSH requerido @ Qop', npsh?.requiredNpshM === undefined ? '—' : fmt(npsh.requiredNpshM), 'm')}
            ${row('Margen NPSH', npsh?.marginM === undefined ? '—' : fmt(npsh.marginM), 'm', true)}
          </article>
        </div>
        ${renderPressureBreakdown(transport)}
        ${renderNpshDiagnostic(pump)}
      </section>

      <section class="wb-section wb-section-energy" aria-labelledby="wb-energy-section-title">
        <header class="wb-section-head">
          <span class="wb-section-index" aria-hidden="true">02</span>
          <div>
            <p class="wb-section-kicker">DESEMPEÑO EN OPERACIÓN</p>
            <h3 id="wb-energy-section-title" class="wb-section-title">Consumo energético y transporte de sólidos</h3>
            <p class="wb-section-description">Potencia, costo estimado y condiciones de transporte evaluadas con los parámetros del escenario.</p>
          </div>
        </header>
        <div class="balance-dashboard wb-analysis-grid wb-analysis-grid-secondary">
          <article class="balance-card wb-data-card wb-data-card-featured">
            <div class="science-card-head"><strong>Potencia y energía</strong><small>${escapeHtml(energy?.basis === 'pump-operating-point' ? 'evaluada en Qop' : qualityLabel(energy?.resultQuality))}</small></div>
            ${row('Caudal base', energy?.flowRateM3s === undefined ? '—' : fmt(energy.flowRateM3s * 3600), 'm³/h')}
            ${row('Potencia hidráulica', energy?.hydraulicPowerW === undefined ? '—' : fmt(energy.hydraulicPowerW / 1000), 'kW')}
            ${row('Potencia eléctrica', energy?.electricalPowerW === undefined ? '—' : fmt(energy.electricalPowerW / 1000), 'kW', true)}
            ${row('Energía anual', energy?.annualEnergyKwh === undefined ? '—' : fmt(energy.annualEnergyKwh, 1), 'kWh/año')}
            ${row('OPEX energético', energy?.annualEnergyCost === undefined ? '—' : fmt(energy.annualEnergyCost, 2), 'moneda/año')}
          </article>
          <article class="balance-card wb-data-card">
            <div class="science-card-head"><strong>Estado operacional</strong><small>${escapeHtml(settling?.status ?? 'sin evaluación')}</small></div>
            ${row('Velocidad crítica', settling ? fmt(settling.criticalVelocityMps) : '—', 'm/s', true)}
            ${row('V / Vcrit', settling ? fmt(settling.velocityRatio, 3) : '—')}
            ${row('Segmento limitante', settling?.limitingSegmentId ?? '—')}
            ${row('Régimen', transport.flowRegime ?? '—')}
            <p class="balance-note">${escapeHtml(settling?.note ?? 'Ingrese densidades y Fl para evaluar asentamiento.')}</p>
          </article>
        </div>
      </section>

      <section class="wb-section wb-section-pressure-detail" aria-labelledby="wb-pressure-detail-title">
        <header class="wb-section-head">
          <span class="wb-section-index" aria-hidden="true">03</span>
          <div>
            <p class="wb-section-kicker">DESGLOSE TÉCNICO</p>
            <h3 id="wb-pressure-detail-title" class="wb-section-title">Pérdidas por tramo y accesorios</h3>
            <p class="wb-section-description">Inspecciona la contribución de fricción, pérdidas menores y altura estática en cada segmento.</p>
          </div>
        </header>
        <div class="wb-table-grid">
          <section class="balance-table-card wb-table-card" aria-label="Desglose de presión">
            <div class="science-card-head"><strong>Desglose de presión</strong><small>kPa por tramo</small></div>
            <div class="science-table-wrap"><table>
              <thead><tr><th scope="col">Tramo</th><th scope="col">Distribuida</th><th scope="col">Menores</th><th scope="col">Estática</th><th scope="col">Total</th></tr></thead>
              <tbody>${pressureRows(results)}</tbody>
            </table></div>
          </section>
          <section class="balance-table-card wb-table-card" aria-label="Accesorios de la línea">
            <div class="science-card-head"><strong>Accesorios de la línea</strong><small>Σ(N·K)</small></div>
            <div class="science-table-wrap"><table>
              <thead><tr><th scope="col">Tramo</th><th scope="col">Accesorio</th><th scope="col">N</th><th scope="col">K</th><th scope="col">Subtotal</th></tr></thead>
              <tbody>${accessoryRows(results)}</tbody>
            </table></div>
          </section>
        </div>
      </section>

      <section class="wb-section wb-sensitivity-wrap" aria-labelledby="wb-sensitivity-title">
        <header class="wb-section-head">
          <span class="wb-section-index" aria-hidden="true">04</span>
          <div>
            <p class="wb-section-kicker">EXPLORACIÓN PARAMÉTRICA</p>
            <h3 id="wb-sensitivity-title" class="wb-section-title">Sensibilidad del escenario</h3>
            <p class="wb-section-description">Evalúa cómo cambia una salida al variar una entrada, sin modificar los parámetros activos.</p>
          </div>
        </header>
        <div id="sensitivity-root"></div>
      </section>
    </section>

    <section class="analysis-domain analysis-domain-process wb-domain wb-domain-process" aria-labelledby="wb-process-title">
      <header class="analysis-domain-head wb-domain-head">
        <div><span>PROCESO MINERO COMPLEMENTARIO</span><strong id="wb-process-title">Balance de masa y continuidad</strong></div>
        <small>Contexto metalúrgico del escenario</small>
      </header>
      <section class="wb-section wb-section-process" aria-labelledby="wb-process-balance-title">
        <header class="wb-section-head">
          <span class="wb-section-index" aria-hidden="true">05</span>
          <div>
            <p class="wb-section-kicker">CIERRE DE FLUJOS</p>
            <h3 id="wb-process-balance-title" class="wb-section-title">Continuidad y distribución de masa</h3>
            <p class="wb-section-description">Comprueba la coherencia de los caudales de entrada y salida, y el reparto de pulpa, sólidos y líquido.</p>
          </div>
        </header>
        <div class="balance-dashboard wb-analysis-grid wb-analysis-grid-process">
          <article class="balance-card wb-data-card">
            <div class="science-card-head"><strong>Continuidad del proceso</strong><small>${continuity ? (continuity.withinTolerance ? 'DENTRO DE TOLERANCIA' : 'FUERA DE TOLERANCIA') : 'ENTRADA DE TANQUE NO DEFINIDA'}</small></div>
            ${row('Descarga tanque', continuity ? fmt(continuity.inletFlowM3s * 3600) : '—', 'm³/h')}
            ${row('Salida por tubería', balance ? fmt(balance.outletFlowM3h) : '—', 'm³/h')}
            ${row('Acumulación / déficit', continuity ? fmt(continuity.accumulationKgS, 3) : '—', 'kg/s', true)}
            ${row('Error relativo', continuity ? fmt(continuity.relativeDifference * 100, 3) : '—', '%')}
            <p class="balance-note">No se integra dinámicamente el nivel del tanque.</p>
          </article>
          <article class="balance-card wb-data-card">
            <div class="science-card-head"><strong>Balance de masa</strong><small>estado estacionario</small></div>
            ${row('Pulpa', balance ? fmt(balance.slurryMassFlowKgS, 3) : '—', 'kg/s', true)}
            ${row('Sólidos', balance ? fmt(balance.solidsMassFlowTh, 3) : '—', 't/h')}
            ${row('Líquido', balance ? fmt(balance.liquidMassFlowKgS, 3) : '—', 'kg/s')}
            ${row('Agua / líquido', balance ? fmt(balance.liquidVolumetricFlowM3h, 2) : '—', 'm³/h')}
          </article>
        </div>
      </section>
    </section>`;
}
