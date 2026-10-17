import { describe, expect, it } from 'vitest';
import { RELEASE_INFO } from '../../src/releaseInfo.js';

describe('release metadata', () => {
  it('identifies the current V22 visual hardening release', () => {
    expect(RELEASE_INFO.version).toBe('V22');
    expect(RELEASE_INFO.name).toMatch(/Realismo industrial/i);
    expect(RELEASE_INFO.date).toBe('2026-10-17');
  });
});
