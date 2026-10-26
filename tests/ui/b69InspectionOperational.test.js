import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const mainSource = readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');
const cssSource = readFileSync(new URL('../../src/styles.css', import.meta.url), 'utf8');

describe('B69 live Inspection operational UI', () => {
  it('renders operational status and rows through the pure metrics adapter', () => {
    expect(mainSource).toContain("import { getInspectionOperationalMetrics } from './ui/inspectionMetrics.js';");
    expect(mainSource).toMatch(/const operational = getInspectionOperationalMetrics\(id, getState\(\), getResults\(\)\);/);
    expect(mainSource).toContain('inspection-operational-status');
    expect(mainSource).not.toContain('function inspectionMetricRows(');
  });

  it('refreshes the selected Inspection card when simulation results change', () => {
    expect(mainSource).toMatch(/subscribeResults\(\(results\) => \{[\s\S]*?refreshInspectionGuide\?\.\(\);/);
    expect(mainSource).toMatch(/refreshInspectionGuide = renderInspectionGuide;/);
  });

  it('adds one concise live metric to the B68 hover tooltip without changing click selection', () => {
    expect(mainSource).toContain('id="inspection-hover-metric"');
    expect(mainSource).toMatch(/const hoverOperational = getInspectionOperationalMetrics\(hover\.id, getState\(\), getResults\(\)\);/);
    expect(mainSource).toMatch(/inspectionHoverMetric\.textContent = hoverOperational\.summary \|\| '';/);
    expect(cssSource).toMatch(/\.inspection-hover-tooltip em \{/);
    expect(mainSource).toMatch(/selectInspectionTarget\(id, \{ applyEnvironment: false \}\)/);
  });
});
