import { createLinearSweepValues, runSensitivitySweep } from '../core/sensitivity/index.js';
import { createNumericSeries, seriesToSvgPolyline } from './chartSeries.js';

const PARAMETERS = Object.freeze([
  { path: 'slurry.solidsMassFraction', label: 'Sólidos', unit: '%', toDisplay: (v) => v * 100, fromDisplay: (v) => v / 100 },
  { path: 'transport.pipe1.velocityMps', label: 'Velocidad', unit: 'm/s' },
  { path: 'transport.pipe1.innerDiameterM', label: 'Diámetro', unit: 'm' },
  { path: 'rheology.newtonianViscosityPaS', label: 'Viscosidad Newtoniana', unit: 'Pa·s' },
  { path: 'rheology.yieldStressPa', label: 'τy', unit: 'Pa' },
  { path: 'rheology.consistencyIndex', label: 'K', unit: 'Pa·sⁿ' },
  { path: 'rheology.flowIndex', label: 'n', unit: '—' },
  { path: 'transport.pipe1.roughnessM', label: 'Rugosidad', unit: 'mm', toDisplay: (v) => v * 1000, fromDisplay: (v) => v / 1000 },
  { path: 'slurry.temperatureC', label: 'Temperatura', unit: '°C' },
  { path: 'leaching.firstOrderRateConstantPerH', label: 'k lixiviación', unit: 'h⁻¹' },
]);

const METRICS = Object.freeze([
  { id: 'pressure', label: 'ΔP total', unit: 'kPa', get: (r) => r.transport?.pressureDropPa / 1000 },
  { id: 'power', label: 'Potencia eléctrica', unit: 'kW', get: (r) => r.energy?.electricalPowerW / 1000 },
  { id: 'opex', label: 'OPEX energético', unit: 'moneda/año', get: (r) => r.energy?.annualEnergyCost },
  { id: 'criticalVelocity', label: 'Velocidad crítica', unit: 'm/s', get: (r) => r.transport?.settling?.criticalVelocityMps },
  { id: 'residence', label: 'Tiempo residencia', unit: 'h', get: (r) => r.leaching?.residenceTimeH },
  { id: 'conversion', label: 'Conversión lixiviación', unit: '%', get: (r) => r.leaching?.conversion === undefined ? undefined : r.leaching.conversion * 100 },
  { id: 'recovery', label: 'Recuperación global', unit: '%', get: (r) => r.recovery?.overallRecovery === undefined ? undefined : r.recovery.overallRecovery * 100 },
]);

// State belongs to the analysis session, not to the DOM being re-rendered
// after each calculation. A stale sweep remains visible but is labeled clearly.
let sensitivityDraft = null;
let sensitivitySweep = null;

function getPath(root, path) { return path.split('.').reduce((value, key) => value?.[key], root); }
function finite(value) { return typeof value === 'number' && Number.isFinite(value); }

export function calculateNormalizedSensitivity(rows, baselineX, baselineY) {
  if (!rows?.length || !(baselineX !== 0) || !(baselineY !== 0)) return null;
  const left = rows[0]; const right = rows.at(-1);
  const dxRelative = (right.x - left.x) / baselineX;
  const dyRelative = (right.y - left.y) / baselineY;
  if (!finite(dxRelative) || !finite(dyRelative) || dxRelative === 0) return null;
  return dyRelative / dxRelative;
}

function sensitivityToCsv(parameter, metric, rows) {
  const lines = [`"${parameter.label} (${parameter.unit})","${metric.label} (${metric.unit})"`];
  rows.forEach((row) => lines.push(`${row.x},${row.y}`));
  return lines.join('\n');
}

function downloadCsv(content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'pulpa-lab-sensibilidad.csv'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function chart(rows, parameter, metric) {
  if (rows.length < 2) return '<p class="science-empty">No hay resultados finitos para este barrido.</p>';
  const width = 620, height = 250, padding = { left: 50, right: 18, top: 18, bottom: 42 };
  const geometry = seriesToSvgPolyline(createNumericSeries(rows.map((r) => r.x), rows.map((r) => r.y)), { width, height, padding });
  return `<svg class="sensitivity-chart" role="img" aria-label="Curva de sensibilidad: ${parameter.label} frente a ${metric.label}; valores disponibles en la tabla siguiente" viewBox="0 0 ${width} ${height}"><line class="chart-axis" x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height-padding.bottom}"/><line class="chart-axis" x1="${padding.left}" y1="${height-padding.bottom}" x2="${width-padding.right}" y2="${height-padding.bottom}"/><polyline class="science-line science-line-2" points="${geometry.points}"/><text class="chart-label" x="${width/2}" y="${height-8}" text-anchor="middle">${parameter.label} · ${parameter.unit}</text><text class="chart-label" x="12" y="${height/2}" transform="rotate(-90 12 ${height/2})" text-anchor="middle">${metric.label} · ${metric.unit}</text></svg>`;
}

function formatSensitivitySweep(sweep, stale) {
  const { rows, parameter, metric, normalized, normalizedEnabled } = sweep;
  const note = stale ? '<p class="sensitivity-stale" role="status">Este barrido corresponde a los parámetros anteriores. Ejecútalo de nuevo para actualizar los resultados.</p>' : '';
  return `${note}${chart(rows, parameter, metric)}${normalizedEnabled ? `<p class="sensitivity-index">Sensibilidad normalizada ≈ <strong>${normalized === null ? 'No definida' : normalized.toFixed(4)}</strong></p>` : ''}<div class="science-table-wrap"><table><caption>Valores numéricos del barrido</caption><thead><tr><th scope="col">${parameter.label}</th><th scope="col">${metric.label}</th></tr></thead><tbody>${rows.map((entry) => `<tr><td>${entry.x}</td><td>${entry.y}</td></tr>`).join('')}</tbody></table></div>`;
}

export function renderSensitivityPanel(root, { state, calculate }) {
  if (!root) return;
  const parameterOptions = PARAMETERS.map((p, index) => `<option value="${index}">${p.label} · ${p.unit}</option>`).join('');
  const metricOptions = METRICS.map((m, index) => `<option value="${index}">${m.label}</option>`).join('');
  root.innerHTML = `<section class="sensitivity-panel"><div class="science-card-head"><strong>Análisis de sensibilidad</strong><small>Variar un parámetro a la vez · no modifica el escenario</small></div><div class="sensitivity-controls"><label>Variable<select id="sensitivity-param">${parameterOptions}</select></label><label>Resultado<select id="sensitivity-metric">${metricOptions}</select></label><label>Mínimo<input id="sensitivity-min" type="number" step="any"></label><label>Máximo<input id="sensitivity-max" type="number" step="any"></label><label>Puntos<input id="sensitivity-steps" type="number" min="2" max="101" value="11"></label><label class="sensitivity-check"><input id="sensitivity-normalized" type="checkbox"> Sensibilidad normalizada</label><button id="sensitivity-run" type="button">Calcular barrido</button><button id="sensitivity-csv" type="button" disabled>Exportar CSV</button></div><div id="sensitivity-output" aria-live="polite"></div></section>`;
  const paramSelect = root.querySelector('#sensitivity-param');
  const metricSelect = root.querySelector('#sensitivity-metric');
  const minInput = root.querySelector('#sensitivity-min');
  const maxInput = root.querySelector('#sensitivity-max');
  const stepsInput = root.querySelector('#sensitivity-steps');
  const normalizedInput = root.querySelector('#sensitivity-normalized');
  const output = root.querySelector('#sensitivity-output');
  const csvButton = root.querySelector('#sensitivity-csv');
  const stateSignature = JSON.stringify(state);

  const setRange = () => {
    const parameter = PARAMETERS[Number(paramSelect.value)];
    const raw = getPath(state, parameter.path);
    const current = parameter.toDisplay ? parameter.toDisplay(raw) : raw;
    const span = Math.max(Math.abs(current) * 0.25, parameter.path.includes('temperature') ? 5 : 0.1);
    minInput.value = Number((current - span).toPrecision(6));
    maxInput.value = Number((current + span).toPrecision(6));
  };
  const saveDraft = () => {
    sensitivityDraft = {
      param: paramSelect.value, metric: metricSelect.value, min: minInput.value,
      max: maxInput.value, steps: stepsInput.value, normalized: normalizedInput.checked,
    };
  };
  paramSelect.addEventListener('change', () => { setRange(); saveDraft(); });
  setRange();
  if (sensitivityDraft) {
    paramSelect.value = sensitivityDraft.param;
    metricSelect.value = sensitivityDraft.metric;
    minInput.value = sensitivityDraft.min;
    maxInput.value = sensitivityDraft.max;
    stepsInput.value = sensitivityDraft.steps;
    normalizedInput.checked = sensitivityDraft.normalized;
  } else saveDraft();
  [metricSelect, minInput, maxInput, stepsInput, normalizedInput].forEach((control) => {
    control.addEventListener('change', saveDraft);
  });
  if (sensitivitySweep) {
    output.innerHTML = formatSensitivitySweep(sensitivitySweep, sensitivitySweep.stateSignature !== stateSignature);
    csvButton.disabled = !sensitivitySweep.rows.length;
    csvButton.onclick = () => downloadCsv(sensitivityToCsv(sensitivitySweep.parameter, sensitivitySweep.metric, sensitivitySweep.rows));
  }

  root.querySelector('#sensitivity-run').addEventListener('click', () => {
    try {
      const parameter = PARAMETERS[Number(paramSelect.value)];
      const metric = METRICS[Number(metricSelect.value)];
      const minDisplay = Number(minInput.value); const maxDisplay = Number(maxInput.value); const steps = Number(stepsInput.value);
      const min = parameter.fromDisplay ? parameter.fromDisplay(minDisplay) : minDisplay;
      const max = parameter.fromDisplay ? parameter.fromDisplay(maxDisplay) : maxDisplay;
      const values = createLinearSweepValues({ min, max, steps });
      const sweep = runSensitivitySweep({ baseInput: state, parameterPath: parameter.path, values, calculate, projectResult: metric.get });
      const lastRows = sweep.map((entry) => ({ x: parameter.toDisplay ? parameter.toDisplay(entry.parameterValue) : entry.parameterValue, y: entry.result })).filter((entry) => finite(entry.y));
      const baselineXRaw = getPath(state, parameter.path); const baselineX = parameter.toDisplay ? parameter.toDisplay(baselineXRaw) : baselineXRaw;
      const baselineY = metric.get(calculate(structuredClone(state)));
      const normalized = calculateNormalizedSensitivity(lastRows, baselineX, baselineY);
      saveDraft();
      sensitivitySweep = { rows: lastRows, parameter, metric, normalized, normalizedEnabled: normalizedInput.checked, stateSignature };
      output.innerHTML = formatSensitivitySweep(sensitivitySweep, false);
      csvButton.disabled = lastRows.length === 0;
      csvButton.onclick = () => downloadCsv(sensitivityToCsv(parameter, metric, lastRows));
    } catch (error) {
      output.innerHTML = `<p class="science-empty">${error.message}</p>`;
      csvButton.disabled = true;
    }
  });
}
