import { describe, expect, it } from 'vitest';
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  loadTheme,
  normalizeTheme,
  resetTheme,
  saveTheme,
} from '../../src/ui/theme.js';

function createStorage() {
  const data = new Map();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
}

describe('UI theme', () => {
  it('normalizes only valid six-digit hex colors', () => {
    expect(normalizeTheme({ accent: '#ABCDEF', panel: 'red' })).toEqual({
      ...DEFAULT_THEME,
      accent: '#abcdef',
    });
  });

  it('persists UI appearance independently from simulation state', () => {
    const storage = createStorage();
    saveTheme({ ...DEFAULT_THEME, background: '#121820' }, storage);
    expect(JSON.parse(storage.getItem(THEME_STORAGE_KEY)).background).toBe('#121820');
    expect(loadTheme(storage).background).toBe('#121820');
    resetTheme(storage);
    expect(loadTheme(storage)).toEqual(DEFAULT_THEME);
  });
});
