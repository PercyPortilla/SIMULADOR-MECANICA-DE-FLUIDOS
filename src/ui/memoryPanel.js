import {
  buildSimulationMemo,
  simulationMemoToCsv,
  simulationMemoToPrintableHtml,
} from '../reporting/simulationMemo.js';
import { escapeHtml } from './safeHtml.js';

const RHEOLOGY_NAMES = Object.freeze({
  newtonian: 'Newtoniano',
  bingham: 'Bingham',
  hb: 'Herschel–Bulkley',
  power: 'Ley de potencia',
  casson: 'Casson',
});

const QUALITY_NAMES = Object.freeze({
  validated: 'Dentro del alcance validado',
  'validated-laminar': 'Régimen laminar validado',
  'educational-estimate': 'Estimación educativa',
  'laminar-profile-only': 'Solo perfil laminar',
});

const SECTION_SUBTITLES = Object.freeze({
  metadata: 'Procedencia y calidad del cálculo',
  inputs: 'Condiciones utilizadas por el modelo',
  equations: 'Relaciones y sustituciones numéricas',
  results: 'Magnitudes calculadas y unidades',
  assumptions: 'Condiciones para interpretar el modelo',
  warnings: 'Límites que requieren atención',
  references: 'Métodos y antecedentes aplicables',
});

function downloadText(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function printableHtml(memo, options) {
  const html = simulationMemoToPrintableHtml(memo, options);
  // The report serializer escapes the article, but its document <title> is raw.
  // Escape just that title in the standalone HTML when the scenario was renamed.
  return html.replace(`<title>${memo.title}</title>`, () => `<title>${escapeHtml(memo.title)}</title>`);
}

function sectionId(section) {
  return `wb-memory-${section.id}`;
}

function renderSectionTable(section) {
  return `<div class="wb-memory-table-wrap">
    <table class="wb-memory-table">
      <thead><tr><th scope="col">Variable / fundamento</th><th scope="col">Valor / sustitución</th><th scope="col">Unidad</th></tr></thead>
      <tbody>${section.rows.map((row) => `<tr>
        <th scope="row">${escapeHtml(row.label)}</th>
        <td class="wb-memory-value">${escapeHtml(row.value)}</td>
        <td class="wb-memory-unit">${escapeHtml(row.unit || '—')}</td>
      </tr>`).join('')}</tbody>
    </table>
  </div>`;
}

function renderMetadata(section) {
  return `<dl class="wb-memory-metadata-grid">${section.rows.map((row) => `
    <div class="wb-memory-metadata-item"><dt>${escapeHtml(row.label)}</dt>
      <dd>${escapeHtml(row.value)}${row.unit ? ` <small>${escapeHtml(row.unit)}</small>` : ''}</dd>
    </div>`).join('')}</dl>`;
}

function renderNotes(section) {
  return `<ol class="wb-memory-note-list">${section.rows.map((row, index) => `
    <li><span class="wb-memory-note-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><p>${escapeHtml(row.value)}</p></li>
  `).join('')}</ol>`;
}

function renderSection(section, index) {
  const noteSection = ['assumptions', 'warnings', 'references'].includes(section.id);
  const contents = section.id === 'metadata'
    ? renderMetadata(section)
    : noteSection ? renderNotes(section) : renderSectionTable(section);
  const position = String(index + 1).padStart(2, '0');
  return `<section class="wb-memory-section wb-memory-section--${section.id}" id="${sectionId(section)}" aria-labelledby="${sectionId(section)}-heading">
    <header class="wb-memory-section-head">
      <span class="wb-memory-section-number" aria-hidden="true">${position}</span>
      <div class="wb-memory-section-heading">
        <p>${escapeHtml(SECTION_SUBTITLES[section.id] ?? 'Registro técnico')}</p>
        <h3 id="${sectionId(section)}-heading">${escapeHtml(section.title)}</h3>
      </div>
      <small class="wb-memory-row-count">${section.rows.length} ${section.rows.length === 1 ? 'registro' : 'registros'}</small>
    </header>
    ${contents}
  </section>`;
}

function renderTableOfContents(sections) {
  return `<nav class="wb-memory-toc" aria-label="Índice de la memoria">
    <span class="wb-memory-eyebrow">NAVEGACIÓN</span>
    <h3>Índice del informe</h3>
    <ol>${sections.map((section, index) => `<li>
      <a href="#${sectionId(section)}"><span aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>${escapeHtml(section.title)}</a>
    </li>`).join('')}</ol>
  </nav>`;
}

export function renderMemoryPanel(root, {
  state, results, scenarioName = 'Escenario actual',
  scenarioNotice = '', matchesSaved = false,
}) {
  if (!root) return;
  const memo = buildSimulationMemo({ state, results, scenarioName });
  const warnings = memo.sections.find((section) => section.id === 'warnings')?.rows.length ?? 0;
  const model = RHEOLOGY_NAMES[state?.rheology?.model] ?? 'Sin modelo seleccionado';
  const quality = QUALITY_NAMES[results?.transport?.resultQuality] ?? 'Calidad por determinar';

  root.innerHTML = `<div class="wb-memory-workbench">
    <header class="wb-memory-hero">
      <div class="wb-memory-hero-top"><span class="wb-memory-eyebrow">CUADERNO CIENTÍFICO / 04</span><span class="wb-memory-hero-kind">EXPEDIENTE DE CÁLCULO</span></div>
      <h2>Memoria técnica del escenario</h2>
      <p>Revisa la secuencia de entradas, ecuaciones, sustituciones, resultados y límites de aplicabilidad del cálculo activo.</p>
      ${scenarioNotice ? `<p class="wb-memory-provenance" role="status" data-saved="${matchesSaved ? 'true' : 'false'}">${escapeHtml(scenarioNotice)}</p>` : ''}
      <dl class="wb-memory-overview">
        <div><dt>Escenario activo</dt><dd>${escapeHtml(scenarioName)}</dd></div>
        <div><dt>Reología</dt><dd>${escapeHtml(model)}</dd></div>
        <div><dt>Calidad hidráulica</dt><dd>${escapeHtml(quality)}</dd></div>
        <div><dt>Revisión del expediente</dt><dd>${warnings ? `${warnings} ${warnings === 1 ? 'advertencia' : 'advertencias'}` : 'Sin advertencias registradas'}</dd></div>
      </dl>
    </header>

    <div class="wb-memory-layout">
      <aside class="wb-memory-rail">
        ${renderTableOfContents(memo.sections)}
        <div class="wb-memory-reading-note"><strong>Criterio de lectura</strong><p>Las magnitudes y ecuaciones proceden del escenario activo. Los supuestos y las advertencias delimitan su interpretación.</p></div>
      </aside>
      <div class="wb-memory-body">
        <section class="wb-memory-export" aria-label="Opciones de exportación">
          <div class="wb-memory-export-intro"><span class="wb-memory-eyebrow">PUBLICAR RESULTADOS</span><h3>Preparar documento</h3><p>Exporta los mismos registros que aparecen en esta memoria. La impresión permite guardar el informe en PDF.</p></div>
          <div class="memo-actions wb-memory-actions">
            <button id="memo-pdf" class="wb-memory-action wb-memory-action-primary" type="button">Imprimir / guardar PDF</button>
            <button id="memo-html" class="wb-memory-action" type="button">Descargar HTML</button>
            <button id="memo-csv" class="wb-memory-action" type="button">Exportar CSV</button>
          </div>
          <p id="memo-export-status" class="memo-export-status wb-memory-export-status" role="status" aria-live="polite"></p>
        </section>
        <article class="wb-memory-document" aria-label="Contenido de la memoria">
          <div class="wb-memory-document-head"><div><span class="wb-memory-eyebrow">REGISTRO DEL MODELO</span><h3>Desarrollo y trazabilidad</h3></div><span>${memo.sections.length} secciones · Sistema Internacional</span></div>
          <div class="wb-memory-sections">${memo.sections.map(renderSection).join('')}</div>
        </article>
      </div>
    </div>
  </div>`;

  const status = root.querySelector('#memo-export-status');
  root.querySelector('#memo-csv')?.addEventListener('click', () => {
    downloadText('pulpa-lab-memoria.csv', simulationMemoToCsv(memo), 'text/csv;charset=utf-8');
    if (status) status.textContent = 'Tabla CSV descargada con las secciones y unidades de esta memoria.';
  });
  root.querySelector('#memo-html')?.addEventListener('click', () => {
    downloadText('pulpa-lab-memoria-imprimible.html', printableHtml(memo, { autoPrint: false }), 'text/html;charset=utf-8');
    if (status) status.textContent = 'Informe HTML descargado y listo para imprimir desde el navegador.';
  });
  root.querySelector('#memo-pdf')?.addEventListener('click', () => {
    const win = window.open('', '_blank');
    if (!win) {
      downloadText('pulpa-lab-memoria-imprimible.html', printableHtml(memo, { autoPrint: false }), 'text/html;charset=utf-8');
      if (status) status.textContent = 'El navegador bloqueó la ventana; se descargó el HTML listo para imprimir o guardar como PDF.';
      return;
    }
    win.opener = null;
    win.document.open();
    win.document.write(printableHtml(memo, { autoPrint: true }));
    win.document.close();
    if (status) status.textContent = 'Informe abierto para imprimir o guardar como PDF desde el navegador.';
    win.focus();
  });
}
