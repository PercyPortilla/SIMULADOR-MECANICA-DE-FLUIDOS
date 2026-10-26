export const V57_SITE_VISUAL_URL = 'models/pulpa-v57/PULPA_LAB_V57_FULL_SITE_FINAL.glb';

// Authored Blender V57 is Z-up and exported to Babylon/glTF Y-up:
// (Blender X, Blender Y, Blender Z) -> (Babylon X, Blender Z, -Blender Y).
// Bounds below intentionally describe the useful authored site, not transient
// animated marker extrema.
export const V57_SITE_BOUNDS = Object.freeze({
  minX: -620,
  maxX: 610,
  minY: -60,
  maxY: 90,
  minZ: -365,
  maxZ: 360,
});

export const V57_ZONE_ANCHORS = Object.freeze({
  Z1: Object.freeze({ x: -304, y: 65.4, z: -206 }),
  Z2: Object.freeze({ x: -232, y: 58.0, z: -184 }),
  Z3: Object.freeze({ x: 6, y: 37.7, z: -134.5 }),
  Z4: Object.freeze({ x: 151.9, y: 25.4, z: -87.8 }),
  Z5: Object.freeze({ x: 228.4, y: 26.8, z: -103.1 }),
  Z6: Object.freeze({ x: 300, y: 29.7, z: -105 }),
  Z7: Object.freeze({ x: 392, y: 29.2, z: -104 }),
  Z8: Object.freeze({ x: 465, y: 27.0, z: -175 }),
});

export const V57_EQUIPMENT_ANCHORS = Object.freeze({
  'ROM-HOPPER': Object.freeze({ x: -304.0, y: 65.41, z: -206.0 }),
  'APRON-FEEDER': Object.freeze({ x: -287.42, y: 60.47, z: -203.26 }),
  'PRIMARY-CRUSHER': Object.freeze({ x: -232.0, y: 58.0, z: -184.0 }),
  'STOCKPILE-RECLAIM': Object.freeze({ x: 6.02, y: 37.74, z: -134.46 }),
  'MILL-01': Object.freeze({ x: 151.94, y: 25.40, z: -87.81 }),
  'SUMP-01': Object.freeze({ x: 178.50, y: 22.99, z: -90.11 }),
  'SLURRY-PUMP-01': Object.freeze({ x: 206.97, y: 23.62, z: -90.0 }),
  'PIPE-1': Object.freeze({ x: 219.0, y: 29.0, z: -96.0 }),
  'CLASS-01': Object.freeze({ x: 228.41, y: 26.84, z: -103.06 }),
  'R-01': Object.freeze({ x: 268.0, y: 29.78, z: -88.0 }),
  'R-02': Object.freeze({ x: 300.0, y: 29.75, z: -88.0 }),
  'R-03': Object.freeze({ x: 300.0, y: 29.72, z: -122.0 }),
  'R-04': Object.freeze({ x: 332.0, y: 29.69, z: -122.0 }),
  'CIP-ADSORPTION': Object.freeze({ x: 392.0, y: 29.15, z: -104.0 }),
  'ELUTION-SKID': Object.freeze({ x: 445.15, y: 25.69, z: -160.85 }),
  'EW-CELLS': Object.freeze({ x: 463.74, y: 26.21, z: -162.0 }),
  'SMELTING-FURNACE': Object.freeze({ x: 482.0, y: 29.8, z: -205.0 }),
  DETOX: Object.freeze({ x: 400.0, y: 21.25, z: -35.0 }),
  'TAILINGS-THICKENER': Object.freeze({ x: 465.98, y: 17.1, z: 0.0 }),
  'TAILINGS-PUMP': Object.freeze({ x: 511.85, y: 3.12, z: 35.0 }),
  TSF: Object.freeze({ x: 545.0, y: 1.55, z: 145.0 }),
});

function aliasSpec(value) {
  const result = { ...value };
  if (result.names) result.names = Object.freeze([...result.names]);
  if (result.prefixes) result.prefixes = Object.freeze([...result.prefixes]);
  if (result.bounds) {
    result.bounds = Object.freeze({
      center: Object.freeze([...result.bounds.center]),
      size: Object.freeze([...result.bounds.size]),
    });
  }
  return Object.freeze(result);
}

// Keep prior V56 names in aliases where useful so old contract tests and
// transitional assets remain inspectable while V57 is the authoritative site.
export const V57_INSPECTION_NODE_ALIASES = Object.freeze({
  'ROM-HOPPER': aliasSpec({ names: ['ROM-HOPPER_ROOT', 'ROM-HOPPER'] }),
  'APRON-FEEDER': aliasSpec({ names: ['APRON-FEEDER_ROOT', 'APRON-FEEDER'] }),
  'PRIMARY-CRUSHER': aliasSpec({ names: ['PRIMARY-CRUSHER_ROOT.001', 'PRIMARY-CRUSHER'] }),
  'STOCKPILE-RECLAIM': aliasSpec({ names: ['STOCKPILE-RECLAIM_ROOT', 'STOCKPILE-RECLAIM'] }),
  'MILL-01': aliasSpec({ names: ['MILL-01_ROOT', 'MILL-01'] }),
  'SUMP-01': aliasSpec({ names: ['SUMP-01_ROOT', 'SUMP-01'] }),
  'SLURRY-PUMP-01': aliasSpec({ names: ['SLURRY-PUMP-01_ROOT', 'SLURRY-PUMP-01'] }),
  'CLASS-01': aliasSpec({ names: ['CLASS-01_ROOT', 'CLASS-01'] }),
  'R-01': aliasSpec({ names: ['R-01_ROOT', 'R-01'] }),
  'R-02': aliasSpec({ names: ['R-02_ROOT', 'R-02'] }),
  'R-03': aliasSpec({ names: ['R-03_ROOT', 'R-03'] }),
  'R-04': aliasSpec({ names: ['R-04_ROOT', 'R-04'] }),
  'CIP-ADSORPTION': aliasSpec({ names: ['CIP-ADSORPTION_ROOT', 'CIP-ADSORPTION'] }),
  'ELUTION-SKID': aliasSpec({ names: ['ELUTION-SKID_ROOT', 'ELUTION-SKID'] }),
  'EW-CELLS': aliasSpec({ names: ['EW-CELLS_ROOT', 'EW-CELLS'] }),
  'SMELTING-FURNACE': aliasSpec({ names: ['SMELTING-FURNACE_ROOT', 'SMELTING-FURNACE'] }),
  'ROM-TO-FEEDER-CHUTE': aliasSpec({
    names: ['ROM_TO_APRON_CHUTE', 'V51_ROM_TO_APRON_CHUTE_BOTTOM'],
  }),
  'CV-01-FEEDER-TO-CRUSHER': aliasSpec({
    prefixes: ['CV-01_', 'V49_APRON_TO_CRUSHER_'],
  }),
  'CV-02-CRUSHER-TO-STOCKPILE': aliasSpec({
    prefixes: ['CV-02A_', 'CV-02_', 'STOCKPILE-FEED-CONVEYOR_', 'V49_CV02_'],
  }),
  'CV-03-STOCKPILE-TO-GRINDING': aliasSpec({ prefixes: ['CV-03_', 'V49_CV03_'] }),
  'P-MILL-TO-SUMP': aliasSpec({
    names: ['V57_MILL_TO_SUMP_TRANSFER', 'V52_PIPE_MILL_TO_SUMP', 'V56_PIPE_CORE_V52_PIPE_MILL_TO_SUMP'],
    prefixes: ['V57_MILL_TO_SUMP_'],
  }),
  'P-SUMP-TO-PUMP': aliasSpec({
    names: ['SLURRY-PUMP-01_SUCTION_SHELL_ROOT', 'V52_PIPE_SUMP_TO_SLURRY_PUMP', 'V56_PIPE_CORE_V52_PIPE_SUMP_TO_SLURRY_PUMP'],
    prefixes: ['SLURRY-PUMP-01_SUCTION_'],
  }),
  'P-PUMP-TO-CYCLONES': aliasSpec({
    names: ['PIPE-1_ROOT', 'CLASS-01_FEED_LINE_SHELL_ROOT', 'CLASS-01_FEED_LINE_FLUID_ROOT', 'V52_PIPE_SLURRY_PUMP_TO_CLASS'],
  }),
  'P-CYCLONE-UNDERFLOW-RETURN': aliasSpec({
    names: ['CLASS-01_UNDERFLOW_RETURN_SHELL_ROOT', 'V52_PIPE_CLASS_UNDERFLOW_TO_MILL'],
    prefixes: ['CLASS-01_UNDERFLOW_RETURN_'],
  }),
  'P-CLASSIFICATION-TO-LEACH': aliasSpec({
    names: ['CLASS-01_OVERFLOW_TO_LEACH_SHELL_ROOT', 'V52_PIPE_CLASS_OVERFLOW_TO_R01'],
    prefixes: ['CLASS-01_OVERFLOW_TO_LEACH_'],
  }),
  'P-LEACH-R01-R02': aliasSpec({ prefixes: ['LEACH_TRANSFER_1'] }),
  'P-LEACH-R02-R03': aliasSpec({ prefixes: ['LEACH_TRANSFER_2'] }),
  'P-LEACH-R03-R04': aliasSpec({ prefixes: ['LEACH_TRANSFER_3'] }),
  // V57 removes the redundant intermediate PUMP-01 equipment from the physical
  // route; retain its educational circuit slot as a semantic proxy at R04→CIP.
  'P-LEACHING-TO-PUMP-01': aliasSpec({
    prefixes: ['LEACH_TO_CIP'],
    proxySemantics: 'leach-discharge-transfer',
  }),
  'PUMP-01': aliasSpec({
    semanticOnly: true,
    bounds: { center: [345, 29.5, -105], size: [8, 5, 8] },
    proxySemantics: 'legacy-transfer-pump-semantic',
  }),
  'P-PUMP-01-TO-CIP': aliasSpec({
    prefixes: ['LEACH_TO_CIP'],
    proxySemantics: 'leach-to-cip-transfer',
  }),
  'MT-CIP-TO-ELUTION-CARBON': aliasSpec({
    names: ['V57_CIP01_TO_ELUTION_CARBON_ROOT', 'V52_PIPE_CIP_TO_ELUTION', 'V56_PIPE_CORE_V52_PIPE_CIP_TO_ELUTION'],
    prefixes: ['V57_CIP01_TO_ELUTION_CARBON_'],
    proxySemantics: 'loaded-carbon-route',
  }),
  'MT-ELUTION-TO-CIP-BARREN-CARBON': aliasSpec({
    names: ['V57_REGEN_TO_CIP06_ROOT'],
    prefixes: ['V57_REGEN_TO_CIP06_'],
    semanticOnly: true,
    proxySemantics: 'regenerated-carbon-return-route',
  }),
  'P-ELUTION-TO-EW': aliasSpec({
    prefixes: ['ELUTION-TO-EW-RICH', 'V57_RICH_ELUATE_'],
  }),
  'MT-EW-TO-SMELTING-CATHODE': aliasSpec({
    prefixes: ['V57_EW_GOLD_SOLIDS_', 'V57_CALCINE_TO_SMELTING_', 'GOLDROOM-CALCINE-SCREW'],
    proxySemantics: 'ew-to-smelting-solids',
  }),
});
