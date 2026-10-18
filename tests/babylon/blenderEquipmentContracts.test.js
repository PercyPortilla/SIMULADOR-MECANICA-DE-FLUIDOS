import { describe, expect, it } from 'vitest';
import {
  BLENDER_EQUIPMENT_CONTRACTS,
  getBlenderEquipmentContract,
} from '../../src/scene/integration/blenderEquipmentContracts.js';

describe('renderer-neutral Blender equipment contracts', () => {
  it('freezes every V30-validated Blender replacement as a renderer-neutral V31 contract', () => {
    expect(Object.keys(BLENDER_EQUIPMENT_CONTRACTS)).toEqual([
      'ROM-HOPPER', 'APRON-FEEDER', 'PRIMARY-CRUSHER', 'STOCKPILE-RECLAIM',
      'EXCAVATOR-01', 'TRUCK-01', 'TRUCK-02', 'TRUCK-03', 'LOADER-01',
      'MILL-01', 'SUMP-01', 'SLURRY-PUMP-01', 'CLASS-01',
      'R-01', 'R-02', 'R-03', 'R-04', 'PUMP-01',
      'CIP-ADSORPTION', 'ELUTION-SKID', 'EW-CELLS', 'SMELTING-FURNACE',
    ]);
    expect(getBlenderEquipmentContract('ROM-HOPPER').preserveProceduralOverlays)
      .toEqual(['rom-grizzly', 'rom-truck-dump-throat']);
    expect(getBlenderEquipmentContract('CIP-ADSORPTION').educationalProcessNodes).toHaveLength(4);
    expect(getBlenderEquipmentContract('SMELTING-FURNACE').animationPacing)
      .toEqual({ cycleSeconds: 16, activeStartSeconds: 8.8, activeEndSeconds: 13.12 });
  });

  it('exposes mobile, fixed-process and mirrored stockpile contracts', () => {
    expect(getBlenderEquipmentContract('TRUCK-01').semanticControl).toBe('haul-truck');
    expect(getBlenderEquipmentContract('MILL-01').rotationPivotRepair.axis).toBe('x');
    expect(getBlenderEquipmentContract('STOCKPILE-RECLAIM').importedScale).toEqual([1, 1, -1]);
    expect(getBlenderEquipmentContract('not-real')).toBeNull();
  });
});
