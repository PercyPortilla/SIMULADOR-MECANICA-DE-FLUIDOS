import { describe, expect, it } from 'vitest';
import { RELEASE_INFO } from '../../src/releaseInfo.js';

describe('release metadata', () => {
  it('identifies the current V25 performance and operational fidelity release', () => {
    expect(RELEASE_INFO.version).toBe('V25');
    expect(RELEASE_INFO.name).toMatch(/Rendimiento y Fidelidad Operacional/i);
    expect(RELEASE_INFO.date).toBe('2026-10-17');
  });
});
