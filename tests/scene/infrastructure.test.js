import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createBaseScene } from '../../src/scene/baseEnvironment.js';
import { createRoadAlignment, getRoadDesignMetrics, getRoadNetworkJunctions, getRoadPath } from '../../src/scene/environment/haulRoads.js';
import { getTerrainHeight } from '../../src/scene/environment/terrainHeight.js';
import { ROAD_DEFINITIONS } from '../../src/scene/config/siteDesign.js';
import { RECOVERY_ROAD_FOOTING_CLEARANCE_M, RECOVERY_ROAD_SPAN_WIDTH_M } from '../../src/scene/infrastructure/pipeRacks.js';

describe('infraestructura de conexión', () => {
  let readonlyBase = null;
  const getReadonlyBase = () => {
    readonlyBase ??= createBaseScene();
    return readonlyBase;
  };

  it('mantiene cuatro caminos y ROAD-04 usa una rasante diseñada cerca de la topografía', () => {
    const path = getRoadPath('ROAD-04');
    expect(path.length).toBeGreaterThan(2);
    const metrics = getRoadDesignMetrics('ROAD-04', { samples: 640 });
    expect(metrics.maximumGrade).toBeLessThanOrEqual(ROAD_DEFINITIONS['ROAD-04'].maximumGrade);
    path.forEach((point) => {
      expect(Math.abs(point.y - (getTerrainHeight(point.x, point.z) + 0.10))).toBeLessThan(1.2);
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
    const base = getReadonlyBase();
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
    const base = getReadonlyBase();
    const signage = base.civilInfrastructure.getObjectByName('mine-road-safety-signage');
    expect(signage).toBeTruthy();
    expect(signage.children.length).toBeGreaterThanOrEqual(4);
    signage.children.forEach((sign) => {
      expect(sign.userData.roadSign).toBe(true);
      expect(sign.userData.code).toBeTruthy();
    });
  });

  it('crea racks para los pipes de proceso existentes', () => {
    const base = getReadonlyBase();
    expect(base.processPipeRacks.name).toBe('process-pipe-racks');
    expect(base.processPipeRacks.userData.totalFrames).toBeGreaterThan(0);
    base.processPipeRacks.traverse((object) => {
      if (!object.userData?.pipeRackFrame) return;
      expect(object.userData.connectionId).toBeTruthy();
      expect(object.userData.supportedPipeY).toBeGreaterThan(object.userData.terrainY);
    });
  });

  it('apoya cada footing de pipe-rack sobre su cota topográfica lateral real', () => {
    const base = getReadonlyBase();
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
    const base = getReadonlyBase();
    const audit = base.integratedPiping.auditConnectionEndpoints(0.03);
    expect(audit.length).toBe(base.integratedPiping.groups.length);
    expect(audit.every((item) => item.valid)).toBe(true);
    expect(Math.max(...audit.map((item) => item.sourceErrorM))).toBeLessThanOrEqual(0.03);
    expect(Math.max(...audit.map((item) => item.targetErrorM))).toBeLessThanOrEqual(0.03);
  });

  it('cubre los tres runs elevados PUMP-01 → CIP con frames derivados de la ruta', () => {
    const base = getReadonlyBase();
    const segmentIndexes = new Set();
    base.processPipeRacks.traverse((object) => {
      if (object.userData?.connectionId === 'P-PUMP-01-TO-CIP' && object.userData?.pipeRackFrame) {
        segmentIndexes.add(object.userData.segmentIndex);
      }
    });
    expect(segmentIndexes.size).toBeGreaterThanOrEqual(3);
  });

  it('usa pórticos anchos en el tramo PUMP-01 → CIP que comparte corredor aéreo con ROAD-02', () => {
    const base = getReadonlyBase();
    const portals = [];
    base.processPipeRacks.traverse((object) => {
      if (object.userData?.connectionId === 'P-PUMP-01-TO-CIP'
        && object.userData?.pipeRackFrame
        && object.userData?.roadSpanPortal) portals.push(object);
    });
    expect(portals.length).toBeGreaterThanOrEqual(4);
    portals.forEach((portal) => {
      expect(portal.userData.clearRoadId).toBe('ROAD-02');
      expect(portal.userData.frameWidthM).toBeGreaterThanOrEqual(RECOVERY_ROAD_SPAN_WIDTH_M);
      expect(Math.min(...portal.userData.roadFootingClearanceM)).toBeGreaterThanOrEqual(
        RECOVERY_ROAD_FOOTING_CLEARANCE_M,
      );
      const footings = portal.children.filter((child) => child.name.includes('-footing-'));
      expect(footings).toHaveLength(2);
      expect(Math.hypot(
        footings[0].position.x - footings[1].position.x,
        footings[0].position.z - footings[1].position.z,
      )).toBeGreaterThanOrEqual(RECOVERY_ROAD_SPAN_WIDTH_M - 1e-9);
    });
  });

  it('mantiene todos los footings PUMP-01 → CIP fuera del corredor real curvo de ROAD-02', () => {
    const base = getReadonlyBase();
    const road = createRoadAlignment('ROAD-02');
    const roadSamples = Array.from({ length: 901 }, (_, index) => road.getPoint(index / 900));
    const distanceToRoad = (point) => {
      let minimum = Infinity;
      for (let index = 0; index < roadSamples.length - 1; index += 1) {
        const a = roadSamples[index];
        const b = roadSamples[index + 1];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const lengthSq = dx * dx + dz * dz;
        const t = lengthSq <= 1e-12
          ? 0
          : THREE.MathUtils.clamp(((point.x - a.x) * dx + (point.z - a.z) * dz) / lengthSq, 0, 1);
        minimum = Math.min(
          minimum,
          Math.hypot(point.x - (a.x + dx * t), point.z - (a.z + dz * t)),
        );
      }
      return minimum;
    };
    const clearances = [];
    base.processPipeRacks.traverse((frame) => {
      if (!frame.userData?.pipeRackFrame || frame.userData.connectionId !== 'P-PUMP-01-TO-CIP') return;
      frame.children
        .filter((child) => child.name.includes('-footing-'))
        .forEach((footing) => clearances.push(distanceToRoad(footing.position)));
    });
    expect(clearances.length).toBeGreaterThan(0);
    expect(Math.min(...clearances)).toBeGreaterThanOrEqual(RECOVERY_ROAD_FOOTING_CLEARANCE_M - 0.02);
  });

  it('evita pórticos sobredimensionados al centrar cruces y desplazar frames ya externos a ROAD-02', () => {
    const base = getReadonlyBase();
    const recoveryFrames = [];
    base.processPipeRacks.traverse((frame) => {
      if (frame.userData?.pipeRackFrame && frame.userData.connectionId === 'P-PUMP-01-TO-CIP') {
        recoveryFrames.push(frame);
      }
    });
    const roadAware = recoveryFrames.filter((frame) => frame.userData.roadSupportMode);
    expect(roadAware.length).toBeGreaterThan(0);
    expect(Math.max(...roadAware.map((frame) => frame.userData.frameWidthM))).toBeLessThanOrEqual(22);
    expect(roadAware.some((frame) => frame.userData.roadSupportMode === 'road-centered-portal')).toBe(true);
    expect(roadAware.some((frame) => frame.userData.roadSupportMode === 'road-offset-frame')).toBe(true);
    roadAware.forEach((frame) => {
      expect(Math.min(...frame.userData.roadFootingClearanceM)).toBeGreaterThanOrEqual(
        RECOVERY_ROAD_FOOTING_CLEARANCE_M,
      );
    });
  });

  it('arriostra soportes locales/trestle altos sin mover sus footings', () => {
    const base = getReadonlyBase();
    const tallNonRack = [];
    base.processPipeRacks.traverse((frame) => {
      if (!frame.userData?.pipeRackFrame || !['local', 'trestle'].includes(frame.userData.policy)) return;
      const columns = frame.children.filter((child) => child.name.includes('-column-'));
      const maxHeight = Math.max(0, ...columns.map((column) => column.geometry?.parameters?.height ?? 0));
      if (maxHeight > 3.2) tallNonRack.push(frame);
    });
    expect(tallNonRack.length).toBeGreaterThan(0);
    tallNonRack.forEach((frame) => {
      expect(frame.userData.bracedFrame).toBe(true);
      expect(frame.children.filter((child) => child.name.includes('-brace-'))).toHaveLength(2);
      frame.children
        .filter((child) => child.name.includes('-footing-'))
        .forEach((footing) => expect(footing.position.y).toBeCloseTo(footing.userData.terrainY + 0.07, 8));
    });
  });

  it('no genera ground racks para las conexiones interstage entre reactores', () => {
    const base = getReadonlyBase();
    const forbidden = new Set(['P-LEACH-R01-R02', 'P-LEACH-R02-R03', 'P-LEACH-R03-R04']);
    const frames = [];
    base.processPipeRacks.traverse((object) => {
      if (object.userData?.pipeRackFrame && forbidden.has(object.userData.connectionId)) frames.push(object);
    });
    expect(frames).toHaveLength(0);
  });

  it('conserva los tres conveyors funcionales', () => {
    const base = getReadonlyBase();
    expect(base.frontEndConveyors.conveyor01).toBeTruthy();
    expect(base.frontEndConveyors.conveyor02).toBeTruthy();
    expect(base.grindingFeedConveyor.conveyor).toBeTruthy();
  });

  it('sostiene el head de CV-02 con una torre de transferencia anclada al terreno', () => {
    const base = getReadonlyBase();
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
    const base = getReadonlyBase();
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

  it('refleja valvesCount de Pipe 1 sólo en las válvulas visuales, no en sus codos de ruta', () => {
    const base = createBaseScene();
    const renderPipe1 = (valvesCount) => base.integratedPiping.refreshPipe1({
      innerDiameterM: 0.25,
      lengthM: 20,
      material: 'Acero',
      accessories: { valvesCount },
    });
    const zero = renderPipe1(0);
    const elbowCount = zero.children.filter((child) => child.userData?.fittingType === 'elbow').length;
    expect(zero.userData.visualValveCount).toBe(0);
    expect(zero.children.filter((child) => child.userData?.fittingType === 'isolation-valve')).toHaveLength(0);
    const one = renderPipe1(1);
    expect(one.userData.visualValveCount).toBe(1);
    expect(one.children.filter((child) => child.userData?.fittingType === 'isolation-valve')).toHaveLength(1);
    expect(one.children.filter((child) => child.userData?.fittingType === 'elbow')).toHaveLength(elbowCount);
    const three = renderPipe1(3);
    expect(three.userData.visualValveCount).toBe(3);
    expect(three.children.filter((child) => child.userData?.fittingType === 'isolation-valve')).toHaveLength(3);
    expect(three.children.filter((child) => child.userData?.fittingType === 'elbow')).toHaveLength(elbowCount);
    expect(three.userData.physicalDiameterM).toBe(0.25);
    expect(three.userData.requestedHydraulicLengthM).toBe(20);
  });
});
