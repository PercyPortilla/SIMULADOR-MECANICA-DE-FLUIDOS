import {
  calculateBinghamStress,
  calculateCassonStress,
  calculateHerschelBulkleyStress,
  calculatePowerLawStress,
} from '../core/rheology/index.js';
import { createNumericSeries, seriesToSvgPolyline } from './chartSeries.js';
import { buildRadialProbeRows, radialProbeToCsv, radialProbeToHtmlTable } from './radialProbe.js';

let selectedProbeRatio = 0.5;

function finite(value) { return typeof value === 'number' && Number.isFinite(value); }

function constitutiveStress(state, shearRateS_1) {
  const r = state.rheology;
  if (r.model === 'newtonian') return r.newtonianViscosityPaS > 0 ? r.newtonianViscosityPaS * shearRateS_1 : null;
  if (r.model === 'hb' && r.consistencyIndex > 0 && r.flowIndex > 0) return calculateHerschelBulkleyStress({ shearRateS_1, yieldStressPa: r.yieldStressPa, consistencyIndex: r.consistencyIndex, flowIndex: r.flowIndex });
  if (r.model === 'bingham' && r.plasticViscosityPaS > 0) return calculateBinghamStress({ shearRateS_1, yieldStressPa: r.yieldStressPa, plasticViscosityPaS: r.plasticViscosityPaS });
  if (r.model === 'power' && r.consistencyIndex > 0 && r.flowIndex > 0) return calculatePowerLawStress({ shearRateS_1, consistencyIndex: r.consistencyIndex, flowIndex: r.flowIndex });
  if (r.model === 'casson' && r.cassonViscosityPaS > 0) return calculateCassonStress({ shearRateS_1, yieldStressPa: r.yieldStressPa, cassonViscosityPaS: r.cassonViscosityPaS });
  return null;
}

export function buildConstitutiveCurve(state, results, pointCount = 61) {
  const profileRates = results.rheology?.profile?.shearRateS_1?.filter(finite) ?? [];
  const maxRate = Math.max(100, ...profileRates, 1);
  const shearRateS_1 = [];
  const shearStressPa = [];
  const apparentViscosityPaS = [];
  for (let index = 0; index < pointCount; index += 1) {
    const gamma = maxRate * 1.25 * index / (pointCount - 1);
    const tau = constitutiveStress(state, gamma);
    if (!finite(tau)) continue;
    shearRateS_1.push(gamma);
    shearStressPa.push(tau);
    apparentViscosityPaS.push(gamma > 0 ? tau / gamma : null);
  }
  return { shearRateS_1, shearStressPa, apparentViscosityPaS };
}

export function buildSystemCurve(state, calculate, pointCount = 13) {
  if (typeof calculate !== 'function' || !(state.transport?.pipe1?.innerDiameterM > 0)) return null;
  const currentVelocity = state.transport.pipe1.velocityMps ?? 0;
  const maxVelocity = Math.max(2.5, currentVelocity * 1.8, 0.5);
  const velocityMps = [];
  const flowRateM3h = [];
  const pressureDropKpa = [];
  for (let index = 0; index < pointCount; index += 1) {
    const velocity = maxVelocity * index / (pointCount - 1);
    const candidate = structuredClone(state);
    candidate.transport.pipe1.velocityMps = velocity;
    candidate.energy.pumpCurve = [];
    candidate.energy.efficiencyCurve = [];
    candidate.energy.npshrCurve = [];
    const calculated = calculate(candidate);
    const q = calculated.transport?.flowRateM3s;
    const dp = calculated.transport?.requiredPressurePa;
    if (!finite(q) || !finite(dp)) continue;
    velocityMps.push(velocity);
    flowRateM3h.push(q * 3600);
    pressureDropKpa.push(dp / 1000);
  }
  return flowRateM3h.length >= 2 ? { velocityMps, flowRateM3h, pressureDropKpa } : null;
}

function chartSvg({ title, subtitle, xLabel, yLabel, series }) {
  const validSeries = series.filter((item) => item?.x?.length && item.x.length === item.y.length);
  if (!validSeries.length) return `<article class="science-chart"><div class="science-card-head"><strong>${title}</strong><small>${subtitle}</small></div><p class="science-empty">Datos insuficientes.</p></article>`;
  const width = 520; const height = 230; const padding = { left: 48, right: 16, top: 18, bottom: 38 };
  const allX = validSeries.flatMap((item) => item.x);
  const allY = validSeries.flatMap((item) => item.y);
  const xDomain = [Math.min(0, ...allX), Math.max(...allX, 1e-12)];
  const yDomain = [Math.min(0, ...allY), Math.max(...allY, 1e-12)];
  const lines = validSeries.map((item, index) => {
    const geometry = seriesToSvgPolyline(createNumericSeries(item.x, item.y), { width, height, padding, xDomain, yDomain });
    return `<polyline class="science-line science-line-${index + 1}" points="${geometry.points}" />`;
  }).join('');
  const legend = validSeries.map((item, index) => `<span><i class="science-key science-key-${index + 1}"></i>${item.label}</span>`).join('');
  return `<article class="science-chart"><div class="science-card-head"><strong>${title}</strong><small>${subtitle}</small></div><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${title}"><line class="chart-axis" x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}"/><line class="chart-axis" x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}"/>${lines}<text class="chart-label" x="${width / 2}" y="${height - 7}" text-anchor="middle">${xLabel}</text><text class="chart-label" x="12" y="${height / 2}" transform="rotate(-90 12 ${height / 2})" text-anchor="middle">${yLabel}</text></svg><div class="science-legend">${legend}</div></article>`;
}

function downloadText(filename, content, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function nearestProbe(rows, ratio) {
  return rows.reduce((best, row) => Math.abs(row.radiusRatio - ratio) < Math.abs(best.radiusRatio - ratio) ? row : best, rows[0]);
}

export function renderCurvesAndProbes(root, { state, results, calculate }) {
  if (!root) return;
  const constitutive = buildConstitutiveCurve(state, results);
  const system = buildSystemCurve(state, calculate);
  const profile = results.rheology?.profile;
  const profileRows = profile?.radiusM?.length ? buildRadialProbeRows(profile) : [];
  const muX = constitutive.shearRateS_1.filter((gamma, index) => gamma > 0 && finite(constitutive.apparentViscosityPaS[index]));
  const muY = constitutive.shearRateS_1.map((gamma, index) => ({ gamma, mu: constitutive.apparentViscosityPaS[index] })).filter((entry) => entry.gamma > 0 && finite(entry.mu)).map((entry) => entry.mu);
  const radialRatio = profileRows.map((row) => row.radiusRatio);
  const radialVelocity = profileRows.map((row) => row.velocityMps);
  const pumpCurves = results.pump?.curves;
  root.innerHTML = `<div class="science-grid">
    ${chartSvg({ title: 'Ley constitutiva', subtitle: state.rheology.model || 'sin modelo', xLabel: 'γ̇ · s⁻¹', yLabel: 'τ · Pa', series: [{ label: 'Modelo activo', x: constitutive.shearRateS_1, y: constitutive.shearStressPa }] })}
    ${chartSvg({ title: 'Viscosidad aparente', subtitle: 'μa = τ/γ̇ · no definida en plug', xLabel: 'γ̇ · s⁻¹', yLabel: 'μa · Pa·s', series: [{ label: 'μ aparente', x: muX, y: muY }] })}
    ${pumpCurves?.flowRateM3s?.length ? chartSvg({ title: 'Bomba y sistema', subtitle: results.pump?.status ?? '', xLabel: 'Q · m³/h', yLabel: 'H · m', series: [{ label: 'Sistema', x: pumpCurves.flowRateM3s.map((q) => q * 3600), y: pumpCurves.systemHeadM }, { label: 'Bomba', x: pumpCurves.flowRateM3s.map((q) => q * 3600), y: pumpCurves.pumpHeadM }] }) : chartSvg({ title: 'Curva del sistema', subtitle: 'recalculada con el motor activo', xLabel: 'Q · m³/h', yLabel: 'ΔP · kPa', series: system ? [{ label: 'Sistema', x: system.flowRateM3h, y: system.pressureDropKpa }] : [] })}
    ${chartSvg({ title: 'Perfil de velocidad', subtitle: results.transport?.flowRegime ? `régimen: ${results.transport.flowRegime}` : '', xLabel: 'u · m/s', yLabel: 'r/R', series: profileRows.length ? [{ label: 'Perfil radial', x: radialVelocity, y: radialRatio }] : [] })}
  </div><section class="probe-panel"><div class="probe-head"><div><p class="eyebrow">SONDA RADIAL</p><h3>Perfil laminar equivalente</h3></div><button id="probe-export-csv" type="button" ${profileRows.length ? '' : 'disabled'}>Exportar perfiles CSV</button></div><label class="probe-slider">r/R <input id="probe-ratio" type="range" min="0" max="1000" value="${Math.round(selectedProbeRatio * 1000)}"><output id="probe-ratio-value">${selectedProbeRatio.toFixed(2)}</output></label><div id="probe-metrics" class="probe-metrics"></div><div class="probe-table-wrap">${profileRows.length ? radialProbeToHtmlTable(profile, { decimals: 4, caption: 'Sondas virtuales · perfil radial' }) : '<p class="science-empty">Selecciona un modelo reológico no newtoniano válido para generar sondas.</p>'}</div></section>`;

  const slider = root.querySelector('#probe-ratio');
  const metrics = root.querySelector('#probe-metrics');
  const output = root.querySelector('#probe-ratio-value');
  const updateProbe = () => {
    if (!profileRows.length) { if (metrics) metrics.innerHTML = '<span>Sin perfil disponible.</span>'; return; }
    selectedProbeRatio = Number(slider.value) / 1000;
    const row = nearestProbe(profileRows, selectedProbeRatio);
    output.textContent = selectedProbeRatio.toFixed(2);
    metrics.innerHTML = `<div><span>r</span><strong>${(row.radiusM * 1000).toFixed(2)} mm</strong></div><div><span>u</span><strong>${row.velocityMps.toFixed(4)} m/s</strong></div><div><span>τ</span><strong>${row.shearStressPa === null ? '—' : `${row.shearStressPa.toFixed(3)} Pa`}</strong></div><div><span>γ̇</span><strong>${row.shearRateS_1 === null ? '—' : `${row.shearRateS_1.toFixed(3)} s⁻¹`}</strong></div><div><span>μa</span><strong>${row.apparentViscosityPaS === null ? 'No definida' : `${row.apparentViscosityPaS.toFixed(4)} Pa·s`}</strong></div>`;
  };
  slider?.addEventListener('input', updateProbe); updateProbe();
  root.querySelector('#probe-export-csv')?.addEventListener('click', () => downloadText('pulpa-lab-sondas.csv', radialProbeToCsv(profile)));
}
