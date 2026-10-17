const DEFAULT_TITLE = 'Informe de laboratorio académico · PULPA LAB V2';
const DEFAULT_RESULT_QUALITY = 'no reportado';
const CHANGE_TOLERANCE = 1e-12;

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function textOr(value, fallback = '') {
  const text = value === null || value === undefined ? '' : String(value).trim();
  return text || fallback;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function formatLocalDate(value = new Date()) {
  let date;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      throw new RangeError('Fecha inválida para el informe académico.');
    }
  } else {
    date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  }
  if (!Number.isFinite(date.getTime())) throw new RangeError('Fecha inválida para el informe académico.');
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear()}`;
}

function normalizeExperimentSource(source) {
  const comparison = source?.comparison ?? source;
  if (!comparison?.leftCase || !comparison?.rightCase || !Array.isArray(comparison.metrics) || !Array.isArray(comparison.insights)) {
    throw new TypeError('El informe requiere una comparación académica válida.');
  }
  return { source: source ?? {}, comparison };
}

function normalizeCase(role, academicCase, results) {
  return Object.freeze({
    role,
    id: textOr(academicCase?.id, role),
    name: textOr(academicCase?.name, textOr(academicCase?.shortName, role)),
    shortName: textOr(academicCase?.shortName, textOr(academicCase?.name, role)),
    objective: textOr(academicCase?.objective),
    caution: textOr(academicCase?.caution),
    resultQuality: textOr(results?.transport?.resultQuality, DEFAULT_RESULT_QUALITY),
    modelStatus: textOr(results?.transport?.modelStatus),
  });
}

function normalizeMetric(metric) {
  const left = metric?.left;
  const right = metric?.right;
  const suppliedDelta = metric?.delta;
  const delta = isFiniteNumber(suppliedDelta)
    ? suppliedDelta
    : isFiniteNumber(left) && isFiniteNumber(right)
      ? right - left
      : null;
  const suppliedPercent = metric?.percentDelta;
  const percentDelta = isFiniteNumber(suppliedPercent)
    ? suppliedPercent
    : isFiniteNumber(left) && isFiniteNumber(right) && Math.abs(left) > CHANGE_TOLERANCE
      ? (right - left) / Math.abs(left) * 100
      : null;
  return Object.freeze({
    key: textOr(metric?.key, textOr(metric?.label, 'metric')),
    label: textOr(metric?.label, textOr(metric?.key, 'Métrica')),
    unit: textOr(metric?.unit),
    left: left ?? null,
    right: right ?? null,
    delta,
    percentDelta,
  });
}

function metricChanged(metric) {
  if (isFiniteNumber(metric.delta)) return Math.abs(metric.delta) > CHANGE_TOLERANCE;
  return metric.left !== metric.right;
}

function normalizeInsight(insight) {
  return Object.freeze({
    key: textOr(insight?.key, 'causal'),
    title: textOr(insight?.title, 'Explicación causal'),
    explanation: textOr(insight?.explanation),
  });
}

function deriveHypothesis(source, comparison) {
  const explicit = textOr(source?.hypothesis);
  if (explicit) return explicit;
  const left = textOr(comparison.leftCase?.shortName, comparison.leftCase?.name);
  const right = textOr(comparison.rightCase?.shortName, comparison.rightCase?.name);
  return `Si cambian las entradas del caso ${left} al caso ${right}, las métricas calculadas responderán únicamente a las relaciones causales representadas explícitamente por el modelo.`;
}

function deriveConclusion(changedMetrics, insights, leftCase, rightCase) {
  if (!changedMetrics.length) {
    return 'No se observaron cambios en las métricas comparadas; con las entradas evaluadas, los dos casos producen la misma respuesta numérica en los resultados seleccionados.';
  }
  const metricNames = changedMetrics.slice(0, 4).map((metric) => metric.label).join(', ');
  const causalTitles = insights
    .filter((item) => item.key !== 'scope' && item.key !== 'same')
    .slice(0, 3)
    .map((item) => item.title)
    .join(', ');
  const qualityWarning = leftCase.resultQuality === 'educational-estimate' || rightCase.resultQuality === 'educational-estimate'
    ? ' La interpretación debe conservar la advertencia de resultQuality porque al menos uno de los casos es una estimación educativa.'
    : '';
  return `La comparación modificó ${metricNames}. ${causalTitles ? `Las diferencias son coherentes con ${causalTitles}.` : 'Las diferencias deben interpretarse con las entradas explícitas del experimento.'}${qualityWarning}`;
}

export function buildAcademicLabReportModel(experiment, options = {}) {
  const { source, comparison } = normalizeExperimentSource(experiment);
  const metrics = comparison.metrics.map(normalizeMetric);
  const changedMetrics = metrics.filter(metricChanged);
  const insights = comparison.insights.map(normalizeInsight);
  const leftCase = normalizeCase('A', comparison.leftCase, comparison.leftResults);
  const rightCase = normalizeCase('B', comparison.rightCase, comparison.rightResults);
  const title = textOr(options.title, textOr(source.title, DEFAULT_TITLE));
  const hypothesis = textOr(options.hypothesis, deriveHypothesis(source, comparison));
  const conclusion = textOr(
    options.conclusion,
    textOr(source.conclusion, deriveConclusion(changedMetrics, insights, leftCase, rightCase)),
  );
  const date = formatLocalDate(options.date ?? source.date ?? new Date());

  return deepFreeze({
    title,
    date,
    hypothesis,
    cases: Object.freeze({ A: leftCase, B: rightCase }),
    changedMetrics: Object.freeze(changedMetrics),
    causalExplanation: Object.freeze(insights),
    scope: Object.freeze({
      A: Object.freeze({ resultQuality: leftCase.resultQuality, modelStatus: leftCase.modelStatus, caution: leftCase.caution }),
      B: Object.freeze({ resultQuality: rightCase.resultQuality, modelStatus: rightCase.modelStatus, caution: rightCase.caution }),
    }),
    conclusion,
  });
}

function formatNumber(value, digits = 4) {
  if (!isFiniteNumber(value)) return '—';
  const fixed = value.toFixed(digits);
  return fixed.replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, '').replace(/\.$/, '');
}

function formatMetricValue(value, unit) {
  if (!isFiniteNumber(value)) return escapeHtml(value ?? '—');
  const suffix = unit ? ` ${unit}` : '';
  return `${formatNumber(value)}${escapeHtml(suffix)}`;
}

function formatDelta(metric) {
  if (!isFiniteNumber(metric.delta)) return '—';
  const sign = metric.delta > 0 ? '+' : '';
  const unit = metric.unit ? ` ${metric.unit}` : '';
  return `${sign}${formatNumber(metric.delta)}${escapeHtml(unit)}`;
}

function formatPercentDelta(metric) {
  if (!isFiniteNumber(metric.percentDelta)) return '—';
  const sign = metric.percentDelta > 0 ? '+' : '';
  return `${sign}${formatNumber(metric.percentDelta, 2)} %`;
}

function caseHtml(item) {
  return `<article class="case-card"><div class="case-role">Caso ${escapeHtml(item.role)}</div><h3>${escapeHtml(item.name)}</h3>${item.objective ? `<p>${escapeHtml(item.objective)}</p>` : ''}</article>`;
}

function metricsHtml(metrics) {
  if (!metrics.length) return '<p class="empty">No hubo métricas cambiadas en la comparación.</p>';
  const rows = metrics.map((metric) => `<tr><th scope="row">${escapeHtml(metric.label)}</th><td>${formatMetricValue(metric.left, metric.unit)}</td><td>${formatMetricValue(metric.right, metric.unit)}</td><td>${formatDelta(metric)}</td><td>${formatPercentDelta(metric)}</td></tr>`).join('');
  return `<div class="table-wrap"><table><thead><tr><th>Métrica</th><th>A</th><th>B</th><th>Δ B−A</th><th>Δ %</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function insightsHtml(insights) {
  if (!insights.length) return '<p class="empty">Sin explicación causal disponible.</p>';
  return `<ol class="insights">${insights.map((item) => `<li><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.explanation)}</span></li>`).join('')}</ol>`;
}

function scopeHtml(scope) {
  return ['A', 'B'].map((role) => {
    const item = scope[role];
    const status = item.modelStatus ? `<p><b>Estado:</b> ${escapeHtml(item.modelStatus)}</p>` : '';
    const caution = item.caution ? `<p><b>Alcance:</b> ${escapeHtml(item.caution)}</p>` : '';
    return `<article><h3>Caso ${role}</h3><p><b>resultQuality:</b> ${escapeHtml(item.resultQuality)}</p>${status}${caution}</article>`;
  }).join('');
}

export function academicLabReportToHtml(report) {
  if (!report?.cases?.A || !report?.cases?.B || !Array.isArray(report.changedMetrics) || !Array.isArray(report.causalExplanation)) {
    throw new TypeError('Modelo de informe académico inválido.');
  }
  const title = escapeHtml(report.title);
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>
    :root{font-family:Arial,Helvetica,sans-serif;color:#17212a;background:#fff}*{box-sizing:border-box}body{margin:0;padding:32px}main{max-width:920px;margin:0 auto}header{border-bottom:2px solid #293a46;padding-bottom:14px;margin-bottom:22px}h1{font-size:24px;margin:0 0 6px}h2{font-size:16px;margin:24px 0 10px}h3{font-size:13px;margin:0 0 6px}.meta{color:#53636d;font-size:12px}.hypothesis,.conclusion{padding:12px 14px;border-left:3px solid #8a6333;background:#f6f3ee;line-height:1.5}.cases,.scope{display:grid;grid-template-columns:1fr 1fr;gap:12px}.case-card,.scope article{border:1px solid #cad2d7;border-radius:6px;padding:12px}.case-role{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6d4f2d}.case-card p,.scope p{font-size:12px;line-height:1.45;margin:6px 0}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:8px;border-bottom:1px solid #d8dee2;text-align:right}th:first-child,td:first-child{text-align:left}thead th{font-size:10px;text-transform:uppercase;color:#53636d}.insights{padding-left:20px}.insights li{margin:0 0 10px;line-height:1.45}.insights strong,.insights span{display:block}.insights span{font-size:12px;color:#374650}.empty{font-size:12px;color:#677780}.footer-note{margin-top:26px;padding-top:10px;border-top:1px solid #d8dee2;color:#677780;font-size:10px}@media(max-width:640px){body{padding:16px}.cases,.scope{grid-template-columns:1fr}}@media print{body{padding:0}.table-wrap{overflow:visible}main{max-width:none}.case-card,.scope article{break-inside:avoid}.insights li{break-inside:avoid}}
  </style>
</head>
<body>
<main>
  <header><h1>${title}</h1><div class="meta">Fecha local: ${escapeHtml(report.date)}</div></header>
  <section><h2>Hipótesis</h2><p class="hypothesis">${escapeHtml(report.hypothesis)}</p></section>
  <section><h2>Casos comparados</h2><div class="cases">${caseHtml(report.cases.A)}${caseHtml(report.cases.B)}</div></section>
  <section><h2>Métricas cambiadas y deltas</h2>${metricsHtml(report.changedMetrics)}</section>
  <section><h2>Explicación causal</h2>${insightsHtml(report.causalExplanation)}</section>
  <section><h2>Alcance y calidad del resultado</h2><div class="scope">${scopeHtml(report.scope)}</div></section>
  <section><h2>Conclusión</h2><p class="conclusion">${escapeHtml(report.conclusion)}</p></section>
  <p class="footer-note">Informe HTML autónomo generado por PULPA LAB V2. No requiere red ni backend.</p>
</main>
</body>
</html>`;
}

export function buildAcademicLabReportHtml(experiment, options = {}) {
  return academicLabReportToHtml(buildAcademicLabReportModel(experiment, options));
}
