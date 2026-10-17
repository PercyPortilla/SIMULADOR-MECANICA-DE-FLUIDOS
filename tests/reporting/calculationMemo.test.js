import { describe, expect, it } from 'vitest';
import {
  buildCalculationMemo,
  calculationMemoToCsv,
  calculationMemoToHtml,
  calculationMemoToText,
} from '../../src/reporting/calculationMemo.js';

describe('calculation memo', () => {
  it('keeps SI values structured and carries explicit labels/units into every format', () => {
    const memo = buildCalculationMemo({
      title: 'Caso A',
      metadata: { model: 'bingham' },
      inputs: {
        transport: { pipe1: { innerDiameterM: 0.15, velocityMps: 1.5 } },
      },
      results: {
        transport: { pressureDropPa: 26666.6667 },
      },
      assumptions: ['Flujo laminar plenamente desarrollado.'],
      warnings: ['No extrapolar a turbulencia.'],
      dictionary: {
        'transport.pipe1.innerDiameterM': { label: 'Diámetro interno', unit: 'm' },
        'transport.pipe1.velocityMps': { label: 'Velocidad media', unit: 'm/s' },
        'transport.pressureDropPa': { label: 'Caída de presión', unit: 'Pa' },
      },
    });

    const inputSection = memo.sections.find((section) => section.id === 'inputs');
    expect(inputSection.rows).toContainEqual({
      key: 'transport.pipe1.innerDiameterM',
      label: 'Diámetro interno',
      value: '0.15',
      unit: 'm',
    });

    expect(calculationMemoToText(memo)).toContain('Caída de presión: 26666.6667 Pa');
    expect(calculationMemoToHtml(memo)).toContain('<td>m/s</td>');
    expect(calculationMemoToCsv(memo)).toContain('"results","transport.pressureDropPa","Caída de presión","26666.6667","Pa"');
  });

  it('is deterministic and escapes exported HTML/CSV content', () => {
    const input = {
      title: '<Caso "B">',
      inputs: { note: 'A, "B" < C' },
      results: { ok: true },
    };
    const first = buildCalculationMemo(input);
    const second = buildCalculationMemo(input);
    expect(second).toEqual(first);
    expect(calculationMemoToHtml(first)).toContain('&lt;Caso &quot;B&quot;&gt;');
    expect(calculationMemoToHtml(first)).toContain('A, &quot;B&quot; &lt; C');
    expect(calculationMemoToCsv(first)).toContain('"A, ""B"" < C"');
  });

  it('rejects non-finite numerical records', () => {
    expect(() => buildCalculationMemo({
      inputs: { invalid: Number.NaN },
      results: {},
    })).toThrow(/no finitos/);
  });
});
