import { describe, expect, it } from 'vitest';
import {
  EQUIPMENT_RENDER_CONTRACTS,
  SUPPORT_EQUIPMENT_CONTRACTS,
  getEquipmentRenderContract,
} from '../../src/scene/integration/equipmentContracts.js';

describe('renderer-neutral equipment contracts', () => {
  it('freezes the V30-validated physical contract as the Babylon V31 authority', () => {
    expect(Object.keys(EQUIPMENT_RENDER_CONTRACTS)).toEqual([
      'romHopper',
      'apronFeeder',
      'jawCrusher',
      'ballMill',
      'slurryPump',
      'cycloneCluster',
      'leachReactor',
      'cip',
      'elution',
      'electrowinning',
      'smelting',
    ]);
    expect(EQUIPMENT_RENDER_CONTRACTS.romHopper.dimensions).toEqual({ length: 11.5, width: 9.2, height: 7.6 });
    expect(EQUIPMENT_RENDER_CONTRACTS.ballMill.ports.find((port) => port.id === 'slurryOut')).toMatchObject({
      position: [5.45, 3.05, 0],
      nominalDiameter: 0.45,
    });
    expect(EQUIPMENT_RENDER_CONTRACTS.slurryPump.ports.find((port) => port.id === 'discharge')).toMatchObject({
      position: [0, 1.92, 0],
      nominalDiameter: 0.25,
    });
    expect(SUPPORT_EQUIPMENT_CONTRACTS['STOCKPILE-RECLAIM']).toMatchObject({
      dimensions: { length: 50, width: 40, height: 10 },
    });
    expect(SUPPORT_EQUIPMENT_CONTRACTS['STOCKPILE-RECLAIM'].ports.find((port) => port.id === 'reclaimOut').position)
      .toEqual([27, 1.15, 8.9]);
  });

  it('returns null for unknown contracts', () => {
    expect(getEquipmentRenderContract('does-not-exist')).toBeNull();
  });
});
