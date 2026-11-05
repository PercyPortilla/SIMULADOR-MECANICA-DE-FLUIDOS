import { describe, expect, it } from 'vitest';
import { escapeHtml } from '../../src/ui/safeHtml.js';

describe('standard workspace UI review safety', () => {
  it('escapes scenario names and table values before HTML interpolation', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>'))
      .toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(escapeHtml('A & B "test"')).toBe('A &amp; B &quot;test&quot;');
    expect(escapeHtml("' or 1=1")).toBe('&#39; or 1=1');
  });

  it('returns safe text for absent and numeric values', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(0)).toBe('0');
    expect(escapeHtml(-17.25)).toBe('-17.25');
  });
});
