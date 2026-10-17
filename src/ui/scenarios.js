export const SCENARIO_STORAGE_KEY = 'pulpa-lab-simulation-scenario-v1';
export const SCENARIO_LIBRARY_KEY = 'pulpa-lab-simulation-scenarios-v2';

function clonePhysicalPipe(pipe = {}) {
  const { material: _visualMaterial, ...physicalPipe } = pipe;
  return physicalPipe;
}

export function extractScenario(state) {
  if (!state || typeof state !== 'object') throw new TypeError('extractScenario requiere el estado de simulación.');
  return structuredClone({
    slurry: state.slurry,
    rheology: state.rheology,
    transport: { ...state.transport, pipe1: clonePhysicalPipe(state.transport?.pipe1) },
    energy: state.energy,
    leaching: state.leaching,
    recovery: state.recovery,
    process: state.process,
  });
}

export function saveScenario(state, storage = globalThis.localStorage) {
  const scenario = extractScenario(state);
  storage?.setItem?.(SCENARIO_STORAGE_KEY, JSON.stringify(scenario));
  return scenario;
}

export function loadScenario(storage = globalThis.localStorage) {
  if (!storage?.getItem) return null;
  try {
    const raw = storage.getItem(SCENARIO_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearScenario(storage = globalThis.localStorage) {
  storage?.removeItem?.(SCENARIO_STORAGE_KEY);
}

export function listScenarios(storage = globalThis.localStorage) {
  if (!storage?.getItem) return [];
  try {
    const parsed = JSON.parse(storage.getItem(SCENARIO_LIBRARY_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLibrary(items, storage) {
  storage?.setItem?.(SCENARIO_LIBRARY_KEY, JSON.stringify(items));
  return items;
}

export function saveNamedScenario({ name, state, id = null }, storage = globalThis.localStorage) {
  const cleanName = String(name || '').trim();
  if (!cleanName) throw new RangeError('El escenario necesita un nombre.');
  const items = listScenarios(storage);
  const existingIndex = id ? items.findIndex((item) => item.id === id) : -1;
  const scenario = {
    id: id || `scenario-${Date.now()}-${items.length + 1}`,
    name: cleanName,
    inputs: extractScenario(state),
  };
  if (existingIndex >= 0) items[existingIndex] = scenario;
  else items.push(scenario);
  writeLibrary(items, storage);
  return scenario;
}

export function loadNamedScenario(id, storage = globalThis.localStorage) {
  return listScenarios(storage).find((item) => item.id === id) ?? null;
}

export function deleteNamedScenario(id, storage = globalThis.localStorage) {
  return writeLibrary(listScenarios(storage).filter((item) => item.id !== id), storage);
}

function flatten(value, prefix = '', out = {}) {
  for (const [key, entry] of Object.entries(value ?? {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (Array.isArray(entry)) {
      if (!entry.length) out[path] = '[]';
      else entry.forEach((item, index) => {
        const itemPath = `${path}[${index}]`;
        if (item && typeof item === 'object') flatten(item, itemPath, out);
        else out[itemPath] = item;
      });
    } else if (entry && typeof entry === 'object') flatten(entry, path, out);
    else out[path] = entry;
  }
  return out;
}

export function compareScenarios(left, right) {
  const normalize = (value) => value?.inputs ?? (value?.slurry && value?.transport ? extractScenario(value) : value ?? {});
  const a = flatten(normalize(left));
  const b = flatten(normalize(right));
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
  return keys
    .filter((key) => a[key] !== b[key])
    .map((key) => ({ key, left: a[key], right: b[key] }));
}

export function exportScenarioJson(name, state) {
  return JSON.stringify({ name: String(name || 'Escenario'), inputs: extractScenario(state) }, null, 2);
}

export function exportScenarioCsv(name, state) {
  const rows = [['scenario', String(name || 'Escenario')], ...Object.entries(flatten(extractScenario(state)))];
  const escape = (value) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return rows.map(([key, value]) => `${escape(key)},${escape(value)}`).join('\n');
}
