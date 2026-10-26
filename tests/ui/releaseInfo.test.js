import { describe, expect, it } from 'vitest';
import { RELEASE_INFO } from '../../src/releaseInfo.js';

describe('release metadata', () => {
  it('identifies the B62 production release backed by Blender V57/B61', () => {
    expect(RELEASE_INFO.version).toBe('V57/B62');
    expect(RELEASE_INFO.name).toMatch(/Blender V57.*B61.*sin fallback legado/i);
    expect(RELEASE_INFO.date).toBe('2026-10-26');
  });
});
