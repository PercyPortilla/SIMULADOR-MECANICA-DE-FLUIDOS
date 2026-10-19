import { describe, expect, it } from 'vitest';
import { RELEASE_INFO } from '../../src/releaseInfo.js';

describe('release metadata', () => {
  it('identifies the current V56 Blender/university interface release', () => {
    expect(RELEASE_INFO.version).toBe('V56');
    expect(RELEASE_INFO.name).toMatch(/Entorno Blender V56 \+ Interfaz Universitaria/i);
    expect(RELEASE_INFO.date).toBe('2026-10-19');
  });
});
