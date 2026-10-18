import { describe, expect, it } from 'vitest';
import {
  EQUIPMENT_LABEL_DEFINITIONS,
  LABEL_CAMERA_FOCUS_ZONES,
  getLabelPresentationForCamera,
} from '../../src/scene/labels/labelContracts.js';

describe('renderer-neutral V30 label contracts', () => {
  it('preserves the 16 equipment labels and camera focus zones', () => {
    expect(EQUIPMENT_LABEL_DEFINITIONS).toHaveLength(16);
    expect(EQUIPMENT_LABEL_DEFINITIONS[0]).toMatchObject({ equipmentId: 'ROM-HOPPER', text: 'ROM', lift: 7.4 });
    expect(EQUIPMENT_LABEL_DEFINITIONS.at(-1)).toMatchObject({ equipmentId: 'SMELTING-FURNACE', text: 'FUNDICIÓN', lift: 5.2 });
    expect(LABEL_CAMERA_FOCUS_ZONES.recovery).toEqual(['Z8', 'Z7']);
  });

  it('keeps Inspection uncluttered while preserving selected/component labels', () => {
    expect(getLabelPresentationForCamera('Z4', 'inspection', 'equipment').visible).toBe(false);
    expect(getLabelPresentationForCamera(null, 'inspection', 'inspection')).toMatchObject({ visible: true, opacity: 1 });
    expect(getLabelPresentationForCamera(null, 'inspection', 'component').visible).toBe(true);
  });
});
