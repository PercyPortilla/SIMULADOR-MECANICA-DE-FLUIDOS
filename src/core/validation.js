export function assertFiniteNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} debe ser un número finito.`);
  }
}

export function assertPositiveNumber(value, name) {
  assertFiniteNumber(value, name);
  if (value <= 0) throw new RangeError(`${name} debe ser mayor que cero.`);
}

export function assertFraction(value, name) {
  assertFiniteNumber(value, name);
  if (value < 0 || value > 1) {
    throw new RangeError(`${name} debe estar entre 0 y 1.`);
  }
}

export function assertNonNegativeNumber(value, name) {
  assertFiniteNumber(value, name);
  if (value < 0) throw new RangeError(`${name} no puede ser negativo.`);
}
