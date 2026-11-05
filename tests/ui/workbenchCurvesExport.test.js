import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderCurvesAndProbes, serializeChartForExport } from '../../src/ui/curvesPanel.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function fixture() {
  return {
    state: {
      rheology: { model: 'newtonian', newtonianViscosityPaS: 0.3 },
      transport: { pipe1: { innerDiameterM: 0.2, velocityMps: 1.3 } },
      energy: { pumpCurve: [], efficiencyCurve: [], npshrCurve: [] },
    },
    results: {
      rheology: {
        profile: {
          radiusM: [0, 0.05, 0.1],
          velocityMps: [1.8, 1.25, 0],
          shearRateS_1: [0, 16, 33],
          shearStressPa: [0, 4.8, 9.9],
          apparentViscosityPaS: [null, 0.3, 0.3],
        },
      },
      pump: {
        status: '</small><script>evil()</script>',
        curves: {
          flowRateM3s: [0.01, 0.02, 0.03],
          systemHeadM: [3, 4, 6],
          pumpHeadM: [10, 8, 5],
        },
        operatingPoint: { flowRateM3s: 0.02, pumpHeadM: 8 },
      },
      transport: { flowRegime: '<img src=x onerror=evil()>' },
    },
    calculate: (candidate) => ({
      transport: {
        flowRateM3s: candidate.transport.pipe1.velocityMps * 0.02,
        requiredPressurePa: 1000 + candidate.transport.pipe1.velocityMps * 2000,
      },
    }),
  };
}

function fakeRoot(buttons = []) {
  const controls = new Map([
    ['#probe-ratio', { value: '0.500', addEventListener: vi.fn() }],
    ['#probe-metrics', { innerHTML: '' }],
    ['#probe-ratio-value', { textContent: '' }],
    ['#probe-export-csv', { addEventListener: vi.fn() }],
  ]);
  return {
    innerHTML: '',
    controls,
    querySelector: (selector) => controls.get(selector) ?? null,
    querySelectorAll: (selector) => selector === '.wb-chart-export' ? buttons : [],
  };
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[character]);
}

function xmlFixture() {
  class Element {
    constructor(name, ownerDocument) {
      this.name = name;
      this.namespaceURI = SVG_NS;
      this.ownerDocument = ownerDocument;
      this.attributes = {};
      this.children = [];
      this.parent = null;
      this.textContent = '';
    }

    setAttribute(key, value) { this.attributes[key] = String(value); }
    get firstChild() { return this.children[0] ?? null; }
    appendChild(child) { return this.insertBefore(child, null); }
    insertBefore(child, reference) {
      const index = reference ? this.children.indexOf(reference) : -1;
      this.children.splice(index < 0 ? this.children.length : index, 0, child);
      child.parent = this;
      return child;
    }
    remove() {
      const index = this.parent?.children.indexOf(this) ?? -1;
      if (index >= 0) this.parent.children.splice(index, 1);
    }
    querySelectorAll(selector) {
      const matches = [];
      for (const child of this.children) {
        if ((child.attributes.class ?? '').split(/\s+/).includes(selector.slice(1))) matches.push(child);
        matches.push(...child.querySelectorAll(selector));
      }
      return matches;
    }
    cloneNode(deep) {
      const copy = new Element(this.name, this.ownerDocument);
      copy.attributes = { ...this.attributes };
      copy.textContent = this.textContent;
      if (deep) this.children.forEach((child) => copy.appendChild(child.cloneNode(true)));
      return copy;
    }
  }

  const ownerDocument = { createElementNS: (_namespace, name) => new Element(name, ownerDocument) };
  const svg = ownerDocument.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 520 230');
  const axis = ownerDocument.createElementNS(SVG_NS, 'line');
  axis.setAttribute('class', 'chart-axis');
  axis.setAttribute('x1', '48');
  axis.setAttribute('y1', '192');
  axis.setAttribute('x2', '504');
  axis.setAttribute('y2', '192');
  svg.appendChild(axis);
  const series = ownerDocument.createElementNS(SVG_NS, 'polyline');
  series.setAttribute('class', 'science-line science-line-1');
  series.setAttribute('points', '48.00,172.00 276.00,90.00 504.00,18.00');
  svg.appendChild(series);
  const point = ownerDocument.createElementNS(SVG_NS, 'circle');
  point.setAttribute('class', 'science-hit-point');
  svg.appendChild(point);
  const axisLabel = ownerDocument.createElementNS(SVG_NS, 'text');
  axisLabel.textContent = 'γ̇ · s⁻¹';
  svg.appendChild(axisLabel);
  vi.stubGlobal('XMLSerializer', class {
    serializeToString(node) {
      const attributes = Object.entries(node.attributes)
        .map(([key, value]) => ` ${key}="${escapeXml(value)}"`).join('');
      return `<${node.name}${attributes}>${escapeXml(node.textContent)}${node.children.map((child) => this.serializeToString(child)).join('')}</${node.name}>`;
    }
  });
  return svg;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Curvas científicas · exportación SVG real', () => {
  it('offers a distinct, keyboard-native download on all four existing chart cards and escapes dynamic text', () => {
    const root = fakeRoot();
    renderCurvesAndProbes(root, fixture());

    const ids = [...root.innerHTML.matchAll(/data-chart-export="([^"]+)"/g)].map((match) => match[1]);
    expect(ids).toEqual(['ley-constitutiva', 'viscosidad-aparente', 'bomba-y-sistema', 'perfil-de-velocidad']);
    expect(root.innerHTML.match(/<svg\s/g)).toHaveLength(4);
    expect(root.innerHTML).toMatch(/<button type="button" class="wb-chart-export"[^>]+>Descargar SVG<\/button>/);
    expect(root.innerHTML).toContain('class="science-hit-point"');
    expect(root.innerHTML).toContain('class="science-line science-line-2"');
    expect(root.innerHTML).toContain('&lt;/small&gt;&lt;script&gt;evil()&lt;/script&gt;');
    expect(root.innerHTML).toContain('&lt;img src=x onerror=evil()&gt;');
    expect(root.innerHTML).not.toContain('<script>evil()');
    expect(root.innerHTML).not.toContain('<img src=x');
    expect(root.innerHTML).toContain('id="probe-export-csv"');
  });

  it('downloads SVG with XML namespace, embedded styles, real axes and curve coordinates', async () => {
    const svg = xmlFixture();
    const xml = serializeChartForExport(svg, 'Curva <ensayo> & medición');
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    expect(xml).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(xml).toContain('viewBox="0 0 520 230"');
    expect(xml).toContain('<title>Curva &lt;ensayo&gt; &amp; medición</title>');
    expect(xml).toContain('class="chart-axis"');
    expect(xml).toContain('points="48.00,172.00 276.00,90.00 504.00,18.00"');
    expect(xml).toContain('.science-line-1 { stroke: #1879d2; }');
    expect(xml).toContain('<rect x="0" y="0" width="520" height="230" fill="#ffffff">');
    expect(xml).not.toContain('science-hit-point');
    expect(xml).not.toContain('<ensayo>');

    const listeners = {};
    const anchor = { click: vi.fn(), href: '', download: '' };
    const blobs = [];
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn((blob) => { blobs.push(blob); return 'blob:curves-export'; }),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal('document', { createElement: vi.fn(() => anchor) });
    const chart = {
      querySelector: (selector) => selector === 'svg' ? svg : { textContent: 'Ley constitutiva' },
    };
    const button = {
      dataset: { chartExport: 'ley-constitutiva' },
      disabled: false,
      closest: () => chart,
      addEventListener: (event, handler) => { listeners[event] = handler; },
    };
    renderCurvesAndProbes(fakeRoot([button]), fixture());
    listeners.click();
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(anchor.download).toBe('pulpa-lab-ley-constitutiva.svg');
    expect(blobs[0].type).toBe('image/svg+xml;charset=utf-8');
    expect(await blobs[0].text()).toContain('class="science-line science-line-1"');
  });

  it('disables the SVG export for a chart without numerical data', () => {
    const input = fixture();
    input.results.rheology.profile = null;
    input.results.pump.curves = null;
    const root = fakeRoot();
    renderCurvesAndProbes(root, input);
    expect(root.innerHTML).toMatch(/data-chart-export="perfil-de-velocidad"[^>]+ disabled/);
    expect(root.innerHTML).toContain('Datos insuficientes.');
  });

  it('keeps the calculated system-curve alternative and radial probes CSV export', async () => {
    const input = fixture();
    input.results.pump.curves = null;
    const root = fakeRoot();
    renderCurvesAndProbes(root, input);
    expect(root.innerHTML).toContain('data-chart-export="curva-del-sistema"');
    expect(root.innerHTML).toContain('class="science-line science-line-1"');
    expect(root.innerHTML).toContain('class="radial-probe-table"');

    const blobs = [];
    const anchor = { click: vi.fn(), download: '' };
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn((blob) => { blobs.push(blob); return 'blob:probes'; }),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal('document', { createElement: vi.fn(() => anchor) });
    const csvHandler = root.controls.get('#probe-export-csv').addEventListener.mock.calls
      .find(([event]) => event === 'click')?.[1];
    expect(csvHandler).toBeTypeOf('function');
    csvHandler();
    expect(anchor.download).toBe('pulpa-lab-sondas.csv');
    expect(await blobs[0].text()).toContain('"radius_m","radius_ratio"');
    expect(await blobs[0].text()).toContain('"0.050000"');
  });
});
