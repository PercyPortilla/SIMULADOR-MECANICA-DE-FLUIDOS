/**
 * T25–T27. UX and brand shell only. No mutation of solver inputs, rendering
 * materials, native Euler scientific controls or educational CAD geometry.
 */
import { describeNpsh } from './npshDiagnostic.js';

const GROUP_IDS = Object.freeze({
  basic: new Set(['slurry', 'rheology', 'transport', 'energy']),
  process: new Set(['leaching', 'recovery', 'process']),
  advanced: new Set(['losses', 'transport', 'energy', 'slurry', 'rheology']),
});

const GUIDES = Object.freeze({
  curves: {
    heading: 'Cómo interpretar los gráficos',
    body: ['Selecciona una curva y recorre los puntos con flechas del teclado.', 'Compara los valores únicamente dentro del modelo activo.', 'Descarga cada SVG con ejes y series para tu informe.'],
  },
  balance: {
    heading: 'Orden recomendado de lectura',
    body: ['Revisa la presión y la carga calculadas.', 'Contrasta NPSHa con NPSHr cuando exista curva aplicable.', 'Usa sensibilidad para explorar supuestos, no como sensor de operación.'],
  },
  memory: {
    heading: 'Antes de exportar la memoria',
    body: ['Comprueba el nombre y procedencia del escenario.', 'Revisa hipótesis, ecuaciones y unidades.', 'Si cambiaste entradas, guarda de nuevo el escenario para hacer reproducible el informe.'],
  },
  academy: {
    heading: 'Ruta de aprendizaje',
    body: ['Carga un caso de referencia y anota tu hipótesis.', 'Realiza la comparación A/B con las entradas modificadas.', 'Interpreta los cambios del cálculo y exporta la evidencia.'],
  },
});

export function installPremiumWorkbench({ content, inputsRoot }) {
  const inputs = inputsRoot?.querySelector('#wb-inputs-model-controls');
  const sections = document.querySelector('#sections');
  if (!content || !inputs || !sections) return { apply() {}, restore() {} };

  const filters = document.createElement('div');
  filters.className = 'wb-premium-filter';
  filters.innerHTML = `
    <div class="wb-premium-filter-heading"><strong>Explorador de parámetros</strong><small>Los campos conservan las validaciones originales.</small></div>
    <div class="wb-premium-filter-controls">
      <label for="wb-parameter-search">Buscar variable
        <input id="wb-parameter-search" type="search" autocomplete="off" placeholder="Ej. velocidad, NPSH, rugosidad" aria-controls="sections">
      </label>
      <label for="wb-parameter-level">Nivel
        <select id="wb-parameter-level" aria-controls="sections">
          <option value="all">Todos los parámetros</option>
          <option value="basic">Esenciales</option>
          <option value="process">Proceso metalúrgico</option>
          <option value="advanced">Hidráulica avanzada</option>
        </select>
      </label>
      <button type="button" id="wb-parameter-reset" title="Mostrar todos los parámetros">Restablecer</button>
    </div>
    <p id="wb-parameter-count" role="status" aria-live="polite">Explora los parámetros del modelo.</p>`;
  inputs.before(filters);

  const search = filters.querySelector('#wb-parameter-search');
  const level = filters.querySelector('#wb-parameter-level');
  const count = filters.querySelector('#wb-parameter-count');
  const reset = filters.querySelector('#wb-parameter-reset');
  const normalize = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
  const apply = () => {
    if (document.body.dataset.workbenchTab !== 'inputs') return;
    const query = normalize(search.value.trim());
    const group = GROUP_IDS[level.value];
    let visibleSections = 0;
    let visibleFields = 0;
    for (const section of sections.querySelectorAll(':scope > details.parameter-section')) {
      const id = section.dataset.sectionId ?? '';
      const allowed = !group || group.has(id) || (level.value === 'advanced' && (section.classList.contains('circuit-segments') || section.classList.contains('pump-curve-editor')));
      const labels = [...section.querySelectorAll('.parameter-field')];
      const headingMatches = normalize(section.querySelector(':scope > summary')?.textContent).includes(query);
      let matchCount = 0;
      for (const label of labels) {
        const match = !query || headingMatches || normalize(label.textContent).includes(query) || normalize(label.querySelector('[data-path]')?.dataset.path).includes(query);
        label.hidden = Boolean(query) && !match;
        if (match) matchCount += 1;
      }
      const matches = !query || headingMatches || matchCount > 0;
      section.hidden = !allowed || !matches;
      if (!section.hidden) {
        visibleSections += 1;
        visibleFields += matchCount;
        if (query) {
          section.open = true;
          section.querySelectorAll('details.parameter-advanced').forEach((advanced) => { advanced.open = true; });
        }
      }
    }
    count.textContent = visibleSections
      ? `${visibleSections} secciones visibles${query ? ` · ${visibleFields} variables coincidentes` : ''}. Los valores no se han modificado.`
      : 'No se encontraron variables. Prueba otro término o restablece el filtro.';
  };
  const restore = () => {
    sections.querySelectorAll(':scope > details.parameter-section, .parameter-field').forEach((node) => { node.hidden = false; });
  };
  search.addEventListener('input', apply);
  level.addEventListener('change', apply);
  reset.addEventListener('click', () => { search.value = ''; level.value = 'all'; apply(); search.focus(); });
  // Model-switch changes rebuild these sections; reapply UI-only filtering.
  new MutationObserver(apply).observe(sections, { childList: true });

  for (const [tabId, guide] of Object.entries(GUIDES)) {
    const panel = content.querySelector(`#workspace-panel-${tabId}`);
    const target = panel?.querySelector('.wb-content-root');
    if (!target) continue;
    const details = document.createElement('details');
    details.className = 'wb-premium-guide';
    const summary = document.createElement('summary');
    summary.textContent = guide.heading;
    const list = document.createElement('ol');
    for (const item of guide.body) { const li = document.createElement('li'); li.textContent = item; list.append(li); }
    details.append(summary, list);
    target.before(details);
  }
  return { apply, restore };
}

export function renderPremiumInsight({ results }) {
  const panel = document.querySelector('#workspace-panel-balance');
  const target = panel?.querySelector('#balance-tab-root');
  if (!target) return;
  let insight = panel.querySelector('#wb-premium-insight');
  if (!insight) {
    insight = document.createElement('section');
    insight.id = 'wb-premium-insight';
    insight.className = 'wb-premium-insight';
    insight.setAttribute('aria-label', 'Interpretación del escenario calculado');
    insight.innerHTML = '<div class="wb-premium-insight-copy"><span>LECTURA TÉCNICA · MODELO ACTIVO</span><h3>Interpretación rápida</h3><p id="wb-premium-insight-flow"></p><p id="wb-premium-insight-npsh"></p><small>Resultados derivados del modelo académico; no lecturas de sensores ni certificación de operación.</small></div><div class="wb-premium-insight-actions"><button type="button" data-premium-go="inputs">Editar entradas</button><button type="button" data-premium-go="curves">Explorar curvas</button></div>';
    insight.querySelectorAll('[data-premium-go]').forEach((button) => {
      button.addEventListener('click', () => document.querySelector(`#workspace-tab-${button.dataset.premiumGo}`)?.click());
    });
    target.before(insight);
  }
  const transport = results.transport ?? {};
  const flowM3h = transport.flowRateM3s === undefined ? NaN : transport.flowRateM3s * 3600;
  const pressureKPa = transport.pressureDropPa === undefined ? NaN : transport.pressureDropPa / 1000;
  const fmt = (x, digits = 2) => Number.isFinite(x) ? x.toLocaleString('es-PE', { maximumFractionDigits: digits, minimumFractionDigits: digits }) : 'N/D';
  insight.querySelector('#wb-premium-insight-flow').textContent = `Para las entradas actuales, el modelo calcula Q = ${fmt(flowM3h)} m³/h y ΔP = ${fmt(pressureKPa)} kPa.`;
  const npsh = describeNpsh(results.pump);
  const npshText = npsh.state === 'below'
    ? `NPSH: margen negativo de ${fmt(npsh.marginM)} m respecto a NPSHr en el caudal evaluado; revisar las condiciones de succión.`
    : npsh.state === 'meets'
      ? `NPSH: comparación básica no negativa (${fmt(npsh.marginM)} m). No equivale a margen adicional de fabricante.`
      : `NPSH: ${npsh.explanation}`;
  insight.querySelector('#wb-premium-insight-npsh').textContent = npshText;
  insight.dataset.npshState = npsh.state;
}
