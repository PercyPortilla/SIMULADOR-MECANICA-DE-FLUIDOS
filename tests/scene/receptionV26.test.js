import { describe, expect, it } from 'vitest';
import { createBaseScene } from '../../src/scene/baseEnvironment.js';
import {
  RECEPTION_EARTHWORK,
  RECEPTION_PROCESS_CUTS,
  ROAD_DEFINITIONS,
  TOPOGRAPHIC_ZONES,
} from '../../src/scene/config/siteDesign.js';
import { createHaulRoads, getRoadDesignMetrics } from '../../src/scene/environment/haulRoads.js';
import { createIndustrialMaterial } from '../../src/scene/materials/industrialMaterials.js';
import { createIntegratedMobile } from '../../src/scene/integration/integratedMobile.js';
import { IntegratedEquipmentRegistry } from '../../src/scene/integration/assetIntegrationLayer.js';
import { getTerrainHeight } from '../../src/scene/environment/terrainHeight.js';
import * as THREE from 'three';

function expectPointClose(actual, expected, precision = 6) {
  expect(actual.x).toBeCloseTo(expected.x, precision);
  expect(actual.y).toBeCloseTo(expected.y, precision);
  expect(actual.z).toBeCloseTo(expected.z, precision);
}

describe('V26 approved reception civil/topographic contract', () => {
  it('uses distinct vertical datums without moving the process X/Z alignment', () => {
    expect(TOPOGRAPHIC_ZONES.reception.center).toEqual([-110, -30]);
    expect(TOPOGRAPHIC_ZONES.reception.elevation).toBe(10.0);
    expect(RECEPTION_PROCESS_CUTS.apronTrench.center).toEqual([-99.4, -30]);
    expect(RECEPTION_PROCESS_CUTS.apronTrench.elevationM).toBe(8.6);
    expect(RECEPTION_PROCESS_CUTS.crusherPocket.center).toEqual([-88, -30]);
    expect(RECEPTION_PROCESS_CUTS.crusherPocket.elevationM).toBe(4.9);
    expect(RECEPTION_EARTHWORK.bermDropM / RECEPTION_EARTHWORK.upperSlopeRunM).toBeGreaterThan(0.4);
  });

  it('keeps the heavy-haul ROM approach inside its design envelope and below the ROM crest at the service junction', () => {
    const road01 = getRoadDesignMetrics('ROAD-01', { samples: 640 });
    expect(road01.maximumGrade).toBeLessThanOrEqual(ROAD_DEFINITIONS['ROAD-01'].maximumGrade);
    expect(road01.minimumRadiusM).toBeGreaterThanOrEqual(ROAD_DEFINITIONS['ROAD-01'].minimumCurveRadiusM);
    const junctionY = getTerrainHeight(-136, -48);
    const romY = getTerrainHeight(-110, -30);
    expect(romY - junctionY).toBeGreaterThan(1.5);
  });

  it('does not worsen the pre-existing service-road grade debt while regrading the ROM tie-in', () => {
    const road02 = getRoadDesignMetrics('ROAD-02', { samples: 640 });
    const road03 = getRoadDesignMetrics('ROAD-03', { samples: 640 });
    const road04 = getRoadDesignMetrics('ROAD-04', { samples: 640 });
    expect(road02.maximumGrade).toBeLessThanOrEqual(0.39);
    expect(road03.maximumGrade).toBeLessThanOrEqual(0.28);
    expect(road04.maximumGrade).toBeLessThanOrEqual(0.13);
  });

  it('keeps reception road shoulders and cut/fill visual strips above authoritative terrain', () => {
    const roads = createHaulRoads(createIndustrialMaterial('road'));
    const reception = TOPOGRAPHIC_ZONES.reception;
    const candidates = roads.children.filter((object) => /shoulder|cut-fill-transition/.test(object.name));
    let checked = 0;
    candidates.forEach((object) => {
      const positions = object.geometry?.attributes?.position;
      const indices = object.geometry?.index;
      if (!positions || !indices) return;
      for (let index = 0; index < positions.count; index += 1) {
        const x = positions.getX(index);
        const y = positions.getY(index);
        const z = positions.getZ(index);
        if (Math.hypot(x - reception.center[0], z - reception.center[1]) > 82) continue;
        checked += 1;
        expect(y - getTerrainHeight(x, z)).toBeGreaterThanOrEqual(0.025);
      }
      for (let index = 0; index < indices.count; index += 3) {
        const vertexIndices = [
          indices.getX(index),
          indices.getX(index + 1),
          indices.getX(index + 2),
        ];
        const x = vertexIndices.reduce((sum, vertex) => sum + positions.getX(vertex), 0) / 3;
        const y = vertexIndices.reduce((sum, vertex) => sum + positions.getY(vertex), 0) / 3;
        const z = vertexIndices.reduce((sum, vertex) => sum + positions.getZ(vertex), 0) / 3;
        if (Math.hypot(x - reception.center[0], z - reception.center[1]) > 82) continue;
        expect(y - getTerrainHeight(x, z)).toBeGreaterThanOrEqual(-0.02);
      }
    });
    expect(checked).toBeGreaterThan(100);
  });

  it('grounds ROM, apron and crusher so the receiving transfer is gravity-monotonic', () => {
    const base = createBaseScene();
    const rom = base.equipmentSystem.getEquipment('ROM-HOPPER').group3D;
    const apron = base.equipmentSystem.getEquipment('APRON-FEEDER').group3D;
    const crusher = base.equipmentSystem.getEquipment('PRIMARY-CRUSHER').group3D;
    expect(rom.position.x).toBe(-110);
    expect(rom.position.z).toBe(-30);
    expect(apron.position.x).toBe(-99.4);
    expect(apron.position.z).toBe(-30);
    expect(crusher.position.x).toBe(-88);
    expect(crusher.position.z).toBe(-30);
    expect(apron.position.y).toBeCloseTo(8.6, 6);
    expect(crusher.position.y).toBeCloseTo(4.9, 6);

    const romOut = base.equipmentSystem.getPortWorldPosition('ROM-HOPPER', 'dischargeOut');
    const apronIn = base.equipmentSystem.getPortWorldPosition('APRON-FEEDER', 'feedIn');
    const apronOut = base.equipmentSystem.getPortWorldPosition('APRON-FEEDER', 'dischargeOut');
    const crusherIn = base.equipmentSystem.getPortWorldPosition('PRIMARY-CRUSHER', 'feedIn');
    expect(romOut.y).toBeGreaterThan(apronIn.y);
    expect(apronIn.y).toBeGreaterThan(apronOut.y);
    expect(apronOut.y).toBeGreaterThan(crusherIn.y);
  });

  it('rebuilds CV-01 and CV-02 from authoritative world ports after re-grounding', () => {
    const base = createBaseScene();
    const cv01 = base.equipmentSystem.getEquipment('CV-01-FEEDER-TO-CRUSHER').group3D;
    const cv02 = base.equipmentSystem.getEquipment('CV-02-CRUSHER-TO-STOCKPILE').group3D;
    const cv01Route = cv01.userData.routePoints.map((point) => new THREE.Vector3(...point));
    const cv02Route = cv02.userData.routePoints.map((point) => new THREE.Vector3(...point));
    expectPointClose(cv01Route[0], base.equipmentSystem.getPortWorldPosition('APRON-FEEDER', 'dischargeOut'));
    expectPointClose(cv01Route[1], base.equipmentSystem.getPortWorldPosition('PRIMARY-CRUSHER', 'feedIn'));
    expectPointClose(cv02Route[0], base.equipmentSystem.getPortWorldPosition('PRIMARY-CRUSHER', 'dischargeOut'));
    expectPointClose(cv02Route[1], base.equipmentSystem.getPortWorldPosition('STOCKPILE-RECLAIM', 'feedIn'));
  });

  it('keeps both ROAD-01 truck lanes on the expanded ROM manoeuvring apron', () => {
    const mobile = createIntegratedMobile({
      plantRoot: new THREE.Group(),
      registry: new IntegratedEquipmentRegistry(),
    });
    const loaded = mobile.truckRoute.getPoint(1);
    const returned = mobile.returnRoute.getPoint(0);
    for (const point of [loaded, returned]) {
      expect(point.x).toBeGreaterThan(-139);
      expect(point.x).toBeLessThan(-107);
      expect(point.z).toBeGreaterThan(-43);
      expect(point.z).toBeLessThan(-16);
      expect(point.y - getTerrainHeight(point.x, point.z)).toBeGreaterThan(0.15);
      expect(point.y - getTerrainHeight(point.x, point.z)).toBeLessThan(0.35);
    }
  });

  it('adds ROM-scale civil protection and dedicated drainage outside the dump throat', () => {
    const base = createBaseScene();
    const apron = base.scene.getObjectByName('reception-turning-apron');
    expect(apron.geometry.parameters.width).toBeCloseTo(32);
    expect(apron.geometry.parameters.depth).toBeCloseTo(26);
    const berms = [1, 2, 3].map((index) => base.scene.getObjectByName(`reception-safety-berm-${index}`));
    berms.forEach((berm) => expect(berm?.userData.designHeightM).toBeCloseTo(1.4));
    expect(base.scene.getObjectByName('reception-lined-drain-south-east')).toBeTruthy();
    expect(base.scene.getObjectByName('reception-lined-drain-north')).toBeTruthy();
    expect(base.scene.getObjectByName('reception-riprap-outlet')).toBeTruthy();
  });

  it('adds a separate visual ROM staging pile and loader without repurposing LOADER-01', () => {
    const base = createBaseScene();
    const pile = base.scene.getObjectByName('ROM-STAGING-PILE');
    const romLoader = base.scene.getObjectByName('ROM-LOADER-01');
    const reclaimLoader = base.scene.getObjectByName('LOADER-01');
    expect(pile?.userData.visualOnly).toBe(true);
    expect(pile?.userData.processCoupled).toBe(false);
    expect(pile?.userData.nominalDiameterM).toBeGreaterThanOrEqual(8);
    expect(pile?.userData.nominalDiameterM).toBeLessThanOrEqual(10);
    expect(pile?.userData.nominalHeightM).toBeGreaterThanOrEqual(2);
    expect(pile?.userData.nominalHeightM).toBeLessThanOrEqual(3);
    expect(romLoader).toBeTruthy();
    expect(romLoader).not.toBe(reclaimLoader);
    expect(romLoader.userData.visualOnly).toBe(true);
    expect(romLoader.userData.processCoupled).toBe(false);
    expect(romLoader.userData.inspectionExcluded).toBe(true);
    const loaderBounds = new THREE.Box3().setFromObject(romLoader);
    const pileBounds = new THREE.Box3().setFromObject(pile);
    const apronBounds = new THREE.Box3().setFromObject(base.scene.getObjectByName('reception-turning-apron'));
    expect(loaderBounds.intersectsBox(pileBounds)).toBe(false);
    expect(loaderBounds.intersectsBox(apronBounds)).toBe(false);
    expect(() => base.equipmentSystem.getEquipment('ROM-LOADER-01')).toThrow(/Equipment desconocido/);
    expect(base.equipmentSystem.getEquipment('LOADER-01')).toBeTruthy();
  });
});
