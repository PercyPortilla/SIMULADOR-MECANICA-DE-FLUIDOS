import * as THREE from 'three';
import { getTerrainHeight } from '../environment/terrainHeight.js';
import { createIndustrialMaterial } from '../materials/industrialMaterials.js';

const EPSILON = 1e-6;
export const DEFAULT_CONVEYOR_WIDTH = 1.35;
export const DEFAULT_SUPPORT_SPACING_M = 6;

function asVector3(value, label) {
  if (value instanceof THREE.Vector3) return value.clone();
  if (Array.isArray(value) && value.length >= 3 && value.slice(0, 3).every(Number.isFinite)) {
    return new THREE.Vector3(value[0], value[1], value[2]);
  }
  throw new TypeError(`${label} debe ser Vector3 o [x,y,z] finito.`);
}

function createSegmentBox(start, end, width, height, material) {
  const direction = end.clone().sub(start);
  const length = direction.length();
  if (length <= EPSILON) throw new RangeError('Un tramo de conveyor no puede tener longitud cero.');
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(length, height, width), material);
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.start = start.toArray();
  mesh.userData.end = end.toArray();
  mesh.userData.lengthM = length;
  return mesh;
}

function sideVectorForSegment(start, end) {
  const direction = end.clone().sub(start).normalize();
  const side = new THREE.Vector3(-direction.z, 0, direction.x);
  if (side.lengthSq() <= EPSILON) side.set(0, 0, 1);
  return side.normalize();
}

function createRoller(point, side, width, material) {
  const roller = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, width * 0.96, 12),
    material,
  );
  roller.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), side);
  roller.position.copy(point);
  roller.castShadow = true;
  return roller;
}


function createBeltFlowTexture(lengthM) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 32;
  const context = canvas.getContext('2d');
  if (!context) return null;
  context.fillStyle = '#d2d2d2';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#9b9b9b';
  for (let x = 0; x < canvas.width; x += 24) context.fillRect(x, 0, 5, canvas.height);
  context.fillStyle = '#ececec';
  for (let x = 12; x < canvas.width; x += 24) context.fillRect(x, 0, 2, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = 'conveyor-belt-flow-texture';
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(Math.max(1, lengthM / 1.4), 1);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function createMineralLoad(id, route, width, totalLength) {
  const count = Math.max(16, Math.min(72, Math.round(totalLength / 1.15)));
  const geometry = new THREE.DodecahedronGeometry(Math.max(0.16, Math.min(0.28, width * 0.17)), 0);
  const material = createIndustrialMaterial('mineral');
  const mineral = new THREE.InstancedMesh(geometry, material, count);
  mineral.name = `${id}-moving-mineral`;
  mineral.castShadow = true;
  mineral.receiveShadow = false;
  mineral.frustumCulled = false;
  mineral.userData = {
    conveyorMineral: true,
    conveyorId: id,
    routePoints: route.map((point) => point.toArray()),
    totalLength,
    distances: Array.from({ length: count }, (_, index) => (index / count) * totalLength),
    beltYOffset: 0.34,
  };
  return mineral;
}

function createSupportTower({ id, beltPoint, terrainY, width, rotationY = 0, material, safetyMaterial }) {
  const supportHeight = beltPoint.y - terrainY - 0.08;
  if (supportHeight <= 0.3) return null;

  const tower = new THREE.Group();
  tower.name = id;
  tower.rotation.y = rotationY;
  const legOffset = Math.max(0.55, width * 0.52);
  [-1, 1].forEach((sign) => {
    // Sample terrain at the actual WORLD footprint after the tower's Y rotation.
    // Using only beltPoint.z +/- legOffset is wrong for non-axis-aligned conveyors.
    const worldOffset = new THREE.Vector3(0, 0, sign * legOffset)
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
    const legTerrainY = getTerrainHeight(
      beltPoint.x + worldOffset.x,
      beltPoint.z + worldOffset.z,
    );
    const legHeight = beltPoint.y - legTerrainY - 0.08;
    if (legHeight <= 0.3) return;
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, legHeight, 0.16),
      material,
    );
    leg.name = `${id}-leg`;
    leg.position.set(0, legTerrainY + legHeight / 2, sign * legOffset);
    leg.castShadow = true;
    leg.receiveShadow = true;
    tower.add(leg);
  });
  const crossbeam = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.18, width + 0.9),
    material,
  );
  crossbeam.name = `${id}-crossbeam`;
  crossbeam.position.set(0, beltPoint.y - 0.22, 0);
  crossbeam.castShadow = true;
  tower.add(crossbeam);

  const braceA = new THREE.Mesh(new THREE.BoxGeometry(0.10, supportHeight * 0.86, 0.10), material);
  braceA.name = `${id}-brace-a`;
  braceA.position.set(0, terrainY + supportHeight * 0.5, 0);
  braceA.rotation.x = 0.52;
  braceA.castShadow = true;
  tower.add(braceA);
  const braceB = braceA.clone();
  braceB.name = `${id}-brace-b`;
  braceB.rotation.x = -0.52;
  tower.add(braceB);

  const guard = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.11, width + 1.0),
    safetyMaterial,
  );
  guard.name = `${id}-safety-crossbar`;
  guard.position.set(0, beltPoint.y + 0.08, 0);
  tower.add(guard);
  tower.position.set(beltPoint.x, 0, beltPoint.z);
  return tower;
}

function interpolatePolyline(points, distanceFromStart) {
  let remaining = distanceFromStart;
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const segmentLength = start.distanceTo(end);
    if (remaining <= segmentLength) {
      return start.clone().lerp(end, segmentLength <= EPSILON ? 0 : remaining / segmentLength);
    }
    remaining -= segmentLength;
  }
  return points.at(-1).clone();
}

export function createConveyor({
  id,
  points,
  width = DEFAULT_CONVEYOR_WIDTH,
  supportSpacingM = DEFAULT_SUPPORT_SPACING_M,
}) {
  if (!id) throw new TypeError('Conveyor necesita id.');
  if (!Array.isArray(points) || points.length < 2) throw new RangeError(`${id} necesita al menos dos puntos.`);
  if (!Number.isFinite(width) || width <= 0) throw new RangeError(`${id}.width debe ser > 0.`);

  const route = points.map((point, index) => asVector3(point, `${id}.points[${index}]`));
  const group = new THREE.Group();
  group.name = id;
  group.userData = { conveyorId: id, width, routePoints: route.map((point) => point.toArray()) };

  const frameMaterial = createIndustrialMaterial('structuralSteel');
  const transferMaterial = createIndustrialMaterial('darkSteel');
  const rollerMaterial = createIndustrialMaterial('darkSteel', { color: 0x394347, metalness: 0.66 });
  const safetyMaterial = createIndustrialMaterial('safetyYellow');
  const idlerGeometry = new THREE.CylinderGeometry(0.075, 0.075, width * 0.96, 12);

  route.slice(0, -1).forEach((start, index) => {
    const end = route[index + 1];
    const side = sideVectorForSegment(start, end);
    const direction = end.clone().sub(start);
    const length = direction.length();
    const frame = createSegmentBox(start, end, width + 0.28, 0.22, frameMaterial);
    frame.name = `${id}-frame-${index + 1}`;
    group.add(frame);

    const beltOffset = new THREE.Vector3(0, 0.16, 0);
    const beltFlowTexture = createBeltFlowTexture(length);
    const beltMaterial = createIndustrialMaterial('conveyorBelt', beltFlowTexture ? { map: beltFlowTexture } : {});
    const belt = createSegmentBox(start.clone().add(beltOffset), end.clone().add(beltOffset), width, 0.10, beltMaterial);
    belt.name = `${id}-belt-${index + 1}`;
    belt.userData.belt = true;
    belt.userData.beltFlow = true;
    belt.userData.metersPerTextureRepeat = 1.4;
    group.add(belt);

    // Truss lateral: cordones superiores/inferiores y diagonales repetidas.
    [-1, 1].forEach((sign) => {
      const sideOffset = side.clone().multiplyScalar(sign * (width / 2 + 0.22));
      const upperStart = start.clone().add(sideOffset).add(new THREE.Vector3(0, -0.02, 0));
      const upperEnd = end.clone().add(sideOffset).add(new THREE.Vector3(0, -0.02, 0));
      const lowerStart = start.clone().add(sideOffset).add(new THREE.Vector3(0, -0.72, 0));
      const lowerEnd = end.clone().add(sideOffset).add(new THREE.Vector3(0, -0.72, 0));
      const upper = createSegmentBox(upperStart, upperEnd, 0.11, 0.11, frameMaterial);
      upper.name = `${id}-upper-stringer-${index + 1}-${sign > 0 ? 'r' : 'l'}`;
      group.add(upper);
      const lower = createSegmentBox(lowerStart, lowerEnd, 0.11, 0.11, frameMaterial);
      lower.name = `${id}-lower-stringer-${index + 1}-${sign > 0 ? 'r' : 'l'}`;
      group.add(lower);

      const panels = Math.max(2, Math.ceil(length / 4.2));
      for (let panel = 0; panel < panels; panel += 1) {
        const t0 = panel / panels;
        const t1 = (panel + 1) / panels;
        const a = start.clone().lerp(end, t0).add(sideOffset);
        const b = start.clone().lerp(end, t1).add(sideOffset);
        if (panel % 2 === 0) {
          a.y -= 0.68;
        } else {
          b.y -= 0.68;
        }
        const brace = createSegmentBox(a, b, 0.075, 0.075, frameMaterial);
        brace.name = `${id}-truss-brace-${index + 1}-${sign > 0 ? 'r' : 'l'}-${panel + 1}`;
        group.add(brace);
      }
    });

    // Pasarela lateral continua y baranda exterior.
    const walkwayOffset = side.clone().multiplyScalar(width / 2 + 0.68);
    const walkwayStart = start.clone().add(walkwayOffset).add(new THREE.Vector3(0, -0.05, 0));
    const walkwayEnd = end.clone().add(walkwayOffset).add(new THREE.Vector3(0, -0.05, 0));
    const walkway = createSegmentBox(walkwayStart, walkwayEnd, 0.58, 0.10, frameMaterial);
    walkway.name = `${id}-walkway-${index + 1}`;
    group.add(walkway);
    const railOffset = side.clone().multiplyScalar(width / 2 + 0.98);
    const railStart = start.clone().add(railOffset).add(new THREE.Vector3(0, 0.72, 0));
    const railEnd = end.clone().add(railOffset).add(new THREE.Vector3(0, 0.72, 0));
    const rail = createSegmentBox(railStart, railEnd, 0.07, 0.07, safetyMaterial);
    rail.name = `${id}-walkway-rail-${index + 1}`;
    group.add(rail);

    // Rodillos simplificados espaciados para conservar rendimiento.
    const rollerCount = Math.max(2, Math.floor(length / 2.6));
    if (rollerCount > 1) {
      const idlers = new THREE.InstancedMesh(idlerGeometry, rollerMaterial, rollerCount - 1);
      idlers.name = `${id}-idlers-${index + 1}`;
      idlers.castShadow = false;
      idlers.receiveShadow = true;
      const matrix = new THREE.Matrix4();
      const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), side);
      const scale = new THREE.Vector3(1, 1, 1);
      for (let rollerIndex = 1; rollerIndex < rollerCount; rollerIndex += 1) {
        const point = start.clone().lerp(end, rollerIndex / rollerCount);
        point.y += 0.25;
        matrix.compose(point, quaternion, scale);
        idlers.setMatrixAt(rollerIndex - 1, matrix);
      }
      idlers.instanceMatrix.needsUpdate = true;
      group.add(idlers);
    }
  });

  const totalLength = route.slice(0, -1).reduce((sum, point, index) => sum + point.distanceTo(route[index + 1]), 0);
  const movingMineral = createMineralLoad(id, route, width, totalLength);
  group.add(movingMineral);
  for (let distance = supportSpacingM; distance < totalLength - 0.5; distance += supportSpacingM) {
    const beltPoint = interpolatePolyline(route, distance);
    const terrainY = getTerrainHeight(beltPoint.x, beltPoint.z);
    const tangentPoint = interpolatePolyline(route, Math.min(totalLength, distance + 0.25));
    const side = sideVectorForSegment(beltPoint, tangentPoint);
    const tangent = tangentPoint.clone().sub(beltPoint).normalize();
    const rotationY = Math.atan2(tangent.z, tangent.x);
    const tower = createSupportTower({
      id: `${id}-support-${Math.round(distance * 10)}`,
      beltPoint,
      terrainY,
      width,
      rotationY,
      material: frameMaterial,
      safetyMaterial,
    });
    if (!tower) continue;
    tower.userData.terrainY = terrainY;
    tower.userData.topY = beltPoint.y;
    tower.userData.side = side.toArray();
    group.add(tower);
  }

  [route[0], route.at(-1)].forEach((point, index) => {
    const transfer = new THREE.Mesh(new THREE.BoxGeometry(width + 0.75, 0.85, width + 0.75), transferMaterial);
    transfer.name = `${id}-transfer-${index === 0 ? 'in' : 'out'}`;
    transfer.position.copy(point);
    transfer.position.y -= 0.18;
    transfer.castShadow = true;
    transfer.receiveShadow = true;
    group.add(transfer);

    const hood = new THREE.Mesh(
      new THREE.ConeGeometry((width + 0.5) * 0.72, 1.05, 4, 1, false),
      transferMaterial,
    );
    hood.name = `${id}-transfer-hood-${index === 0 ? 'in' : 'out'}`;
    hood.position.copy(point);
    hood.position.y += 0.55;
    hood.rotation.y = Math.PI / 4;
    hood.castShadow = true;
    group.add(hood);
  });

  // Poleas de cabeza y cola visibles.
  [route[0], route.at(-1)].forEach((point, index) => {
    const next = index === 0 ? route[1] : route.at(-2);
    const side = sideVectorForSegment(point, next);
    const pulley = createRoller(point.clone().add(new THREE.Vector3(0, 0.25, 0)), side, width + 0.15, rollerMaterial);
    pulley.name = `${id}-${index === 0 ? 'tail' : 'head'}-pulley`;
    group.add(pulley);
  });

  return group;
}
