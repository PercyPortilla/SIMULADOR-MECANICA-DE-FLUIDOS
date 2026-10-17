import { describe, expect, it } from 'vitest';
import { compareAcademicCases } from '../../src/ui/academicComparison.js';
import {
  academicLabReportToHtml,
  buildAcademicLabReportHtml,
  buildAcademicLabReportModel,
  escapeHtml,
  formatLocalDate,
} from '../../src/ui/academicLabReport.js';

describe('academic lab report', () => {
  const fixedDate = new Date(2026, 9, 17, 12, 0, 0);

  it('builds a complete A/B report model from academicComparison output', () => {
    const comparison = compareAcademicCases('newtonian-reference', 'high-solids-bingham');
    const report = buildAcademicLabReportModel(comparison, {
      date: fixedDate,
      hypothesis: 'Una pulpa más resistente requerirá mayor presión.',
    });

    expect(report.title).toContain('PULPA LAB V2');
    expect(report.date).toBe('17/10/2026');
    expect(report.hypothesis).toContain('mayor presión');
    expect(report.cases.A.id).toBe('newtonian-reference');
    expect(report.cases.B.id).toBe('high-solids-bingham');
    expect(report.changedMetrics.some((row) => row.key === 'density')).toBe(true);
    expect(report.changedMetrics.some((row) => row.key === 'pressure')).toBe(true);
    expect(report.changedMetrics.every((row) => Math.abs(row.delta) > 1e-12)).toBe(true);
    expect(report.causalExplanation.some((item) => item.key === 'rheology')).toBe(true);
    expect(report.scope.A.resultQuality).toBeTruthy();
    expect(report.scope.B.resultQuality).toBeTruthy();
    expect(report.conclusion.length).toBeGreaterThan(30);
  });

  it('keeps unchanged metrics out of the changed-metrics section', () => {
    const comparison = compareAcademicCases('newtonian-reference', 'static-head-energy');
    const report = buildAcademicLabReportModel(comparison, { date: fixedDate });
    expect(report.changedMetrics.some((row) => row.key === 'flow')).toBe(false);
    expect(report.changedMetrics.some((row) => row.key === 'pressure')).toBe(true);
    expect(report.causalExplanation.some((item) => item.key === 'length')).toBe(true);
    expect(report.causalExplanation.some((item) => item.key === 'elevation')).toBe(true);
  });

  it('surfaces resultQuality and applicability scope for educational estimates', () => {
    const comparison = compareAcademicCases('herschel-bulkley', 'power-law-scope');
    const report = buildAcademicLabReportModel(comparison, { date: fixedDate });
    expect(report.scope.B.resultQuality).toBe('educational-estimate');
    expect(report.causalExplanation.some((item) => item.key === 'scope')).toBe(true);
    expect(report.conclusion).toMatch(/resultQuality/);
  });

  it('accepts a future lab wrapper without coupling back to academicComparison', () => {
    const comparison = compareAcademicCases('newtonian-reference', 'static-head-energy');
    const report = buildAcademicLabReportModel({
      title: 'Ensayo de carga estática',
      hypothesis: 'Mayor Δz incrementa la carga total.',
      conclusion: 'La hipótesis se conserva dentro del alcance del caso.',
      comparison,
    }, { date: fixedDate });
    expect(report.title).toBe('Ensayo de carga estática');
    expect(report.hypothesis).toContain('Δz');
    expect(report.conclusion).toContain('hipótesis');
  });

  it('escapes all user-provided report text in standalone HTML', () => {
    const comparison = compareAcademicCases('newtonian-reference', 'static-head-energy');
    const html = buildAcademicLabReportHtml({
      comparison,
      title: '<img src=x onerror=alert(1)>',
      hypothesis: '<script>alert("x")</script>',
      conclusion: 'A & B > C',
    }, { date: fixedDate });

    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
    expect(html).toContain('A &amp; B &gt; C');
    expect(html).not.toContain('<script>alert("x")</script>');
  });

  it('is deterministic when the date is injected', () => {
    const comparison = compareAcademicCases('newtonian-reference', 'high-solids-bingham');
    const options = { date: fixedDate, hypothesis: 'Hipótesis controlada.' };
    expect(buildAcademicLabReportHtml(comparison, options)).toBe(buildAcademicLabReportHtml(comparison, options));
  });

  it('formats date locally without network or locale dependencies', () => {
    expect(formatLocalDate(new Date(2026, 0, 5, 8, 30))).toBe('05/01/2026');
    expect(formatLocalDate('2026-10-17')).toBe('17/10/2026');
    expect(() => formatLocalDate('2026-02-30')).toThrow(/Fecha inválida/);
    expect(() => formatLocalDate('not-a-date')).toThrow(/Fecha inválida/);
  });

  it('exposes HTML escaping as a small reusable boundary helper', () => {
    expect(escapeHtml(`<a title="x'y">&</a>`)).toBe('&lt;a title=&quot;x&#39;y&quot;&gt;&amp;&lt;/a&gt;');
  });

  it('renders a printable standalone HTML document from an already-built model', () => {
    const report = buildAcademicLabReportModel(
      compareAcademicCases('newtonian-reference', 'static-head-energy'),
      { date: fixedDate },
    );
    const html = academicLabReportToHtml(report);
    expect(html).toMatch(/^<!doctype html>/);
    expect(html).toContain('@media print');
    expect(html).toContain('Métricas cambiadas y deltas');
    expect(html).toContain('Explicación causal');
    expect(html).toContain('Alcance y calidad del resultado');
    expect(html).toContain('Conclusión');
    expect(html).not.toMatch(/https?:\/\//);
  });
});
