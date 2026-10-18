import { describe, expect, it } from 'vitest';
import { RELEASE_INFO } from '../../src/releaseInfo.js';

describe('release metadata', () => {
  it('identifies the current V30 final polish and presentation release', () => {
    expect(RELEASE_INFO.version).toBe('V30');
    expect(RELEASE_INFO.name).toMatch(/Pulido Final, Inspección y Presentación/i);
    expect(RELEASE_INFO.date).toBe('2026-10-17');
  });
});
