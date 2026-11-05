// Builds a complete candidate snapshot without mutating the active simulation.
// updateState(candidate) performs its existing shape/physics validation and
// commits atomically. This prevents losing active data on bad saved scenarios.
const plain = (value) => value !== null && typeof value === 'object'
  && !Array.isArray(value);

export function prepareScenarioState(initial, storedInputs) {
  if (!plain(initial) || !plain(storedInputs)) {
    throw new TypeError('La biblioteca contiene entradas de escenario inválidas.');
  }
  const merge = (base, patch, prefix) => {
    const result = structuredClone(base);
    for (const [key, value] of Object.entries(patch)) {
      if (!Object.hasOwn(base, key)) {
        throw new TypeError(`${prefix}.${key} no pertenece al estado definido.`);
      }
      result[key] = plain(value) && plain(base[key])
        ? merge(base[key], value, `${prefix}.${key}`)
        : structuredClone(value);
    }
    return result;
  };
  return merge(initial, storedInputs, 'simulationState');
}
