export const V50_SITE_VISUAL_URL = 'models/pulpa-v50/PULPA_LAB_V50_FULL_SITE.glb';

// Blender V50 (V48 environment + corrected circuit positions) exports Z-up
// coordinates to glTF/Babylon Y-up as:
// (blender X, blender Y, blender Z) -> (babylon X, blender Z, -blender Y).
// These bounds/anchors describe the authored V50 site, not the superseded V30
// procedural mine layout that remains available only as a logical fallback.
export const V50_SITE_BOUNDS = Object.freeze({
  minX: -36,
  maxX: 386,
  minY: -8,
  maxY: 20,
  minZ: -56,
  maxZ: 56,
});
export const V50_ZONE_ANCHORS = Object.freeze({
  Z1: Object.freeze({ x: 180, y: 3.7, z: 0 }),
  Z2: Object.freeze({ x: 204, y: 3.0, z: 0 }),
  Z3: Object.freeze({ x: 264, y: 4.5, z: 0 }),
  Z4: Object.freeze({ x: 334, y: 5.0, z: -35 }),
  Z5: Object.freeze({ x: 308, y: 4.6, z: -35 }),
  Z6: Object.freeze({ x: 272, y: 6.5, z: -35 }),
  Z7: Object.freeze({ x: 249, y: 4.0, z: -35 }),
  Z8: Object.freeze({ x: 210, y: 5.0, z: -35 }),
});

export const V50_EQUIPMENT_ANCHORS = Object.freeze({
  'ROM-HOPPER': Object.freeze({ x: 180, y: 3.684, z: 0 }),
  'APRON-FEEDER': Object.freeze({ x: 190, y: 1.058, z: 0.45 }),
  'PRIMARY-CRUSHER': Object.freeze({ x: 204, y: 2.277, z: 0.194 }),
  'STOCKPILE-RECLAIM': Object.freeze({ x: 263.778, y: 4.42, z: 0 }),
  'MILL-01': Object.freeze({ x: 334, y: 4.895, z: -35.643 }),
  'SUMP-01': Object.freeze({ x: 322, y: 3.872, z: -35 }),
  'SLURRY-PUMP-01': Object.freeze({ x: 313.087, y: 3.423, z: -35 }),
  'CLASS-01': Object.freeze({ x: 303.035, y: 4.463, z: -35.027 }),
  'R-01': Object.freeze({ x: 289, y: 6.46, z: -35.117 }),
  'R-02': Object.freeze({ x: 278, y: 6.46, z: -35.117 }),
  'R-03': Object.freeze({ x: 267, y: 6.46, z: -35.117 }),
  'R-04': Object.freeze({ x: 256, y: 6.46, z: -35.117 }),
  'PUMP-01': Object.freeze({ x: 249, y: 3.423, z: -35.087 }),
  'CIP-ADSORPTION': Object.freeze({ x: 239, y: 4.927, z: -35 }),
  'ELUTION-SKID': Object.freeze({ x: 217.925, y: 4.688, z: -35 }),
  'EW-CELLS': Object.freeze({ x: 200, y: 3.33, z: -35 }),
  'SMELTING-FURNACE': Object.freeze({ x: 182, y: 6.3, z: -35 }),
  'LOADER-01': Object.freeze({ x: 291.171, y: 2.01, z: -18.324 }),
  'TRUCK-01': Object.freeze({ x: 300, y: -0.17, z: 8 }),
  'TRUCK-02': Object.freeze({ x: 314, y: -0.17, z: 0 }),
  'TRUCK-03': Object.freeze({ x: 326, y: -0.15, z: -8 }),
  'EXCAVATOR-01': Object.freeze({ x: 343, y: -0.18, z: 0 }),
});

// Inspection's renderer-neutral circuit keeps stable educational IDs. Several
// corrected transfer objects retain their V49_* Blender names for compatibility
// even though the authoritative master is V50.
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

export const V50_INSPECTION_NODE_ALIASES = Object.freeze({
  'ROM-TO-FEEDER-CHUTE': aliasSpec({ names: ['V49_ROM_TO_APRON_CHUTE'] }),
  'CV-01-FEEDER-TO-CRUSHER': aliasSpec({ prefixes: ['V49_APRON_TO_CRUSHER_'] }),
  'CV-02-CRUSHER-TO-STOCKPILE': aliasSpec({ prefixes: ['V49_CV02_'] }),
  'CV-03-STOCKPILE-TO-GRINDING': aliasSpec({ prefixes: ['V49_CV03_'] }),
  'P-MILL-TO-SUMP': aliasSpec({ names: ['V49_PIPE_MILL_TO_SUMP'] }),
  'P-SUMP-TO-PUMP': aliasSpec({ names: ['V16_PIPE_SUMP_TO_PUMP'] }),
  'P-PUMP-TO-CYCLONES': aliasSpec({ names: ['V16_PIPE_PUMP_TO_CLASS'] }),
  'P-CYCLONE-UNDERFLOW-RETURN': aliasSpec({
    semanticOnly: true,
    bounds: { center: [318.5, 3.8, -35], size: [31, 4.5, 6] },
  }),
  'P-CLASSIFICATION-TO-LEACH': aliasSpec({ names: ['V16_PIPE_CLASS_TO_LEACH'] }),
  'P-LEACH-R01-R02': aliasSpec({ names: ['V39_PIPE_R01_TO_R02'] }),
  'P-LEACH-R02-R03': aliasSpec({ names: ['V39_PIPE_R02_TO_R03'] }),
  'P-LEACH-R03-R04': aliasSpec({ names: ['V39_PIPE_R03_TO_R04'] }),
  'P-LEACHING-TO-PUMP-01': aliasSpec({ names: ['V37_PIPE_R04_TO_PUMP'] }),
  'P-PUMP-01-TO-CIP': aliasSpec({ names: ['V37_PIPE_PUMP_TO_CIP'] }),
  'MT-CIP-TO-ELUTION-CARBON': aliasSpec({
    names: ['V39_PIPE_CIP_TO_ELUTION'],
    proxySemantics: 'loaded-carbon-route',
  }),
  'MT-ELUTION-TO-CIP-BARREN-CARBON': aliasSpec({
    names: ['V16_PIPE_CIP_TO_ELUTION'],
    proxySemantics: 'barren-carbon-return-route',
  }),
  'P-ELUTION-TO-EW': aliasSpec({ names: ['V39_PIPE_ELUTION_TO_EW'] }),
  'MT-EW-TO-SMELTING-CATHODE': aliasSpec({ names: ['V39_EW_SMELT_CART'] }),
});
