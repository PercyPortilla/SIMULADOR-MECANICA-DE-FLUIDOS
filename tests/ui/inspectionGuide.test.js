import { describe, expect, it } from 'vitest';
import { INSPECTION_CIRCUIT_ORDER } from '../../src/scene/inspection/equipmentInspection.js';
import {
  INSPECTION_GUIDE,
  INSPECTION_COMPONENT_HOTSPOTS,
  PRESENTATION_STOP_IDS,
  getInspectionComponentHotspots,
  getInspectionGuideEntry,
  getInspectionRelatedResult,
  getInspectionStage,
  getPresentationStops,
} from '../../src/ui/inspectionGuide.js';

describe('inspection educational guide', () => {
  it('covers every explicit process target exactly once', () => {
    expect(Object.keys(INSPECTION_GUIDE)).toEqual([...INSPECTION_CIRCUIT_ORDER]);
    expect(Object.keys(INSPECTION_GUIDE)).toHaveLength(38);
  });

  it('provides the five educational fields for every target', () => {
    INSPECTION_CIRCUIT_ORDER.forEach((id) => {
      const guide = getInspectionGuideEntry(id);
      expect(guide).toBeTruthy();
      expect(guide.purpose.length).toBeGreaterThan(12);
      expect(guide.input.length).toBeGreaterThan(5);
      expect(guide.output.length).toBeGreaterThan(5);
      expect(guide.keyVariable.length).toBeGreaterThan(5);
      expect(guide.calculationImpact.length).toBeGreaterThan(20);
    });
  });

  it('maps every process target to an explicit stage and related result', () => {
    INSPECTION_CIRCUIT_ORDER.forEach((id) => {
      expect(getInspectionStage(id).length).toBeGreaterThan(4);
      expect(getInspectionRelatedResult(id).length).toBeGreaterThan(8);
    });
    expect(getInspectionStage('MILL-01')).toMatch(/Molienda/i);
    expect(getInspectionRelatedResult('P-LEACH-R01-R02')).toMatch(/ΔP/);
    expect(getInspectionRelatedResult('CIP-ADSORPTION')).toMatch(/Recuperación global/i);
  });

  it('does not claim every visual pipe is an independent hydraulic model', () => {
    expect(getInspectionGuideEntry('P-LEACH-R01-R02').calculationImpact).toContain('Pipe 1');
    expect(getInspectionGuideEntry('P-LEACH-R02-R03').calculationImpact).toContain('no es un segundo Pipe 1');
  });

  it('adds compact component hotspots to the V25 priority equipment without changing target count', () => {
    expect(Object.keys(INSPECTION_COMPONENT_HOTSPOTS).sort()).toEqual([
      'CIP-ADSORPTION',
      'CLASS-01',
      'ELUTION-SKID',
      'EW-CELLS',
      'MILL-01',
      'PRIMARY-CRUSHER',
      'SLURRY-PUMP-01',
      'SMELTING-FURNACE',
    ]);
    Object.keys(INSPECTION_COMPONENT_HOTSPOTS).forEach((id) => {
      const hotspots = getInspectionComponentHotspots(id);
      expect(hotspots.length).toBeGreaterThanOrEqual(4);
      hotspots.forEach((item) => {
        expect(item.component.length).toBeGreaterThan(3);
        expect(item.function.length).toBeGreaterThan(15);
        expect(item.processLink.length).toBeGreaterThan(15);
      });
    });
    expect(getInspectionComponentHotspots('R-01')).toEqual([]);
    expect(getInspectionComponentHotspots('EW-CELLS').map((item) => item.component)).toContain('Ánodos y cátodos');
    expect(getInspectionComponentHotspots('SMELTING-FURNACE').map((item) => item.component)).toContain('Mecanismo de inclinación');
    expect(Object.keys(INSPECTION_GUIDE)).toHaveLength(38);
  });

  it('defines a compact presentation route as an ordered unique subsequence of the circuit', () => {
    expect(PRESENTATION_STOP_IDS).toHaveLength(19);
    expect(new Set(PRESENTATION_STOP_IDS).size).toBe(PRESENTATION_STOP_IDS.length);
    const ranks = PRESENTATION_STOP_IDS.map((id) => INSPECTION_CIRCUIT_ORDER.indexOf(id));
    expect(ranks.every((index) => index >= 0)).toBe(true);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it('provides a complete educational guide for every presentation stop', () => {
    const stops = getPresentationStops();
    expect(stops.map((stop) => stop.id)).toEqual([...PRESENTATION_STOP_IDS]);
    stops.forEach((stop) => {
      expect(stop.guide).toBeTruthy();
      expect(stop.guide.purpose.length).toBeGreaterThan(12);
      expect(stop.guide.input.length).toBeGreaterThan(5);
      expect(stop.guide.output.length).toBeGreaterThan(5);
      expect(stop.guide.keyVariable.length).toBeGreaterThan(5);
    });
  });
});
