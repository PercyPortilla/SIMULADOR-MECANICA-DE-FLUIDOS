function spec(value) {
  const result = { ...value };
  for (const key of [
    'preserveProceduralOverlays',
    'hideImportedNamePrefixes',
    'importedScale',
    'educationalProcessNodes',
    'educationalHostProcessNodes',
  ]) {
    if (Array.isArray(result[key])) {
      result[key] = Object.freeze(result[key].map((item) => (
        item && typeof item === 'object' && !Array.isArray(item)
          ? Object.freeze({ ...item })
          : item
      )));
    }
  }
  if (result.rotationPivotRepair) result.rotationPivotRepair = Object.freeze({ ...result.rotationPivotRepair });
  if (result.animationPacing) result.animationPacing = Object.freeze({ ...result.animationPacing });
  if (result.proceduralOverlayPositions) {
    result.proceduralOverlayPositions = Object.freeze(Object.fromEntries(
      Object.entries(result.proceduralOverlayPositions).map(([key, position]) => [key, Object.freeze([...position])]),
    ));
  }
  return Object.freeze(result);
}

/**
 * Renderer-neutral Blender asset contract shared by the V30 Three adapter and
 * the V31 Babylon adapter. Fields that refer to procedural overlays remain in
 * the contract because they are semantic migration requirements even when the
 * Babylon implementation has not ported those overlays yet.
 */
export const BLENDER_EQUIPMENT_CONTRACTS = Object.freeze({
  'ROM-HOPPER': spec({
    url: 'models/pulpa-blender/ROM-HOPPER.glb',
    keepProceduralUpdate: true,
    preserveProceduralOverlays: ['rom-grizzly', 'rom-truck-dump-throat'],
    hideImportedNamePrefixes: ['ROM-HOPPER_GRIZZLY_'],
  }),
  'APRON-FEEDER': spec({
    url: 'models/pulpa-blender/APRON-FEEDER.glb',
    playAllAnimations: true,
  }),
  'PRIMARY-CRUSHER': spec({
    url: 'models/pulpa-blender/PRIMARY-CRUSHER.glb',
    playAllAnimations: true,
    keepProceduralUpdate: true,
    preserveProceduralOverlays: ['PRIMARY-CRUSHER-v23-safety-overlay', 'PRIMARY-CRUSHER-v29-ore-flow'],
    hideImportedNamePrefixes: ['PRIMARY-CRUSHER_ORE_'],
  }),
  'STOCKPILE-RECLAIM': spec({
    url: 'models/pulpa-blender/STOCKPILE-RECLAIM.glb',
    preserveProceduralOverlays: ['STOCKPILE-RECLAIM-motion', 'STOCKPILE-RECLAIM-v24-feed-flow'],
    importedScale: [1, 1, -1],
    hideImportedNamePrefixes: [
      'STOCKPILE-RECLAIM_FEEDER',
      'STOCKPILE-RECLAIM_GRIZZLY_',
      'STOCKPILE-RECLAIM_PAN_',
    ],
  }),
  'EXCAVATOR-01': spec({
    url: 'models/pulpa-blender/MINING-SHOVEL.glb',
    playAllAnimations: true,
    materialLoadNode: 'MINING-SHOVEL_BUCKET_ORE',
    initialMaterialLoadVisible: false,
  }),
  'TRUCK-01': spec({ url: 'models/pulpa-blender/HAUL-TRUCK.glb', semanticControl: 'haul-truck' }),
  'TRUCK-02': spec({ url: 'models/pulpa-blender/HAUL-TRUCK.glb', semanticControl: 'haul-truck' }),
  'TRUCK-03': spec({ url: 'models/pulpa-blender/HAUL-TRUCK.glb', semanticControl: 'haul-truck' }),
  'LOADER-01': spec({
    url: 'models/pulpa-blender/WHEEL-LOADER.glb',
    playAllAnimations: true,
    semanticControl: 'wheel-loader',
    materialLoadNode: 'WHEEL-LOADER_BUCKET_ORE',
    initialMaterialLoadVisible: false,
  }),
  'MILL-01': spec({
    url: 'models/pulpa-blender/MILL-01.glb',
    expectedAnimation: 'MILL-01_Rotation',
    rotationPivotRepair: { nodeName: 'MILL-01_ROTATING_GROUP', axis: 'x' },
    preserveProceduralOverlays: ['mill-charge'],
  }),
  'SUMP-01': spec({
    url: 'models/pulpa-blender/SUMP-01.glb',
    keepProceduralUpdate: true,
    preserveProceduralOverlays: ['SUMP-01-slurry', 'SUMP-01-suspended-solids'],
  }),
  'SLURRY-PUMP-01': spec({
    url: 'models/pulpa-blender/SLURRY-PUMP-01.glb',
    expectedAnimation: 'SLURRY-PUMP-01_ShaftRotation',
    rotationPivotRepair: { nodeName: 'SLURRY-PUMP-01_ROTATING_GROUP', axis: 'x' },
    keepProceduralUpdate: true,
    preserveProceduralOverlays: ['pump-impeller', 'pump-slurry-path'],
    proceduralOverlayPositions: { 'pump-impeller': [-1.15, 1.18, 0] },
  }),
  'CLASS-01': spec({
    url: 'models/pulpa-blender/CLASS-01.glb',
    keepProceduralUpdate: true,
    preserveProceduralOverlays: [
      'cyclone-1-swirl',
      'cyclone-2-swirl',
      'cyclone-3-swirl',
      'cyclone-4-swirl',
      'cyclone-5-swirl',
      'cyclone-6-swirl',
      'cyclone-manifold-suspended-solids',
      'CLASS-01-v24-mechanical-access',
    ],
  }),
  'R-01': spec({
    url: 'models/pulpa-blender/LEACH-REACTOR.glb',
    expectedAnimation: 'LEACH_REACTOR_Agitator',
    educationalProcessNodes: [{ name: 'LEACH-REACTOR_SLURRY', mode: 'liquid', phase: 0.0 }],
  }),
  'R-02': spec({
    url: 'models/pulpa-blender/LEACH-REACTOR.glb',
    expectedAnimation: 'LEACH_REACTOR_Agitator',
    educationalProcessNodes: [{ name: 'LEACH-REACTOR_SLURRY', mode: 'liquid', phase: 0.9 }],
  }),
  'R-03': spec({
    url: 'models/pulpa-blender/LEACH-REACTOR.glb',
    expectedAnimation: 'LEACH_REACTOR_Agitator',
    educationalProcessNodes: [{ name: 'LEACH-REACTOR_SLURRY', mode: 'liquid', phase: 1.8 }],
  }),
  'R-04': spec({
    url: 'models/pulpa-blender/LEACH-REACTOR.glb',
    expectedAnimation: 'LEACH_REACTOR_Agitator',
    educationalProcessNodes: [{ name: 'LEACH-REACTOR_SLURRY', mode: 'liquid', phase: 2.7 }],
  }),
  'PUMP-01': spec({
    url: 'models/pulpa-blender/SLURRY-PUMP-01.glb',
    expectedAnimation: 'SLURRY-PUMP-01_ShaftRotation',
    rotationPivotRepair: { nodeName: 'SLURRY-PUMP-01_ROTATING_GROUP', axis: 'x' },
    keepProceduralUpdate: true,
    preserveProceduralOverlays: ['pump-impeller', 'pump-slurry-path'],
    proceduralOverlayPositions: { 'pump-impeller': [-1.15, 1.18, 0] },
  }),
  'CIP-ADSORPTION': spec({
    url: 'models/pulpa-blender/CIP-ADSORPTION.glb',
    expectedAnimation: 'CIP_Agitators',
    educationalProcessNodes: [
      { name: 'CIP-ADSORPTION_SLURRY_-500', mode: 'liquid', phase: 0.0 },
      { name: 'CIP-ADSORPTION_SLURRY_-167', mode: 'liquid', phase: 0.7 },
      { name: 'CIP-ADSORPTION_SLURRY_+167', mode: 'liquid', phase: 1.4 },
      { name: 'CIP-ADSORPTION_SLURRY_+500', mode: 'liquid', phase: 2.1 },
    ],
    preserveProceduralOverlays: [
      'cip-access-ladder',
      'cip-service-deck',
      'cip-pump-a-skid',
      'cip-pump-a-motor',
      'cip-pump-b-skid',
      'cip-pump-b-motor',
    ],
  }),
  'ELUTION-SKID': spec({
    url: 'models/pulpa-blender/ELUTION-SKID.glb',
    educationalHostProcessNodes: [
      { name: 'elution-column-solution', mode: 'liquid', phase: 0.3 },
      { name: 'elution-tank-liquid', mode: 'liquid', phase: 1.1 },
    ],
    preserveProceduralOverlays: [
      'elution-column-solution',
      'elution-tank-liquid',
      'elution-hx-tube--4',
      'elution-hx-tube--3',
      'elution-hx-tube--2',
      'elution-hx-tube--1',
      'elution-hx-tube-0',
      'elution-hx-tube-1',
      'elution-hx-tube-2',
      'elution-hx-tube-3',
      'elution-hx-tube-4',
    ],
  }),
  'EW-CELLS': spec({
    url: 'models/pulpa-blender/EW-CELLS.glb',
    educationalProcessNodes: [
      { name: 'EW-CELLS_ELECTROLYTE_1', mode: 'liquid', phase: 0.0 },
      { name: 'EW-CELLS_ELECTROLYTE_2', mode: 'liquid', phase: 0.8 },
      { name: 'EW-CELLS_ELECTROLYTE_3', mode: 'liquid', phase: 1.6 },
      { name: 'EW-CELLS_ELECTROLYTE_4', mode: 'liquid', phase: 2.4 },
    ],
  }),
  'SMELTING-FURNACE': spec({
    url: 'models/pulpa-blender/SMELTING-FURNACE.glb',
    expectedAnimation: 'SMELTING_FURNACE_Tilt',
    animationPacing: { cycleSeconds: 16, activeStartSeconds: 8.8, activeEndSeconds: 13.12 },
    educationalProcessNodes: [
      { name: 'SMELTING-FURNACE_MELT', mode: 'glow', phase: 0.0 },
      { name: 'SMELTING-FURNACE_CRUCIBLE_GLOW', mode: 'glow', phase: 1.1 },
    ],
  }),
});

export function getBlenderEquipmentContract(instanceId) {
  return BLENDER_EQUIPMENT_CONTRACTS[instanceId] ?? null;
}
