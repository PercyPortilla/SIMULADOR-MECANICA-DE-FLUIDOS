import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderMemoryPanel } from '../../src/ui/memoryPanel.js';

function fixture() {
  return {
    state: {
      slurry: { solidsMassFraction: 0.35, solidDensityKgM3: 4200, liquidDensityKgM3: 1000 },
      rheology: { model: 'hb' },
      transport: { pipe1: { innerDiameterM: 0.15, lengthM: 100, velocityMps: 1.5, elevationChangeM: 0 } },
      energy: { pumpEfficiency: 0.75, motorEfficiency: 1 },
      leaching: { firstOrderRateConstantPerH: 0.1 },
    },
    results: {
      slurry: { densityKgM3: 1363.636 },
      transport: {
        flowRateM3s: 0.0265,
        distributedPressureDropPa: 89614,
        minorLossPressurePa: 3682,
        staticPressurePa: 0,
        pressureDropPa: 93296,
        requiredPressurePa: 93296,
        calculationMode: 'non-newtonian-dodge-metzner-estimate',
        resultQuality: 'educational-estimate',
        flowRegime: 'turbulent',
        settling: { note: 'Sedimentación orientativa.' },
      },
      rheology: { wallStressPa: 33.605, fanningFrictionFactor: 0.02 },
      energy: { electricalPowerW: 3300, annualEnergyKwh: 26400 },
    },
  };
}

function fakeRoot() {
  const clicks = new Map();
  const status = { textContent: '' };
  const root = {
    innerHTML: '',
    querySelector(selector) {
      if (selector === '#memo-export-status') return status;
      return {
        addEventListener(event, handler) {
          if (event === 'click') clicks.set(selector, handler);
        },
      };
    },
  };
  return { root, clicks, status };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Memoria · escritorio científico', () => {
  it('renders all source sections as a readable indexed dossier without replacing numeric values', () => {
    const { root, clicks } = fakeRoot();
    renderMemoryPanel(root, { ...fixture(), scenarioName: '<Caso A & B>' });

    expect(root.innerHTML).toContain('wb-memory-layout');
    expect(root.innerHTML).toContain('wb-memory-metadata-grid');
    expect(root.innerHTML).toContain('wb-memory-table');
    expect(root.innerHTML).toContain('wb-memory-note-list');
    expect(root.innerHTML).toContain('href="#wb-memory-equations"');
    expect(root.innerHTML).toContain('id="wb-memory-equations"');
    expect(root.innerHTML).toContain('Sustitución presión');
    expect(root.innerHTML).toContain('93296');
    expect(root.innerHTML).toContain('Estimación educativa');
    expect(root.innerHTML).toContain('Sedimentación orientativa.');
    expect(root.innerHTML).toContain('&lt;Caso A &amp; B&gt;');
    expect(root.innerHTML).not.toContain('<Caso A & B>');
    expect(clicks.has('#memo-pdf')).toBe(true);
    expect(clicks.has('#memo-html')).toBe(true);
    expect(clicks.has('#memo-csv')).toBe(true);
  });

  it('preserves CSV and printable HTML exports, including automatic print for the PDF action', async () => {
    const { root, clicks, status } = fakeRoot();
    const downloads = [];
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn((blob) => { downloads.push(blob); return 'blob:memory-test'; }),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal('document', { createElement: vi.fn(() => ({ click: vi.fn() })) });

    const written = [];
    const printWindow = {
      opener: 'original',
      document: { open: vi.fn(), write: (value) => written.push(value), close: vi.fn() },
      focus: vi.fn(),
    };
    vi.stubGlobal('window', { open: vi.fn(() => printWindow) });
    renderMemoryPanel(root, { ...fixture(), scenarioName: '</title><script>unsafe()</script>' });

    clicks.get('#memo-csv')();
    expect(await downloads[0].text()).toContain('"equations","sub.dp","Sustitución presión"');
    expect(status.textContent).toContain('CSV');

    clicks.get('#memo-html')();
    const html = await downloads[1].text();
    expect(html).toContain('Memoria técnica reproducible');
    expect(html).not.toContain('window.print()');
    expect(html).not.toContain('</title><script>unsafe()</script>');

    clicks.get('#memo-pdf')();
    expect(written[0]).toContain('window.print()');
    expect(written[0]).toContain('&lt;/title&gt;&lt;script&gt;unsafe()&lt;/script&gt;');
    expect(printWindow.opener).toBe(null);
    expect(printWindow.focus).toHaveBeenCalledOnce();
    expect(status.textContent).toContain('PDF');
  });

  it('downloads a non-autoprinting HTML when the print popup is blocked', async () => {
    const { root, clicks, status } = fakeRoot();
    const downloads = [];
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn((blob) => { downloads.push(blob); return 'blob:fallback'; }),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal('document', { createElement: vi.fn(() => ({ click: vi.fn() })) });
    vi.stubGlobal('window', { open: vi.fn(() => null) });
    renderMemoryPanel(root, { ...fixture() });

    clicks.get('#memo-pdf')();
    expect(downloads).toHaveLength(1);
    expect(await downloads[0].text()).toContain('<!doctype html>');
    expect(await downloads[0].text()).not.toContain('window.print()');
    expect(status.textContent).toContain('bloqueó');
  });
});
