export const FINAL_EQUIPMENT_LAYOUT = Object.freeze({
  'ROM-HOPPER': Object.freeze({ asset: 'romHopper', x: -110, z: -30, rotationY: 0 }),
  'APRON-FEEDER': Object.freeze({ asset: 'apronFeeder', x: -99.4, z: -30, rotationY: 0 }),
  'PRIMARY-CRUSHER': Object.freeze({ asset: 'jawCrusher', x: -88.0, z: -30, rotationY: 0 }),
  'MILL-01': Object.freeze({ asset: 'ballMill', x: 80, z: -6, rotationY: 0 }),
  'SLURRY-PUMP-01': Object.freeze({ asset: 'slurryPump', x: 109, z: -5, rotationY: 0 }),
  'CLASS-01': Object.freeze({ asset: 'cycloneCluster', x: 126, z: -4, rotationY: 0 }),
  'R-01': Object.freeze({ asset: 'leachReactor', x: 164, z: 26, rotationY: 0 }),
  'R-02': Object.freeze({ asset: 'leachReactor', x: 184, z: 26, rotationY: 0 }),
  'R-03': Object.freeze({ asset: 'leachReactor', x: 204, z: 26, rotationY: 0 }),
  'R-04': Object.freeze({ asset: 'leachReactor', x: 224, z: 26, rotationY: 0 }),
  'PUMP-01': Object.freeze({ asset: 'slurryPump', x: 205, z: -35, rotationY: 0 }),
  'CIP-ADSORPTION': Object.freeze({ asset: 'cip', x: 171, z: -90, rotationY: 0 }),
  'ELUTION-SKID': Object.freeze({ asset: 'elution', x: 196, z: -90, rotationY: 0 }),
  'EW-CELLS': Object.freeze({ asset: 'electrowinning', x: 219, z: -90, rotationY: 0 }),
  'SMELTING-FURNACE': Object.freeze({ asset: 'smelting', x: 242, z: -90, rotationY: 0 }),
});

export const SUPPORT_LAYOUT = Object.freeze({
  stockpile: Object.freeze({ x: 8, z: -38 }),
  reclaim: Object.freeze({ x: 30, z: -26 }),
  sump: Object.freeze({ x: 96, z: -4 }),
  truckDump: Object.freeze({ x: -122, z: -30 }),
  truckLoad: Object.freeze({ x: -270, z: 80 }),
  loaderPickup: Object.freeze({ x: 11, z: -20 }),
  loaderDump: Object.freeze({ x: 24, z: -20 }),
});

export const PIPE_CORRIDORS = Object.freeze({
  classificationToLeachZ: 10,
  leachHeaderZ: 14,
  recoveryRiserX: 210,
  recoveryRackZ: -62,
});

export const MOBILE_ROUTE_LAYOUT = Object.freeze({
  loaderOutbound: Object.freeze([
    Object.freeze([SUPPORT_LAYOUT.loaderPickup.x, SUPPORT_LAYOUT.loaderPickup.z]),
    Object.freeze([13, -16]),
    Object.freeze([20, -15]),
    Object.freeze([SUPPORT_LAYOUT.loaderDump.x, SUPPORT_LAYOUT.loaderDump.z]),
  ]),
  loaderReturn: Object.freeze([
    Object.freeze([SUPPORT_LAYOUT.loaderDump.x, SUPPORT_LAYOUT.loaderDump.z]),
    Object.freeze([20, -14]),
    Object.freeze([13, -14]),
    Object.freeze([SUPPORT_LAYOUT.loaderPickup.x, SUPPORT_LAYOUT.loaderPickup.z]),
  ]),
});
