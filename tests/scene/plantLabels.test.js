import { describe, expect, it } from 'vitest';
import {
  createPlantLabels,
  getLabelPresentationForCamera,
  setPlantLabelsPresentationMode,
  setPlantLabelsVisible,
} from '../../src/scene/labels/plantLabels.js';

describe('plant labels', () => {
  it('creates a dedicated label group without duplicating layout placeholders', () => {
    const labels = createPlantLabels();
    expect(labels.name).toBe('plant-labels');
    // In node/vitest there is no DOM canvas, so sprites are created only in browser.
    expect(labels.children.every((child) => child.userData.plantLabel === true)).toBe(true);
  });

  it('supports explicit visibility control', () => {
    const labels = createPlantLabels();
    setPlantLabelsVisible(labels, false);
    expect(labels.visible).toBe(false);
    expect(labels.userData.labelsVisible).toBe(false);
    setPlantLabelsVisible(labels, true);
    expect(labels.visible).toBe(true);
  });

  it('prioritizes labels for the active zone without hiding context labels', () => {
    const active = getLabelPresentationForCamera('Z6', 'leaching');
    const distant = getLabelPresentationForCamera('Z2', 'leaching');
    expect(active.visible).toBe(true);
    expect(distant.visible).toBe(true);
    expect(active.opacity).toBeGreaterThan(distant.opacity);
    expect(active.scale).toBeGreaterThan(distant.scale);
  });

  it('keeps overview labels readable while inspection preserves only selected/component labels', () => {
    const overview = getLabelPresentationForCamera('Z1', 'general');
    const top = getLabelPresentationForCamera('Z8', 'top');
    const inspectionZone = getLabelPresentationForCamera('Z4', 'inspection', 'zone');
    const inspectionEquipment = getLabelPresentationForCamera('Z4', 'inspection', 'equipment');
    const selected = getLabelPresentationForCamera(null, 'inspection', 'inspection');
    const component = getLabelPresentationForCamera(null, 'inspection', 'component');
    expect(overview.opacity).toBeGreaterThan(0.85);
    expect(top.opacity).toBeLessThan(overview.opacity);
    expect(inspectionZone.visible).toBe(false);
    expect(inspectionEquipment.visible).toBe(false);
    expect(selected.visible).toBe(true);
    expect(selected.opacity).toBe(1);
    expect(component.visible).toBe(true);
    expect(component.opacity).toBeGreaterThan(0.8);
  });

  it('keeps the label layer alive in Presentation while preserving the prior user visibility', () => {
    const labels = createPlantLabels();
    setPlantLabelsVisible(labels, false);
    expect(labels.visible).toBe(false);
    setPlantLabelsPresentationMode(labels, true);
    expect(labels.visible).toBe(true);
    expect(labels.userData.labelsVisible).toBe(false);
    expect(labels.userData.presentationMode).toBe(true);
    setPlantLabelsPresentationMode(labels, false);
    expect(labels.visible).toBe(false);
  });
});
