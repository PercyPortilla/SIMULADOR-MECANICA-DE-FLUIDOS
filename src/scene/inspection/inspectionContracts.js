export const INSPECTION_MODES = Object.freeze(['normal', 'transparent', 'cutaway', 'interior']);

export const INSPECTION_FOCUS_PROFILES = Object.freeze({
  'CV-02-CRUSHER-TO-STOCKPILE': Object.freeze({ routeFraction: 0.50, maxSpanM: 28 }),
  'STOCKPILE-RECLAIM': Object.freeze({ focusObjectName: 'STOCKPILE-RECLAIM-motion' }),
  'CV-03-STOCKPILE-TO-GRINDING': Object.freeze({ routeFraction: 0.58, maxSpanM: 26 }),
  'P-CYCLONE-UNDERFLOW-RETURN': Object.freeze({ routeFraction: 0.52, maxSpanM: 22 }),
  'P-CLASSIFICATION-TO-LEACH': Object.freeze({ routeFraction: 0.48, maxSpanM: 22 }),
  'P-LEACHING-TO-PUMP-01': Object.freeze({ routeFraction: 0.55, maxSpanM: 24 }),
  'P-PUMP-01-TO-CIP': Object.freeze({ routeFraction: 0.46, maxSpanM: 24 }),
});

export const INSPECTION_CIRCUIT_ORDER = Object.freeze([
  'EXCAVATOR-01',
  'TRUCK-01',
  'ROM-HOPPER',
  'ROM-TO-FEEDER-CHUTE',
  'APRON-FEEDER',
  'CV-01-FEEDER-TO-CRUSHER',
  'PRIMARY-CRUSHER',
  'CV-02-CRUSHER-TO-STOCKPILE',
  'STOCKPILE-RECLAIM',
  'LOADER-01',
  'CV-03-STOCKPILE-TO-GRINDING',
  'MILL-01',
  'P-MILL-TO-SUMP',
  'SUMP-01',
  'P-SUMP-TO-PUMP',
  'SLURRY-PUMP-01',
  'P-PUMP-TO-CYCLONES',
  'CLASS-01',
  'P-CYCLONE-UNDERFLOW-RETURN',
  'P-CLASSIFICATION-TO-LEACH',
  'R-01',
  'P-LEACH-R01-R02',
  'R-02',
  'P-LEACH-R02-R03',
  'R-03',
  'P-LEACH-R03-R04',
  'R-04',
  'P-LEACHING-TO-PUMP-01',
  'PUMP-01',
  'P-PUMP-01-TO-CIP',
  'CIP-ADSORPTION',
  'MT-CIP-TO-ELUTION-CARBON',
  'ELUTION-SKID',
  'MT-ELUTION-TO-CIP-BARREN-CARBON',
  'P-ELUTION-TO-EW',
  'EW-CELLS',
  'MT-EW-TO-SMELTING-CATHODE',
  'SMELTING-FURNACE',
]);

const CIRCUIT_RANK = new Map(INSPECTION_CIRCUIT_ORDER.map((id, index) => [id, index]));

export const INSPECTION_FRIENDLY_TARGET_LABELS = Object.freeze({
  'EXCAVATOR-01': 'Excavadora · EXCAVATOR-01',
  'TRUCK-01': 'Camión mina · TRUCK-01',
  'LOADER-01': 'Cargador · LOADER-01',
  'ROM-HOPPER': 'Tolva ROM · ROM-HOPPER',
  'APRON-FEEDER': 'Alimentador · APRON-FEEDER',
  'PRIMARY-CRUSHER': 'Chancadora primaria · PRIMARY-CRUSHER',
  'STOCKPILE-RECLAIM': 'Stockpile / reclaim',
  'MILL-01': 'Molino · MILL-01',
  'SUMP-01': 'Sump · SUMP-01',
  'SLURRY-PUMP-01': 'Bomba de clasificación · SLURRY-PUMP-01',
  'CLASS-01': 'Ciclones · CLASS-01',
  'PUMP-01': 'Bomba a recuperación · PUMP-01',
  'CIP-ADSORPTION': 'Adsorción CIP',
  'ELUTION-SKID': 'Elución',
  'EW-CELLS': 'Electrowinning',
  'SMELTING-FURNACE': 'Fundición',
});

export function getInspectionCircuitContext(id) {
  const index = CIRCUIT_RANK.get(id);
  if (index === undefined) return Object.freeze({ id, previousId: null, nextId: null, index: -1 });
  return Object.freeze({
    id,
    previousId: INSPECTION_CIRCUIT_ORDER[index - 1] ?? null,
    nextId: INSPECTION_CIRCUIT_ORDER[index + 1] ?? null,
    index,
  });
}

export function getInspectionTargetLabel(id, { conveyor = false, connection = false } = {}) {
  if (INSPECTION_FRIENDLY_TARGET_LABELS[id]) return INSPECTION_FRIENDLY_TARGET_LABELS[id];
  if (conveyor || id?.startsWith('CV-')) return `Faja · ${id}`;
  if (connection || id?.startsWith('P-') || id?.startsWith('MT-')) return `Línea · ${id}`;
  return id;
}

export function getInspectionCircuitRank(id) {
  if (CIRCUIT_RANK.has(id)) return CIRCUIT_RANK.get(id);
  if (/^R-0[1-4]$/.test(id)) return 200 + Number(id.slice(-1));
  if (id?.startsWith('P-')) return 800;
  if (id?.startsWith('CV-')) return 850;
  return 1000;
}
