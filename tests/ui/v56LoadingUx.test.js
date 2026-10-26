import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const mainSource = readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');
const runtimeSource = readFileSync(new URL('../../src/babylon/runtime/baseEnvironment.js', import.meta.url), 'utf8');

describe('B62 V57 authoritative loading UX contract', () => {
  it('labels the initial viewport loader as the final V57/B61 Blender site', () => {
    expect(mainSource).toContain('<strong>Cargando Blender V57 · B61</strong>');
    expect(mainSource).not.toContain('Cargando entorno Blender V56');
  });

  it('keeps legacy visuals disabled while V57 loads and does not reveal a fallback on slow networks', () => {
    expect(runtimeSource).toMatch(/if \(base\.v57SiteVisual\) \{[\s\S]*?setLegacyVisualsEnabled\(false\);[\s\S]*?activeVisualRevision = 'V57-loading'/);
    expect(runtimeSource).not.toContain("activeVisualRevision = 'V30-fallback'");
    expect(mainSource).toContain('El entorno final continúa cargando; no se mostrará una versión anterior.');
    expect(mainSource).toMatch(/window\.setTimeout\(\(\) => resolve\(false\), 12000\)/);
  });
});
