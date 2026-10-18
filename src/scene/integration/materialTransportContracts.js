function freezeConnection(value) {
  return Object.freeze({
    ...value,
    source: Object.freeze([...value.source]),
    target: Object.freeze([...value.target]),
  });
}

function freezeTransfer(value) {
  return Object.freeze({ ...value });
}

/**
 * Renderer-neutral solid-material routing shared by the V30 Three adapter and
 * the V31 Babylon adapter. These values are physical/layout contracts, not
 * renderer geometry.
 */
export const CONVEYOR_CONNECTIONS = Object.freeze([
  freezeConnection({
    id: 'CV-01-FEEDER-TO-CRUSHER',
    source: ['APRON-FEEDER', 'dischargeOut'],
    target: ['PRIMARY-CRUSHER', 'feedIn'],
    widthM: 1.50,
    walkway: true,
  }),
  freezeConnection({
    id: 'CV-02-CRUSHER-TO-STOCKPILE',
    source: ['PRIMARY-CRUSHER', 'dischargeOut'],
    target: ['STOCKPILE-RECLAIM', 'feedIn'],
    widthM: 1.45,
    walkway: true,
  }),
  freezeConnection({
    id: 'CV-03-STOCKPILE-TO-GRINDING',
    source: ['STOCKPILE-RECLAIM', 'reclaimOut'],
    target: ['MILL-01', 'feedIn'],
    widthM: 1.40,
    walkway: true,
  }),
]);

export const FIXED_MATERIAL_TRANSFER_CASCADES = Object.freeze([
  freezeTransfer({
    name: 'CV-01-TO-CRUSHER-MATERIAL',
    equipmentId: 'PRIMARY-CRUSHER',
    portId: 'feedIn',
    upstreamM: 1.10,
    liftM: 0.34,
    count: 14,
  }),
  freezeTransfer({
    name: 'CV-02-TO-STOCKPILE-MATERIAL',
    equipmentId: 'STOCKPILE-RECLAIM',
    portId: 'feedIn',
    upstreamM: 1.25,
    liftM: 0.48,
    count: 16,
  }),
  freezeTransfer({
    name: 'CV-03-TO-MILL-MATERIAL',
    equipmentId: 'MILL-01',
    portId: 'feedIn',
    upstreamM: 1.05,
    liftM: 0.40,
    count: 14,
  }),
]);

export const ROM_FEEDER_TRANSFER = Object.freeze({
  id: 'ROM-TO-FEEDER-CHUTE',
  source: Object.freeze(['ROM-HOPPER', 'dischargeOut']),
  target: Object.freeze(['APRON-FEEDER', 'feedIn']),
});

export const V30_CONVEYOR_BELT_SPEED_MPS = 0.90;
