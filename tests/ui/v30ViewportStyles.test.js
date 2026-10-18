import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../src/styles.css', import.meta.url), 'utf8');

describe('V30 viewport overlay readability', () => {
  it('keeps viewport overlays opaque enough without GPU backdrop blur', () => {
    expect(css).not.toMatch(/backdrop-filter\s*:/i);
    expect(css).toMatch(/\.inspection-guide\s*\{[^}]*max-height:\s*46%/s);
    expect(css).toMatch(/@media\s*\(max-width:\s*520px\)[\s\S]*?\.inspection-guide\.presentation-summary\s*\{[^}]*max-height:\s*44%/s);
  });
});
