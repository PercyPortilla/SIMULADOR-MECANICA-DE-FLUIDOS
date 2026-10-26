import { describe, expect, it } from 'vitest';
import { RELEASE_INFO } from '../../src/releaseInfo.js';

describe('release metadata', () => {
  it('identifies the B64 release backed by the optimized Blender master', () => {
    expect(RELEASE_INFO.version).toBe('V57/B64');
    expect(RELEASE_INFO.name).toMatch(/Blender V57.*B64 terreno autocontenido/i);
    expect(RELEASE_INFO.date).toBe('2026-10-26');
  });
});
