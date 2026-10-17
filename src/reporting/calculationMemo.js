function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function formatScalar(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new TypeError('La memoria de cálculo no admite números no finitos.');
  }
  return String(value);
}

function flattenRows(value, prefix = '', dictionary = {}, rows = []) {
  if (isPlainObject(value)) {
    for (const [key, entry] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key;
      flattenRows(entry, path, dictionary, rows);
    }
    return rows;
  }
  const metadata = dictionary[prefix] ?? {};
  rows.push({
    key: prefix,
    label: metadata.label ?? prefix,
    value: formatScalar(value),
    unit: metadata.unit ?? '',
  });
  return rows;
}

function noteRows(items = []) {
  if (!Array.isArray(items)) throw new TypeError('Las notas deben ser un arreglo.');
  return items.map((value, index) => ({
    key: String(index + 1),
    label: String(index + 1),
    value: String(value),
    unit: '',
  }));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeCsv(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function renderHtmlRows(rows) {
  return rows.map((row) => `
        <tr>
          <th scope="row">${escapeHtml(row.label)}</th>
          <td>${escapeHtml(row.value)}</td>
          <td>${escapeHtml(row.unit)}</td>
        </tr>`).join('');
}

/**
 * Creates a deterministic, serializable calculation record. No timestamp is
 * generated implicitly; callers can pass one in metadata when traceability
 * requires it.
 */
export function buildCalculationMemo({
  title = 'Memoria de cálculo',
  inputs = {},
  results = {},
  assumptions = [],
  warnings = [],
  metadata = {},
  dictionary = {},
} = {}) {
  if (!isPlainObject(inputs) || !isPlainObject(results) || !isPlainObject(metadata) || !isPlainObject(dictionary)) {
    throw new TypeError('inputs, results, metadata y dictionary deben ser objetos.');
  }
  const sections = [
    { id: 'metadata', title: 'Metadatos', rows: flattenRows(metadata, '', dictionary) },
    { id: 'inputs', title: 'Entradas', rows: flattenRows(inputs, '', dictionary) },
    { id: 'results', title: 'Resultados', rows: flattenRows(results, '', dictionary) },
    { id: 'assumptions', title: 'Supuestos y alcance', rows: noteRows(assumptions) },
    { id: 'warnings', title: 'Advertencias', rows: noteRows(warnings) },
  ].filter((section) => section.rows.length > 0);

  return {
    title: String(title),
    sections: structuredClone(sections),
  };
}

export function calculationMemoToText(memo) {
  if (!memo || !Array.isArray(memo.sections)) throw new TypeError('memo debe ser una memoria estructurada.');
  const blocks = [String(memo.title ?? 'Memoria de cálculo')];
  for (const section of memo.sections) {
    blocks.push(
      `\n## ${section.title}`,
      ...section.rows.map((row) => {
        const unit = row.unit ? ` ${row.unit}` : '';
        return `${row.label}: ${row.value}${unit}`;
      }),
    );
  }
  return blocks.join('\n');
}

export function calculationMemoToHtml(memo) {
  if (!memo || !Array.isArray(memo.sections)) throw new TypeError('memo debe ser una memoria estructurada.');
  const sections = memo.sections.map((section) => `
    <section data-section="${escapeHtml(section.id)}">
      <h2>${escapeHtml(section.title)}</h2>
      <table>
        <thead><tr><th>Variable</th><th>Valor</th><th>Unidad</th></tr></thead>
        <tbody>${renderHtmlRows(section.rows)}
        </tbody>
      </table>
    </section>`).join('');
  return `<article class="calculation-memo">
    <h1>${escapeHtml(memo.title ?? 'Memoria de cálculo')}</h1>${sections}
  </article>`;
}

export function calculationMemoToCsv(memo) {
  if (!memo || !Array.isArray(memo.sections)) throw new TypeError('memo debe ser una memoria estructurada.');
  const rows = [['section', 'key', 'label', 'value', 'unit']];
  for (const section of memo.sections) {
    for (const row of section.rows) {
      rows.push([section.id, row.key, row.label, row.value, row.unit]);
    }
  }
  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}
