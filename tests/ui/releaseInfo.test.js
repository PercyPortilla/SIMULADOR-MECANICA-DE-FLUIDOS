import { describe, expect, it } from 'vitest';
import { RELEASE_INFO } from '../../src/releaseInfo.js';

describe('release metadata', () => {
  it('identifies the current V23 industrial-detail release', () => {
    expect(RELEASE_INFO.version).toBe('V23');
    expect(RELEASE_INFO.name).toMatch(/Detalle industrial/i);
    expect(RELEASE_INFO.date).toBe('2026-10-17');
  });
});
