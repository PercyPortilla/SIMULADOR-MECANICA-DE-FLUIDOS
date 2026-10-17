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
  root.innerHTML = `<div class="memo-actions"><button id="memo-pdf" type="button">Exportar PDF</button><button id="memo-csv" type="button">Exportar CSV</button></div><div class="memo-document">${simulationMemoToHtml(memo)}</div>`;
  root.querySelector('#memo-csv')?.addEventListener('click', () => downloadText('pulpa-lab-memoria.csv', simulationMemoToCsv(memo), 'text/csv;charset=utf-8'));
  root.querySelector('#memo-pdf')?.addEventListener('click', () => {
    const win = window.open('', '_blank', 'noopener,noreferrer');
    if (!win) return;
    win.document.open(); win.document.write(simulationMemoToPrintableHtml(memo)); win.document.close();
  });
}
