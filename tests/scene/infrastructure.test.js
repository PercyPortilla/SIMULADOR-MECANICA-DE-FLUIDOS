import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createBaseScene } from '../../src/scene/baseEnvironment.js';
import { getRoadDesignMetrics, getRoadNetworkJunctions, getRoadPath } from '../../src/scene/environment/haulRoads.js';
import { getTerrainHeight } from '../../src/scene/environment/terrainHeight.js';
import { ROAD_DEFINITIONS } from '../../src/scene/config/siteDesign.js';

describe('infraestructura de conexión', () => {
  it('mantiene cuatro caminos y ROAD-04 sigue la topografía', () => {
    const path = getRoadPath('ROAD-04');
    expect(path.length).toBeGreaterThan(2);
    path.forEach((point) => {
      expect(point.y).toBeCloseTo(getTerrainHeight(point.x, point.z) + 0.10, 8);
    });
  });

  it('conecta los caminos de servicio mediante intersecciones reales', () => {
    const road02 = ROAD_DEFINITIONS['ROAD-02'].points;
    const road03 = ROAD_DEFINITIONS['ROAD-03'].points;
    const road04 = ROAD_DEFINITIONS['ROAD-04'].points;
    const key = (point) => point.join(',');
    const road02Nodes = new Set(road02.map(key));
    expect(road02Nodes.has(key(road03[0]))).toBe(true);
    expect(road02Nodes.has(key(road03.at(-1)))).toBe(true);
    expect(road02Nodes.has(key(road04[0]))).toBe(true);
    expect(road02Nodes.has(key(road04.at(-1)))).toBe(true);
  });

  it('integra drenaje lateral en los caminos de servicio sin duplicarlo sobre el haul road principal', () => {
    const base = createBaseScene();
    const drains = [];
    base.haulRoads.traverse((object) => {
      if (object.userData?.roadDrainage) drains.push(object.name);
    });
    expect(drains.some((name) => name.startsWith('ROAD-02'))).toBe(true);
    expect(drains.some((name) => name.startsWith('ROAD-03'))).toBe(true);
    expect(drains.some((name) => name.startsWith('ROAD-04'))).toBe(true);
    expect(drains.some((name) => name.startsWith('ROAD-01'))).toBe(false);
  });

  it('expone criterios geométricos y un grafo vial realmente conectado', () => {
    const junctions = getRoadNetworkJunctions();
    expect(junctions.some((junction) => junction.roads.includes('ROAD-02') && junction.roads.includes('ROAD-03'))).toBe(true);
    expect(junctions.some((junction) => junction.roads.includes('ROAD-02') && junction.roads.includes('ROAD-04'))).toBe(true);
    for (const roadId of Object.keys(ROAD_DEFINITIONS)) {
      const metrics = getRoadDesignMetrics(roadId);
      expect(metrics.lengthM).toBeGreaterThan(20);
      expect(metrics.designSpeedKph).toBeGreaterThan(0);
      expect(metrics.designMaximumGrade).toBeGreaterThan(0);
    }
  });

  it('añade señalización minera selectiva sin convertir la planta en una red urbana', () => {
    const base = createBaseScene();
    const signage = base.civilInfrastructure.getObjectByName('mine-road-safety-signage');
    expect(signage).toBeTruthy();
    expect(signage.children.length).toBeGreaterThanOrEqual(4);
    signage.children.forEach((sign) => {
      expect(sign.userData.roadSign).toBe(true);
      expect(sign.userData.code).toBeTruthy();
    });
  });

  it('crea racks para los pipes de proceso existentes', () => {
    const base = createBaseScene();
    expect(base.processPipeRacks.name).toBe('process-pipe-racks');
    expect(base.processPipeRacks.userData.totalFrames).toBeGreaterThan(0);
    base.processPipeRacks.traverse((object) => {
      if (!object.userData?.pipeRackFrame) return;
      expect(object.userData.connectionId).toBeTruthy();
      expect(object.userData.supportedPipeY).toBeGreaterThan(object.userData.terrainY);
    });
  });

  it('apoya cada footing de pipe-rack sobre su cota topográfica lateral real', () => {
    const base = createBaseScene();
    const errors = [];
    base.processPipeRacks.traverse((object) => {
      if (!object.name?.includes('-footing-') || !Number.isFinite(object.userData?.terrainY)) return;
      const expected = object.userData.terrainY + 0.07;
      errors.push(Math.abs(object.position.y - expected));
    });
    expect(errors.length).toBeGreaterThan(0);
    expect(Math.max(...errors)).toBeLessThan(1e-8);
  });

  it('valida que cada conexión de proceso termine exactamente en sus puertos 3D', () => {
    const base = createBaseScene();
    const audit = base.integratedPiping.auditConnectionEndpoints(0.03);
    expect(audit.length).toBe(base.integratedPiping.groups.length);
    expect(audit.every((item) => item.valid)).toBe(true);
    expect(Math.max(...audit.map((item) => item.sourceErrorM))).toBeLessThanOrEqual(0.03);
    expect(Math.max(...audit.map((item) => item.targetErrorM))).toBeLessThanOrEqual(0.03);
  });

  it('cubre los tres runs elevados PUMP-01 → CIP con frames derivados de la ruta', () => {
    const base = createBaseScene();
    const segmentIndexes = new Set();
    base.processPipeRacks.traverse((object) => {
      if (object.userData?.connectionId === 'P-PUMP-01-TO-CIP' && object.userData?.pipeRackFrame) {
        segmentIndexes.add(object.userData.segmentIndex);
      }
    });
    expect(segmentIndexes.size).toBeGreaterThanOrEqual(3);
  });

  it('no genera ground racks para las conexiones interstage entre reactores', () => {
    const base = createBaseScene();
    const forbidden = new Set(['P-LEACH-R01-R02', 'P-LEACH-R02-R03', 'P-LEACH-R03-R04']);
    const frames = [];
    base.processPipeRacks.traverse((object) => {
      if (object.userData?.pipeRackFrame && forbidden.has(object.userData.connectionId)) frames.push(object);
    });
    expect(frames).toHaveLength(0);
  });

  it('conserva los tres conveyors funcionales', () => {
    const base = createBaseScene();
    expect(base.frontEndConveyors.conveyor01).toBeTruthy();
    expect(base.frontEndConveyors.conveyor02).toBeTruthy();
    expect(base.grindingFeedConveyor.conveyor).toBeTruthy();
  });

  it('sostiene el head de CV-02 con una torre de transferencia anclada al terreno', () => {
    const base = createBaseScene();
    const tower = base.equipmentSystem.stockpileFeedTower;
    expect(tower?.userData.transferTower).toBe(true);
    const target = base.equipmentSystem.getPortWorldPosition('STOCKPILE-RECLAIM', 'feedIn');
    expect(new THREE.Vector3(...tower.userData.supportedEndpoint).distanceTo(target)).toBeLessThan(1e-8);
    const footings = [];
    tower.traverse((object) => {
      if (object.name?.includes('-footing-')) footings.push(object);
    });
    expect(footings).toHaveLength(4);
    footings.forEach((footing) => {
      expect(footing.position.y).toBeCloseTo(footing.userData.terrainY + 0.08, 8);
    });
  });

  it('apoya individualmente los footings de los conveyors integrados sobre la topografía', () => {
    const base = createBaseScene();
    ['CV-01-FEEDER-TO-CRUSHER', 'CV-02-CRUSHER-TO-STOCKPILE', 'CV-03-STOCKPILE-TO-GRINDING'].forEach((id) => {
      const conveyor = base.equipmentSystem.getEquipment(id).group3D;
      conveyor.updateMatrixWorld(true);
      const footings = [];
      conveyor.traverse((object) => {
        if (object.name?.includes('conveyor-support-') && object.name?.includes('-footing-')) footings.push(object);
      });
      expect(footings.length).toBeGreaterThan(0);
      footings.forEach((footing) => {
        const world = footing.getWorldPosition(new THREE.Vector3());
        expect(world.y - 0.06).toBeCloseTo(getTerrainHeight(world.x, world.z), 1);
      });
    });
  });

  it('refresca piping y racks sin reposicionar R-02 por la longitud hidráulica de Pipe 1', () => {
    const base = createBaseScene();
    const r02 = base.equipmentSystem.getEquipment('R-02');
    const before = r02.group3D.position.clone();

    base.pipe1System.update({
      innerDiameterM: 0.05,
      lengthM: 3,
      roughnessM: 0,
      material: 'steel',
      velocityMps: 1,
    });
    base.pipe1System.update({ innerDiameterM: 0.05, lengthM: 3, roughnessM: 0, material: 'steel', velocityMps: 1 });
    base.industrialAnimations.refreshRoutes();

    expect(r02.group3D.position.equals(before)).toBe(true);
    expect(base.integratedPiping.groups.length).toBeGreaterThanOrEqual(8);
    const current = base.integratedPiping.engine.getConnectionGroup('P-LEACH-R01-R02');
    expect(base.integratedPiping.groups.find((group) => group.userData.connectionId === 'P-LEACH-R01-R02')).toBe(current);
    expect(base.processPipeRacks.children.length).toBeGreaterThan(0);
  });
});
