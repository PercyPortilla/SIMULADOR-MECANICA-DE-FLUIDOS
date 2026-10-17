import * as THREE from 'three';
import { createPipeMaterial } from '../materials/industrialMaterials.js';
import { createIndustrialMaterial } from '../materials/industrialMaterials.js';
import { getTerrainHeight } from '../environment/terrainHeight.js';
import { attachBlenderModule, BLENDER_MODULE_URLS, quaternionFromLocalX } from '../integration/blenderModuleLibrary.js';

const EPSILON = 1e-6;
const RADIAL_SEGMENTS = 24;
// Renderer-only minimum. Hydraulic calculations continue to use nominal/real diameter.
const MIN_RENDERED_DIAMETER_M = 0.40;

function asVector3(value, label) {
  if (value instanceof THREE.Vector3) return value.clone();
  if (Array.isArray(value) && value.length >= 3) {
    const vector = new THREE.Vector3(value[0], value[1], value[2]);
    if ([vector.x, vector.y, vector.z].every(Number.isFinite)) return vector;
  }
  throw new TypeError(`${label} debe ser un Vector3 o [x,y,z] finito.`);
}

function createMaterial(materialName = '') {
  return createPipeMaterial(materialName);
}

function createSlurryFlowMaterial() {
  let map = null;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#76593f';
      ctx.fillRect(0, 0, 32, 128);
      ctx.fillStyle = '#a17b55';
      for (let y = 0; y < 128; y += 24) ctx.fillRect(0, y, 32, 6);
      ctx.fillStyle = '#604733';
      for (let y = 12; y < 128; y += 24) ctx.fillRect(0, y, 32, 3);
      map = new THREE.CanvasTexture(canvas);
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(1, 3);
    }
  }
  const material = new THREE.MeshStandardMaterial({
    color: 0x826247,
    map,
    roughness: 0.78,
    metalness: 0,
    transparent: true,
    opacity: 0.88,
  });
  material.userData.pipeFluidMaterial = true;
  return material;
}

function createInternalFluidMesh(start, end, renderedDiameterM, material) {
  const startPoint = asVector3(start, 'fluid.start');
  const endPoint = asVector3(end, 'fluid.end');
  const direction = endPoint.clone().sub(startPoint);
  const length = direction.length();
  const radius = renderedDiameterM * 0.31;
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 16, 1, false),
    material,
  );
  mesh.position.copy(startPoint).add(endPoint).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.userData.inspectionInterior = true;
  mesh.userData.pipeFluid = true;
  mesh.userData.lengthM = length;
  mesh.visible = false;
  return mesh;
}

function seededFraction(index, salt = 0) {
  const value = Math.sin((index + 1) * (12.9898 + salt * 0.317)) * 43758.5453;
  return value - Math.floor(value);
}

function createPiecewiseLinearFlowCurve(routePoints) {
  const curve = new THREE.CurvePath();
  for (let index = 0; index < routePoints.length - 1; index += 1) {
    curve.add(new THREE.LineCurve3(routePoints[index].clone(), routePoints[index + 1].clone()));
  }
  return curve;
}

function setParticlePositionOnFlow({ curve, progress, radialDistance, radialAngle, out, tangent, normal, binormal, reference }) {
  curve.getPointAt(progress, out);
  curve.getTangentAt(progress, tangent).normalize();
  reference.set(0, 1, 0);
  if (Math.abs(tangent.dot(reference)) > 0.92) reference.set(1, 0, 0);
  normal.crossVectors(tangent, reference).normalize();
  binormal.crossVectors(tangent, normal).normalize();
  out.addScaledVector(normal, Math.cos(radialAngle) * radialDistance);
  out.addScaledVector(binormal, Math.sin(radialAngle) * radialDistance);
  return out;
}

function createFlowParticles(routePoints, renderedDiameterM, connectionId) {
  // IMPORTANT: the pipe shell is built from straight physical segments + spherical
  // joints, so the particle path must use the same piecewise-linear route. A
  // Catmull-Rom spline can bow outside the real pipe at 90-degree changes.
  const curve = createPiecewiseLinearFlowCurve(routePoints);
  const totalLength = Math.max(0.1, curve.getLength());
  const count = Math.max(18, Math.min(96, Math.round(totalLength * 0.75)));
  const positions = new Float32Array(count * 3);
  const progress = new Float32Array(count);
  const radialDistance = new Float32Array(count);
  const radialAngle = new Float32Array(count);
  const fluidRadius = renderedDiameterM * 0.31;
  // Keep particle centres well inside the slurry core. The remaining margin also
  // accounts for the screen-space size of THREE.Points sprites.
  const maxRadialOffset = fluidRadius * 0.42;
  const temp = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const binormal = new THREE.Vector3();
  const reference = new THREE.Vector3();
  for (let index = 0; index < count; index += 1) {
    progress[index] = (index / count + ((index * 17) % 23) / (23 * count)) % 1;
    radialDistance[index] = Math.sqrt(seededFraction(index, 3)) * maxRadialOffset;
    radialAngle[index] = seededFraction(index, 11) * Math.PI * 2;
    setParticlePositionOnFlow({
      curve,
      progress: progress[index],
      radialDistance: radialDistance[index],
      radialAngle: radialAngle[index],
      out: temp,
      tangent,
      normal,
      binormal,
      reference,
    });
    positions[index * 3] = temp.x;
    positions[index * 3 + 1] = temp.y;
    positions[index * 3 + 2] = temp.z;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xffd9a1,
    size: Math.max(0.018, Math.min(0.034, renderedDiameterM * 0.055)),
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.name = `${connectionId}-suspended-solids`;
  points.userData.inspectionInterior = true;
  points.userData.pipeParticleFlow = true;
  points.userData.flowCurve = curve;
  points.userData.flowProgress = progress;
  points.userData.flowRadialDistance = radialDistance;
  points.userData.flowRadialAngle = radialAngle;
  points.userData.flowFluidRadius = fluidRadius;
  points.userData.flowMaxRadialOffset = maxRadialOffset;
  points.userData.flowSpeed = THREE.MathUtils.clamp(2.4 / totalLength, 0.018, 0.11);
  points.userData.connectionId = connectionId;
  return points;
}

function createPipeSupport(point, pipeY, renderedDiameterM, name, tangent = null) {
  const group = new THREE.Group();
  group.name = name;
  const structural = createIndustrialMaterial('darkSteel', { color: 0x536168, roughness: 0.48 });
  const groundY = Math.min(pipeY - 0.45, getTerrainHeight(point.x, point.z) + 0.10);
  const height = Math.max(0.35, pipeY - groundY - renderedDiameterM * 0.65);
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, height, 0.16), structural);
  post.name = `${name}-post`;
  post.position.set(point.x, groundY + height / 2, point.z);
  post.castShadow = true;
  group.add(post);
  const shoe = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.48, renderedDiameterM * 1.8), 0.12, Math.max(0.36, renderedDiameterM * 1.25)), structural);
  shoe.name = `${name}-shoe`;
  shoe.position.set(point.x, pipeY - renderedDiameterM * 0.58, point.z);
  shoe.castShadow = true;
  group.add(shoe);
  const moduleScale = THREE.MathUtils.clamp(renderedDiameterM / 0.40, 0.85, 1.8);
  const direction = tangent instanceof THREE.Vector3 ? tangent.clone() : new THREE.Vector3(1, 0, 0);
  attachBlenderModule({
    parent: group,
    url: BLENDER_MODULE_URLS.pipeSaddle,
    name: `${name}-blender-saddle`,
    position: [point.x, pipeY, point.z],
    scale: [moduleScale, moduleScale, moduleScale],
    quaternion: quaternionFromLocalX(direction),
    userData: { pipingHybridRole: 'saddle', renderedDiameterM },
  });
  return group;
}

function disposeObject(object) {
  object.traverse((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) child.material.forEach((item) => item?.dispose?.());
    else child.material?.dispose?.();
  });
}

export function getRenderedPipeDiameter(realDiameterM) {
  if (!Number.isFinite(realDiameterM) || realDiameterM <= 0) return 0;
  return Math.max(realDiameterM, MIN_RENDERED_DIAMETER_M);
}

export function validateConnectionModel(connection) {
  if (!connection?.id) throw new TypeError('La conexión necesita id.');
  for (const endpoint of ['source', 'target']) {
    if (!connection[endpoint]?.equipmentId || !connection[endpoint]?.portId) {
      throw new TypeError(`${connection.id}.${endpoint} necesita equipmentId y portId.`);
    }
  }
  if (!Number.isFinite(connection.nominalDiameterM) || connection.nominalDiameterM <= 0) {
    throw new RangeError(`${connection.id}.nominalDiameterM debe ser > 0.`);
  }
  if (connection.waypoints !== undefined && !Array.isArray(connection.waypoints)) {
    throw new TypeError(`${connection.id}.waypoints debe ser un arreglo.`);
  }
  return connection;
}

function removeConsecutiveDuplicates(points) {
  const result = [];
  points.forEach((point) => {
    if (!result.length || result[result.length - 1].distanceTo(point) > EPSILON) {
      result.push(point);
    }
  });
  return result;
}

export function buildOrthogonalRoute({ start, end, waypoints = [] }) {
  const startPoint = asVector3(start, 'start');
  const endPoint = asVector3(end, 'end');
  const explicit = waypoints.map((point, index) => asVector3(point, `waypoint ${index}`));

  if (explicit.length) {
    // User supplied waypoints often share an axis with an endpoint (for
    // example a vertical leg whose z already equals the target). Collapse
    // those coincident joins before validating so no zero length pipe segment
    // or floating fitting is emitted.
    return validateRoutePoints(removeConsecutiveDuplicates([startPoint, ...explicit, endPoint]));
  }

  if (startPoint.distanceTo(endPoint) <= EPSILON) {
    throw new RangeError('Una ruta no puede tener source y target coincidentes.');
  }

  const delta = endPoint.clone().sub(startPoint);
  const changedAxes = [Math.abs(delta.x), Math.abs(delta.y), Math.abs(delta.z)]
    .filter((value) => value > EPSILON).length;
  if (changedAxes <= 1) return [startPoint, endPoint];

  // Router ortogonal determinista X -> Z -> Y. Elimina tramos de longitud cero.
  const points = [
    startPoint,
    new THREE.Vector3(endPoint.x, startPoint.y, startPoint.z),
    new THREE.Vector3(endPoint.x, startPoint.y, endPoint.z),
    endPoint,
  ];
  return validateRoutePoints(removeConsecutiveDuplicates(points));
}

export function validateRoutePoints(points) {
  if (!Array.isArray(points) || points.length < 2) {
    throw new RangeError('Una ruta necesita al menos dos puntos.');
  }
  const normalized = points.map((point, index) => asVector3(point, `route[${index}]`));
  for (let index = 0; index < normalized.length - 1; index += 1) {
    const current = normalized[index];
    const next = normalized[index + 1];
    if (current.distanceTo(next) <= EPSILON) {
      throw new RangeError(`Segmento ${index} tiene longitud <= epsilon.`);
    }
  }
  return normalized;
}

export function createStraightPipeMesh(start, end, renderedDiameterM, material) {
  const startPoint = asVector3(start, 'segment.start');
  const endPoint = asVector3(end, 'segment.end');
  const direction = endPoint.clone().sub(startPoint);
  const length = direction.length();
  if (length <= EPSILON) throw new RangeError('No se puede crear un tramo de longitud cero.');

  const radius = renderedDiameterM / 2;
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, RADIAL_SEGMENTS, 1, false),
    material,
  );
  mesh.position.copy(startPoint).add(endPoint).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.start = startPoint.toArray();
  mesh.userData.end = endPoint.toArray();
  mesh.userData.lengthM = length;
  return mesh;
}

export function createElbowMesh(point, renderedDiameterM, material, previous = null, next = null) {
  const center = asVector3(point, 'elbow.point');
  let geometry;
  if (previous && next) {
    const prev = asVector3(previous, 'elbow.previous');
    const nextPoint = asVector3(next, 'elbow.next');
    const incoming = center.clone().sub(prev);
    const outgoing = nextPoint.clone().sub(center);
    const incomingLength = incoming.length();
    const outgoingLength = outgoing.length();
    if (incomingLength > EPSILON && outgoingLength > EPSILON) {
      incoming.normalize();
      outgoing.normalize();
      const bendRadius = Math.max(
        renderedDiameterM * 0.85,
        Math.min(renderedDiameterM * 1.55, incomingLength * 0.32, outgoingLength * 0.32),
      );
      const start = center.clone().addScaledVector(incoming, -bendRadius);
      const end = center.clone().addScaledVector(outgoing, bendRadius);
      const curve = new THREE.QuadraticBezierCurve3(start, center.clone(), end);
      geometry = new THREE.TubeGeometry(curve, 12, renderedDiameterM / 2, 18, false);
    }
  }
  geometry ||= new THREE.SphereGeometry(renderedDiameterM / 2, 18, 12);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.joint = center.toArray();
  mesh.userData.fittingType = 'elbow';
  return mesh;
}

function createFlangeMesh(point, tangent, renderedDiameterM, material) {
  const outerRadius = Math.max(renderedDiameterM * 0.78, 0.065);
  const thickness = Math.max(renderedDiameterM * 0.34, 0.045);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(outerRadius, outerRadius, thickness, 20),
    material,
  );
  mesh.position.copy(point);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent.clone().normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.fittingType = 'flange';
  return mesh;
}

function createValveAssembly(point, renderedDiameterM) {
  const group = new THREE.Group();
  group.name = 'inline-isolation-valve';
  const bodyMaterial = createIndustrialMaterial('darkSteel');
  const handleMaterial = createIndustrialMaterial('safetyYellow');
  const bodyRadius = Math.max(renderedDiameterM * 0.85, 0.075);
  const body = new THREE.Mesh(new THREE.SphereGeometry(bodyRadius, 16, 10), bodyMaterial);
  body.name = 'valve-body';
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const stem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.025, Math.max(0.22, renderedDiameterM * 1.5), 10),
    bodyMaterial,
  );
  stem.name = 'valve-stem';
  stem.position.y = bodyRadius + 0.08;
  group.add(stem);
  const wheel = new THREE.Mesh(
    new THREE.TorusGeometry(Math.max(0.12, renderedDiameterM * 1.45), 0.022, 6, 20),
    handleMaterial,
  );
  wheel.name = 'valve-handwheel';
  wheel.rotation.x = Math.PI / 2;
  wheel.position.y = bodyRadius + Math.max(0.2, renderedDiameterM * 1.5);
  group.add(wheel);
  group.position.copy(point);
  group.userData.fittingType = 'isolation-valve';
  return group;
}

export function createReducerMesh(start, end, startDiameterM, endDiameterM, material) {
  if (![startDiameterM, endDiameterM].every((value) => Number.isFinite(value) && value > 0)) {
    throw new RangeError('Reducer necesita diámetros positivos.');
  }
  const startPoint = asVector3(start, 'reducer.start');
  const endPoint = asVector3(end, 'reducer.end');
  const direction = endPoint.clone().sub(startPoint);
  const length = direction.length();
  if (length <= EPSILON) throw new RangeError('Reducer necesita longitud > epsilon.');
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(
      getRenderedPipeDiameter(endDiameterM) / 2,
      getRenderedPipeDiameter(startDiameterM) / 2,
      length,
      RADIAL_SEGMENTS,
      1,
      false,
    ),
    material,
  );
  mesh.position.copy(startPoint).add(endPoint).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.userData = {
    fittingType: 'reducer',
    start: startPoint.toArray(),
    end: endPoint.toArray(),
    startDiameterM,
    endDiameterM,
  };
  return mesh;
}

export function createPipingEngine({ equipmentSystem }) {
  if (!equipmentSystem) throw new TypeError('PipingEngine requiere equipmentSystem.');
  const root = new THREE.Group();
  root.name = 'piping-engine';
  const renderedConnections = new Map();

  function clearConnection(id) {
    const group = renderedConnections.get(id);
    if (!group) return;
    root.remove(group);
    disposeObject(group);
    renderedConnections.delete(id);
  }

  function renderConnection(connection, options = {}) {
    validateConnectionModel(connection);
    clearConnection(connection.id);

    const start = equipmentSystem.getPortWorldPosition(
      connection.source.equipmentId,
      connection.source.portId,
    );
    const end = equipmentSystem.getPortWorldPosition(
      connection.target.equipmentId,
      connection.target.portId,
    );
    const points = buildOrthogonalRoute({ start, end, waypoints: connection.waypoints ?? [] });
    const renderedDiameterM = getRenderedPipeDiameter(connection.nominalDiameterM);
    const material = options.material ?? createMaterial(options.materialName);

    const group = new THREE.Group();
    group.name = connection.id;
    group.userData = {
      connectionId: connection.id,
      source: { ...connection.source },
      target: { ...connection.target },
      nominalDiameterM: connection.nominalDiameterM,
      physicalDiameterM: connection.nominalDiameterM,
      renderedDiameterM,
      visualDiameterM: renderedDiameterM,
      routePoints: points.map((point) => point.toArray()),
      inspectableEquipment: true,
      inspectionKind: 'pipe',
      flowDirection: 'source-to-target',
    };

    const slurryFlowMaterial = createSlurryFlowMaterial();
    points.slice(0, -1).forEach((point, index) => {
      const segment = createStraightPipeMesh(point, points[index + 1], renderedDiameterM, material);
      segment.name = `${connection.id}-segment-${index + 1}`;
      segment.userData.inspectionShell = true;
      group.add(segment);

      const fluid = createInternalFluidMesh(point, points[index + 1], renderedDiameterM, slurryFlowMaterial);
      fluid.name = `${connection.id}-slurry-stream-${index + 1}`;
      group.add(fluid);
    });
    points.slice(1, -1).forEach((point, index) => {
      const elbow = createElbowMesh(point, renderedDiameterM, material, points[index], points[index + 2]);
      elbow.name = `${connection.id}-elbow-${index + 1}`;
      elbow.userData.inspectionShell = true;
      group.add(elbow);

      const fluidJoint = new THREE.Mesh(
        new THREE.SphereGeometry(renderedDiameterM * 0.31, 14, 10),
        slurryFlowMaterial,
      );
      fluidJoint.name = `${connection.id}-slurry-joint-${index + 1}`;
      fluidJoint.position.copy(point);
      fluidJoint.userData.inspectionInterior = true;
      fluidJoint.userData.pipeFluid = true;
      fluidJoint.visible = false;
      group.add(fluidJoint);
    });

    const suspendedSolids = createFlowParticles(points, renderedDiameterM, connection.id);
    group.add(suspendedSolids);

    // Simple engineered shoes/posts on long near-horizontal runs. They are built
    // once with the connection, never per frame, and keep long routes from reading
    // as unsupported floating lines.
    let supportIndex = 0;
    if (options.supports !== false) {
      points.slice(0, -1).forEach((point, index) => {
        const next = points[index + 1];
        const deltaY = Math.abs(next.y - point.y);
        const length = point.distanceTo(next);
        if (deltaY > 0.15 || length < 8) return;
        const supportCount = Math.min(5, Math.floor(length / 9));
        for (let i = 1; i <= supportCount; i += 1) {
          const supportPoint = point.clone().lerp(next, i / (supportCount + 1));
          const support = createPipeSupport(
            supportPoint,
            supportPoint.y,
            renderedDiameterM,
            `${connection.id}-support-${++supportIndex}`,
            next.clone().sub(point),
          );
          group.add(support);
        }
      });
    }

    // Bridas en los extremos para que la unión puerto-tubería sea explícita.
    const flangeMaterial = createIndustrialMaterial('darkSteel', { color: 0x53656b, metalness: 0.7 });
    const startTangent = points[1].clone().sub(points[0]).normalize();
    const endTangent = points.at(-1).clone().sub(points.at(-2)).normalize();
    const startFlange = createFlangeMesh(points[0], startTangent, renderedDiameterM, flangeMaterial);
    startFlange.name = `${connection.id}-source-flange`;
    group.add(startFlange);
    const endFlange = createFlangeMesh(points.at(-1), endTangent, renderedDiameterM, flangeMaterial);
    endFlange.name = `${connection.id}-target-flange`;
    group.add(endFlange);
    const fittingScale = THREE.MathUtils.clamp(renderedDiameterM / 0.40, 0.82, 1.85);
    attachBlenderModule({
      parent: group,
      url: BLENDER_MODULE_URLS.pipeFlange,
      name: `${connection.id}-source-flange-blender`,
      position: points[0],
      scale: [fittingScale, fittingScale, fittingScale],
      quaternion: quaternionFromLocalX(startTangent),
      userData: { pipingHybridRole: 'source-flange', connectionId: connection.id, renderedDiameterM },
      onReady: () => { startFlange.visible = false; },
    });
    attachBlenderModule({
      parent: group,
      url: BLENDER_MODULE_URLS.pipeFlange,
      name: `${connection.id}-target-flange-blender`,
      position: points.at(-1),
      scale: [fittingScale, fittingScale, fittingScale],
      quaternion: quaternionFromLocalX(endTangent),
      userData: { pipingHybridRole: 'target-flange', connectionId: connection.id, renderedDiameterM },
      onReady: () => { endFlange.visible = false; },
    });

    // Una válvula visual en el tramo más largo cuando hay espacio suficiente.
    let longest = null;
    points.slice(0, -1).forEach((point, index) => {
      const next = points[index + 1];
      const length = point.distanceTo(next);
      if (!longest || length > longest.length) longest = { start: point, end: next, length };
    });
    if (longest?.length > 6) {
      const valvePoint = longest.start.clone().lerp(longest.end, 0.5);
      const valveTangent = longest.end.clone().sub(longest.start).normalize();
      const valve = createValveAssembly(valvePoint, renderedDiameterM);
      valve.name = `${connection.id}-isolation-valve`;
      group.add(valve);
      attachBlenderModule({
        parent: group,
        url: BLENDER_MODULE_URLS.pipeValve,
        name: `${connection.id}-isolation-valve-blender`,
        position: valvePoint,
        scale: [fittingScale, fittingScale, fittingScale],
        quaternion: quaternionFromLocalX(valveTangent),
        userData: { pipingHybridRole: 'isolation-valve', connectionId: connection.id, renderedDiameterM },
        onReady: () => { valve.visible = false; },
      });
    }
    group.userData.blenderHybridPiping = true;

    renderedConnections.set(connection.id, group);
    root.add(group);
    root.updateMatrixWorld(true);
    return group;
  }

  function getConnectionGroup(id) {
    return renderedConnections.get(id) ?? null;
  }

  function dispose() {
    [...renderedConnections.keys()].forEach(clearConnection);
  }

  return { root, renderConnection, clearConnection, getConnectionGroup, dispose };
}
