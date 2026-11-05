import {
  buildSimulationMemo,
  simulationMemoToCsv,
  simulationMemoToHtml,
  simulationMemoToPrintableHtml,
} from '../reporting/simulationMemo.js';

function downloadText(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function renderMemoryPanel(root, { state, results, scenarioName = 'Escenario actual' }) {
  if (!root) return;
  const memo = buildSimulationMemo({ state, results, scenarioName });
  root.innerHTML = `<div class="memo-toolbar"><div><span>EXPORTACIÓN TÉCNICA</span><strong>Entradas · ecuaciones · supuestos · resultados</strong></div><div class="memo-actions"><button id="memo-pdf" type="button">Imprimir / guardar PDF</button><button id="memo-csv" type="button">Exportar tabla CSV</button></div></div><p id="memo-export-status" class="memo-export-status" role="status" aria-live="polite"></p><div class="memo-document">${simulationMemoToHtml(memo)}</div>`;
  root.querySelector('#memo-csv')?.addEventListener('click', () => downloadText('pulpa-lab-memoria.csv', simulationMemoToCsv(memo), 'text/csv;charset=utf-8'));
  root.querySelector('#memo-pdf')?.addEventListener('click', () => {
    const printable = simulationMemoToPrintableHtml(memo);
    // `noopener` in window.open features returns null in modern browsers;
    // detach opener only after obtaining a writable window reference.
    const win = window.open('', '_blank');
    if (!win) {
      downloadText('pulpa-lab-memoria-imprimible.html', printable, 'text/html;charset=utf-8');
      root.querySelector('#memo-export-status').textContent = 'El navegador bloqueó la ventana; se descargó el informe HTML listo para imprimir o guardar como PDF.';
      return;
    }
    win.opener = null;
    win.document.open();
    win.document.write(printable);
    win.document.close();
    root.querySelector('#memo-export-status').textContent = 'Informe abierto para imprimir o guardar como PDF desde el navegador.';
    win.focus();
  });
}
