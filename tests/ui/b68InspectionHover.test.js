import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const mainSource = readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');
const runtimeSource = readFileSync(new URL('../../src/babylon/runtime/baseEnvironment.js', import.meta.url), 'utf8');
const cssSource = readFileSync(new URL('../../src/styles.css', import.meta.url), 'utf8');

describe('B68 Inspection hover affordance', () => {
  it('renders a compact tooltip with canonical ID, label and equipment kind', () => {
    expect(mainSource).toContain('id="inspection-hover-tooltip"');
    expect(mainSource).toContain('id="inspection-hover-id"');
    expect(mainSource).toContain('id="inspection-hover-label"');
    expect(mainSource).toContain('id="inspection-hover-kind"');
    expect(mainSource).toMatch(/environment\.setInspectionHoverHandler\?\.\(\(hover\) =>/);
    expect(mainSource).toMatch(/inspectionHoverId\.textContent = hover\.id/);
    expect(mainSource).toMatch(/inspectionHoverLabel\.textContent = hover\.label \|\| hover\.id/);
    expect(mainSource).toMatch(/inspectionHoverKind\.textContent = kindLabels\[hover\.kind\]/);
  });

  it('keeps hover non-interactive and clears it during drag or pointer exit', () => {
    expect(cssSource).toMatch(/\.inspection-hover-tooltip \{[^}]*pointer-events: none;/);
    expect(runtimeSource).toMatch(/if \(pointer\.moved\) \{\s*clearInspectionHover\(\);\s*return;/);
    expect(runtimeSource).toMatch(/pointerleave: \(\) => clearInspectionHover\(\)/);
    expect(runtimeSource).toMatch(/canvas\.style\.cursor = nextId \? 'pointer' : ''/);
  });

  it('continues to route clicks through B67 instead of duplicating selection logic', () => {
    expect(runtimeSource).toMatch(/activateBabylonInspectionPick\(\{[\s\S]*?setTarget: setInspectionTarget,[\s\S]*?onPick: inspectionPickHandler/);
    expect(mainSource).toMatch(/selectInspectionTarget\(id, \{ applyEnvironment: false \}\)/);
  });
});
