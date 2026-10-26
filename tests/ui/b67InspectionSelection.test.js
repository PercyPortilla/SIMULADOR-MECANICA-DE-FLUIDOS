import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const mainSource = readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');

describe('B67 Inspection selector regression', () => {
  it('keeps the existing selector as fallback through the shared selection flow', () => {
    expect(mainSource).toMatch(
      /const selectInspectionTarget = \(id, \{ applyEnvironment = true, smoothCamera = false \} = \{\}\) =>/,
    );
    expect(mainSource).toMatch(
      /inspectionTarget\?\.addEventListener\('change', \(\) => selectInspectionTarget\(inspectionTarget\.value\)\);/,
    );
    expect(mainSource).toMatch(
      /if \(applyEnvironment\) \{\s*environment\.setInspectionTarget\(selectedId \|\| null, \{ smooth: smoothCamera \}\);\s*\}/,
    );
  });

  it('routes 3D clicks through the same UI selection flow without applying Inspection twice', () => {
    expect(mainSource).toMatch(
      /environment\.setInspectionPickHandler\?\.\(\(id\) => \{[\s\S]*?selectInspectionTarget\(id, \{ applyEnvironment: false \}\);[\s\S]*?\}\);/,
    );
  });
});
