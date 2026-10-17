import { describe, expect, it } from 'vitest';
import {
  CRUSHING_CUT,
  RECEPTION_EARTHWORK,
  ROAD_CIVIL_DETAIL,
} from '../../src/scene/config/siteDesign.js';
import {
  getCrushingEarthworkBand,
  getTerrainHeight,
  getTerrainMicrorelief,
  getZoneElevation,
} from '../../src/scene/environment/terrainHeight.js';
import {
  getRoadCutFillTransitionWidth,
  getRoadSafetyBermHeight,
} from '../../src/scene/environment/haulRoads.js';
import { createPrimaryRoadAlignment } from '../../src/scene/environment/roadEngineering.js';
import { createCivilInfrastructure } from '../../src/scene/environment/civilInfrastructure.js';

describe('V22 terrain and civil realism', () => {
  it('adds bounded natural microrelief while engineered datums remain authoritative', () => {
    const samples = [
      getTerrainMicrorelief(-170, 22),
      getTerrainMicrorelief(-45, 118),
      getTerrainMicrorelief(74, -142),
      getTerrainMicrorelief(258, 126),
    ];
    expect(Math.max(...samples.map(Math.abs))).toBeLessThan(0.13);
    expect(new Set(samples.map((value) => value.toFixed(4))).size).toBeGreaterThan(2);
    expect(getTerrainHeight(-110, -30)).toBeCloseTo(getZoneElevation('reception'), 0);
    expect(getTerrainHeight(-82, -30)).toBeCloseTo(getZoneElevation('crushing'), 6);
  });

  it('uses a legible cut face and secondary catch berm south of primary crushing', () => {
    const [cx, cz] = CRUSHING_CUT.center;
    const southEdge = cz - CRUSHING_CUT.terraceSizeM[1] / 2;
    const faceZ = southEdge - CRUSHING_CUT.faceRunM * 0.6;
    const bermZ = southEdge - CRUSHING_CUT.faceRunM - CRUSHING_CUT.bermWidthM * 0.5;
    const toeZ = southEdge - CRUSHING_CUT.faceRunM - CRUSHING_CUT.bermWidthM - CRUSHING_CUT.toeRunM * 0.55;

    expect(getCrushingEarthworkBand(cx, southEdge)).toBe('terrace');
    expect(getCrushingEarthworkBand(cx, faceZ)).toBe('cut-face');
    expect(getCrushingEarthworkBand(cx, bermZ)).toBe('catch-berm');
    expect(getCrushingEarthworkBand(cx, toeZ)).toBe('toe-transition');

    const terraceY = getTerrainHeight(cx, southEdge);
    const faceY = getTerrainHeight(cx, faceZ);
    const bermY = getTerrainHeight(cx, bermZ);
    const toeY = getTerrainHeight(cx, toeZ);
    expect(terraceY).toBeCloseTo(CRUSHING_CUT.terraceElevationM, 3);
    expect(faceY).toBeGreaterThan(terraceY);
    expect(bermY).toBeCloseTo(CRUSHING_CUT.terraceElevationM + CRUSHING_CUT.bermRiseM, 1);
    expect(toeY).toBeGreaterThanOrEqual(bermY - 0.15);
    expect(Math.max(terraceY, faceY, bermY, toeY)).toBeLessThan(7.25);
  });

  it('blends the reception south earthwork away before it creates a crusher-side hump', () => {
    const eastEdge = RECEPTION_EARTHWORK.center[0] + RECEPTION_EARTHWORK.crestSizeM[0] / 2;
    expect(RECEPTION_EARTHWORK.eastBlendWidthM).toBeGreaterThanOrEqual(12);
    const x = eastEdge - 7;
    const crushingSouthEdge = CRUSHING_CUT.center[1] - CRUSHING_CUT.terraceSizeM[1] / 2;
    const samples = [0, 3, 7, 11, 15].map((offset) => getTerrainHeight(x, crushingSouthEdge - offset));
    expect(samples[0]).toBeCloseTo(CRUSHING_CUT.terraceElevationM, 2);
    for (let index = 1; index < samples.length; index += 1) {
      expect(samples[index] - samples[index - 1]).toBeLessThan(0.65);
    }
    expect(Math.max(...samples)).toBeLessThan(7.25);
  });

  it('flares road cut/fill into the ROM tie-in while tapering the haul-road berm', () => {
    expect(getRoadCutFillTransitionWidth('ROAD-01', 0.5)).toBeCloseTo(ROAD_CIVIL_DETAIL.primaryTransitionWidthM, 6);
    expect(getRoadCutFillTransitionWidth('ROAD-01', 1)).toBeCloseTo(
      ROAD_CIVIL_DETAIL.primaryTransitionWidthM + ROAD_CIVIL_DETAIL.primaryTieInFlareM,
      6,
    );
    expect(getRoadSafetyBermHeight('ROAD-01', 0.5)).toBeCloseTo(ROAD_CIVIL_DETAIL.primaryBermHeightM, 6);
    expect(getRoadSafetyBermHeight('ROAD-01', 1)).toBeCloseTo(0, 6);
    expect(getRoadCutFillTransitionWidth('ROAD-02', 1)).toBeCloseTo(3.2, 6);
    expect(getRoadSafetyBermHeight('ROAD-02', 1)).toBeCloseTo(0.48, 6);
  });

  it('keeps the existing ROAD-01 centerline continuous with authoritative terrain at the terraplén', () => {
    const curve = createPrimaryRoadAlignment();
    [0.90, 0.94, 0.97, 1].forEach((progress) => {
      const point = curve.getPointAt(progress);
      expect(getTerrainHeight(point.x, point.z)).toBeCloseTo(point.y, 3);
    });
  });

  it('removes the duplicate decorative fill solid and keeps only functional ROM civil pieces', () => {
    const civil = createCivilInfrastructure();
    expect(civil.userData.receptionEarthworkSource).toBe('terrainHeight');
    expect(civil.getObjectByName('reception-engineered-embankment')).toBeFalsy();
    expect(civil.getObjectByName('reception-turning-apron')).toBeTruthy();
    expect(civil.getObjectByName('reception-retaining-wall')).toBeTruthy();
    const berms = civil.children.filter((child) => child.name.startsWith('reception-safety-berm-'));
    expect(berms).toHaveLength(3);
  });
});
