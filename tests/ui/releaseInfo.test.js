import { describe, expect, it } from 'vitest';
import { RELEASE_INFO } from '../../src/releaseInfo.js';

describe('release metadata', () => {
  it('identifies the B63 release backed by the optimized Blender master', () => {
    expect(RELEASE_INFO.version).toBe('V57/B63');
    expect(RELEASE_INFO.name).toMatch(/Blender V57.*B63 optimizado/i);
    expect(RELEASE_INFO.date).toBe('2026-10-26');
  });
});
