import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createBaseScene } from '../../src/scene/baseEnvironment.js';

describe('base 3D environment', () => {
  it('creates only the requested environment and no fog', () => {
    const environment = createBaseScene();

    expect(environment.scene.fog).toBeNull();
    expect(environment.scene.getObjectByName('environment-root')).toBeTruthy();
    expect(environment.environmentRoot.parent).toBe(environment.scene);
    expect(environment.skyDome.material.side).toBe(THREE.BackSide);
    expect(environment.skyDome.userData.atmosphereProfile).toBe('clear-highland-blue');
    expect(environment.ground.name).toBe('base-ground');
    expect(environment.ground.userData.surfaceProfile).toBe('compacted-weathered-rock');
    expect(environment.blenderTerrainOverlay.root.name).toBe('reception-earthwork-v26-overlay');
    expect(environment.blenderTerrainOverlay.root.userData.visualOnly).toBe(true);
    expect(environment.blenderTerrainOverlay.root.userData.authoritativeTerrain).toBe(false);
    expect(environment.blenderTerrainOverlay.root.userData.blenderVisualStatus).toBe('ssr-procedural-fallback');
    expect(environment.scene.getObjectByName('reception-earthwork-v26-overlay')).toBeTruthy();
    expect(environment.platform.name).toBe('central-concrete-platform');
    expect(environment.grid.name).toBe('platform-technical-grid');
    expect(environment.scene.getObjectByName('base-ground')).toBeTruthy();
    expect(environment.scene.getObjectByName('central-concrete-platform')).toBeTruthy();
    expect(environment.scene.getObjectByName('platform-technical-grid')).toBeTruthy();
    expect(environment.scene.getObjectByName('haul-roads')).toBeTruthy();
    expect(environment.scene.getObjectByName('industrial-pads')).toBeTruthy();
    expect(environment.scene.getObjectByName('plant-layout-placeholders')).toBeFalsy();
    expect(environment.scene.getObjectByName('Z1-temporary-label')).toBeFalsy();
    expect(environment.scene.getObjectByName('integrated-equipment-v1')).toBeTruthy();
    expect(environment.scene.getObjectByName('R-01')).toBeTruthy();
    expect(environment.scene.getObjectByName('R-02')).toBeTruthy();
    expect(environment.scene.getObjectByName('R-03')).toBeTruthy();
    expect(environment.scene.getObjectByName('R-04')).toBeTruthy();
    expect(environment.scene.getObjectByName('integrated-global-piping')).toBeTruthy();
    expect(environment.scene.getObjectByName('ROM-HOPPER')).toBeTruthy();
    expect(environment.scene.getObjectByName('APRON-FEEDER')).toBeTruthy();
    expect(environment.scene.getObjectByName('PRIMARY-CRUSHER')).toBeTruthy();
    expect(environment.scene.getObjectByName('STOCKPILE-RECLAIM')).toBeTruthy();
    expect(environment.scene.getObjectByName('CV-01-FEEDER-TO-CRUSHER')).toBeTruthy();
    expect(environment.scene.getObjectByName('CV-02-CRUSHER-TO-STOCKPILE')).toBeTruthy();
    expect(environment.scene.getObjectByName('MILL-01')).toBeTruthy();
    expect(environment.scene.getObjectByName('CLASS-01')).toBeTruthy();
    expect(environment.scene.getObjectByName('CV-03-STOCKPILE-TO-GRINDING')).toBeTruthy();
    expect(environment.scene.getObjectByName('P-PUMP-TO-CYCLONES')).toBeTruthy();
    expect(environment.scene.getObjectByName('PUMP-01')).toBeTruthy();
    expect(environment.scene.getObjectByName('P-LEACHING-TO-PUMP-01')).toBeTruthy();
    expect(environment.scene.getObjectByName('CIP-ADSORPTION')).toBeTruthy();
    expect(environment.scene.getObjectByName('ELUTION-SKID')).toBeTruthy();
    expect(environment.scene.getObjectByName('EW-CELLS')).toBeTruthy();
    expect(environment.scene.getObjectByName('SMELTING-FURNACE')).toBeTruthy();
    expect(environment.scene.getObjectByName('P-PUMP-01-TO-CIP')).toBeTruthy();
    expect(environment.scene.getObjectByName('P-ELUTION-TO-EW')).toBeTruthy();
    expect(environment.scene.getObjectByName('MT-CIP-TO-ELUTION-CARBON')).toBeTruthy();
    expect(environment.scene.getObjectByName('MT-EW-TO-SMELTING-CATHODE')).toBeTruthy();
    expect(environment.scene.getObjectByName('integrated-mobile-equipment')).toBeTruthy();
    expect(environment.scene.getObjectByName('plant-labels')).toBeTruthy();
    expect(environment.scene.getObjectByName('geotechnical-system')).toBeTruthy();
    expect(environment.geotechnicalSystem.root.visible).toBe(false);
    expect(environment.geotechnicalSystem.root.userData.visualOnly).toBe(true);
    expect(environment.scene.getObjectByName('TRUCK-01')).toBeTruthy();
    expect(environment.scene.getObjectByName('TRUCK-02')).toBeTruthy();
    expect(environment.scene.getObjectByName('TRUCK-03')).toBeTruthy();
    expect(environment.inspectionControlLimits.minDistance).toBeCloseTo(0.8);
    expect(environment.inspectionControlLimits.maxDistance).toBe(1200);
    expect(environment.scene.getObjectByName('EXCAVATOR-01')).toBeTruthy();
    expect(environment.scene.getObjectByName('LOADER-01')).toBeTruthy();
    expect(environment.processRoute.id).toBe('CIP-ELUTION-EW-SMELTING');
    expect(environment.processRoute.validation.isValidated).toBe(true);
    expect(environment.processRoute.validation.topologyValidated).toBe(true);
    expect(environment.processRoute.validation.canRender3D).toBe(true);
    expect(environment.processRoute.validation.canCalculateRecovery).toBe(true);
    expect(environment.processRoute.recoveryModel.requiresExplicitStageEfficiencies).toBe(true);
    expect(environment.environmentRoot.userData.processRouteId).toBe(environment.processRoute.id);
    expect(environment.environmentRoot.userData.processRouteTopologyValidated).toBe(true);
    expect(environment.environmentRoot.userData.processRouteRenderable).toBe(true);
    expect(environment.scene.children.some((child) => /mountain|rock|cone|sun/i.test(child.name)))
      .toBe(false);
  });

  it('provides all professional camera presets with distinct general and inspection poses', () => {
    const environment = createBaseScene();
    expect(Object.keys(environment.cameras)).toEqual([
      'general', 'top', 'oblique', 'reception', 'crushing',
      'grinding', 'leaching', 'recovery', 'inspection',
    ]);
    expect(environment.cameras.general.position.equals(environment.cameras.inspection.position)).toBe(false);
    expect(environment.cameras.top.position.y).toBeGreaterThan(environment.cameras.general.position.y);
  });

  it('keeps terrain and platform inside the far clipping range when zoomed out', () => {
    const environment = createBaseScene();
    const camera = environment.cameras.general;
    camera.position.set(140, 100, 140);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();

    expect(camera.far).toBeGreaterThan(camera.position.length());
    expect(environment.ground.geometry.boundingBox.max.x - environment.ground.geometry.boundingBox.min.x).toBeGreaterThan(100);
    expect(environment.platform.isGroup).toBe(true);
    expect(environment.platform.children.length).toBeGreaterThanOrEqual(2);
    expect(environment.platform.children.every((child) => child.geometry?.parameters?.width > 20)).toBe(true);
    expect(environment.platform.children.every((child) => child.userData.embeddedFoundation === true)).toBe(true);
    expect(environment.platform.children.every((child) => Math.abs((child.position.y + child.geometry.parameters.height / 2) - child.userData.foundationTopY) < 1e-8)).toBe(true);
    expect(environment.platform.children.every((child) => child.userData.foundationTopY < child.userData.engineeringDatumY)).toBe(true);
  });
});
