import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { getTerrainHeight } from '../../scene/environment/terrainHeight.js';
import {
  attachBabylonBlenderModule,
  BLENDER_MODULE_URLS,
  quaternionFromLocalX,
} from '../assets/moduleLibrary.js';
import {
  CONVEYOR_CONNECTIONS,
  FIXED_MATERIAL_TRANSFER_CASCADES,
  ROM_FEEDER_TRANSFER,
  V30_CONVEYOR_BELT_SPEED_MPS,
} from '../../scene/integration/materialTransportContracts.js';

const DECK_CENTER_Y_M = 2.03;
const SUPPORT_SPACING_M = 4.5;

function material(scene, name, color, { metal = false } = {}) {
  const result = new StandardMaterial(name, scene);
  result.diffuseColor = Color3.FromHexString(color);
  result.specularColor = metal ? new Color3(0.28, 0.30, 0.30) : new Color3(0.05, 0.05, 0.045);
  result.specularPower = metal ? 48 : 12;
  return result;
}

function createMaterials(scene) {
  return Object.freeze({
    belt: material(scene, 'babylon-conveyor-belt-material', '#353b3d'),
    steel: material(scene, 'babylon-conveyor-steel-material', '#536269', { metal: true }),
    safety: material(scene, 'babylon-conveyor-safety-material', '#d29a27', { metal: true }),
    ore: material(scene, 'babylon-conveyor-ore-material', '#7f6046'),
    liner: material(scene, 'babylon-transfer-liner-material', '#4d5659', { metal: true }),
  });
}

function clonePoint(value) {
  return value instanceof Vector3 ? value.clone() : Vector3.FromArray(value);
}

function createBoxBetween(scene, parent, name, start, end, thickness, boxMaterial) {
  const a = clonePoint(start);
  const b = clonePoint(end);
  const direction = b.subtract(a);
  const length = direction.length();
  if (length <= 1e-8) return null;
  const mesh = CreateBox(name, {
    width: thickness,
    height: length,
    depth: thickness,
  }, scene);
  mesh.parent = parent;
  mesh.position = Vector3.Lerp(a, b, 0.5);
  const rotation = Quaternion.Identity();
  Quaternion.FromUnitVectorsToRef(Vector3.Up(), direction.normalize(), rotation);
  mesh.rotationQuaternion = rotation;
  mesh.material = boxMaterial;
  mesh.receiveShadows = true;
  return mesh;
}

function createConveyor({ scene, equipmentSystem, definition, materials }) {
  const [sourceEquipment, sourcePort] = definition.source;
  const [targetEquipment, targetPort] = definition.target;
  const source = equipmentSystem.getPortWorldPosition(sourceEquipment, sourcePort);
  const target = equipmentSystem.getPortWorldPosition(targetEquipment, targetPort);
  const dx = target.x - source.x;
  const dz = target.z - source.z;
  const horizontalRun = Math.max(0.5, Math.hypot(dx, dz));
  const rise = target.y - source.y;
  const incline = Math.atan2(rise, horizontalRun);
  const slopeLength = Math.hypot(horizontalRun, rise);
  const width = definition.widthM;

  const root = new TransformNode(definition.id, scene);
  root.position.set(
    (source.x + target.x) / 2,
    (source.y + target.y) / 2 - DECK_CENTER_Y_M,
    (source.z + target.z) / 2,
  );
  root.rotation.y = Math.atan2(-dz, dx);
  root.metadata = {
    inspectableEquipment: true,
    inspectionKind: 'conveyor',
    conveyorId: definition.id,
    source: [...definition.source],
    target: [...definition.target],
    routePoints: [source.asArray(), target.asArray()],
    widthM: width,
    horizontalRunM: horizontalRun,
    slopeLengthM: slopeLength,
    beltSpeedMps: V30_CONVEYOR_BELT_SPEED_MPS,
    beltTravelM: 0,
    coordinateSystem: 'right-handed',
  };

  const frame = new TransformNode(`${definition.id}-local-frame`, scene);
  frame.parent = root;
  frame.position.y = DECK_CENTER_Y_M;
  frame.rotation.z = incline;

  const belt = CreateBox(`${definition.id}-belt`, {
    width: slopeLength,
    height: 0.10,
    depth: width,
  }, scene);
  belt.parent = frame;
  belt.position.y = 0.36;
  belt.material = materials.belt;
  belt.metadata = { role: 'shell', beltSpeedMps: V30_CONVEYOR_BELT_SPEED_MPS };

  [-1, 1].forEach((side) => {
    const stringer = CreateBox(`${definition.id}-stringer-${side < 0 ? 'left' : 'right'}`, {
      width: slopeLength,
      height: 0.18,
      depth: 0.12,
    }, scene);
    stringer.parent = frame;
    stringer.position.set(0, 0.04, side * width * 0.72);
    stringer.material = materials.steel;
    stringer.receiveShadows = true;
  });

  const pulleys = [];
  [['tail', -slopeLength / 2 + 0.30], ['head', slopeLength / 2 - 0.30]].forEach(([end, x]) => {
    const pivot = new TransformNode(`${definition.id}-${end}-pulley-pivot`, scene);
    pivot.parent = frame;
    pivot.position.set(x, 0.30, 0);
    pivot.metadata = { rotationAxis: 'z', conveyorId: definition.id };
    const pulley = CreateCylinder(`${definition.id}-${end}-pulley`, {
      height: width * 1.20,
      diameter: 0.68,
      tessellation: 24,
    }, scene);
    pulley.parent = pivot;
    pulley.rotation.x = Math.PI / 2;
    pulley.material = materials.steel;
    const marker = CreateBox(`${definition.id}-${end}-pulley-marker`, {
      width: 0.48,
      height: 0.055,
      depth: width * 1.23,
    }, scene);
    marker.parent = pivot;
    marker.material = materials.safety;
    pulleys.push(pivot);
  });

  const orePieces = [];
  const oreCount = Math.max(28, Math.min(72, Math.floor(slopeLength * 2.4)));
  for (let index = 0; index < oreCount; index += 1) {
    const size = 0.085 + (index % 5) * 0.016;
    const ore = CreateSphere(`${definition.id}-ore-${index}`, {
      diameter: size * 2,
      segments: 4,
    }, scene);
    ore.parent = frame;
    ore.position.set(
      -slopeLength / 2 + 0.55 + (index / oreCount) * (slopeLength - 1.1),
      0.51 + (index % 3) * 0.025,
      ((index % 9) - 4) * width * 0.065,
    );
    ore.material = materials.ore;
    ore.metadata = { inspectionRole: 'interior', conveyorMineral: true };
    orePieces.push(ore);
  }

  const supportRoot = new TransformNode(`${definition.id}-supports`, scene);
  supportRoot.parent = root;
  root.computeWorldMatrix(true);
  const supportCount = Math.max(2, Math.ceil(horizontalRun / SUPPORT_SPACING_M));
  for (let index = 1; index < supportCount; index += 1) {
    const localX = -horizontalRun / 2 + (index * horizontalRun) / supportCount;
    const deckY = DECK_CENTER_Y_M + Math.tan(incline) * localX;
    const lateral = width * 0.78;
    [-1, 1].forEach((side) => {
      const localXZ = new Vector3(localX, 0, side * lateral);
      const worldXZ = Vector3.TransformCoordinates(localXZ, root.computeWorldMatrix(true));
      const terrainY = getTerrainHeight(worldXZ.x, worldXZ.z);
      const baseLocalY = terrainY - root.position.y;
      const topLocalY = Math.max(baseLocalY + 0.22, deckY - 0.10);
      const height = topLocalY - baseLocalY;
      const column = CreateBox(`${definition.id}-support-${index}-column-${side < 0 ? 'left' : 'right'}`, {
        width: 0.18,
        height,
        depth: 0.18,
      }, scene);
      column.parent = supportRoot;
      column.position.set(localX, baseLocalY + height / 2, side * lateral);
      column.material = materials.steel;
      column.receiveShadows = true;
      const footing = CreateBox(`${definition.id}-support-${index}-footing-${side < 0 ? 'left' : 'right'}`, {
        width: 0.62,
        height: 0.12,
        depth: 0.62,
      }, scene);
      footing.parent = supportRoot;
      footing.position.set(localX, baseLocalY + 0.06, side * lateral);
      footing.material = materials.steel;
      footing.receiveShadows = true;
      footing.metadata = { terrainY, groundedBy: 'getTerrainHeight' };
    });
    const crossbeam = CreateBox(`${definition.id}-support-${index}-crossbeam`, {
      width: 0.22,
      height: 0.18,
      depth: lateral * 2 + 0.35,
    }, scene);
    crossbeam.parent = supportRoot;
    crossbeam.position.set(localX, deckY - 0.10, 0);
    crossbeam.material = materials.steel;
  }

  const feedLocal = new Vector3(-horizontalRun / 2, DECK_CENTER_Y_M - rise / 2, 0);
  const dischargeLocal = new Vector3(horizontalRun / 2, DECK_CENTER_Y_M + rise / 2, 0);

  function endpointWorld(local) {
    return Vector3.TransformCoordinates(local, root.computeWorldMatrix(true));
  }

  return {
    id: definition.id,
    root,
    frame,
    belt,
    pulleys,
    orePieces,
    source,
    target,
    feedLocal,
    dischargeLocal,
    get feedWorld() { return endpointWorld(feedLocal); },
    get dischargeWorld() { return endpointWorld(dischargeLocal); },
    update(dt) {
      const safeDt = Math.min(Math.max(Number(dt) || 0, 0), 0.1);
      if (safeDt <= 0) return;
      const angularSpeed = V30_CONVEYOR_BELT_SPEED_MPS / 0.34;
      pulleys.forEach((pivot) => { pivot.rotation.z -= safeDt * angularSpeed; });
      orePieces.forEach((ore) => {
        ore.position.x += safeDt * V30_CONVEYOR_BELT_SPEED_MPS;
        ore.rotation.y += safeDt * 0.36;
        if (ore.position.x > slopeLength / 2 - 0.34) ore.position.x = -slopeLength / 2 + 0.42;
      });
      root.metadata.beltTravelM += safeDt * V30_CONVEYOR_BELT_SPEED_MPS;
    },
  };
}

function createTransferCascade({ scene, equipmentSystem, definition, materials }) {
  const target = equipmentSystem.getPortWorldPosition(definition.equipmentId, definition.portId);
  const direction = equipmentSystem.getPortWorldDirection(definition.equipmentId, definition.portId);
  const start = target.add(direction.scale(-definition.upstreamM)).add(new Vector3(0, definition.liftM, 0));
  const end = target.add(direction.scale(0.10));
  const root = new TransformNode(definition.name, scene);
  root.metadata = {
    visualOnly: true,
    educationalMaterialFlow: true,
    sourcePoint: start.asArray(),
    targetPoint: end.asArray(),
    receivingEquipmentId: definition.equipmentId,
    receivingPortId: definition.portId,
  };
  const particles = [];
  const phases = [];
  for (let index = 0; index < definition.count; index += 1) {
    const particle = CreateSphere(`${definition.name}-ore-${index}`, {
      diameter: 0.22 + (index % 4) * 0.018,
      segments: 4,
    }, scene);
    particle.parent = root;
    particle.material = materials.ore;
    particle.metadata = { inspectionRole: 'interior' };
    particles.push(particle);
    phases.push((index / definition.count + (index % 4) * 0.017) % 1);
  }
  const length = Math.max(0.25, Vector3.Distance(start, end));
  function render() {
    particles.forEach((particle, index) => {
      particle.position = Vector3.Lerp(start, end, phases[index]);
      particle.rotation.y = index * 0.41 + phases[index] * 1.3;
    });
  }
  render();
  return {
    root,
    start,
    end,
    particles,
    update(dt) {
      const safeDt = Math.min(Math.max(Number(dt) || 0, 0), 0.1);
      if (safeDt <= 0) return;
      const delta = safeDt * 1.15 / length;
      phases.forEach((phase, index) => { phases[index] = (phase + delta) % 1; });
      render();
    },
  };
}

function createRomFeederChute({ scene, equipmentSystem, materials }) {
  const [sourceEquipment, sourcePort] = ROM_FEEDER_TRANSFER.source;
  const [targetEquipment, targetPort] = ROM_FEEDER_TRANSFER.target;
  const start = equipmentSystem.getPortWorldPosition(sourceEquipment, sourcePort);
  const end = equipmentSystem.getPortWorldPosition(targetEquipment, targetPort);
  const root = new TransformNode(ROM_FEEDER_TRANSFER.id, scene);
  root.metadata = {
    visualOnly: true,
    inspectableEquipment: true,
    inspectionKind: 'material-chute',
    sourcePoint: start.asArray(),
    targetPoint: end.asArray(),
  };
  const shell = createBoxBetween(scene, root, `${ROM_FEEDER_TRANSFER.id}-shell`, start, end, 0.72, materials.liner);
  if (shell) shell.metadata = { visualOnly: true };
  const direction = end.subtract(start).normalize();
  const transferHood = attachBabylonBlenderModule({
    scene,
    parent: root,
    url: BLENDER_MODULE_URLS.conveyorTransferHood,
    name: 'rom-feeder-blender-transfer-hood',
    position: Vector3.Lerp(start, end, 0.88),
    scale: [0.92, 0.86, 0.92],
    rotationQuaternion: quaternionFromLocalX(direction),
    metadata: { chuteHybridRole: 'outlet-hood', connectionId: ROM_FEEDER_TRANSFER.id },
  });
  root.metadata.blenderHybridChute = true;
  const flow = [];
  for (let index = 0; index < 12; index += 1) {
    const ore = CreateSphere(`${ROM_FEEDER_TRANSFER.id}-ore-${index}`, { diameter: 0.20, segments: 4 }, scene);
    ore.parent = root;
    ore.material = materials.ore;
    ore.position = Vector3.Lerp(start, end, index / 12);
    flow.push({ mesh: ore, phase: index / 12 });
  }
  return {
    root,
    start,
    end,
    transferHood,
    update(dt) {
      const safeDt = Math.min(Math.max(Number(dt) || 0, 0), 0.1);
      if (safeDt <= 0) return;
      const length = Math.max(0.25, Vector3.Distance(start, end));
      flow.forEach((item) => {
        item.phase = (item.phase + safeDt * 0.95 / length) % 1;
        item.mesh.position = Vector3.Lerp(start, end, item.phase);
      });
    },
  };
}

function createStockpileTransferTower({ scene, equipmentSystem, materials }) {
  const source = equipmentSystem.getPortWorldPosition('PRIMARY-CRUSHER', 'dischargeOut');
  const target = equipmentSystem.getPortWorldPosition('STOCKPILE-RECLAIM', 'feedIn');
  const root = new TransformNode('CV-02-STOCKPILE-TRANSFER-TOWER', scene);
  root.metadata = {
    structuralAuxiliary: true,
    transferTower: true,
    conveyorId: 'CV-02-CRUSHER-TO-STOCKPILE',
    supportedEndpoint: target.asArray(),
  };
  const horizontal = target.subtract(source);
  horizontal.y = 0;
  if (horizontal.lengthSquared() < 1e-8) horizontal.set(1, 0, 0);
  horizontal.normalize();
  const side = new Vector3(-horizontal.z, 0, horizontal.x);
  const center = target.add(horizontal.scale(-0.72));
  const deckY = target.y - 0.72;
  const corners = [];
  for (const along of [-1.8, 1.8]) {
    for (const lateral of [-2.25, 2.25]) {
      const point = center.add(horizontal.scale(along)).add(side.scale(lateral));
      const terrainY = getTerrainHeight(point.x, point.z);
      const top = new Vector3(point.x, deckY - 0.12, point.z);
      createBoxBetween(scene, root, `${root.name}-leg-${corners.length + 1}`, new Vector3(point.x, terrainY + 0.16, point.z), top, 0.22, materials.steel);
      const footing = CreateBox(`${root.name}-footing-${corners.length + 1}`, { width: 0.72, height: 0.16, depth: 0.72 }, scene);
      footing.parent = root;
      footing.position.set(point.x, terrainY + 0.08, point.z);
      footing.material = materials.steel;
      footing.metadata = { terrainY, groundedBy: 'getTerrainHeight' };
      corners.push(top);
    }
  }
  [[0, 1], [2, 3], [0, 2], [1, 3]].forEach(([a, b], index) => {
    createBoxBetween(scene, root, `${root.name}-top-${index + 1}`, corners[a], corners[b], 0.20, materials.steel);
  });
  return root;
}

export function createBabylonMaterialTransportSystem({ scene, equipmentSystem } = {}) {
  if (!scene) throw new TypeError('Babylon material transport requires a Scene.');
  if (scene.useRightHandedSystem !== true) throw new Error('Babylon material transport requires a right-handed Scene.');
  if (!equipmentSystem?.getPortWorldPosition || !equipmentSystem?.getPortWorldDirection) {
    throw new TypeError('Babylon material transport requires an equipment system with world-space ports.');
  }
  const root = new TransformNode('babylon-material-transport', scene);
  root.metadata = { migrationStage: 'V31-material-transport', coordinateSystem: 'right-handed' };
  const materials = createMaterials(scene);
  const conveyors = new Map();
  const transfers = [];
  let animationsEnabled = true;

  CONVEYOR_CONNECTIONS.forEach((definition) => {
    const conveyor = createConveyor({ scene, equipmentSystem, definition, materials });
    conveyor.root.parent = root;
    conveyors.set(definition.id, conveyor);
  });
  FIXED_MATERIAL_TRANSFER_CASCADES.forEach((definition) => {
    const transfer = createTransferCascade({ scene, equipmentSystem, definition, materials });
    transfer.root.parent = root;
    transfers.push(transfer);
  });
  const romFeederTransfer = createRomFeederChute({ scene, equipmentSystem, materials });
  romFeederTransfer.root.parent = root;
  const stockpileFeedTower = createStockpileTransferTower({ scene, equipmentSystem, materials });
  stockpileFeedTower.parent = root;

  function update(dt) {
    if (!animationsEnabled) return false;
    conveyors.forEach((conveyor) => conveyor.update(dt));
    transfers.forEach((transfer) => transfer.update(dt));
    romFeederTransfer.update(dt);
    return true;
  }

  function auditConnectionEndpoints(toleranceM = 1e-5) {
    return CONVEYOR_CONNECTIONS.map((definition) => {
      const conveyor = conveyors.get(definition.id);
      const source = equipmentSystem.getPortWorldPosition(...definition.source);
      const target = equipmentSystem.getPortWorldPosition(...definition.target);
      const sourceErrorM = Vector3.Distance(conveyor.feedWorld, source);
      const targetErrorM = Vector3.Distance(conveyor.dischargeWorld, target);
      return Object.freeze({
        id: definition.id,
        sourceErrorM,
        targetErrorM,
        valid: sourceErrorM <= toleranceM && targetErrorM <= toleranceM,
      });
    });
  }

  return {
    root,
    materials,
    conveyors,
    transfers,
    romFeederTransfer,
    stockpileFeedTower,
    update,
    auditConnectionEndpoints,
    setAnimationsEnabled(enabled) { animationsEnabled = Boolean(enabled); },
    get animationsEnabled() { return animationsEnabled; },
    dispose() {
      romFeederTransfer.transferHood?.dispose?.();
      root.dispose(false, true);
      Object.values(materials).forEach((item) => item.dispose());
      conveyors.clear();
      transfers.splice(0, transfers.length);
    },
  };
}
