import { describe, expect, it } from 'vitest';
import { DEFAULT_SCENE_PALETTE, paletteHexToNumbers, normalizeScenePalette } from '../../src/ui/scenePalette.js';

describe('scene palette preferences', () => {
  it('keeps only semantic roles and valid hex colors', () => {
    const palette = normalizeScenePalette({ terrain: '#ABCDEF', fake: '#ffffff', road: 'red' });
    expect(palette.terrain).toBe('#abcdef');
    expect(palette.road).toBe(DEFAULT_SCENE_PALETTE.road);
    expect(palette.fake).toBeUndefined();
  });

  it('converts visual preferences into Three-compatible numeric colors', () => {
    expect(paletteHexToNumbers({ terrain: '#112233' }).terrain).toBe(0x112233);
  });
});
