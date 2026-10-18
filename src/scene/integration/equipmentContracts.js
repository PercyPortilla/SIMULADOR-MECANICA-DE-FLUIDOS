function freezePorts(ports) {
  return Object.freeze(ports.map((port) => Object.freeze({
    ...port,
    position: Object.freeze([...port.position]),
    direction: Object.freeze([...port.direction]),
  })));
}

function contract(dimensions, ports) {
  return Object.freeze({
    dimensions: Object.freeze({ ...dimensions }),
    ports: freezePorts(ports),
  });
}

/**
 * Renderer-neutral equipment geometry/process interface.
 *
 * These values are the same physical contracts exposed by the V30 Three asset
 * factories. V31 Babylon consumes them without instantiating Three objects.
 * A parity test guards this table against the still-authoritative V30 assets
 * during the transition.
 */
export const EQUIPMENT_RENDER_CONTRACTS = Object.freeze({
  romHopper: contract(
    { length: 11.5, width: 9.2, height: 7.6 },
    [
      { id: 'feedIn', type: 'materialIn', position: [-6.72, 2.18, 0], direction: [1, -0.08, 0] },
      { id: 'dischargeOut', type: 'materialOut', position: [0, 1.95, 0], direction: [0, -1, 0] },
    ],
  ),
  apronFeeder: contract(
    { length: 8.4, width: 2.8, height: 1.85 },
    [
      { id: 'feedIn', type: 'materialIn', position: [-3.8, 1.25, 0], direction: [1, 0, 0] },
      { id: 'dischargeOut', type: 'materialOut', position: [4.2, 1.0, 0], direction: [1, 0, 0] },
    ],
  ),
  jawCrusher: contract(
    { length: 5.4, width: 4.2, height: 4.7 },
    [
      { id: 'feedIn', type: 'materialIn', position: [-0.4, 4.55, 0], direction: [0, -1, 0] },
      { id: 'dischargeOut', type: 'materialOut', position: [0.8, 0.55, 0], direction: [1, -0.3, 0] },
    ],
  ),
  ballMill: contract(
    { length: 10.6, width: 6.1, height: 5.65 },
    [
      { id: 'feedIn', type: 'materialIn', position: [-5.2, 3.25, 0], direction: [1, 0, 0] },
      { id: 'slurryOut', type: 'slurryOut', position: [5.45, 3.05, 0], direction: [1, 0, 0], nominalDiameter: 0.45 },
    ],
  ),
  slurryPump: contract(
    { length: 4.8, width: 2.65, height: 2.55 },
    [
      { id: 'suction', type: 'suction', position: [-1.15, 1.05, 0.95], direction: [0, 0, 1], nominalDiameter: 0.3 },
      { id: 'discharge', type: 'discharge', position: [0, 1.92, 0], direction: [1, 0, 0], nominalDiameter: 0.25 },
    ],
  ),
  cycloneCluster: contract(
    { length: 5.4, width: 5.4, height: 5.4 },
    [
      { id: 'feed', type: 'slurryIn', position: [0, 5.15, 0], direction: [0, -1, 0], nominalDiameter: 0.3 },
      { id: 'overflow', type: 'overflow', position: [2.1, 4.25, 0], direction: [1, 0, 0], nominalDiameter: 0.22 },
      { id: 'underflow', type: 'underflow', position: [0, 0.55, 0], direction: [0, -1, 0], nominalDiameter: 0.26 },
    ],
  ),
  leachReactor: contract(
    { length: 7.6, width: 7.6, height: 8.8 },
    [
      { id: 'feedIn', type: 'slurryIn', position: [-4.0, 6.2, 0], direction: [1, 0, 0], nominalDiameter: 0.25 },
      { id: 'overflowOut', type: 'slurryOut', position: [4.0, 5.7, 0], direction: [1, 0, 0], nominalDiameter: 0.25 },
      { id: 'drain', type: 'slurryOut', position: [0, 0.15, 3.7], direction: [0, 0, 1], nominalDiameter: 0.15 },
      { id: 'reagentIn', type: 'reagentIn', position: [-1.2, 7.45, 0], direction: [0, -1, 0], nominalDiameter: 0.08 },
    ],
  ),
  cip: contract(
    { length: 13.8, width: 7.4, height: 6.9 },
    [
      { id: 'feed', type: 'slurryIn', position: [-6.7, 4.0, -1.0], direction: [1, 0, 0], nominalDiameter: 0.22 },
      { id: 'slurryOut', type: 'slurryOut', position: [6.7, 4.0, -1.0], direction: [1, 0, 0], nominalDiameter: 0.22 },
      { id: 'loadedCarbonOut', type: 'materialOut', position: [-5.6, 5.55, 2.25], direction: [-1, 0, 0], nominalDiameter: 0.08 },
      { id: 'barrenCarbonIn', type: 'materialIn', position: [5.6, 5.55, 2.25], direction: [-1, 0, 0], nominalDiameter: 0.08 },
    ],
  ),
  elution: contract(
    { length: 9.4, width: 5.6, height: 6.4 },
    [
      { id: 'loadedCarbonIn', type: 'materialIn', position: [-2.8, 5.2, 0], direction: [0, -1, 0] },
      { id: 'pregnantSolutionOut', type: 'slurryOut', position: [4.45, 1.0, 1.25], direction: [1, 0, 0], nominalDiameter: 0.1 },
      { id: 'barrenCarbonOut', type: 'materialOut', position: [-2.8, 0.35, 0.7], direction: [-1, 0, 0] },
    ],
  ),
  electrowinning: contract(
    { length: 10.8, width: 5.8, height: 3.8 },
    [
      { id: 'electrolyteIn', type: 'slurryIn', position: [-5.2, 0.85, -1.7], direction: [1, 0, 0], nominalDiameter: 0.1 },
      { id: 'electrolyteOut', type: 'slurryOut', position: [5.2, 0.85, 1.7], direction: [1, 0, 0], nominalDiameter: 0.1 },
      { id: 'cathodeOut', type: 'materialOut', position: [5.35, 2.15, 0], direction: [1, 0, 0] },
      { id: 'dcPower', type: 'electrical', position: [4.3, 2.4, -2.15], direction: [0, 1, 0] },
    ],
  ),
  smelting: contract(
    { length: 7.4, width: 5.8, height: 8.9 },
    [
      { id: 'feed', type: 'materialIn', position: [-2.35, 2.25, 0], direction: [1, 0, 0] },
      { id: 'exhaust', type: 'service', position: [3.0, 6.2, 0], direction: [1, 1, 0], nominalDiameter: 0.75 },
      { id: 'productOut', type: 'materialOut', position: [2.25, 1.45, 0], direction: [0, -1, 0] },
    ],
  ),
});

export const INSTANCE_PORT_ALIASES = Object.freeze({
  'MILL-01': Object.freeze({ feed: 'feedIn', discharge: 'slurryOut' }),
  'CLASS-01': Object.freeze({ inlet: 'feed', outlet: 'overflow' }),
  'R-01': Object.freeze({ inlet: 'feedIn', outlet: 'overflowOut' }),
  'R-02': Object.freeze({ inlet: 'feedIn', outlet: 'overflowOut' }),
  'R-03': Object.freeze({ inlet: 'feedIn', outlet: 'overflowOut' }),
  'R-04': Object.freeze({ inlet: 'feedIn', outlet: 'overflowOut' }),
  'CIP-ADSORPTION': Object.freeze({ inlet: 'feed', outlet: 'slurryOut' }),
  'ELUTION-SKID': Object.freeze({ inlet: 'loadedCarbonIn', outlet: 'pregnantSolutionOut' }),
  'EW-CELLS': Object.freeze({ inlet: 'electrolyteIn', outlet: 'electrolyteOut' }),
  'SMELTING-FURNACE': Object.freeze({ inlet: 'feed', outlet: 'productOut' }),
});

export const SUPPORT_EQUIPMENT_CONTRACTS = Object.freeze({
  'SUMP-01': contract(
    { length: 5.1, width: 5.1, height: 3.3 },
    [
      { id: 'inlet', type: 'slurryIn', position: [-2.2, 2.3, 0], direction: [1, 0, 0], nominalDiameter: 0.4 },
      { id: 'outlet', type: 'slurryOut', position: [2.2, 0.85, 0], direction: [1, 0, 0], nominalDiameter: 0.3 },
    ],
  ),
  'STOCKPILE-RECLAIM': contract(
    { length: 50, width: 40, height: 10 },
    [
      { id: 'feedIn', type: 'materialIn', position: [-13.0, 9.4, 0], direction: [1, -0.3, 0], nominalDiameter: 0.6 },
      { id: 'reclaimOut', type: 'materialOut', position: [27.0, 1.15, 8.9], direction: [1, 0, 0], nominalDiameter: 0.6 },
      { id: 'loaderDump', type: 'materialIn', position: [21.5, 3.65, 12.0], direction: [0, -1, 0], nominalDiameter: 0.6 },
    ],
  ),
});

export function getEquipmentRenderContract(assetKey) {
  return EQUIPMENT_RENDER_CONTRACTS[assetKey] ?? null;
}

export function getSupportEquipmentContract(instanceId) {
  return SUPPORT_EQUIPMENT_CONTRACTS[instanceId] ?? null;
}
