import * as THREE from 'three';
import { createPipingEngine, createReducerMesh } from '../piping/pipingEngine.js';
import { createPipeMaterial } from '../materials/industrialMaterials.js';
import { PIPE_CORRIDORS } from './finalLayout.js';
import { createProcessPipeRacks } from '../infrastructure/pipeRacks.js';
import { getTerrainHeight } from '../environment/terrainHeight.js';

function elevatedRoute(start, end, { z = null, x = null, clearance = 2.0 } = {}) {
  const y = Math.max(start.y, end.y) + clearance;
  const points = [new THREE.Vector3(start.x, y, start.z)];
  if (z !== null) points.push(new THREE.Vector3(start.x, y, z));
  if (x !== null) points.push(new THREE.Vector3(x, y, z ?? start.z));
  if (z !== null) points.push(new THREE.Vector3(end.x, y, z));
  points.push(new THREE.Vector3(end.x, y, end.z));
  return points.filter((point, index, arr) => index === 0 || point.distanceTo(arr[index - 1]) > 0.05);
}

function connectionWaypoints(equipmentSystem, source, target, corridor = {}) {
  const start = equipmentSystem.getPortWorldPosition(source.equipmentId, source.portId);
  const end = equipmentSystem.getPortWorldPosition(target.equipmentId, target.portId);
  if (corridor.slopedApproach) {
    const first = new THREE.Vector3(
      THREE.MathUtils.lerp(start.x, end.x, 0.28),
      start.y,
      THREE.MathUtils.lerp(start.z, end.z, 0.34),
    );
    const second = new THREE.Vector3(
      THREE.MathUtils.lerp(start.x, end.x, 0.82),
      end.y + 0.45,
      THREE.MathUtils.lerp(start.z, end.z, 0.84),
    );
    return [first, second].map((p) => p.toArray());
  }
  return elevatedRoute(start, end, corridor).map((p) => p.toArray());
}

function solidTransferLink({ id, start, end, color = 0xb58a52, width = 0.24 }) {
  const midY = Math.max(start.y, end.y) + 1.6;
  const points = [start, new THREE.Vector3(start.x, midY, start.z), new THREE.Vector3(end.x, midY, end.z), end];
  const group = new THREE.Group();
  group.name = id;
  const material = new THREE.MeshStandardMaterial({ color, metalness: 0.22, roughness: 0.58 });
  const edgeMaterial = new THREE.MeshStandardMaterial({ color: 0x4f5b5f, metalness: 0.64, roughness: 0.40 });
  const supportMaterial = new THREE.MeshStandardMaterial({ color: 0x58676b, metalness: 0.70, roughness: 0.38 });
  points.slice(0, -1).forEach((point, index) => {
    const next = points[index + 1];
    const direction = next.clone().sub(point);
    const length = direction.length();
    if (length <= 0.05) return;
    const tray = new THREE.Group();
    tray.name = `${id}-tray-${index + 1}`;
    tray.position.copy(point).add(next).multiplyScalar(0.5);
    tray.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction.clone().normalize());
    const floor = new THREE.Mesh(new THREE.BoxGeometry(length, 0.11, width), material);
    floor.name = `${tray.name}-floor`;
    floor.castShadow = true;
    floor.receiveShadow = true;
    tray.add(floor);
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(length, 0.28, 0.055), edgeMaterial.clone());
      wall.name = `${tray.name}-side-${side < 0 ? 'l' : 'r'}`;
      wall.position.set(0, 0.14, side * (width / 2 + 0.025));
      wall.castShadow = true;
      wall.receiveShadow = true;
      tray.add(wall);
    }
    group.add(tray);

    const horizontalLength = Math.hypot(direction.x, direction.z);
    if (horizontalLength > 4.5 && Math.abs(direction.y) < 0.2) {
      const supportCount = Math.min(4, Math.max(1, Math.floor(horizontalLength / 5.5)));
      for (let supportIndex = 1; supportIndex <= supportCount; supportIndex += 1) {
        const t = supportIndex / (supportCount + 1);
        const supportPoint = point.clone().lerp(next, t);
        const groundY = getTerrainHeight(supportPoint.x, supportPoint.z) + 0.06;
        const height = supportPoint.y - groundY - 0.08;
        if (height <= 0.25) continue;
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, height, 0.12), supportMaterial.clone());
        post.name = `${id}-tray-support-${index + 1}-${supportIndex}`;
        post.position.set(supportPoint.x, groundY + height / 2, supportPoint.z);
        post.castShadow = true;
        post.receiveShadow = true;
        group.add(post);
        const footing = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.42), supportMaterial.clone());
        footing.name = `${post.name}-footing`;
        footing.position.set(supportPoint.x, groundY - 0.02, supportPoint.z);
        footing.castShadow = true;
        footing.receiveShadow = true;
        group.add(footing);
      }
    }
  });
  group.userData.connectionId = id;
  group.userData.inspectableEquipment = true;
  group.userData.inspectionKind = 'solid-material-transfer';
  group.userData.routePoints = points.map((p) => p.toArray());
  group.userData.flowDirection = 'source-to-target';
  group.userData.hybridIndustrialTransfer = true;
  return group;
}

export function createIntegratedPiping({ equipmentSystem, pipe1State }) {
  const root = new THREE.Group();
  root.name = 'integrated-global-piping';
  const engine = createPipingEngine({ equipmentSystem });
  root.add(engine.root);
  const materialTransfers = new THREE.Group();
  materialTransfers.name = 'recovery-material-transfers';
  root.add(materialTransfers);

  const definitions = [
    { id: 'P-MILL-TO-SUMP', source: ['MILL-01', 'slurryOut'], target: ['SUMP-01', 'inlet'], diameter: 0.40, kind: 'slurry', corridor: { z: -12, clearance: 1.6 }, supportPolicy: 'local' },
    { id: 'P-SUMP-TO-PUMP', source: ['SUMP-01', 'outlet'], target: ['SLURRY-PUMP-01', 'suction'], diameter: 0.30, kind: 'slurry', corridor: { z: -11, clearance: 1.3 }, supportPolicy: 'local' },
    { id: 'P-PUMP-TO-CYCLONES', source: ['SLURRY-PUMP-01', 'discharge'], target: ['CLASS-01', 'feed'], diameter: 0.25, kind: 'slurry', corridor: { z: -12, clearance: 2.5 }, supportPolicy: 'trestle' },
    { id: 'P-CYCLONE-UNDERFLOW-RETURN', source: ['CLASS-01', 'underflow'], target: ['MILL-01', 'feedIn'], diameter: 0.26, kind: 'underflow', corridor: { z: -18, clearance: 1.6 }, supportPolicy: 'trestle' },
    { id: 'P-CLASSIFICATION-TO-LEACH', source: ['CLASS-01', 'overflow'], target: ['R-01', 'feedIn'], diameter: 0.22, kind: 'overflow', corridor: { z: PIPE_CORRIDORS.classificationToLeachZ, clearance: 2.1 }, supportPolicy: 'rack' },
    { id: 'P-LEACH-R01-R02', source: ['R-01', 'overflowOut'], target: ['R-02', 'feedIn'], diameter: pipe1State?.innerDiameterM || 0.25, kind: 'interstage', corridor: { clearance: 0.15 }, supportPolicy: 'none' },
    { id: 'P-LEACH-R02-R03', source: ['R-02', 'overflowOut'], target: ['R-03', 'feedIn'], diameter: 0.25, kind: 'interstage', corridor: { clearance: 0.15 }, supportPolicy: 'none' },
    { id: 'P-LEACH-R03-R04', source: ['R-03', 'overflowOut'], target: ['R-04', 'feedIn'], diameter: 0.25, kind: 'interstage', corridor: { clearance: 0.15 }, supportPolicy: 'none' },
    { id: 'P-LEACHING-TO-PUMP-01', source: ['R-04', 'overflowOut'], target: ['PUMP-01', 'suction'], diameter: 0.25, kind: 'slurry', corridor: { slopedApproach: true }, supportPolicy: 'trestle' },
    { id: 'P-PUMP-01-TO-CIP', source: ['PUMP-01', 'discharge'], target: ['CIP-ADSORPTION', 'feed'], diameter: 0.22, kind: 'slurry', corridor: { z: PIPE_CORRIDORS.recoveryRackZ, clearance: 2.4 }, supportPolicy: 'rack' },
    { id: 'P-ELUTION-TO-EW', source: ['ELUTION-SKID', 'pregnantSolutionOut'], target: ['EW-CELLS', 'electrolyteIn'], diameter: 0.10, kind: 'solution', corridor: { z: -82, clearance: 1.8 }, supportPolicy: 'local' },
  ];


  const pipeMaterials = Object.freeze({
    slurry: new THREE.MeshStandardMaterial({ color: 0x557f8d, metalness: 0.66, roughness: 0.38 }),
    underflow: new THREE.MeshStandardMaterial({ color: 0x80654a, metalness: 0.50, roughness: 0.46 }),
    overflow: new THREE.MeshStandardMaterial({ color: 0x4e8790, metalness: 0.58, roughness: 0.40 }),
    interstage: new THREE.MeshStandardMaterial({ color: 0x648c93, metalness: 0.62, roughness: 0.39 }),
    solution: new THREE.MeshStandardMaterial({ color: 0x668d78, metalness: 0.52, roughness: 0.42 }),
  });

  const groups = [];
  const definitionMap = new Map(definitions.map((def) => [def.id, def]));
  function renderDefinition(definition, diameterOverride = null, materialOverride = null, visualOptions = {}) {
    const source = { equipmentId: definition.source[0], portId: definition.source[1] };
    const target = { equipmentId: definition.target[0], portId: definition.target[1] };
    const waypoints = connectionWaypoints(equipmentSystem, source, target, definition.corridor);
    const nominalDiameterM = diameterOverride ?? definition.diameter;
    const pipeMaterial = materialOverride ?? (pipeMaterials[definition.kind] ?? pipeMaterials.slurry).clone();
    const group = engine.renderConnection({
      id: definition.id,
      source,
      target,
      nominalDiameterM,
      waypoints,
    }, { material: pipeMaterial, supports: false, ...visualOptions });
    group.userData.integrationValidated = true;
    group.userData.processKind = definition.kind ?? 'slurry';
    const sourceDiameterM = equipmentSystem.getPort(source.equipmentId, source.portId).nominalDiameterM;
    const targetDiameterM = equipmentSystem.getPort(target.equipmentId, target.portId).nominalDiameterM;
    group.userData.sourceDiameterM = sourceDiameterM;
    group.userData.targetDiameterM = targetDiameterM;
    group.userData.requiresReducer = Math.abs(sourceDiameterM - nominalDiameterM) > 1e-9
      || Math.abs(targetDiameterM - nominalDiameterM) > 1e-9;
    const routePoints = group.userData.routePoints.map((point) => new THREE.Vector3(...point));
    if (routePoints.length >= 2 && Math.abs(sourceDiameterM - nominalDiameterM) > 1e-9) {
      const start = routePoints[0];
      const reducerEnd = start.clone().lerp(routePoints[1], Math.min(1, 0.8 / Math.max(0.8, start.distanceTo(routePoints[1]))));
      const reducer = createReducerMesh(start, reducerEnd, sourceDiameterM, nominalDiameterM, pipeMaterial.clone());
      reducer.name = `${definition.id}-source-reducer`;
      group.add(reducer);
    }
    if (routePoints.length >= 2 && Math.abs(targetDiameterM - nominalDiameterM) > 1e-9) {
      const end = routePoints.at(-1);
      const previous = routePoints.at(-2);
      const reducerStart = end.clone().lerp(previous, Math.min(1, 0.8 / Math.max(0.8, end.distanceTo(previous))));
      const reducer = createReducerMesh(reducerStart, end, nominalDiameterM, targetDiameterM, pipeMaterial.clone());
      reducer.name = `${definition.id}-target-reducer`;
      group.add(reducer);
    }
    return group;
  }
  definitions.forEach((def) => {
    const material = def.id === 'P-LEACH-R01-R02' && pipe1State?.material
      ? createPipeMaterial(pipe1State.material)
      : null;
    const visualOptions = def.id === 'P-LEACH-R01-R02'
      ? { visualValveCount: Number(pipe1State?.accessories?.valvesCount ?? 0) }
      : {};
    groups.push(renderDefinition(def, null, material, visualOptions));
  });

  const supportPolicyByConnection = Object.fromEntries(definitions.map((definition) => [definition.id, definition.supportPolicy ?? 'local']));
  const supportRoot = createProcessPipeRacks({ connections: groups, policyByConnection: supportPolicyByConnection });
  root.add(supportRoot);

  const carbonStart = equipmentSystem.getPortWorldPosition('CIP-ADSORPTION', 'loadedCarbonOut');
  const carbonEnd = equipmentSystem.getPortWorldPosition('ELUTION-SKID', 'loadedCarbonIn');
  materialTransfers.add(solidTransferLink({ id: 'MT-CIP-TO-ELUTION-CARBON', start: carbonStart, end: carbonEnd, color: 0x403a32, width: 0.22 }));
  const barrenStart = equipmentSystem.getPortWorldPosition('ELUTION-SKID', 'barrenCarbonOut');
  const barrenEnd = equipmentSystem.getPortWorldPosition('CIP-ADSORPTION', 'barrenCarbonIn');
  materialTransfers.add(solidTransferLink({ id: 'MT-ELUTION-TO-CIP-BARREN-CARBON', start: barrenStart, end: barrenEnd, color: 0x585248, width: 0.18 }));
  const ewProduct = equipmentSystem.getPortWorldPosition('EW-CELLS', 'cathodeOut');
  const furnaceFeed = equipmentSystem.getPortWorldPosition('SMELTING-FURNACE', 'feed');
  materialTransfers.add(solidTransferLink({ id: 'MT-EW-TO-SMELTING-CATHODE', start: ewProduct, end: furnaceFeed, color: 0xb7a06d, width: 0.42 }));


  function auditConnectionEndpoints(toleranceM = 0.03) {
    return groups.map((group) => {
      const route = group.userData.routePoints ?? [];
      const source = group.userData.source;
      const target = group.userData.target;
      if (!source || !target || route.length < 2) {
        return Object.freeze({ id: group.userData.connectionId, valid: false, sourceErrorM: Infinity, targetErrorM: Infinity });
      }
      const expectedStart = equipmentSystem.getPortWorldPosition(source.equipmentId, source.portId);
      const expectedEnd = equipmentSystem.getPortWorldPosition(target.equipmentId, target.portId);
      const actualStart = new THREE.Vector3(...route[0]);
      const actualEnd = new THREE.Vector3(...route.at(-1));
      const sourceErrorM = actualStart.distanceTo(expectedStart);
      const targetErrorM = actualEnd.distanceTo(expectedEnd);
      return Object.freeze({
        id: group.userData.connectionId,
        valid: sourceErrorM <= toleranceM && targetErrorM <= toleranceM,
        sourceErrorM,
        targetErrorM,
        toleranceM,
      });
    });
  }

  return {
    root,
    engine,
    groups,
    supportRoot,
    materialTransfers,
    auditConnectionEndpoints,
    refreshPipe1(nextPipe1State) {
      const def = definitionMap.get('P-LEACH-R01-R02');
      if (!def) return null;
      const diameter = Number(nextPipe1State?.innerDiameterM);
      const material = nextPipe1State?.material ? createPipeMaterial(nextPipe1State.material) : null;
      const next = renderDefinition(
        def,
        Number.isFinite(diameter) && diameter > 0 ? diameter : def.diameter,
        material,
        { visualValveCount: Number(nextPipe1State?.accessories?.valvesCount ?? 0) },
      );
      next.userData.requestedHydraulicLengthM = nextPipe1State?.lengthM ?? null;
      next.userData.physicalDiameterM = Number.isFinite(diameter) && diameter > 0 ? diameter : def.diameter;
      const index = groups.findIndex((group) => group.userData.connectionId === def.id);
      if (index >= 0) groups[index] = next;
      else groups.push(next);
      supportRoot.refresh(groups);
      return next;
    },
    dispose() { engine.dispose(); },
  };
}
