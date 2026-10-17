import { assertFiniteNumber } from '../validation.js';

function clone(value) {
  return structuredClone(value);
}

function parsePath(path) {
  if (typeof path !== 'string' || !path.trim()) {
    throw new TypeError('parameterPath debe ser una ruta no vacía.');
  }
  const parts = path.split('.');
  if (parts.some((part) => !part)) throw new RangeError('parameterPath contiene un segmento vacío.');
  return parts;
}

function setExistingPath(root, path, value) {
  const parts = parsePath(path);
  let cursor = root;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    if (cursor === null || typeof cursor !== 'object' || !(key in cursor)) {
      throw new RangeError(`No existe la ruta de sensibilidad: ${path}.`);
    }
    cursor = cursor[key];
  }
  const last = parts.at(-1);
  if (cursor === null || typeof cursor !== 'object' || !(last in cursor)) {
    throw new RangeError(`No existe la ruta de sensibilidad: ${path}.`);
  }
  cursor[last] = value;
}

export function createLinearSweepValues({ min, max, steps }) {
  assertFiniteNumber(min, 'min');
  assertFiniteNumber(max, 'max');
  if (max < min) throw new RangeError('max debe ser mayor o igual que min.');
  if (!Number.isInteger(steps) || steps < 2) {
    throw new RangeError('steps debe ser un entero mayor o igual que 2.');
  }
  if (min === max) return Array.from({ length: steps }, () => min);
  const span = max - min;
  return Array.from({ length: steps }, (_, index) => (
    min + span * index / (steps - 1)
  ));
}

/**
 * One-at-a-time deterministic sensitivity sweep.
 *
 * Each calculation receives a fresh deep clone of the baseline input. The
 * baseline object itself is never changed, even if a supplied calculator
 * accidentally mutates its argument.
 */
export function runSensitivitySweep({
  baseInput,
  parameterPath,
  values,
  calculate,
  projectResult = (result) => result,
}) {
  if (baseInput === null || typeof baseInput !== 'object') {
    throw new TypeError('baseInput debe ser un objeto.');
  }
  parsePath(parameterPath);
  if (!Array.isArray(values) || values.length === 0) {
    throw new RangeError('values debe contener al menos un valor.');
  }
  values.forEach((value, index) => assertFiniteNumber(value, `values[${index}]`));
  if (typeof calculate !== 'function') throw new TypeError('calculate debe ser una función.');
  if (typeof projectResult !== 'function') throw new TypeError('projectResult debe ser una función.');

  const baseline = clone(baseInput);
  return values.map((parameterValue) => {
    const candidate = clone(baseline);
    setExistingPath(candidate, parameterPath, parameterValue);
    const calculated = calculate(candidate);
    const projected = projectResult(calculated, candidate);
    return {
      parameterPath,
      parameterValue,
      result: clone(projected),
    };
  });
}
