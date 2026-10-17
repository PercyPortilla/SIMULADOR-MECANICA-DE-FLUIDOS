import * as THREE from 'three';

const DEFAULT_SPEEDS = Object.freeze({
  millRadPerSec: 0.28,
  agitatorRadPerSec: 1.1,
  conveyorMps: 1.8,
  pipeMps: 1.2,
  pumpRadPerSec: 4.8,
  feederHz: 7.5,
});

function routeLength(points) {
  return points.slice(0, -1).reduce((sum, point, index) => sum + point.distanceTo(points[index + 1]), 0);
}

function pointAlongRoute(points, distance, total = routeLength(points)) {
  if (total <= 0) return points[0]?.clone() ?? new THREE.Vector3();
  let remaining = ((distance % total) + total) % total;
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const length = start.distanceTo(end);
    if (remaining <= length) return start.clone().lerp(end, length ? remaining / length : 0);
    remaining -= length;
  }
  return points.at(-1).clone();
}

function normalizedRoute(raw) {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const points = raw.map((point) => new THREE.Vector3(...point));
  return points.every((point) => [point.x, point.y, point.z].every(Number.isFinite)) ? points : null;
}

function addRouteMarker(root, route, name, material, radius = 0.12) {
  const marker = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 8), material);
  marker.name = name;
  marker.userData.route = route;
  marker.userData.distance = 0;
  marker.userData.routeLength = routeLength(route);
  root.add(marker);
  return marker;
}

function updateMineralInstances(system, deltaMeters) {
  const route = system.userData.route;
  const totalLength = system.userData.totalLength;
  const distances = system.userData.distances;
  if (!route || !Number.isFinite(totalLength) || totalLength <= 0 || !Array.isArray(distances)) return;
  const matrix = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);
  const yOffset = system.userData.beltYOffset ?? 0.34;

  distances.forEach((distance, index) => {
    const nextDistance = (distance + deltaMeters) % totalLength;
    distances[index] = nextDistance;
    const position = pointAlongRoute(route, nextDistance, totalLength);
    position.y += yOffset;
    quaternion.setFromEuler(new THREE.Euler(0.18 * (index % 3), 0.43 * index, 0.11 * (index % 5)));
    const size = 0.82 + (index % 4) * 0.08;
    scale.set(size, size * 0.8, size);
    matrix.compose(position, quaternion, scale);
    system.setMatrixAt(index, matrix);
  });
  system.instanceMatrix.needsUpdate = true;
}

function moveLoopingOre(mesh, elapsed, speed = 0.9) {
  const start = mesh.userData.travelStartX;
  const end = mesh.userData.travelEndX;
  if (![start, end].every(Number.isFinite) || end <= start) return;
  const offset = mesh.userData.travelOffset || 0;
  const span = end - start;
  mesh.position.x = start + ((elapsed * speed + offset) % span);
  mesh.rotation.y += 0.012;
}

export function createIndustrialAnimations({ environmentRoot, equipmentSystem, mobileEquipment } = {}) {
  if (!environmentRoot || !equipmentSystem) throw new TypeError('Animations requiere environmentRoot y equipmentSystem.');

  const root = new THREE.Group();
  root.name = 'industrial-animation-markers';
  environmentRoot.add(root);

  const conveyorMaterial = new THREE.MeshBasicMaterial({ color: 0xd8a65f });
  const pipeMaterial = new THREE.MeshBasicMaterial({ color: 0x7ed0da });
  const conveyorMarkers = [];
  const pipeMarkers = [];
  const beltFlowMeshes = [];
  const mineralSystems = [];
  const feeders = [];
  const feederExciters = [];
  const feederOre = [];
  const crusherMantles = [];
  const crusherOre = [];
  const pumpImpellers = [];
  const cycloneVortices = [];
  const slurrySurfaces = [];
  const cipAgitators = [];
  const moltenPools = [];
  const pipeFluidMaterials = new Set();

  function clearRouteMarkers() {
    while (root.children.length) {
      const child = root.children[root.children.length - 1];
      root.remove(child);
      child.geometry?.dispose?.();
    }
    conveyorMarkers.splice(0, conveyorMarkers.length);
    pipeMarkers.splice(0, pipeMarkers.length);
    beltFlowMeshes.splice(0, beltFlowMeshes.length);
    mineralSystems.splice(0, mineralSystems.length);
    feeders.splice(0, feeders.length);
    feederExciters.splice(0, feederExciters.length);
    feederOre.splice(0, feederOre.length);
    crusherMantles.splice(0, crusherMantles.length);
    crusherOre.splice(0, crusherOre.length);
    pumpImpellers.splice(0, pumpImpellers.length);
    cycloneVortices.splice(0, cycloneVortices.length);
    slurrySurfaces.splice(0, slurrySurfaces.length);
    cipAgitators.splice(0, cipAgitators.length);
    moltenPools.splice(0, moltenPools.length);
    pipeFluidMaterials.clear();
  }

  function refreshRoutes() {
    clearRouteMarkers();
    environmentRoot.traverse((object) => {
      if (object === root || object.parent === root) return;
      if (object.userData?.beltFlow) beltFlowMeshes.push(object);
      if (object.userData?.vibratoryFeeder || object.userData?.reclaimFeeder) feeders.push(object);
      if (object.userData?.feederExciter) feederExciters.push(object);
      if (object.userData?.feederOre || object.userData?.reclaimOre) feederOre.push(object);
      if (object.userData?.crusherMantle) crusherMantles.push(object);
      if (object.userData?.crusherOre) crusherOre.push(object);
      if (object.userData?.pumpImpeller) pumpImpellers.push(object);
      if (object.userData?.cycloneVortex) cycloneVortices.push(object);
      if (object.userData?.slurrySurface) {
        object.userData.slurryBaseY ??= object.position.y;
        slurrySurfaces.push(object);
      }
      if (object.userData?.cipAgitator) cipAgitators.push(object);
      if (object.userData?.moltenProcess) moltenPools.push(object);
      if (object.userData?.pipeFluid && object.material?.userData?.pipeFluidMaterial) {
        pipeFluidMaterials.add(object.material);
      }

      if (object.userData?.conveyorMineral) {
        const mineralRoute = normalizedRoute(object.userData.routePoints);
        if (mineralRoute) {
          object.userData.route = mineralRoute;
          mineralSystems.push(object);
          updateMineralInstances(object, 0);
        }
      }
      const route = normalizedRoute(object.userData?.routePoints);
      if (!route || object.userData?.conveyorMineral) return;
      if (object.userData?.conveyorId) {
        conveyorMarkers.push(addRouteMarker(root, route, `${object.userData.conveyorId}-flow-marker`, conveyorMaterial, 0.14));
      } else if (object.userData?.connectionId) {
        pipeMarkers.push(addRouteMarker(root, route, `${object.userData.connectionId}-flow-marker`, pipeMaterial, 0.12));
      }
    });
  }

  refreshRoutes();

  const mill = equipmentSystem.getEquipment('MILL-01')?.group3D;
  const millRotatingAssembly = mill?.getObjectByName('MILL-01-rotating-assembly') ?? null;
  const millInternal = mill?.getObjectByName('MILL-01-internal-charge') ?? null;
  const agitatorAssemblies = ['R-01', 'R-02', 'R-03', 'R-04']
    .map((id) => equipmentSystem.getEquipment(id)?.group3D?.getObjectByName(`${id}-agitator-assembly`))
    .filter(Boolean);

  let enabled = true;
  let elapsed = 0;

  function update(deltaSeconds) {
    if (!enabled || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
    const dt = Math.min(deltaSeconds, 0.1);
    elapsed += dt;

    if (millRotatingAssembly) millRotatingAssembly.rotation.x += DEFAULT_SPEEDS.millRadPerSec * dt;
    if (millInternal) millInternal.rotation.x += DEFAULT_SPEEDS.millRadPerSec * 0.62 * dt;
    agitatorAssemblies.forEach((assembly) => { assembly.rotation.y += DEFAULT_SPEEDS.agitatorRadPerSec * dt; });
    cipAgitators.forEach((shaft) => { shaft.rotation.y += DEFAULT_SPEEDS.agitatorRadPerSec * 0.9 * dt; });
    pumpImpellers.forEach((impeller) => { impeller.rotation.x += DEFAULT_SPEEDS.pumpRadPerSec * dt; });
    cycloneVortices.forEach((vortex) => { vortex.rotation.y += 2.4 * dt; });
    mobileEquipment?.update?.(dt);

    feeders.forEach((feeder, index) => {
      const base = feeder.userData.basePosition;
      if (!Array.isArray(base)) return;
      const vibration = Math.sin(elapsed * Math.PI * 2 * DEFAULT_SPEEDS.feederHz + index) * 0.055;
      feeder.position.set(base[0], base[1] + vibration, base[2]);
    });
    feederExciters.forEach((exciter) => { exciter.rotation.z += 9.0 * dt; });
    feederOre.forEach((ore) => moveLoopingOre(ore, elapsed, ore.userData.reclaimOre ? 0.72 : 0.95));

    crusherMantles.forEach((pivot, index) => {
      const phase = elapsed * 2.4 + index;
      pivot.position.x = Math.cos(phase) * 0.11;
      pivot.position.z = Math.sin(phase) * 0.11;
      pivot.rotation.y += 0.45 * dt;
    });
    crusherOre.forEach((rock) => {
      const phase = (elapsed * 0.20 + rock.userData.phase) % 1;
      rock.position.y = 6.4 - phase * 4.8;
      rock.rotation.x += 0.7 * dt;
      rock.rotation.z += 0.5 * dt;
    });

    beltFlowMeshes.forEach((belt) => {
      const texture = belt.material?.map;
      if (!texture) return;
      const metersPerRepeat = belt.userData.metersPerTextureRepeat || 1.4;
      texture.offset.x = (texture.offset.x - (DEFAULT_SPEEDS.conveyorMps / metersPerRepeat) * dt) % 1;
    });
    mineralSystems.forEach((system) => updateMineralInstances(system, DEFAULT_SPEEDS.conveyorMps * dt));

    pipeFluidMaterials.forEach((material) => {
      if (material.map) material.map.offset.y = (material.map.offset.y - DEFAULT_SPEEDS.pipeMps * dt * 0.55) % 1;
    });

    slurrySurfaces.forEach((surface, index) => {
      surface.rotation.y += (0.22 + index * 0.015) * dt;
      surface.position.y = (surface.userData.slurryBaseY ?? surface.position.y) + Math.sin(elapsed * 1.8 + index) * 0.035;
    });
    moltenPools.forEach((pool, index) => {
      if (pool.material && 'emissiveIntensity' in pool.material) {
        pool.material.emissiveIntensity = 1.55 + Math.sin(elapsed * 3.1 + index) * 0.25;
      }
    });

    conveyorMarkers.forEach((marker, index) => {
      marker.userData.distance += DEFAULT_SPEEDS.conveyorMps * dt;
      marker.position.copy(pointAlongRoute(marker.userData.route, marker.userData.distance + index * 1.7, marker.userData.routeLength));
    });
    pipeMarkers.forEach((marker, index) => {
      marker.userData.distance += DEFAULT_SPEEDS.pipeMps * dt;
      marker.position.copy(pointAlongRoute(marker.userData.route, marker.userData.distance + index * 0.75, marker.userData.routeLength));
    });
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    root.visible = true;
  }

  function dispose() {
    environmentRoot.remove(root);
    root.traverse((object) => object.geometry?.dispose?.());
    conveyorMaterial.dispose();
    pipeMaterial.dispose();
  }

  return {
    root,
    update,
    setEnabled,
    get enabled() { return enabled; },
    get elapsedSeconds() { return elapsed; },
    refreshRoutes,
    get conveyorMarkerCount() { return conveyorMarkers.length; },
    get pipeMarkerCount() { return pipeMarkers.length; },
    get beltFlowCount() { return beltFlowMeshes.length; },
    get mineralSystemCount() { return mineralSystems.length; },
    get feederCount() { return feeders.length; },
    get pumpImpellerCount() { return pumpImpellers.length; },
    get pipeFluidMaterialCount() { return pipeFluidMaterials.size; },
    dispose,
  };
}
