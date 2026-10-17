import { describe, expect, it } from 'vitest';
import { RELEASE_INFO } from '../../src/releaseInfo.js';

describe('release metadata', () => {
  it('identifies the current V24 operation and industrial realism release', () => {
    expect(RELEASE_INFO.version).toBe('V24');
    expect(RELEASE_INFO.name).toMatch(/Operación y Realismo Industrial/i);
    expect(RELEASE_INFO.date).toBe('2026-10-17');
  });
});
