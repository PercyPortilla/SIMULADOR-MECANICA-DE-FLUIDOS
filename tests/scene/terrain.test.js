import { describe, expect, it } from 'vitest';
import { getTerrainHeight, getZoneElevation } from '../../src/scene/environment/terrainHeight.js';
import { createRoadAlignment, getRoadPath, getRoadSurfaceOffset, getRoadWidth, HAUL_ROAD_WIDTH } from '../../src/scene/environment/haulRoads.js';
import { nearestOnPrimaryRoad } from '../../src/scene/environment/roadEngineering.js';
import { getIndustrialPad } from '../../src/scene/environment/industrialPads.js';
import { MINE_AUXILIARY_AREAS, PIT_DESIGN, ROAD_DEFINITIONS, SITE_EXTENT } from '../../src/scene/config/siteDesign.js';
import { createMineProps } from '../../src/scene/environment/mineProps.js';
import { createBaseScene } from '../../src/scene/baseEnvironment.js';
import { getPitVisualSector } from '../../src/scene/environment/terrain.js';
import * as THREE from 'three';

describe('mine terrain', () => {
  it('is deterministic and provides distinct operating elevations', () => {
    expect(getTerrainHeight(12.5, -7.25)).toBe(getTerrainHeight(12.5, -7.25));
    expect(getZoneElevation('reception')).toBeGreaterThan(getZoneElevation('process'));
    expect(getZoneElevation('crushing')).toBeLessThan(getZoneElevation('reception'));
  });

  it('keeps the main haul road grounded and dimensioned for the reference mine truck', () => {
    const road = getRoadPath('ROAD-01');
    expect(HAUL_ROAD_WIDTH).toBeCloseTo(18.5);
    expect(getRoadWidth('ROAD-01')).toBeCloseTo(18.5);
    road.forEach((point) => {
      expect(point.y).toBeCloseTo(getTerrainHeight(point.x, point.z) + 0.10, 8);
    });
  });

  it('keeps the engineered ROAD-01 sustained profile inside the design grade envelope', () => {
    const road = getRoadPath('ROAD-01');
    let maxGrade = 0;
    for (let index = 0; index < road.length - 1; index += 1) {
      const a = road[index];
      const b = road[index + 1];
      const horizontal = Math.hypot(b.x - a.x, b.z - a.z);
      maxGrade = Math.max(maxGrade, Math.abs(b.y - a.y) / horizontal);
    }
    expect(maxGrade).toBeLessThanOrEqual(0.10);
  });

  it('uses the same ROAD-01 alignment to excavate the terrain and render the road surface', () => {
    const curve = createRoadAlignment('ROAD-01');
    for (let index = 0; index <= 160; index += 1) {
      const point = curve.getPointAt(index / 160);
      const terrainY = getTerrainHeight(point.x, point.z);
      const nearest = nearestOnPrimaryRoad(point.x, point.z);
      expect(nearest.distance).toBeLessThan(0.08);
      expect(point.y - terrainY).toBeGreaterThanOrEqual(0.08);
      expect(point.y - terrainY).toBeLessThan(0.16);
    }
  });

  it('keeps ROAD-01 wide, crowned and laid out with truck-scale control-point turns', () => {
    const road = ROAD_DEFINITIONS['ROAD-01'];
    expect(road.minimumCurveRadiusM).toBeGreaterThanOrEqual(25);
    expect(getRoadSurfaceOffset('ROAD-01', 0)).toBeGreaterThan(getRoadSurfaceOffset('ROAD-01', 3.4));
    for (let index = 1; index < road.points.length - 1; index += 1) {
      const [ax, az] = road.points[index - 1];
      const [bx, bz] = road.points[index];
      const [cx, cz] = road.points[index + 1];
      const ab = Math.hypot(bx - ax, bz - az);
      const bc = Math.hypot(cx - bx, cz - bz);
      expect(Math.min(ab, bc)).toBeGreaterThan(10);
      const ux = (bx - ax) / ab;
      const uz = (bz - az) / ab;
      const vx = (cx - bx) / bc;
      const vz = (cz - bz) / bc;
      const turn = Math.acos(THREE.MathUtils.clamp(ux * vx + uz * vz, -1, 1));
      expect(turn).toBeLessThan(1.05);
    }
    const curve = createRoadAlignment('ROAD-01');
    let minimumRadius = Infinity;
    for (let index = 3; index < 997; index += 4) {
      const t = index / 1000;
      const a = curve.getPoint(t - 0.002);
      const b = curve.getPoint(t);
      const c = curve.getPoint(t + 0.002);
      const ab = a.distanceTo(b);
      const bc = b.distanceTo(c);
      const ca = c.distanceTo(a);
      const twiceArea = Math.abs((b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x));
      if (twiceArea <= 1e-8) continue;
      minimumRadius = Math.min(minimumRadius, (ab * bc * ca) / (2 * twiceArea));
    }
    expect(minimumRadius).toBeGreaterThanOrEqual(road.minimumCurveRadiusM);
  });

  it('contains a stepped open pit with a working floor substantially below the rim', () => {
    const floor = getTerrainHeight(PIT_DESIGN.center.x, PIT_DESIGN.center.z);
    const rim = getTerrainHeight(PIT_DESIGN.center.x + PIT_DESIGN.radiusX + 22, PIT_DESIGN.center.z);
    expect(floor).toBeLessThanOrEqual(PIT_DESIGN.floorElevation + 1);
    expect(rim - floor).toBeGreaterThan(25);
  });

  it('classifies working floor, active face and final wall as different visual sectors', () => {
    expect(getPitVisualSector(PIT_DESIGN.center.x, PIT_DESIGN.center.z)).toBe('pit-floor');
    expect(getPitVisualSector(PIT_DESIGN.shovelPoint.x, PIT_DESIGN.shovelPoint.z)).not.toBe('final-wall');
    const finalWallX = PIT_DESIGN.center.x + Math.cos(0.75) * (PIT_DESIGN.floorRadiusM + 70);
    const finalWallZ = PIT_DESIGN.center.z + Math.sin(0.75) * (PIT_DESIGN.floorRadiusM + 70) * (PIT_DESIGN.radiusZ / PIT_DESIGN.radiusX);
    expect(getPitVisualSector(finalWallX, finalWallZ)).toBe('final-wall');
  });

  it('keeps four mine benches with broad near-level berms between rocky faces', () => {
    expect(PIT_DESIGN.benchCount).toBe(4);
    const { x: cx, z: cz } = PIT_DESIGN.center;
    const samples = [
      { radius: PIT_DESIGN.floorRadiusM + PIT_DESIGN.faceRunM + PIT_DESIGN.benchWidthM * 0.5, level: 1 },
      { radius: PIT_DESIGN.floorRadiusM + (PIT_DESIGN.faceRunM + PIT_DESIGN.benchWidthM) + PIT_DESIGN.faceRunM + PIT_DESIGN.benchWidthM * 0.5, level: 2 },
      { radius: PIT_DESIGN.floorRadiusM + 2 * (PIT_DESIGN.faceRunM + PIT_DESIGN.benchWidthM) + PIT_DESIGN.faceRunM + PIT_DESIGN.benchWidthM * 0.5, level: 3 },
    ];
    samples.forEach(({ radius, level }) => {
      const center = getTerrainHeight(cx + radius, cz);
      const nearby = getTerrainHeight(cx + radius + 2, cz);
      expect(center).toBeCloseTo(PIT_DESIGN.floorElevation + level * PIT_DESIGN.benchHeightM, 0);
      expect(Math.abs(nearby - center)).toBeLessThan(0.5);
    });
  });

  it('exposes industrial pad metadata without duplicating elevations', () => {
    const pad = getIndustrialPad('reception');
    expect(pad.elevation).toBe(getZoneElevation('reception'));
    expect(pad.width).toBeGreaterThan(10);
    expect(pad.depth).toBeGreaterThan(10);
    expect(pad.width).toBeLessThan(14);
    expect(pad.depth).toBeLessThan(16);
  });

  it('keeps decorative pit rocks inside the rendered terrain extent', () => {
    const props = createMineProps();
    const rocks = props.getObjectByName('pit-perimeter-rock-field');
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    for (let index = 0; index < rocks.count; index += 1) {
      rocks.getMatrixAt(index, matrix);
      matrix.decompose(position, quaternion, scale);
      expect(Math.abs(position.x)).toBeLessThan(SITE_EXTENT.width / 2);
      expect(Math.abs(position.z)).toBeLessThan(SITE_EXTENT.depth / 2);
      expect(position.y).toBeGreaterThan(getTerrainHeight(position.x, position.z));
    }
  });

  it('provides explicit loading, drilling and final-wall sectors inside the open pit', () => {
    const props = createMineProps();
    const operations = props.getObjectByName('pit-operating-areas');
    const loading = props.getObjectByName('pit-loading-platform');
    const drilling = props.getObjectByName('pit-drilling-platform');
    const finalWall = props.getObjectByName('pit-final-wall-rock-scarps');
    const weathering = props.getObjectByName('pit-geological-weathering-traces');
    expect(operations?.userData.mineSector).toBe('active');
    expect(loading?.userData.mineRole).toBe('loading-and-truck-manoeuvre');
    expect(drilling?.userData.mineRole).toBe('drilling-bench');
    expect(finalWall?.userData.mineSector).toBe('final-wall');
    expect(weathering?.userData.mineRole).toBe('geological-visual-cue');
    expect(weathering?.children.length).toBe(3);
    expect(weathering.children.reduce((sum, child) => sum + (child.count ?? 0), 0)).toBe(25);
    expect(loading.position.y).toBeCloseTo(getTerrainHeight(loading.position.x, loading.position.z), 0);
    expect(drilling.position.y).toBeCloseTo(getTerrainHeight(drilling.position.x, drilling.position.z), 0);
    const drillHoles = operations.children.filter((child) => child.userData?.drillHoleMarker);
    expect(drillHoles).toHaveLength(12);
  });

  it('keeps waste dumps outside the pit and drainage sump inside the working floor', () => {
    const props = createMineProps();
    const northDump = props.getObjectByName('north-waste-dump');
    const southDump = props.getObjectByName('south-waste-dump');
    const sump = props.getObjectByName('pit-drainage-sump');
    const oreStaging = props.getObjectByName('temporary-ore-staging');
    expect(northDump?.userData.mineRole).toBe('waste-dump');
    expect(southDump?.userData.mineRole).toBe('waste-dump');
    expect(sump?.userData.mineRole).toBe('sump');
    expect(oreStaging?.userData.mineRole).toBe('ore-staging');
    for (const dump of [MINE_AUXILIARY_AREAS.northWasteDump, MINE_AUXILIARY_AREAS.southWasteDump]) {
      const dx = dump.x - PIT_DESIGN.center.x;
      const dz = (dump.z - PIT_DESIGN.center.z) * (PIT_DESIGN.radiusX / PIT_DESIGN.radiusZ);
      expect(Math.hypot(dx, dz)).toBeGreaterThan(PIT_DESIGN.radiusX + 10);
    }
    const sumpDx = MINE_AUXILIARY_AREAS.pitSump.x - PIT_DESIGN.center.x;
    const sumpDz = (MINE_AUXILIARY_AREAS.pitSump.z - PIT_DESIGN.center.z) * (PIT_DESIGN.radiusX / PIT_DESIGN.radiusZ);
    expect(Math.hypot(sumpDx, sumpDz)).toBeLessThan(PIT_DESIGN.floorRadiusM);
    const center = getTerrainHeight(MINE_AUXILIARY_AREAS.pitSump.x, MINE_AUXILIARY_AREAS.pitSump.z);
    const edge = getTerrainHeight(MINE_AUXILIARY_AREAS.pitSump.x + MINE_AUXILIARY_AREAS.pitSump.radiusM * 1.3, MINE_AUXILIARY_AREAS.pitSump.z);
    expect(center).toBeLessThan(edge);
  });

  it('keeps the compact ROM concrete pad clear of the feeder and CV-01', () => {
    const base = createBaseScene();
    const pad = base.scene.getObjectByName('rom-hopper-local-pad');
    const feeder = base.equipmentSystem.getEquipment('APRON-FEEDER').group3D;
    const conveyor = base.equipmentSystem.getEquipment('CV-01-FEEDER-TO-CRUSHER').group3D;
    const padBox = new THREE.Box3().setFromObject(pad);
    expect(padBox.intersectsBox(new THREE.Box3().setFromObject(feeder))).toBe(false);
    expect(padBox.intersectsBox(new THREE.Box3().setFromObject(conveyor))).toBe(false);
  });
});
