import { describe, expect, it } from 'vitest';
import { RELEASE_INFO } from '../../src/releaseInfo.js';

describe('release metadata', () => {
  it('identifies the B65 solver release while preserving the B64 Blender visual', () => {
    expect(RELEASE_INFO.version).toBe('V57/B65');
    expect(RELEASE_INFO.name).toMatch(/B65 hidráulica NN coherente.*Blender B64/i);
    expect(RELEASE_INFO.date).toBe('2026-10-26');
  });
});
