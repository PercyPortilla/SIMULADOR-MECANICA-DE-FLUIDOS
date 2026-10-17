import { describe, expect, it } from 'vitest';
import { createBaseScene } from '../../src/scene/baseEnvironment.js';
import {
  GEOTECH_UNITS,
  getGroundwaterElevation,
  sampleNaturalStratigraphy,
} from '../../src/scene/geotech/geotechModel.js';
import { MINE_AUXILIARY_AREAS, PIT_DESIGN } from '../../src/scene/config/siteDesign.js';

function collectNames(root) {
  const names = [];
  root.traverse((object) => { if (object.name) names.push(object.name); });
  return names;
}

describe('V13 geotechnical visualization', () => {
  it('defines natural, engineered and hydrogeological units without physics properties', () => {
    const ids = GEOTECH_UNITS.map((unit) => unit.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('topsoil');
    expect(ids).toContain('granular-soil');
    expect(ids).toContain('cohesive-soil');
    expect(ids).toContain('weathered-rock');
    expect(ids).toContain('competent-rock');
    expect(ids).toContain('structural-fill');
    expect(ids).toContain('secondary-containment');
    expect(ids).toContain('groundwater');
    GEOTECH_UNITS.forEach((unit) => {
      expect(unit).not.toHaveProperty('cohesion');
      expect(unit).not.toHaveProperty('frictionAngle');
      expect(unit).not.toHaveProperty('bearingCapacity');
      expect(unit).not.toHaveProperty('elasticModulus');
    });
  });

  it('keeps stratigraphic boundaries ordered and derived from the existing terrain', () => {
    const samples = [
      [-270, 80], [-88, -30], [8, -38], [80, -6], [224, 26], [210, -90],
    ];
    samples.forEach(([x, z]) => {
      const profile = sampleNaturalStratigraphy(x, z);
      expect(profile.surfaceY).toBeGreaterThan(profile.topsoilBottomY);
      expect(profile.topsoilBottomY).toBeGreaterThan(profile.naturalSoilBottomY);
      expect(profile.naturalSoilBottomY).toBeGreaterThan(profile.weatheredRockBottomY);
      expect(profile.weatheredRockBottomY).toBeGreaterThan(profile.competentRockBottomY);
    });
    expect(sampleNaturalStratigraphy(224, 26).surficialSoilId).toBe('cohesive-soil');
    const pitFloorProfile = sampleNaturalStratigraphy(PIT_DESIGN.center.x, PIT_DESIGN.center.z);
    expect(pitFloorProfile.topsoilThicknessM).toBeLessThan(0.1);
    expect(pitFloorProfile.naturalSoilThicknessM).toBeLessThan(0.8);
  });

  it('starts hidden and toggles subsurface visibility without moving equipment or changing the circuit', () => {
    const base = createBaseScene();
    const system = base.geotechnicalSystem;
    const millPosition = base.equipmentSystem.getEquipment('MILL-01').group3D.position.clone();
    const routeId = base.processRoute.id;

    expect(system.root.name).toBe('geotechnical-system');
    expect(system.root.visible).toBe(false);
    expect(system.root.userData.visualOnly).toBe(true);
    expect(system.root.userData.physicsCoupled).toBe(false);

    system.setVisible(true);
    expect(system.visible).toBe(true);
    expect(base.ground.material.transparent).toBe(true);
    expect(base.ground.material.opacity).toBeCloseTo(0.30);
    expect(base.equipmentSystem.getEquipment('MILL-01').group3D.position.equals(millPosition)).toBe(true);
    expect(base.processRoute.id).toBe(routeId);

    system.setVisible(false);
    expect(system.visible).toBe(false);
    expect(base.ground.material.opacity).toBeCloseTo(1);
  });

  it('contains the required geotechnical sections and no fictitious flotation or heap-leach object', () => {
    const base = createBaseScene();
    const names = collectNames(base.geotechnicalSystem.root);
    expect(names).toContain('geotech-stratigraphic-transect');
    expect(names).toContain('PRIMARY-CRUSHER-geotech-foundation-assembly');
    expect(names).toContain('MILL-01-geotech-foundation-assembly');
    expect(names).toContain('ROAD-01-geotech-section');
    expect(names).toContain('stockpile-geotech-platform');
    expect(names).toContain('stockpile-drainage-blanket');
    expect(names).toContain('R-04-soft-ground-treatment');
    expect(names).toContain('geotech-secondary-containment');
    expect(names).toContain('conceptual-groundwater-surface');
    expect(names.some((name) => /flotation|heap[- ]?leach/i.test(name))).toBe(false);

    const barrier = base.geotechnicalSystem.root.getObjectByName('reactor-train-impermeable-barrier');
    expect(barrier.userData.containmentType).toBe('secondary');
    expect(barrier.userData.heapLeach).toBe(false);
  });

  it('depresses the conceptual groundwater surface toward the pit sump', () => {
    const sump = MINE_AUXILIARY_AREAS.pitSump;
    const sumpLevel = getGroundwaterElevation(sump.x, sump.z);
    const rimLevel = getGroundwaterElevation(
      PIT_DESIGN.center.x + PIT_DESIGN.radiusX * 1.02,
      PIT_DESIGN.center.z,
    );
    expect(sumpLevel).toBeLessThan(rimLevel);
    expect(sumpLevel).toBeLessThan(PIT_DESIGN.floorElevation + 4.5);
  });

  it('disposes the optional subsystem and restores the base terrain material', () => {
    const base = createBaseScene();
    base.geotechnicalSystem.setVisible(true);
    base.geotechnicalSystem.dispose();
    expect(base.geotechnicalSystem.root.parent).toBeNull();
    expect(base.ground.material.opacity).toBeCloseTo(1);
  });
});
