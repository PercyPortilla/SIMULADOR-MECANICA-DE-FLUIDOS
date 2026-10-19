import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const mainSource = readFileSync(new URL('../../src/main.js', import.meta.url), 'utf8');
const runtimeSource = readFileSync(new URL('../../src/babylon/runtime/baseEnvironment.js', import.meta.url), 'utf8');

describe('V56 loading UX contract', () => {
  it('labels the initial viewport loader as V56 instead of the retired V50 visual', () => {
    expect(mainSource).toContain('<strong>Cargando entorno Blender V56</strong>');
    expect(mainSource).not.toContain('<strong>Cargando entorno Blender V50</strong>');
  });

  it('keeps the lightweight scene visible while V56 loads and releases the overlay on slow networks', () => {
    expect(runtimeSource).toMatch(/if \(base\.v50SiteVisual\) \{[\s\S]*?setLegacyVisualsEnabled\(true\);[\s\S]*?activeVisualRevision = 'V56-loading'/);
    expect(mainSource).toContain('V56 continúa cargando en segundo plano…');
    expect(mainSource).toMatch(/window\.setTimeout\(\(\) => resolve\(false\), 12000\)/);
  });
});
