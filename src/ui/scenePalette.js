export const SCENE_PALETTE_STORAGE_KEY = 'pulpa-lab-scene-palette-v1';

export const DEFAULT_SCENE_PALETTE = Object.freeze({
  terrain: '#c8b28f',
  road: '#857766',
  concrete: '#969994',
  structuralSteel: '#768589',
  processSteel: '#9ca8a8',
  pipeSteel: '#638c9c',
  pipeHdpe: '#30383b',
  safetyYellow: '#d5a51e',
  mineral: '#84664b',
  vehicleYellow: '#d49a1e',
});

const LEGACY_DEFAULT_SCENE_PALETTE = Object.freeze({
  terrain: '#806b52',
  road: '#5b5145',
  concrete: '#969994',
  structuralSteel: '#768589',
  processSteel: '#9ca8a8',
  pipeSteel: '#638c9c',
  pipeHdpe: '#30383b',
  safetyYellow: '#d5a51e',
  mineral: '#695540',
  vehicleYellow: '#d49a1e',
});

function validHex(value) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

export function normalizeScenePalette(candidate = {}) {
  return Object.fromEntries(Object.entries(DEFAULT_SCENE_PALETTE).map(([role, fallback]) => [
    role,
    validHex(candidate?.[role]) ? candidate[role].toLowerCase() : fallback,
  ]));
}

export function paletteHexToNumbers(candidate = {}) {
  const palette = normalizeScenePalette(candidate);
  return Object.fromEntries(Object.entries(palette).map(([role, value]) => [role, Number.parseInt(value.slice(1), 16)]));
}

export function loadScenePalette(storage = globalThis.localStorage) {
  try {
    const raw = storage?.getItem?.(SCENE_PALETTE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SCENE_PALETTE };
    const parsed = JSON.parse(raw);
    const isUntouchedLegacyDefault = Object.entries(LEGACY_DEFAULT_SCENE_PALETTE)
      .every(([role, value]) => String(parsed?.[role] ?? '').toLowerCase() === value);
    return isUntouchedLegacyDefault ? { ...DEFAULT_SCENE_PALETTE } : normalizeScenePalette(parsed);
  } catch {
    return { ...DEFAULT_SCENE_PALETTE };
  }
}

export function saveScenePalette(candidate, storage = globalThis.localStorage) {
  const palette = normalizeScenePalette(candidate);
  storage?.setItem?.(SCENE_PALETTE_STORAGE_KEY, JSON.stringify(palette));
  return palette;
}

export function resetScenePalette(storage = globalThis.localStorage) {
  storage?.removeItem?.(SCENE_PALETTE_STORAGE_KEY);
  return { ...DEFAULT_SCENE_PALETTE };
}
