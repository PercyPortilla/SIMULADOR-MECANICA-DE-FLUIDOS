function assertFiniteArray(values, name) {
  if (!Array.isArray(values) || values.length === 0) {
    throw new RangeError(`${name} debe contener al menos un valor.`);
  }
  values.forEach((value, index) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new TypeError(`${name}[${index}] debe ser un número finito.`);
    }
  });
}

function normalizePadding(padding = {}) {
  const normalized = {
    left: padding.left ?? 0,
    right: padding.right ?? 0,
    top: padding.top ?? 0,
    bottom: padding.bottom ?? 0,
  };
  for (const [key, value] of Object.entries(normalized)) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new RangeError(`padding.${key} debe ser un número finito no negativo.`);
    }
  }
  return normalized;
}

function resolveDomain(values, domain, name) {
  if (domain !== undefined) {
    if (
      !Array.isArray(domain)
      || domain.length !== 2
      || domain.some((value) => typeof value !== 'number' || !Number.isFinite(value))
      || domain[1] < domain[0]
    ) {
      throw new RangeError(`${name} debe ser [mínimo, máximo] con números finitos.`);
    }
    return [...domain];
  }
  return [Math.min(...values), Math.max(...values)];
}

function scale(value, [min, max], start, span, invert = false) {
  if (max === min) return start + span / 2;
  const ratio = (value - min) / (max - min);
  return invert ? start + (1 - ratio) * span : start + ratio * span;
}

export function createNumericSeries(xValues, yValues) {
  assertFiniteArray(xValues, 'xValues');
  assertFiniteArray(yValues, 'yValues');
  if (xValues.length !== yValues.length) {
    throw new RangeError('xValues y yValues deben tener la misma longitud.');
  }
  return xValues.map((x, index) => ({ x, y: yValues[index] }));
}

/**
 * Pure SVG geometry helper. It returns a polyline point string and the
 * resolved domains, without touching the DOM or simulation state.
 */
export function seriesToSvgPolyline(series, {
  width,
  height,
  padding,
  xDomain,
  yDomain,
  decimals = 2,
} = {}) {
  if (!Array.isArray(series) || series.length === 0) {
    throw new RangeError('series debe contener al menos un punto.');
  }
  if (typeof width !== 'number' || !Number.isFinite(width) || width <= 0) {
    throw new RangeError('width debe ser mayor que cero.');
  }
  if (typeof height !== 'number' || !Number.isFinite(height) || height <= 0) {
    throw new RangeError('height debe ser mayor que cero.');
  }
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 12) {
    throw new RangeError('decimals debe ser un entero entre 0 y 12.');
  }

  const xValues = series.map((point, index) => {
    if (!point || typeof point.x !== 'number' || !Number.isFinite(point.x)) {
      throw new TypeError(`series[${index}].x debe ser un número finito.`);
    }
    return point.x;
  });
  const yValues = series.map((point, index) => {
    if (!point || typeof point.y !== 'number' || !Number.isFinite(point.y)) {
      throw new TypeError(`series[${index}].y debe ser un número finito.`);
    }
    return point.y;
  });
  const resolvedXDomain = resolveDomain(xValues, xDomain, 'xDomain');
  const resolvedYDomain = resolveDomain(yValues, yDomain, 'yDomain');
  const inset = normalizePadding(padding);
  const chartWidth = width - inset.left - inset.right;
  const chartHeight = height - inset.top - inset.bottom;
  if (chartWidth <= 0 || chartHeight <= 0) {
    throw new RangeError('El padding debe dejar un área de gráfico positiva.');
  }

  const points = series.map((point) => {
    const x = scale(point.x, resolvedXDomain, inset.left, chartWidth);
    const y = scale(point.y, resolvedYDomain, inset.top, chartHeight, true);
    return `${x.toFixed(decimals)},${y.toFixed(decimals)}`;
  }).join(' ');

  return {
    points,
    xDomain: resolvedXDomain,
    yDomain: resolvedYDomain,
  };
}
