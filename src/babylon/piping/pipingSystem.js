import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import {
  PROCESS_PIPE_CONNECTIONS,
  PROCESS_SOLID_TRANSFERS,
  getProcessPipeConnection,
} from '../../scene/integration/processConnectionContracts.js';
import { getTerrainHeight } from '../../scene/environment/terrainHeight.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { createBabylonProcessPipeRacks } from './pipeRacks.js';
import {
  attachBabylonBlenderModule,
  BLENDER_MODULE_URLS,
  quaternionFromLocalX,
} from '../assets/moduleLibrary.js';

export const BABYLON_MIN_RENDERED_PIPE_DIAMETER_M = 0.40;

const PIPE_COLORS = Object.freeze({
  slurry: Object.freeze([0x55 / 255, 0x7f / 255, 0x8d / 255]),
  underflow: Object.freeze([0x80 / 255, 0x65 / 255, 0x4a / 255]),
  overflow: Object.freeze([0x4e / 255, 0x87 / 255, 0x90 / 255]),
  interstage: Object.freeze([0x64 / 255, 0x8c / 255, 0x93 / 255]),
  solution: Object.freeze([0x66 / 255, 0x8d / 255, 0x78 / 255]),
});

export function getBabylonRenderedPipeDiameter(realDiameterM) {
  if (!Number.isFinite(realDiameterM) || realDiameterM <= 0) return 0;
  return Math.max(realDiameterM, BABYLON_MIN_RENDERED_PIPE_DIAMETER_M);
}

function elevatedRoute(start, end, { z = null, x = null, clearance = 2.0 } = {}) {
  const y = Math.max(start.y, end.y) + clearance;
  const points = [new Vector3(start.x, y, start.z)];
  if (z !== null) points.push(new Vector3(start.x, y, z));
  if (x !== null) points.push(new Vector3(x, y, z ?? start.z));
  if (z !== null) points.push(new Vector3(end.x, y, z));
  points.push(new Vector3(end.x, y, end.z));
  return points.filter((point, index, array) => index === 0 || Vector3.Distance(point, array[index - 1]) > 0.05);
}

export function buildBabylonConnectionRoute(equipmentSystem, definition) {
  const source = { equipmentId: definition.source[0], portId: definition.source[1] };
  const target = { equipmentId: definition.target[0], portId: definition.target[1] };
  const start = equipmentSystem.getPortWorldPosition(source.equipmentId, source.portId);
  const end = equipmentSystem.getPortWorldPosition(target.equipmentId, target.portId);
  const corridor = definition.corridor ?? {};
  let interior;
  if (corridor.slopedApproach) {
    interior = [
      Vector3.Lerp(start, end, 0.28),
      Vector3.Lerp(start, end, 0.82),
    ];
    interior[0].y = start.y;
    interior[0].z = start.z + (end.z - start.z) * 0.34;
    interior[1].y = end.y + 0.45;
    interior[1].z = start.z + (end.z - start.z) * 0.84;
  } else {
    interior = elevatedRoute(start, end, corridor);
  }
  const route = corridor.slopedApproach
    ? [start, ...interior, end]
    : [start, ...interior, end];
  return route.filter((point, index, array) => (
    index === 0 || Vector3.Distance(point, array[index - 1]) > 1e-6
  ));
}

function createMaterial(scene, kind) {
  const [r, g, b] = PIPE_COLORS[kind] ?? PIPE_COLORS.slurry;
  const material = new StandardMaterial(`babylon-pipe-${kind}`, scene);
  material.diffuseColor = new Color3(r, g, b);
  material.specularColor = new Color3(0.48, 0.52, 0.54);
  material.specularPower = 36;
  return material;
}

function createFluidMaterial(scene, kind) {
  const [r, g, b] = PIPE_COLORS[kind] ?? PIPE_COLORS.slurry;
  const material = new StandardMaterial(`babylon-pipe-${kind}-internal-fluid`, scene);
  material.diffuseColor = new Color3(r * 0.72, g * 0.78, b * 0.82);
  material.emissiveColor = new Color3(r * 0.18, g * 0.20, b * 0.22);
  material.specularColor = new Color3(0.10, 0.11, 0.12);
  material.alpha = 0.72;
  material.disableDepthWrite = true;
  return material;
}

function alignCylinder(mesh, start, end) {
  const direction = end.subtract(start);
  const rotation = Quaternion.Identity();
  Quaternion.FromUnitVectorsToRef(Vector3.Up(), direction.normalize(), rotation);
  mesh.rotationQuaternion = rotation;
  mesh.position = Vector3.Lerp(start, end, 0.5);
}

function createFluidSegment(scene, parent, start, end, renderedDiameterM, material, name) {
  const length = Vector3.Distance(start, end);
  if (length <= 1e-8) return null;
  const mesh = CreateCylinder(name, {
    height: length,
    diameter: renderedDiameterM * 0.62,
    tessellation: 16,
    subdivisions: 1,
    cap: 3,
  }, scene);
  mesh.parent = parent;
  alignCylinder(mesh, start, end);
  mesh.material = material;
  mesh.isPickable = false;
  mesh.metadata = { inspectionInterior: true, inspectionRole: 'interior', pipeInternalFluid: true };
  return mesh;
}

function pointAlongRoute(route, fraction) {
  const lengths = [];
  let total = 0;
  for (let index = 0; index < route.length - 1; index += 1) {
    const length = Vector3.Distance(route[index], route[index + 1]);
    lengths.push(length);
    total += length;
  }
  if (total <= 1e-8) return route[0].clone();
  let remaining = Math.max(0, Math.min(1, fraction)) * total;
  for (let index = 0; index < lengths.length; index += 1) {
    if (remaining <= lengths[index] || index === lengths.length - 1) {
      return Vector3.Lerp(route[index], route[index + 1], lengths[index] > 0 ? remaining / lengths[index] : 0);
    }
    remaining -= lengths[index];
  }
  return route.at(-1).clone();
}

function routeLength(route) {
  return route.slice(0, -1).reduce((sum, point, index) => sum + Vector3.Distance(point, route[index + 1]), 0);
}

function createFlowParticles(scene, parent, route, renderedDiameterM, connectionId) {
  const totalLengthM = Math.max(0.1, routeLength(route));
  const count = Math.max(18, Math.min(72, Math.round(totalLengthM * 0.55)));
  const material = new StandardMaterial(`${connectionId}-flow-particle-material`, scene);
  material.diffuseColor = new Color3(1.0, 0.78, 0.46);
  material.emissiveColor = new Color3(0.12, 0.08, 0.035);
  material.specularColor = Color3.Black();
  const particles = [];
  const phases = [];
  const diameter = Math.max(0.024, Math.min(0.055, renderedDiameterM * 0.10));
  for (let index = 0; index < count; index += 1) {
    const phase = (index / count + ((index * 17) % 23) / (23 * count)) % 1;
    const particle = CreateSphere(`${connectionId}-suspended-solid-${index + 1}`, {
      diameter,
      segments: 4,
    }, scene);
    particle.parent = parent;
    particle.position.copyFrom(pointAlongRoute(route, phase));
    particle.material = material;
    particle.isPickable = false;
    particle.metadata = {
      inspectionInterior: true,
      inspectionRole: 'interior',
      pipeParticleFlow: true,
      connectionId,
    };
    particles.push(particle);
    phases.push(phase);
  }
  const flowSpeed = Math.max(0.018, Math.min(0.11, 2.4 / totalLengthM));
  return {
    material,
    particles,
    phases,
    totalLengthM,
    flowSpeed,
    update(dt, scale = 1) {
      if (!(dt > 0) || !(scale > 0)) return false;
      particles.forEach((particle, index) => {
        phases[index] = (phases[index] + dt * flowSpeed * scale) % 1;
        particle.position.copyFrom(pointAlongRoute(route, phases[index]));
      });
      return true;
    },
  };
}

function createFittingCylinder(scene, parent, name, position, tangent, { height, diameter, material, metadata = {} }) {
  const half = tangent.normalize().scale(height / 2);
  const start = position.subtract(half);
  const end = position.add(half);
  const mesh = CreateCylinder(name, { height, diameter, tessellation: 24, cap: 3 }, scene);
  mesh.parent = parent;
  alignCylinder(mesh, start, end);
  mesh.material = material;
  mesh.receiveShadows = true;
  mesh.metadata = metadata;
  return mesh;
}

function createReducer(scene, parent, name, start, end, startDiameterM, endDiameterM, material) {
  const length = Vector3.Distance(start, end);
  if (length <= 1e-8) return null;
  const reducer = CreateCylinder(name, {
    height: length,
    diameterTop: endDiameterM,
    diameterBottom: startDiameterM,
    tessellation: 24,
    cap: 3,
  }, scene);
  reducer.parent = parent;
  alignCylinder(reducer, start, end);
  reducer.material = material;
  reducer.receiveShadows = true;
  reducer.metadata = { pipeReducer: true, startDiameterM, endDiameterM };
  return reducer;
}

function createSegment(scene, parent, start, end, diameter, material, name) {
  const direction = end.subtract(start);
  const length = direction.length();
  if (length <= 1e-8) return null;
  const mesh = CreateCylinder(name, {
    height: length,
    diameter,
    tessellation: 24,
    subdivisions: 1,
    cap: 3,
  }, scene);
  mesh.parent = parent;
  mesh.position = Vector3.Lerp(start, end, 0.5);
  const rotation = Quaternion.Identity();
  Quaternion.FromUnitVectorsToRef(Vector3.Up(), direction.normalize(), rotation);
  mesh.rotationQuaternion = rotation;
  mesh.material = material;
  mesh.receiveShadows = true;
  mesh.metadata = { pipeSegment: true, physicalLengthM: length };
  return mesh;
}

function createJoint(scene, parent, point, diameter, material, name) {
  const joint = CreateSphere(name, {
    diameter,
    segments: 16,
  }, scene);
  joint.parent = parent;
  joint.position.copyFrom(point);
  joint.material = material;
  joint.receiveShadows = true;
  joint.metadata = { pipeJoint: true };
  return joint;
}

function createSolidTransfer({ scene, equipmentSystem, definition }) {
  const start = equipmentSystem.getPortWorldPosition(definition.source[0], definition.source[1]);
  const end = equipmentSystem.getPortWorldPosition(definition.target[0], definition.target[1]);
  const midY = Math.max(start.y, end.y) + 1.6;
  const points = [
    start,
    new Vector3(start.x, midY, start.z),
    new Vector3(end.x, midY, end.z),
    end,
  ];
  const root = new TransformNode(definition.id, scene);
  if (scene.metadata?.visualAuthority === 'V57/B63') {
    root.metadata = { connectionId: definition.id, routePoints: points.map((point) => point.asArray()), visualAuthority: 'V57/B63' };
    return { root, route: points, materials: [] };
  }
  const color = new Color3(
    ((definition.color >> 16) & 0xff) / 255,
    ((definition.color >> 8) & 0xff) / 255,
    (definition.color & 0xff) / 255,
  );
  const trayMaterial = new StandardMaterial(`${definition.id}-material`, scene);
  trayMaterial.diffuseColor = color;
  trayMaterial.specularColor = new Color3(0.18, 0.18, 0.16);
  const supportMaterial = new StandardMaterial(`${definition.id}-support-material`, scene);
  supportMaterial.diffuseColor = new Color3(0.35, 0.41, 0.43);
  points.slice(0, -1).forEach((point, index) => {
    const next = points[index + 1];
    const direction = next.subtract(point);
    const length = direction.length();
    if (length <= 0.05) return;
    const floor = CreateBox(`${definition.id}-tray-${index + 1}-floor`, {
      width: length,
      height: 0.11,
      depth: definition.width,
    }, scene);
    floor.parent = root;
    floor.position = Vector3.Lerp(point, next, 0.5);
    const rotation = Quaternion.Identity();
    Quaternion.FromUnitVectorsToRef(Vector3.Right(), direction.normalize(), rotation);
    floor.rotationQuaternion = rotation;
    floor.material = trayMaterial;
    floor.receiveShadows = true;

    const horizontalLength = Math.hypot(direction.x, direction.z);
    if (horizontalLength > 4.5 && Math.abs(direction.y) < 0.2) {
      const supportCount = Math.min(4, Math.max(1, Math.floor(horizontalLength / 5.5)));
      for (let supportIndex = 1; supportIndex <= supportCount; supportIndex += 1) {
        const t = supportIndex / (supportCount + 1);
        const supportPoint = Vector3.Lerp(point, next, t);
        const groundY = getTerrainHeight(supportPoint.x, supportPoint.z) + 0.06;
        const height = supportPoint.y - groundY - 0.08;
        if (height <= 0.25) continue;
        const post = CreateBox(`${definition.id}-tray-support-${index + 1}-${supportIndex}`, {
          width: 0.12,
          height,
          depth: 0.12,
        }, scene);
        post.parent = root;
        post.position.set(supportPoint.x, groundY + height / 2, supportPoint.z);
        post.material = supportMaterial;
      }
    }
  });
  root.metadata = {
    connectionId: definition.id,
    inspectableEquipment: true,
    inspectionKind: 'solid-material-transfer',
    routePoints: points.map((point) => point.asArray()),
    flowDirection: 'source-to-target',
    source: { equipmentId: definition.source[0], portId: definition.source[1] },
    target: { equipmentId: definition.target[0], portId: definition.target[1] },
    transferKind: definition.kind,
    widthM: definition.width,
  };
  return { root, route: points, materials: [trayMaterial, supportMaterial] };
}

export function renderBabylonPipeConnection({
  scene,
  equipmentSystem,
  definition,
  nominalDiameterM = definition?.diameter,
  pipeMaterialName = '',
  visualValveCount = null,
} = {}) {
  if (!scene || !equipmentSystem || !definition?.id) throw new TypeError('Conexión Babylon inválida.');
  const route = buildBabylonConnectionRoute(equipmentSystem, definition);
  const renderedDiameterM = getBabylonRenderedPipeDiameter(nominalDiameterM);
  const root = new TransformNode(definition.id, scene);
  if (scene.metadata?.visualAuthority === 'V57/B63') {
    // Retain topology and parameter updates; B63 supplies the visible pipes.
    const sourceDiameterM = Number(equipmentSystem.getPort?.(...definition.source)?.nominalDiameterM ?? nominalDiameterM);
    const targetDiameterM = Number(equipmentSystem.getPort?.(...definition.target)?.nominalDiameterM ?? nominalDiameterM);
    root.metadata = {
      connectionId: definition.id,
      source: { equipmentId: definition.source[0], portId: definition.source[1] },
      target: { equipmentId: definition.target[0], portId: definition.target[1] },
      nominalDiameterM, physicalDiameterM: nominalDiameterM, renderedDiameterM,
      processKind: definition.kind, supportPolicy: definition.supportPolicy,
      routePoints: route.map((point) => point.asArray()), sourceDiameterM, targetDiameterM,
      requiresReducer: Math.abs(sourceDiameterM - nominalDiameterM) > 1e-9 || Math.abs(targetDiameterM - nominalDiameterM) > 1e-9,
      requestedMaterial: pipeMaterialName, visualValveCount: visualValveCount ?? 0,
      flowParticleCount: 0, visualAuthority: 'V57/B63',
    };
    return { root, route, material: null, fluidMaterial: null, fittingMaterial: null,
      flow: { particles: [], update: () => false }, moduleHandles: [] };
  }
  const material = createMaterial(scene, definition.kind);
  const fluidMaterial = createFluidMaterial(scene, definition.kind);
  const fittingMaterial = new StandardMaterial(`${definition.id}-fitting-material`, scene);
  fittingMaterial.diffuseColor = new Color3(0.31, 0.36, 0.38);
  fittingMaterial.specularColor = new Color3(0.45, 0.48, 0.49);
  fittingMaterial.specularPower = 40;
  route.slice(0, -1).forEach((start, index) => {
    createSegment(scene, root, start, route[index + 1], renderedDiameterM, material, `${definition.id}-segment-${index + 1}`);
    createFluidSegment(scene, root, start, route[index + 1], renderedDiameterM, fluidMaterial, `${definition.id}-slurry-stream-${index + 1}`);
  });
  route.slice(1, -1).forEach((point, index) => {
    createJoint(scene, root, point, renderedDiameterM, material, `${definition.id}-joint-${index + 1}`);
  });

  const flow = createFlowParticles(scene, root, route, renderedDiameterM, definition.id);
  const moduleHandles = [];
  const firstTangent = route[1].subtract(route[0]).normalize();
  const lastTangent = route.at(-1).subtract(route.at(-2)).normalize();
  const sourceFlange = createFittingCylinder(scene, root, `${definition.id}-source-flange`, route[0], firstTangent, {
    height: Math.max(0.12, renderedDiameterM * 0.22),
    diameter: renderedDiameterM * 1.36,
    material: fittingMaterial,
    metadata: { pipeFlange: true, fittingEnd: 'source' },
  });
  const targetFlange = createFittingCylinder(scene, root, `${definition.id}-target-flange`, route.at(-1), lastTangent, {
    height: Math.max(0.12, renderedDiameterM * 0.22),
    diameter: renderedDiameterM * 1.36,
    material: fittingMaterial,
    metadata: { pipeFlange: true, fittingEnd: 'target' },
  });
  const fittingScale = Math.max(0.82, Math.min(1.85, renderedDiameterM / 0.40));
  moduleHandles.push(attachBabylonBlenderModule({
    scene,
    parent: root,
    url: BLENDER_MODULE_URLS.pipeFlange,
    name: `${definition.id}-source-flange-blender`,
    position: route[0],
    scale: [fittingScale, fittingScale, fittingScale],
    rotationQuaternion: quaternionFromLocalX(firstTangent),
    metadata: { pipingHybridRole: 'source-flange', connectionId: definition.id, renderedDiameterM },
    onReady: () => sourceFlange?.setEnabled?.(false),
  }));
  moduleHandles.push(attachBabylonBlenderModule({
    scene,
    parent: root,
    url: BLENDER_MODULE_URLS.pipeFlange,
    name: `${definition.id}-target-flange-blender`,
    position: route.at(-1),
    scale: [fittingScale, fittingScale, fittingScale],
    rotationQuaternion: quaternionFromLocalX(lastTangent),
    metadata: { pipingHybridRole: 'target-flange', connectionId: definition.id, renderedDiameterM },
    onReady: () => targetFlange?.setEnabled?.(false),
  }));

  const sourceDiameterM = Number(equipmentSystem.getPort?.(definition.source[0], definition.source[1])?.nominalDiameterM ?? nominalDiameterM);
  const targetDiameterM = Number(equipmentSystem.getPort?.(definition.target[0], definition.target[1])?.nominalDiameterM ?? nominalDiameterM);
  if (Math.abs(sourceDiameterM - nominalDiameterM) > 1e-9 && route.length >= 2) {
    const length = Math.min(0.8, Vector3.Distance(route[0], route[1]) * 0.35);
    createReducer(
      scene,
      root,
      `${definition.id}-source-reducer`,
      route[0],
      route[0].add(firstTangent.scale(length)),
      sourceDiameterM,
      nominalDiameterM,
      fittingMaterial,
    );
  }
  if (Math.abs(targetDiameterM - nominalDiameterM) > 1e-9 && route.length >= 2) {
    const length = Math.min(0.8, Vector3.Distance(route.at(-2), route.at(-1)) * 0.35);
    createReducer(
      scene,
      root,
      `${definition.id}-target-reducer`,
      route.at(-1).subtract(lastTangent.scale(length)),
      route.at(-1),
      nominalDiameterM,
      targetDiameterM,
      fittingMaterial,
    );
  }

  let longest = null;
  route.slice(0, -1).forEach((start, index) => {
    const end = route[index + 1];
    const length = Vector3.Distance(start, end);
    if (!longest || length > longest.length) longest = { start, end, length };
  });
  const requestedValveCount = Number.isFinite(visualValveCount)
    ? Math.max(0, Math.min(8, Math.floor(visualValveCount)))
    : (longest?.length > 6 ? 1 : 0);
  if (longest && requestedValveCount > 0) {
    const tangent = longest.end.subtract(longest.start).normalize();
    for (let index = 1; index <= requestedValveCount; index += 1) {
      const point = Vector3.Lerp(longest.start, longest.end, index / (requestedValveCount + 1));
      const valve = CreateSphere(`${definition.id}-valve-${index}`, {
        diameter: renderedDiameterM * 1.42,
        segments: 12,
      }, scene);
      valve.parent = root;
      valve.position.copyFrom(point);
      valve.scaling.set(1, 0.74, 1);
      valve.material = fittingMaterial;
      valve.metadata = { pipeValve: true, valveIndex: index, tangent: tangent.asArray() };
      moduleHandles.push(attachBabylonBlenderModule({
        scene,
        parent: root,
        url: BLENDER_MODULE_URLS.pipeValve,
        name: `${definition.id}-valve-${index}-blender`,
        position: point,
        scale: [fittingScale, fittingScale, fittingScale],
        rotationQuaternion: quaternionFromLocalX(tangent),
        metadata: { pipingHybridRole: 'valve', connectionId: definition.id, valveIndex: index, renderedDiameterM },
        onReady: () => valve.setEnabled?.(false),
      }));
    }
  }

  const normalizedMaterialName = String(pipeMaterialName).trim().toLowerCase();
  if (normalizedMaterialName.includes('hdpe') || normalizedMaterialName.includes('pead')) {
    material.diffuseColor = new Color3(0.15, 0.17, 0.18);
  }
  root.metadata = {
    connectionId: definition.id,
    source: { equipmentId: definition.source[0], portId: definition.source[1] },
    target: { equipmentId: definition.target[0], portId: definition.target[1] },
    nominalDiameterM,
    physicalDiameterM: nominalDiameterM,
    renderedDiameterM,
    processKind: definition.kind,
    supportPolicy: definition.supportPolicy,
    routePoints: route.map((point) => point.asArray()),
    sourceDiameterM,
    targetDiameterM,
    requiresReducer: Math.abs(sourceDiameterM - nominalDiameterM) > 1e-9 || Math.abs(targetDiameterM - nominalDiameterM) > 1e-9,
    visualValveCount: requestedValveCount,
    requestedMaterial: pipeMaterialName,
    flowParticleCount: flow.particles.length,
    flowSpeed: flow.flowSpeed,
    blenderHybridModuleCount: moduleHandles.length,
  };
  return { root, route, material, fluidMaterial, fittingMaterial, flow, moduleHandles };
}

export function createBabylonPipingSystem({
  scene,
  equipmentSystem,
  pipe1State = null,
} = {}) {
  if (!scene || !equipmentSystem) throw new TypeError('Babylon piping system requires scene and equipmentSystem.');
  const root = new TransformNode('babylon-process-piping', scene);
  const connections = new Map();
  const materialTransfers = new Map();

  function disposeConnectionHandle(handle) {
    if (!handle) return;
    handle.root?.dispose?.(false, true);
  }

  function effectiveDiameter(definition) {
    if (definition.id !== 'P-LEACH-R01-R02') return definition.diameter;
    const diameter = Number(pipe1State?.innerDiameterM);
    return Number.isFinite(diameter) && diameter > 0 ? diameter : definition.diameter;
  }

  PROCESS_PIPE_CONNECTIONS.forEach((definition) => {
    const isPipe1 = definition.id === 'P-LEACH-R01-R02';
    const handle = renderBabylonPipeConnection({
      scene,
      equipmentSystem,
      definition,
      nominalDiameterM: effectiveDiameter(definition),
      pipeMaterialName: isPipe1 ? String(pipe1State?.material ?? '') : '',
      visualValveCount: isPipe1 ? Number(pipe1State?.accessories?.valvesCount ?? 0) : null,
    });
    handle.root.parent = root;
    connections.set(definition.id, handle);
  });
  PROCESS_SOLID_TRANSFERS.forEach((definition) => {
    const handle = createSolidTransfer({ scene, equipmentSystem, definition });
    handle.root.parent = root;
    materialTransfers.set(definition.id, handle);
  });
  const supportPolicyByConnection = Object.fromEntries(
    PROCESS_PIPE_CONNECTIONS.map((definition) => [definition.id, definition.supportPolicy ?? 'local']),
  );
  const pipeRacks = createBabylonProcessPipeRacks({
    scene,
    connections,
    policyByConnection: supportPolicyByConnection,
  });
  pipeRacks.root.parent = root;

  function auditConnectionEndpoints(toleranceM = 0.03) {
    return [...connections].map(([id, handle]) => {
      const definition = getProcessPipeConnection(id);
      const expectedStart = equipmentSystem.getPortWorldPosition(definition.source[0], definition.source[1]);
      const expectedEnd = equipmentSystem.getPortWorldPosition(definition.target[0], definition.target[1]);
      const actualStart = handle.route[0];
      const actualEnd = handle.route.at(-1);
      const sourceErrorM = Vector3.Distance(actualStart, expectedStart);
      const targetErrorM = Vector3.Distance(actualEnd, expectedEnd);
      return Object.freeze({
        id,
        valid: sourceErrorM <= toleranceM && targetErrorM <= toleranceM,
        sourceErrorM,
        targetErrorM,
        toleranceM,
      });
    });
  }

  function refreshPipe1(nextPipe1State = null) {
    const definition = getProcessPipeConnection('P-LEACH-R01-R02');
    if (!definition) return null;
    const requestedDiameterM = Number(nextPipe1State?.innerDiameterM);
    const nominalDiameterM = Number.isFinite(requestedDiameterM) && requestedDiameterM > 0
      ? requestedDiameterM
      : definition.diameter;
    const next = renderBabylonPipeConnection({
      scene,
      equipmentSystem,
      definition,
      nominalDiameterM,
      pipeMaterialName: String(nextPipe1State?.material ?? ''),
      visualValveCount: Number(nextPipe1State?.accessories?.valvesCount ?? 0),
    });
    next.root.parent = root;
    next.root.metadata.requestedHydraulicLengthM = Number.isFinite(Number(nextPipe1State?.lengthM))
      ? Number(nextPipe1State.lengthM)
      : null;
    next.root.metadata.requestedMaterial = String(nextPipe1State?.material ?? '');

    const previous = connections.get(definition.id);
    connections.set(definition.id, next);
    disposeConnectionHandle(previous);
    pipeRacks.refresh(connections);
    return next;
  }

  let flowScale = 1;
  function setFlowScale(value) {
    flowScale = Number.isFinite(value) ? Math.max(0, value) : 0;
    root.metadata = { ...(root.metadata ?? {}), visualFlowScale: flowScale };
    return flowScale;
  }

  function updateFlow(deltaSeconds) {
    if (!(deltaSeconds > 0) || !(flowScale > 0)) return false;
    let updated = false;
    connections.forEach((handle) => {
      updated = handle.flow?.update?.(deltaSeconds, flowScale) || updated;
    });
    return updated;
  }

  return {
    root,
    connections,
    materialTransfers,
    supportRoot: pipeRacks.root,
    pipeRacks,
    auditConnectionEndpoints,
    refreshPipe1,
    setFlowScale,
    updateFlow,
    get flowScale() { return flowScale; },
    dispose() {
      pipeRacks.dispose();
      connections.forEach((handle) => {
        disposeConnectionHandle(handle);
      });
      connections.clear();
      materialTransfers.forEach((handle) => {
        handle.root.dispose(false, true);
        handle.materials.forEach((material) => material.dispose());
      });
      materialTransfers.clear();
      root.dispose();
    },
  };
}
