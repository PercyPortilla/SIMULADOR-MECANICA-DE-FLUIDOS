export const DEFAULT_THEME = Object.freeze({
  accent: '#d6a15f',
  background: '#0b1117',
  panel: '#101b22',
  text: '#e8eef2',
});

export const THEME_STORAGE_KEY = 'pulpa-lab-ui-theme-v1';

function isHexColor(value) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

export function normalizeTheme(candidate = {}) {
  const source = candidate && typeof candidate === 'object' ? candidate : {};
  return Object.freeze(Object.fromEntries(
    Object.entries(DEFAULT_THEME).map(([key, fallback]) => [
      key,
      isHexColor(source[key]) ? source[key].toLowerCase() : fallback,
    ]),
  ));
}

export function applyTheme(candidate, root = globalThis.document?.documentElement) {
  const theme = normalizeTheme(candidate);
  if (!root?.style?.setProperty) return theme;
  root.style.setProperty('--ui-accent', theme.accent);
  root.style.setProperty('--ui-accent-strong', theme.accent);
  root.style.setProperty('--ui-bg', theme.background);
  root.style.setProperty('--ui-panel', theme.panel);
  root.style.setProperty('--ui-input', theme.background);
  root.style.setProperty('--ui-panel-soft', theme.panel);
  root.style.setProperty('--ui-text', theme.text);
  return theme;
}

export function loadTheme(storage = globalThis.localStorage) {
  if (!storage?.getItem) return DEFAULT_THEME;
  try {
    const raw = storage.getItem(THEME_STORAGE_KEY);
    return raw ? normalizeTheme(JSON.parse(raw)) : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function saveTheme(candidate, storage = globalThis.localStorage) {
  const theme = normalizeTheme(candidate);
  if (storage?.setItem) storage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
  return theme;
}

export function resetTheme(storage = globalThis.localStorage) {
  if (storage?.removeItem) storage.removeItem(THEME_STORAGE_KEY);
  return DEFAULT_THEME;
}
