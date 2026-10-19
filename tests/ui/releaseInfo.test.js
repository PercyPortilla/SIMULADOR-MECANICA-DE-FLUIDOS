import { describe, expect, it } from 'vitest';
import { RELEASE_INFO } from '../../src/releaseInfo.js';

describe('release metadata', () => {
  it('identifies the current V57 industrial presentation release', () => {
    expect(RELEASE_INFO.version).toBe('V57');
    expect(RELEASE_INFO.name).toMatch(/Acabado industrial de planta V57 \+ Interfaz Universitaria/i);
    expect(RELEASE_INFO.date).toBe('2026-10-19');
  });
});
