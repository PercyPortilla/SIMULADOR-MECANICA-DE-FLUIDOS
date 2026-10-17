export const WORLD_UNITS_PER_METER = 1;

export const SITE_EXTENT = Object.freeze({ width: 860, depth: 560 });

export const REFERENCE_EQUIPMENT_DIMENSIONS = Object.freeze({
  haulTruck: Object.freeze({ lengthM: 10.0, widthM: 5.25, heightM: 5.05, tireRadiusM: 1.42 }),
  wheelLoader: Object.freeze({ lengthM: 12.0, widthM: 3.75, heightM: 4.25, tireRadiusM: 1.25 }),
  miningShovel: Object.freeze({ bodyLengthM: 9.9, widthM: 8.0, heightM: 8.1, bucketWidthM: 4.3 }),
});

export const PIT_DESIGN = Object.freeze({
  center: Object.freeze({ x: -265, z: 78 }),
  radiusX: 145,
  radiusZ: 110,
  floorElevation: -30,
  floorRadiusM: 40,
  benchHeightM: 10,
  benchWidthM: 14,
  faceRunM: 12,
  benchCount: 4,
  rimBlendM: 18,
  faceRoughnessM: 0.55,
  loadingPoint: Object.freeze({ x: -270, z: 80 }),
  shovelPoint: Object.freeze({ x: -258, z: 66 }),
});

export const MINE_AUXILIARY_AREAS = Object.freeze({
  northWasteDump: Object.freeze({ x: -345, z: 205, radiusX: 42, radiusZ: 28, levels: 3, levelHeightM: 4.5 }),
  southWasteDump: Object.freeze({ x: -390, z: -155, radiusX: 32, radiusZ: 23, levels: 2, levelHeightM: 4.0 }),
  oreStaging: Object.freeze({ x: -190, z: 185 }),
  pitSump: Object.freeze({ x: -238, z: 95, radiusM: 5.5 }),
  loadingPad: Object.freeze({ x: -272, z: 81, widthM: 38, depthM: 24, rotationY: -0.08, elevation: -29.85 }),
  drillingPad: Object.freeze({ x: -205, z: 92, widthM: 10.5, depthM: 29, rotationY: -0.06, elevation: -19.95 }),
});

export const MINE_DRAINAGE_PATHS = Object.freeze({
  west: Object.freeze([
    Object.freeze([-289, 104]),
    Object.freeze([-270, 109]),
    Object.freeze([-250, 108]),
    Object.freeze([MINE_AUXILIARY_AREAS.pitSump.x, MINE_AUXILIARY_AREAS.pitSump.z]),
  ]),
  east: Object.freeze([
    Object.freeze([-221, 79]),
    Object.freeze([-226, 90]),
    Object.freeze([MINE_AUXILIARY_AREAS.pitSump.x, MINE_AUXILIARY_AREAS.pitSump.z]),
  ]),
});

export const MINE_DUMP_ACCESS_PATHS = Object.freeze({
  north: Object.freeze([
    Object.freeze([-330, 96]),
    Object.freeze([-338, 128]),
    Object.freeze([-342, 164]),
    Object.freeze([MINE_AUXILIARY_AREAS.northWasteDump.x, MINE_AUXILIARY_AREAS.northWasteDump.z - 10]),
  ]),
  south: Object.freeze([
    Object.freeze([-334, -48]),
    Object.freeze([-350, -82]),
    Object.freeze([-370, -118]),
    Object.freeze([MINE_AUXILIARY_AREAS.southWasteDump.x + 7, MINE_AUXILIARY_AREAS.southWasteDump.z + 8]),
  ]),
});

export const TOPOGRAPHIC_ZONES = Object.freeze({
  reception: Object.freeze({ id: 'reception', center: [-110, -30], size: [58, 48], elevation: 8.5 }),
  crushing: Object.freeze({ id: 'crushing', center: [-82, -30], size: [42, 34], elevation: 6.0 }),
  stockpile: Object.freeze({ id: 'stockpile', center: [8, -38], size: [66, 54], elevation: 3.4 }),
  process: Object.freeze({ id: 'process', center: [105, -6], size: [112, 54], elevation: 2.2 }),
  leaching: Object.freeze({ id: 'leaching', center: [195, 26], size: [92, 64], elevation: 2.6 }),
  recovery: Object.freeze({ id: 'recovery', center: [210, -90], size: [108, 60], elevation: 2.0 }),
});

export const PLANT_ZONE_DEFINITIONS = Object.freeze({
  Z1: Object.freeze({ id: 'Z1', key: 'reception', name: 'RECEPCIÓN ROM', position: { x: -110, z: -30 }, rotationY: 0, width: 24, depth: 38, elevationKey: 'reception', connections: ['Z2'] }),
  Z2: Object.freeze({ id: 'Z2', key: 'crushing', name: 'CHANCADO PRIMARIO', position: { x: -78, z: -30 }, rotationY: 0, width: 20, depth: 30, elevationKey: 'crushing', connections: ['Z3'] }),
  Z3: Object.freeze({ id: 'Z3', key: 'stockpile', name: 'STOCKPILE / RECLAIM', position: { x: 8, z: -38 }, rotationY: 0, width: 58, depth: 48, elevationKey: 'stockpile', connections: ['Z4'] }),
  Z4: Object.freeze({ id: 'Z4', key: 'grinding', name: 'MOLIENDA', position: { x: 80, z: -6 }, rotationY: 0, width: 30, depth: 32, elevationKey: 'process', connections: ['Z5'] }),
  Z5: Object.freeze({ id: 'Z5', key: 'classification', name: 'CLASIFICACIÓN', position: { x: 122, z: -6 }, rotationY: 0, width: 34, depth: 32, elevationKey: 'process', connections: ['Z6'] }),
  Z6: Object.freeze({ id: 'Z6', key: 'leaching', name: 'LIXIVIACIÓN', position: { x: 195, z: 26 }, rotationY: 0, width: 82, depth: 52, elevationKey: 'leaching', connections: ['Z7'] }),
  Z7: Object.freeze({ id: 'Z7', key: 'utilities', name: 'BOMBEO / SERVICIOS', position: { x: 205, z: -35 }, rotationY: 0, width: 18, depth: 20, elevationKey: 'process', connections: ['Z8'] }),
  Z8: Object.freeze({ id: 'Z8', key: 'recovery', name: 'RECUPERACIÓN METALÚRGICA', position: { x: 210, z: -90 }, rotationY: 0, width: 98, depth: 52, elevationKey: 'recovery', connections: [] }),
});

export const ROAD_DEFINITIONS = Object.freeze({
  'ROAD-01': Object.freeze({
    role: 'primary-haul-road',
    widthM: 18.5,
    shoulderM: 2.2,
    minimumCurveRadiusM: 28,
    maximumGrade: 0.10,
    designSpeedKph: 35,
    points: Object.freeze([
      [-270, 80], [-300, 94], [-330, 96], [-352, 82], [-365, 55],
      [-366, 20], [-356, -15], [-334, -48], [-304, -72], [-268, -88],
      [-228, -92], [-192, -82], [-160, -64], [-136, -48], [-122, -30],
    ]),
  }),
  'ROAD-02': Object.freeze({
    role: 'plant-service-road',
    widthM: 12.0,
    shoulderM: 1.5,
    minimumCurveRadiusM: 18,
    maximumGrade: 0.12,
    designSpeedKph: 25,
    // Main service spine: joins the haul road at the ROM approach and stays south
    // of the process islands, leaving manoeuvring/maintenance space around equipment.
    points: Object.freeze([
      [-136, -48], [-112, -58], [-72, -62], [-22, -64], [32, -64],
      [92, -64], [154, -66], [210, -64], [270, -56],
    ]),
  }),
  'ROAD-03': Object.freeze({
    role: 'site-service-loop',
    widthM: 11.0,
    shoulderM: 1.3,
    minimumCurveRadiusM: 18,
    maximumGrade: 0.12,
    designSpeedKph: 25,
    // Northern bypass: shares real junctions with ROAD-02 instead of forming a
    // detached decorative loop. It clears the open-pit rim and leach pad.
    points: Object.freeze([
      [-136, -48], [-128, -4], [-104, 42], [-62, 74], [-4, 90],
      [62, 94], [126, 88], [190, 72], [238, 52], [270, 18], [270, -56],
    ]),
  }),
  'ROAD-04': Object.freeze({
    role: 'recovery-access-road',
    widthM: 10.0,
    shoulderM: 1.1,
    minimumCurveRadiusM: 14,
    maximumGrade: 0.12,
    designSpeedKph: 20,
    // Recovery loop: two connections to the service spine, routed south of the
    // metallurgical equipment so access does not cut through the process train.
    points: Object.freeze([
      [154, -66], [150, -84], [152, -108], [170, -132], [210, -138],
      [248, -128], [268, -96], [270, -56],
    ]),
  }),
});

export const PLANT_CLEARANCES = Object.freeze({
  minimumModuleGapM: 9,
  heavyVehicleApronM: 18,
  maintenanceAroundMillM: 7,
  maintenanceAroundTanksM: 5,
  pipeRackCorridorM: 4,
  recoveryModuleGapM: 7,
});

export function getSiteOverviewBounds() {
  return Object.freeze({ minX: -410, maxX: 340, minZ: -170, maxZ: 210, minY: -32, maxY: 32 });
}
