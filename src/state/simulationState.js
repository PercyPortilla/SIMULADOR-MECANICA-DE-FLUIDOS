/**
 * Estado central de PULPA LAB V2.
 *
 * Unidades internas:
 * - Fracciones másicas: adimensionales, en el intervalo [0, 1].
 * - Densidad: kg/m³.
 * - Esfuerzo: Pa.
 * - Índice de consistencia: Pa·s^n.
 * - Índice de flujo: adimensional.
 * - Viscosidad dinámica: Pa·s.
 * - Longitud, diámetro y rugosidad: m.
 * - Velocidad: m/s.
 */

const initialState = {
  study: {},
  slurry: {
    solidsMassFraction: 0,
    solidDensityKgM3: 0,
    liquidDensityKgM3: 0,
    referenceSolidsMassFraction: 0.35,
    temperatureC: 25,
    referenceTemperatureC: 25,
    d50M: 0,
    d80M: 0,
  },
  rheology: {
    model: '',
    yieldStressPa: 0,
    consistencyIndex: 0,
    flowIndex: 0,
    plasticViscosityPaS: 0,
    newtonianViscosityPaS: 0,
    cassonViscosityPaS: 0,
    concentrationExponent: 0,
    empiricalScalingEnabled: false,
    betaTemperaturePerC: 0,
    betaPhPerUnit: 0,
    betaConcentrationPerGL: 0,
  },
  transport: {
    pipe1: {
      innerDiameterM: 0,
      lengthM: 0,
      roughnessM: 0,
      material: '',
      velocityMps: 0,
      minorLossCoefficient: 0,
      elevationChangeM: 0,
      accessories: {
        valvesCount: 0,
        valveK: 0.2,
        elbowsCount: 0,
        elbowK: 0.9,
        teesCount: 0,
        teeK: 1.8,
        reducersCount: 0,
        reducerK: 0.4,
        otherK: 0,
      },
    },
    segments: [],
    settlingFactorFl: 1.34,
  },
  energy: {
    pumpEfficiency: 0,
    motorEfficiency: 0,
    operatingHoursPerYear: 0,
    electricityPricePerKwh: 0,
    pumpCurve: [],
    efficiencyCurve: [],
    npshrCurve: [],
    suctionAbsolutePressurePa: 101325,
    vaporPressurePa: 3169,
    suctionVelocityMps: 0,
    suctionElevationHeadM: 0,
    suctionHeadLossM: 0,
  },
  leaching: {
    kineticModel: '',
    totalUsefulVolumeM3: 0,
    reactorCount: 4,
    firstOrderRateConstantPerH: 0,
    temperatureC: 25,
    ph: 2,
    freeCyanideGL: 0,
    dissolvedOxygenMgL: 0,
    feedGradeGL: 0,
    referenceTemperatureC: 25,
    referencePh: 2,
    referenceGradeGL: 0,
    referenceCyanideGL: 0,
    referenceOxygenMgL: 0,
    coupleTemperature: false,
    couplePh: false,
    coupleCyanide: false,
    coupleOxygen: false,
    betaTemperaturePerC: 0,
    betaPhPerUnit: 0,
    betaCyanidePerGL: 0,
    betaOxygenPerMgL: 0,
  },
  recovery: {
    model: '',
    feedGoldKgH: 0,
    adsorptionEfficiency: 0,
    elutionEfficiency: 0,
    electrowinningEfficiency: 0,
    smeltingEfficiency: 0,
  },
  process: {
    tankDischargeM3h: 0,
    tankVolumeM3: 0,
    balanceToleranceFraction: 0.05,
  },
};

let state = clone(initialState);
const listeners = new Set();

export function getState() {
  return clone(state);
}

export function getInitialState() {
  return clone(initialState);
}

export function updateState(patch) {
  assertPlainObject(patch, 'updateState');
  assertKnownShape(patch, initialState, 'simulationState');

  const nextState = merge(state, patch);
  validateState(nextState);
  state = nextState;

  const snapshot = getState();
  listeners.forEach((listener) => listener(snapshot));
  return snapshot;
}

export function subscribe(listener) {
  if (typeof listener !== 'function') {
    throw new TypeError('subscribe requiere una función.');
  }

  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function resetState() {
  state = clone(initialState);

  const snapshot = getState();
  listeners.forEach((listener) => listener(snapshot));
  return snapshot;
}

function validateState(candidate) {
  assertFraction(candidate.slurry.solidsMassFraction, 'slurry.solidsMassFraction');
  assertNonNegativeFinite(candidate.slurry.solidDensityKgM3, 'slurry.solidDensityKgM3');
  assertNonNegativeFinite(candidate.slurry.liquidDensityKgM3, 'slurry.liquidDensityKgM3');
  assertFraction(candidate.slurry.referenceSolidsMassFraction, 'slurry.referenceSolidsMassFraction');
  assertFiniteNumber(candidate.slurry.temperatureC, 'slurry.temperatureC');
  assertFiniteNumber(candidate.slurry.referenceTemperatureC, 'slurry.referenceTemperatureC');
  assertNonNegativeFinite(candidate.slurry.d50M, 'slurry.d50M');
  assertNonNegativeFinite(candidate.slurry.d80M, 'slurry.d80M');

  assertString(candidate.rheology.model, 'rheology.model');
  if (!['', 'newtonian', 'hb', 'bingham', 'power', 'casson'].includes(candidate.rheology.model)) {
    throw new RangeError('rheology.model debe ser "", "newtonian", "hb", "bingham", "power" o "casson".');
  }
  assertNonNegativeFinite(candidate.rheology.yieldStressPa, 'rheology.yieldStressPa');
  assertNonNegativeFinite(candidate.rheology.consistencyIndex, 'rheology.consistencyIndex');
  assertNonNegativeFinite(candidate.rheology.flowIndex, 'rheology.flowIndex');
  assertNonNegativeFinite(candidate.rheology.plasticViscosityPaS, 'rheology.plasticViscosityPaS');
  assertNonNegativeFinite(
    candidate.rheology.newtonianViscosityPaS,
    'rheology.newtonianViscosityPaS',
  );
  assertNonNegativeFinite(candidate.rheology.cassonViscosityPaS, 'rheology.cassonViscosityPaS');
  assertNonNegativeFinite(candidate.rheology.concentrationExponent, 'rheology.concentrationExponent');
  assertBoolean(candidate.rheology.empiricalScalingEnabled, 'rheology.empiricalScalingEnabled');
  assertFiniteNumber(candidate.rheology.betaTemperaturePerC, 'rheology.betaTemperaturePerC');
  assertFiniteNumber(candidate.rheology.betaPhPerUnit, 'rheology.betaPhPerUnit');
  assertFiniteNumber(candidate.rheology.betaConcentrationPerGL, 'rheology.betaConcentrationPerGL');

  const pipe = candidate.transport.pipe1;
  assertNonNegativeFinite(pipe.innerDiameterM, 'transport.pipe1.innerDiameterM');
  assertNonNegativeFinite(pipe.lengthM, 'transport.pipe1.lengthM');
  assertNonNegativeFinite(pipe.roughnessM, 'transport.pipe1.roughnessM');
  assertString(pipe.material, 'transport.pipe1.material');
  assertNonNegativeFinite(pipe.velocityMps, 'transport.pipe1.velocityMps');
  assertNonNegativeFinite(pipe.minorLossCoefficient, 'transport.pipe1.minorLossCoefficient');
  assertFiniteNumber(pipe.elevationChangeM, 'transport.pipe1.elevationChangeM');
  validateAccessories(pipe.accessories, 'transport.pipe1.accessories');
  if (!Array.isArray(candidate.transport.segments)) throw new TypeError('transport.segments debe ser un arreglo.');
  candidate.transport.segments.forEach((segment, index) => validateTransportSegment(segment, `transport.segments[${index}]`));
  assertNonNegativeFinite(candidate.transport.settlingFactorFl, 'transport.settlingFactorFl');

  assertFractionOrUnset(candidate.energy.pumpEfficiency, 'energy.pumpEfficiency');
  assertFractionOrUnset(candidate.energy.motorEfficiency, 'energy.motorEfficiency');
  assertNonNegativeFinite(candidate.energy.operatingHoursPerYear, 'energy.operatingHoursPerYear');
  assertNonNegativeFinite(candidate.energy.electricityPricePerKwh, 'energy.electricityPricePerKwh');
  for (const key of ['pumpCurve', 'efficiencyCurve', 'npshrCurve']) {
    if (!Array.isArray(candidate.energy[key])) throw new TypeError(`energy.${key} debe ser un arreglo.`);
  }
  validateCurve(candidate.energy.pumpCurve, 'headM', 'energy.pumpCurve');
  validateCurve(candidate.energy.efficiencyCurve, 'efficiency', 'energy.efficiencyCurve');
  validateCurve(candidate.energy.npshrCurve, 'npshM', 'energy.npshrCurve');
  assertNonNegativeFinite(candidate.energy.suctionAbsolutePressurePa, 'energy.suctionAbsolutePressurePa');
  assertNonNegativeFinite(candidate.energy.vaporPressurePa, 'energy.vaporPressurePa');
  assertNonNegativeFinite(candidate.energy.suctionVelocityMps, 'energy.suctionVelocityMps');
  assertFiniteNumber(candidate.energy.suctionElevationHeadM, 'energy.suctionElevationHeadM');
  assertNonNegativeFinite(candidate.energy.suctionHeadLossM, 'energy.suctionHeadLossM');

  assertString(candidate.leaching.kineticModel, 'leaching.kineticModel');
  if (!['', 'first-order-cstr-series'].includes(candidate.leaching.kineticModel)) {
    throw new RangeError('leaching.kineticModel no soportado.');
  }
  assertNonNegativeFinite(candidate.leaching.totalUsefulVolumeM3, 'leaching.totalUsefulVolumeM3');
  if (!Number.isInteger(candidate.leaching.reactorCount) || candidate.leaching.reactorCount < 1) {
    throw new RangeError('leaching.reactorCount debe ser un entero >= 1.');
  }
  assertNonNegativeFinite(candidate.leaching.firstOrderRateConstantPerH, 'leaching.firstOrderRateConstantPerH');
  assertFiniteNumber(candidate.leaching.temperatureC, 'leaching.temperatureC');
  assertFiniteNumber(candidate.leaching.ph, 'leaching.ph');
  assertNonNegativeFinite(candidate.leaching.freeCyanideGL, 'leaching.freeCyanideGL');
  assertNonNegativeFinite(candidate.leaching.dissolvedOxygenMgL, 'leaching.dissolvedOxygenMgL');
  assertNonNegativeFinite(candidate.leaching.feedGradeGL, 'leaching.feedGradeGL');
  assertFiniteNumber(candidate.leaching.referenceTemperatureC, 'leaching.referenceTemperatureC');
  assertFiniteNumber(candidate.leaching.referencePh, 'leaching.referencePh');
  assertNonNegativeFinite(candidate.leaching.referenceGradeGL, 'leaching.referenceGradeGL');
  assertNonNegativeFinite(candidate.leaching.referenceCyanideGL, 'leaching.referenceCyanideGL');
  assertNonNegativeFinite(candidate.leaching.referenceOxygenMgL, 'leaching.referenceOxygenMgL');
  for (const key of ['coupleTemperature', 'couplePh', 'coupleCyanide', 'coupleOxygen']) assertBoolean(candidate.leaching[key], `leaching.${key}`);
  for (const key of ['betaTemperaturePerC', 'betaPhPerUnit', 'betaCyanidePerGL', 'betaOxygenPerMgL']) assertFiniteNumber(candidate.leaching[key], `leaching.${key}`);

  assertString(candidate.recovery.model, 'recovery.model');
  if (!['', 'stage-efficiency'].includes(candidate.recovery.model)) {
    throw new RangeError('recovery.model no soportado.');
  }
  assertNonNegativeFinite(candidate.recovery.feedGoldKgH, 'recovery.feedGoldKgH');
  for (const key of ['adsorptionEfficiency', 'elutionEfficiency', 'electrowinningEfficiency', 'smeltingEfficiency']) {
    assertFraction(candidate.recovery[key], `recovery.${key}`);
  }
  assertNonNegativeFinite(candidate.process.tankDischargeM3h, 'process.tankDischargeM3h');
  assertNonNegativeFinite(candidate.process.tankVolumeM3, 'process.tankVolumeM3');
  assertFraction(candidate.process.balanceToleranceFraction, 'process.balanceToleranceFraction');
}

function validateAccessories(accessories, path) {
  if (!isPlainObject(accessories)) throw new TypeError(`${path} debe ser un objeto.`);
  for (const key of ['valvesCount', 'elbowsCount', 'teesCount', 'reducersCount']) {
    assertNonNegativeFinite(accessories[key], `${path}.${key}`);
    if (!Number.isInteger(accessories[key])) throw new RangeError(`${path}.${key} debe ser entero.`);
  }
  for (const key of ['valveK', 'elbowK', 'teeK', 'reducerK', 'otherK']) assertNonNegativeFinite(accessories[key], `${path}.${key}`);
}

function validateTransportSegment(segment, path) {
  if (!isPlainObject(segment)) throw new TypeError(`${path} debe ser un objeto.`);
  assertString(segment.id ?? '', `${path}.id`);
  assertNonNegativeFinite(segment.innerDiameterM ?? 0, `${path}.innerDiameterM`);
  assertNonNegativeFinite(segment.lengthM ?? 0, `${path}.lengthM`);
  assertNonNegativeFinite(segment.roughnessM ?? 0, `${path}.roughnessM`);
  assertFiniteNumber(segment.elevationChangeM ?? 0, `${path}.elevationChangeM`);
  assertString(segment.material ?? '', `${path}.material`);
  if (segment.velocityMps !== undefined) assertNonNegativeFinite(segment.velocityMps, `${path}.velocityMps`);
  if (segment.accessories !== undefined) validateAccessories(segment.accessories, `${path}.accessories`);
  if (segment.minorLossCoefficient !== undefined) assertNonNegativeFinite(segment.minorLossCoefficient, `${path}.minorLossCoefficient`);
}

function validateCurve(curve, valueKey, path) {
  curve.forEach((point, index) => {
    if (!isPlainObject(point)) throw new TypeError(`${path}[${index}] debe ser un objeto.`);
    assertNonNegativeFinite(point.flowRateM3s, `${path}[${index}].flowRateM3s`);
    assertNonNegativeFinite(point[valueKey], `${path}[${index}].${valueKey}`);
  });
}

function assertBoolean(value, path) {
  if (typeof value !== 'boolean') throw new TypeError(`${path} debe ser booleano.`);
}

function assertFractionOrUnset(value, path) {
  assertFraction(value, path);
}

function assertFraction(value, path) {
  assertFiniteNumber(value, path);
  if (value < 0 || value > 1) {
    throw new RangeError(`${path} debe estar entre 0 y 1.`);
  }
}

function assertNonNegativeFinite(value, path) {
  assertFiniteNumber(value, path);
  if (value < 0) {
    throw new RangeError(`${path} no puede ser negativo.`);
  }
}

function assertFiniteNumber(value, path) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${path} debe ser un número finito.`);
  }
}

function assertString(value, path) {
  if (typeof value !== 'string') {
    throw new TypeError(`${path} debe ser texto.`);
  }
}

function assertKnownShape(patch, schema, path) {
  for (const key of Object.keys(patch)) {
    if (!Object.hasOwn(schema, key)) {
      throw new TypeError(`${path}.${key} no pertenece al estado definido.`);
    }

    const patchValue = patch[key];
    const schemaValue = schema[key];
    if (isPlainObject(patchValue)) {
      if (!isPlainObject(schemaValue)) {
        throw new TypeError(`${path}.${key} no acepta un objeto.`);
      }
      assertKnownShape(patchValue, schemaValue, `${path}.${key}`);
    }
  }
}

function merge(target, patch) {
  const result = clone(target);
  for (const [key, value] of Object.entries(patch)) {
    result[key] = isPlainObject(value) ? merge(result[key], value) : value;
  }
  return result;
}

function assertPlainObject(value, name) {
  if (!isPlainObject(value)) {
    throw new TypeError(`${name} requiere un objeto parcial.`);
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
  return structuredClone(value);
}
