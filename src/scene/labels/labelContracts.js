export const LABEL_ASPECT = 144 / 768;
export const SMALL_LABEL_ASPECT = 104 / 520;

export const LABEL_CAMERA_FOCUS_ZONES = Object.freeze({
  reception: Object.freeze(['Z1']),
  crushing: Object.freeze(['Z2', 'Z3']),
  grinding: Object.freeze(['Z4', 'Z5']),
  leaching: Object.freeze(['Z6', 'Z7']),
  recovery: Object.freeze(['Z8', 'Z7']),
});

export const EQUIPMENT_LABEL_DEFINITIONS = Object.freeze([
  Object.freeze({ equipmentId: 'ROM-HOPPER', text: 'ROM', zoneId: 'Z1', lift: 7.4 }),
  Object.freeze({ equipmentId: 'APRON-FEEDER', text: 'APRON', zoneId: 'Z1', lift: 3.3 }),
  Object.freeze({ equipmentId: 'PRIMARY-CRUSHER', text: 'CHANCADORA', zoneId: 'Z2', lift: 8.2 }),
  Object.freeze({ equipmentId: 'STOCKPILE-RECLAIM', text: 'STOCKPILE', zoneId: 'Z3', lift: 11.2 }),
  Object.freeze({ equipmentId: 'MILL-01', text: 'MILL-01', zoneId: 'Z4', lift: 5.8 }),
  Object.freeze({ equipmentId: 'SLURRY-PUMP-01', text: 'P-CLASIF.', zoneId: 'Z5', lift: 3.4 }),
  Object.freeze({ equipmentId: 'CLASS-01', text: 'CICLONES', zoneId: 'Z5', lift: 8.0 }),
  Object.freeze({ equipmentId: 'R-01', text: 'R-01', zoneId: 'Z6', lift: 8.6 }),
  Object.freeze({ equipmentId: 'R-02', text: 'R-02', zoneId: 'Z6', lift: 8.6 }),
  Object.freeze({ equipmentId: 'R-03', text: 'R-03', zoneId: 'Z6', lift: 8.6 }),
  Object.freeze({ equipmentId: 'R-04', text: 'R-04', zoneId: 'Z6', lift: 8.6 }),
  Object.freeze({ equipmentId: 'PUMP-01', text: 'PUMP-01', zoneId: 'Z7', lift: 3.5 }),
  Object.freeze({ equipmentId: 'CIP-ADSORPTION', text: 'CIP', zoneId: 'Z8', lift: 4.2 }),
  Object.freeze({ equipmentId: 'ELUTION-SKID', text: 'ELUCIÓN', zoneId: 'Z8', lift: 4.2 }),
  Object.freeze({ equipmentId: 'EW-CELLS', text: 'EW', zoneId: 'Z8', lift: 3.0 }),
  Object.freeze({ equipmentId: 'SMELTING-FURNACE', text: 'FUNDICIÓN', zoneId: 'Z8', lift: 5.2 }),
]);

const OVERVIEW_CAMERAS = new Set(['general', 'top', 'oblique']);

export function getLabelPresentationForCamera(zoneId, cameraId, kind = 'zone') {
  if (kind === 'inspection') return Object.freeze({ visible: cameraId === 'inspection', opacity: cameraId === 'inspection' ? 1 : 0, scale: 1 });
  if (kind === 'component') return Object.freeze({ visible: cameraId === 'inspection', opacity: cameraId === 'inspection' ? 0.90 : 0, scale: 0.82 });
  if (cameraId === 'inspection') return Object.freeze({ visible: false, opacity: 0, scale: 0.72 });
  const focusZones = LABEL_CAMERA_FOCUS_ZONES[cameraId] ?? [];
  if (kind === 'equipment') {
    if (focusZones.includes(zoneId)) return Object.freeze({ visible: true, opacity: 0.98, scale: 1.08 });
    if (cameraId === 'general' || cameraId === 'oblique') return Object.freeze({ visible: true, opacity: 0.72, scale: 0.90 });
    if (cameraId === 'top') return Object.freeze({ visible: true, opacity: 0.70, scale: 0.88 });
    return Object.freeze({ visible: false, opacity: 0, scale: 0.7 });
  }
  if (OVERVIEW_CAMERAS.has(cameraId)) return Object.freeze({ visible: true, opacity: cameraId === 'top' ? 0.82 : 0.90, scale: 1 });
  if (focusZones.includes(zoneId)) return Object.freeze({ visible: true, opacity: 0.98, scale: 1.10 });
  return Object.freeze({ visible: true, opacity: 0.28, scale: 0.76 });
}
