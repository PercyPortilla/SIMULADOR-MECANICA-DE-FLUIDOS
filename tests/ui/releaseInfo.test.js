import { describe, expect, it } from 'vitest';
import { RELEASE_INFO } from '../../src/releaseInfo.js';

describe('release metadata', () => {
  it('identifies the current V50 Blender/circuit release', () => {
    expect(RELEASE_INFO.version).toBe('V50');
    expect(RELEASE_INFO.name).toMatch(/Entorno Blender V48 \+ Circuito Corregido/i);
    expect(RELEASE_INFO.date).toBe('2026-10-18');
  });
});
