import * as THREE from 'three';
import { getRoadPath } from '../environment/haulRoads.js';
import { getTerrainHeight } from '../environment/terrainHeight.js';
import { getZoneTransform } from '../layout/plantLayout.js';
import { PIT_DESIGN, REFERENCE_EQUIPMENT_DIMENSIONS } from '../config/siteDesign.js';
import { createIndustrialMaterial } from '../materials/industrialMaterials.js';

function material(color, { metalness = 0.2, roughness = 0.62 } = {}) {
  return createIndustrialMaterial('vehicleYellow', { color, metalness, roughness });
}
function addBox(group, name, size, position, mat, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}
function addCylinder(group, name, radius, width, position, mat, radialSegments = 24, rotation = [0, 0, Math.PI / 2]) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, radialSegments), mat);
  mesh.name = name;
  mesh.rotation.set(...rotation);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}
function setHeadingFromXZ(object, from, to) {
  object.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
}
function placeOnTerrain(object, x, z, headingTarget = null) {
  const y = getTerrainHeight(x, z);
  object.position.set(x, y, z);
  if (headingTarget) setHeadingFromXZ(object, { x, z }, headingTarget);
  object.userData.terrainY = y;
  return object;
}
function rotateVehicleWheels(vehicle, distanceM) {
  vehicle.traverse((object) => {
    if (!object.userData?.vehicleWheel) return;
    object.rotation.x -= distanceM / (object.userData.radiusM || 1);
  });
}

export function createHaulTruck({ id = 'TRUCK-01' } = {}) {
  const dims = REFERENCE_EQUIPMENT_DIMENSIONS.haulTruck;
  const root = new THREE.Group();
  root.name = id;
  root.userData = { type: 'haul-truck', mobileEquipment: true, targetDimensionsM: dims };

  const yellow = material(0xd49a1e, { metalness: 0.28, roughness: 0.52 });
  const dark = material(0x3d474b, { metalness: 0.48, roughness: 0.5 });
  const tire = createIndustrialMaterial('tire', { color: 0x202326 });
  const rim = material(0x717876, { metalness: 0.68, roughness: 0.36 });
  const glass = createIndustrialMaterial('glass');
  const safety = createIndustrialMaterial('safetyYellow');
  const oreMaterial = createIndustrialMaterial('mineral', { color: 0x725943 });

  addBox(root, 'truck-chassis', [4.75, 0.62, 8.9], [0, 1.55, -0.05], dark);
  addBox(root, 'truck-engine-deck', [4.35, 1.25, 2.65], [0, 2.45, 2.8], yellow);
  addBox(root, 'truck-radiator-grille', [3.55, 0.86, 0.18], [0, 2.52, 4.13], dark);
  addBox(root, 'truck-cab', [2.35, 2.35, 2.1], [-1.0, 3.65, 2.45], yellow);
  addBox(root, 'truck-windshield', [2.02, 1.14, 0.08], [-1.0, 3.88, 3.52], glass, [-0.08, 0, 0]);
  addBox(root, 'truck-side-window', [0.08, 1.1, 1.1], [-2.19, 3.88, 2.48], glass);
  addBox(root, 'truck-front-platform', [4.7, 0.12, 0.72], [0, 4.35, 3.35], dark);

  const bedPivot = new THREE.Group();
  bedPivot.name = 'truck-dump-bed-pivot';
  // Rear hinge: the dump body rotates about its real rear pivot instead of its centre.
  bedPivot.position.set(0, 3.0, -4.0);
  bedPivot.userData.dumpBedPivot = true;
  const bed = new THREE.Group();
  bed.name = 'truck-dump-bed';
  addBox(bed, 'dump-bed-floor', [5.1, 0.34, 5.95], [0, 0, 2.72], yellow);
  addBox(bed, 'dump-bed-left-wall', [0.28, 2.05, 6.05], [-2.42, 0.98, 2.72], yellow, [0, 0, -0.1]);
  addBox(bed, 'dump-bed-right-wall', [0.28, 2.05, 6.05], [2.42, 0.98, 2.72], yellow, [0, 0, 0.1]);
  addBox(bed, 'dump-bed-front-wall', [5.1, 2.1, 0.30], [0, 1.0, 5.62], yellow, [0.10, 0, 0]);
  const oreLoad = new THREE.Mesh(new THREE.BoxGeometry(4.45, 0.82, 4.7), oreMaterial);
  oreLoad.name = 'truck-ore-load';
  oreLoad.position.set(0, 0.78, 2.72);
  oreLoad.castShadow = true;
  bed.add(oreLoad);
  bedPivot.add(bed);
  root.add(bedPivot);

  // Reusable ore fragments become visible only during the actual dumping phase.
  const dumpOreGroup = new THREE.Group();
  dumpOreGroup.name = 'truck-dump-ore-stream';
  for (let index = 0; index < 12; index += 1) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16 + (index % 3) * 0.045, 0), oreMaterial);
    rock.name = `truck-dump-rock-${index + 1}`;
    rock.castShadow = true;
    rock.visible = false;
    rock.userData.dumpPhase = index / 12;
    dumpOreGroup.add(rock);
  }
  root.add(dumpOreGroup);

  const hoist = addCylinder(root, 'truck-hoist-cylinder', 0.17, 3.1, [0, 2.55, -1.2], safety, 16);
  hoist.rotation.z = Math.PI / 4;

  const wheelRadius = dims.tireRadiusM;
  const wheelX = 2.28;
  const wheelPositions = [
    [-wheelX, wheelRadius, 2.65], [wheelX, wheelRadius, 2.65],
    [-wheelX, wheelRadius, -2.1], [wheelX, wheelRadius, -2.1],
    [-wheelX, wheelRadius, -3.55], [wheelX, wheelRadius, -3.55],
  ];
  wheelPositions.forEach((position, index) => {
    const wheel = addCylinder(root, `truck-wheel-${index + 1}`, wheelRadius, 0.76, position, tire, 30);
    wheel.userData.vehicleWheel = true;
    wheel.userData.radiusM = wheelRadius;
    addCylinder(root, `truck-wheel-hub-${index + 1}`, 0.52, 0.80, position, rim, 20);
  });

  [-2.15, -1.2, -0.2, 0.8, 1.8].forEach((x, index) => {
    addBox(root, `truck-handrail-${index + 1}`, [0.06, 0.7, 0.06], [x, 4.68, 3.42], safety);
  });
  addBox(root, 'truck-handrail-top', [4.4, 0.06, 0.06], [0, 5.02, 3.42], safety);
  root.userData.joints = { bedPivot, oreLoad, dumpOreGroup };
  root.userData.groundClearanceReference = 0;
  return root;
}

export function createWheelLoader({ id = 'LOADER-01' } = {}) {
  const dims = REFERENCE_EQUIPMENT_DIMENSIONS.wheelLoader;
  const root = new THREE.Group();
  root.name = id;
  root.userData = { type: 'wheel-loader', mobileEquipment: true, targetDimensionsM: dims };
  const yellow = material(0xd7a326, { metalness: 0.24, roughness: 0.54 });
  const dark = material(0x3c4548, { metalness: 0.46, roughness: 0.52 });
  const tire = createIndustrialMaterial('tire', { color: 0x202326 });
  const rim = material(0x6f7674, { metalness: 0.62, roughness: 0.38 });
  const glass = createIndustrialMaterial('glass');
  const oreMaterial = createIndustrialMaterial('mineral', { color: 0x705640 });

  const rear = new THREE.Group();
  rear.name = 'loader-rear-frame';
  addBox(rear, 'loader-rear-body', [3.35, 1.65, 4.4], [0, 2.05, -1.9], yellow);
  addBox(rear, 'loader-engine-hood', [3.05, 1.0, 2.5], [0, 2.9, -2.45], yellow);
  addBox(rear, 'loader-cab', [2.35, 2.45, 2.2], [0, 3.45, -0.35], yellow);
  addBox(rear, 'loader-front-glass', [2.05, 1.3, 0.08], [0, 3.7, 0.78], glass);
  root.add(rear);

  const front = new THREE.Group();
  front.name = 'loader-front-frame';
  front.userData.loaderFrontFrame = true;
  addBox(front, 'loader-articulation', [2.8, 0.9, 2.3], [0, 1.75, 1.0], dark);
  const lift = new THREE.Group();
  lift.name = 'loader-lift-group';
  lift.position.set(0, 1.92, 1.45);
  lift.userData.loaderLiftGroup = true;
  [-1, 1].forEach((side) => {
    addBox(lift, `loader-lift-arm-${side > 0 ? 'right' : 'left'}`, [0.30, 0.44, 5.4], [side * 1.15, 0.48, 2.55], yellow, [-0.23, 0, 0]);
    addCylinder(lift, `loader-lift-cylinder-${side > 0 ? 'right' : 'left'}`, 0.10, 3.8, [side * 0.92, 0.15, 2.0], dark, 14, [Math.PI / 2 - 0.26, 0, 0]);
  });
  const bucketPivot = new THREE.Group();
  bucketPivot.name = 'loader-bucket-pivot';
  bucketPivot.position.set(0, -0.32, 5.25);
  bucketPivot.userData.loaderBucketPivot = true;
  const bucket = addBox(bucketPivot, 'loader-bucket', [4.1, 1.55, 2.35], [0, 0, 0.7], yellow, [-0.18, 0, 0]);
  bucket.userData.inspectionShell = true;
  addBox(bucketPivot, 'loader-bucket-cutting-edge', [4.3, 0.16, 0.34], [0, -0.66, 1.78], dark);
  const bucketOre = new THREE.Mesh(new THREE.BoxGeometry(3.55, 0.62, 1.5), oreMaterial);
  bucketOre.name = 'loader-bucket-ore';
  bucketOre.position.set(0, 0.42, 0.88);
  bucketOre.visible = false;
  bucketOre.castShadow = true;
  bucketPivot.add(bucketOre);
  lift.add(bucketPivot);
  front.add(lift);
  root.add(front);

  const r = dims.tireRadiusM;
  [[-1.5, r, 1.2], [1.5, r, 1.2], [-1.5, r, -2.35], [1.5, r, -2.35]].forEach((position, index) => {
    const wheel = addCylinder(root, `loader-wheel-${index + 1}`, r, 0.66, position, tire, 30);
    wheel.userData.vehicleWheel = true;
    wheel.userData.radiusM = r;
    addCylinder(root, `loader-wheel-hub-${index + 1}`, 0.50, 0.70, position, rim, 18);
  });
  const dumpOreGroup = new THREE.Group();
  dumpOreGroup.name = 'loader-dump-ore-stream';
  for (let index = 0; index < 9; index += 1) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.14 + (index % 3) * 0.035, 0), oreMaterial);
    rock.name = `loader-dump-rock-${index + 1}`;
    rock.visible = false;
    rock.castShadow = true;
    rock.userData.dumpPhase = index / 9;
    dumpOreGroup.add(rock);
  }
  root.add(dumpOreGroup);
  root.userData.joints = { front, lift, bucketPivot, bucketOre, dumpOreGroup };
  return root;
}

export function createExcavator({ id = 'EXCAVATOR-01' } = {}) {
  const dims = REFERENCE_EQUIPMENT_DIMENSIONS.miningShovel;
  const root = new THREE.Group();
  root.name = id;
  root.userData = { type: 'hydraulic-mining-shovel', mobileEquipment: true, targetDimensionsM: dims };
  const yellow = material(0xd2a027, { metalness: 0.25, roughness: 0.55 });
  const dark = material(0x41494c, { metalness: 0.48, roughness: 0.52 });
  const glass = createIndustrialMaterial('glass');
  const oreMaterial = createIndustrialMaterial('mineral', { color: 0x6b513b });

  const undercarriage = new THREE.Group();
  undercarriage.name = 'excavator-undercarriage';
  [-3.2, 3.2].forEach((x, index) => addBox(undercarriage, `excavator-track-${index + 1}`, [1.35, 1.35, 8.1], [x, 0.78, 0], dark));
  addBox(undercarriage, 'excavator-track-frame', [5.8, 0.62, 5.4], [0, 1.25, 0], dark);
  root.add(undercarriage);

  const house = new THREE.Group();
  house.name = 'excavator-house';
  house.position.y = 1.55;
  house.userData.excavatorHouse = true;
  addBox(house, 'excavator-counterweight', [6.1, 2.8, 4.3], [0.5, 1.75, -1.55], yellow);
  addBox(house, 'excavator-machinery-deck', [6.6, 0.38, 5.5], [0, 0.45, -0.25], dark);
  addBox(house, 'excavator-cab', [2.0, 3.0, 2.1], [-2.4, 3.35, 0.55], yellow);
  addBox(house, 'excavator-windshield', [1.65, 1.65, 0.08], [-2.4, 3.55, 1.64], glass);

  const boomPivot = new THREE.Group();
  boomPivot.name = 'excavator-boom-pivot';
  boomPivot.position.set(1.0, 2.45, 1.3);
  boomPivot.userData.excavatorBoom = true;
  addBox(boomPivot, 'excavator-boom', [0.75, 0.95, 8.7], [0, 0.85, 3.95], yellow, [-0.52, 0, 0]);
  const stickPivot = new THREE.Group();
  stickPivot.name = 'excavator-stick-pivot';
  stickPivot.position.set(0, 3.45, 7.0);
  stickPivot.userData.excavatorStick = true;
  addBox(stickPivot, 'excavator-stick', [0.65, 0.78, 6.0], [0, -0.7, 2.65], yellow, [0.48, 0, 0]);
  const bucketPivot = new THREE.Group();
  bucketPivot.name = 'excavator-bucket-pivot';
  bucketPivot.position.set(0, -2.1, 5.0);
  bucketPivot.userData.excavatorBucket = true;
  const bucket = addBox(bucketPivot, 'excavator-bucket', [dims.bucketWidthM, 2.2, 2.5], [0, -0.2, 0.72], yellow, [0.15, 0, 0]);
  bucket.userData.inspectionShell = true;
  const bucketOre = new THREE.Mesh(new THREE.BoxGeometry(3.7, 1.0, 1.6), oreMaterial);
  bucketOre.name = 'excavator-bucket-ore';
  bucketOre.position.set(0, 0.35, 0.7);
  bucketOre.visible = false;
  bucketOre.castShadow = true;
  bucketPivot.add(bucketOre);
  stickPivot.add(bucketPivot);
  boomPivot.add(stickPivot);
  house.add(boomPivot);
  root.add(house);
  const dumpOreGroup = new THREE.Group();
  dumpOreGroup.name = 'excavator-dump-ore-stream';
  for (let index = 0; index < 10; index += 1) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18 + (index % 3) * 0.04, 0), oreMaterial);
    rock.name = `excavator-dump-rock-${index + 1}`;
    rock.visible = false;
    rock.castShadow = true;
    rock.userData.dumpPhase = index / 10;
    dumpOreGroup.add(rock);
  }
  root.add(dumpOreGroup);
  root.userData.joints = { house, boomPivot, stickPivot, bucketPivot, bucketOre, dumpOreGroup };
  return root;
}

function createTerrainFollowingRoute(path) {
  const points = path.map(({ x, z }) => new THREE.Vector3(x, getTerrainHeight(x, z), z));
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  return { curve, length: curve.getLength() };
}
function updateVehicleOnRoute(vehicle, route, progress, direction = 1) {
  const t = THREE.MathUtils.clamp(progress, 0, 1);
  const point = route.curve.getPointAt(t);
  const tangent = route.curve.getTangentAt(t).multiplyScalar(direction);
  const y = getTerrainHeight(point.x, point.z);
  vehicle.position.set(point.x, y, point.z);
  setHeadingFromXZ(vehicle, point, point.clone().add(tangent));
  vehicle.userData.terrainY = y;
  vehicle.userData.routeProgress = t;
  vehicle.userData.routeDirection = direction;
}
function lerpXZOnTerrain(object, a, b, t) {
  const x = THREE.MathUtils.lerp(a.x, b.x, t);
  const z = THREE.MathUtils.lerp(a.z, b.z, t);
  placeOnTerrain(object, x, z, b);
}

function createTruckCycleController(truck, route, phaseOffsetSeconds = 0) {
  // Keep the legacy scene controller aligned with the integrated production
  // cycle: TRUCK-01 must leave the loading point after 10 s, not remain parked
  // for the old 18 s loading phase.
  const phases = { loading: 10, haul: 40, dumping: 8, return: 35 };
  const total = Object.values(phases).reduce((a, b) => a + b, 0);
  let elapsed = phaseOffsetSeconds % total;
  let previousProgress = 0;
  return function update(dt) {
    elapsed = (elapsed + dt) % total;
    const joints = truck.userData.joints;
    const ore = joints?.oreLoad;
    const bed = joints?.bedPivot;
    let progress = 0;
    let direction = 1;
    let state = 'loading';
    let dumpLift = 0;
    let loaded = true;
    let loadFraction = 1;
    let dumpPhase = -1;
    if (elapsed < phases.loading) {
      progress = 0;
      state = 'loading-at-pit';
      loadFraction = THREE.MathUtils.clamp(elapsed / phases.loading, 0.04, 1);
    } else if (elapsed < phases.loading + phases.haul) {
      const local = (elapsed - phases.loading) / phases.haul;
      progress = local;
      state = 'loaded-haul';
    } else if (elapsed < phases.loading + phases.haul + phases.dumping) {
      progress = 1;
      state = 'dumping-at-rom';
      const local = (elapsed - phases.loading - phases.haul) / phases.dumping;
      dumpPhase = local;
      dumpLift = local < 0.32 ? local / 0.32 : local < 0.72 ? 1 : (1 - local) / 0.28;
      loaded = local < 0.72;
      loadFraction = local < 0.42 ? 1 : THREE.MathUtils.clamp(1 - (local - 0.42) / 0.30, 0.03, 1);
    } else {
      const local = (elapsed - phases.loading - phases.haul - phases.dumping) / phases.return;
      progress = 1 - local;
      direction = -1;
      state = 'empty-return';
      loaded = false;
      loadFraction = 0;
    }
    updateVehicleOnRoute(truck, route, progress, direction);
    const distanceDelta = Math.abs(progress - previousProgress) * route.length;
    rotateVehicleWheels(truck, distanceDelta);
    previousProgress = progress;
    if (bed) bed.rotation.x = -Math.max(0, dumpLift) * 0.92;
    if (ore) {
      ore.visible = loaded && loadFraction > 0.02;
      ore.scale.y = Math.max(0.03, loadFraction);
      ore.position.y = 0.37 + 0.41 * Math.max(0.03, loadFraction);
    }
    const dumpOreGroup = joints?.dumpOreGroup;
    if (dumpOreGroup) {
      dumpOreGroup.children.forEach((rock, index) => {
        const local = dumpPhase < 0 ? -1 : (dumpPhase - 0.28) / 0.46;
        const phase = local - rock.userData.dumpPhase * 0.34;
        const active = phase >= 0 && phase <= 1;
        rock.visible = active;
        if (!active) return;
        rock.position.set(
          ((index % 3) - 1) * 0.72,
          THREE.MathUtils.lerp(4.7, 0.75, phase),
          THREE.MathUtils.lerp(-4.2, -6.15, phase),
        );
        rock.rotation.x += 0.08;
        rock.rotation.z += 0.06;
      });
    }
    truck.userData.operationalState = state;
    truck.userData.dumpProgress = dumpLift;
    truck.userData.loadState = loaded ? 'loaded' : 'empty';
  };
}

export function createMobileEquipment() {
  const root = new THREE.Group();
  root.name = 'mobile-equipment';
  const road01 = getRoadPath('ROAD-01');
  const route = createTerrainFollowingRoute(road01);
  const stockpile = getZoneTransform('Z3');
  const reception = getZoneTransform('Z1');

  const truck01 = createHaulTruck({ id: 'TRUCK-01' });
  const truck02 = createHaulTruck({ id: 'TRUCK-02' });
  const truck03 = createHaulTruck({ id: 'TRUCK-03' });
  [truck01, truck02].forEach((truck) => {
    truck.userData.routeId = 'ROAD-01';
    truck.userData.speedMps = 6.0;
    root.add(truck);
  });
  placeOnTerrain(truck03, reception.position.x - 16, reception.position.z + 12, { x: reception.position.x, z: reception.position.z });
  truck03.userData.operationalState = 'rom-standby';
  root.add(truck03);

  const loader = createWheelLoader({ id: 'LOADER-01' });
  const loaderPoints = {
    home: { x: stockpile.position.x + 10, z: stockpile.position.z + 14 },
    pile: { x: stockpile.position.x - 5, z: stockpile.position.z + 7 },
    turn: { x: stockpile.position.x + 11, z: stockpile.position.z + 13 },
    hopper: { x: stockpile.position.x + 13, z: stockpile.position.z + 8 },
    hopperForward: { x: stockpile.position.x + 15, z: stockpile.position.z + 3 },
  };
  placeOnTerrain(loader, loaderPoints.home.x, loaderPoints.home.z, loaderPoints.pile);
  root.add(loader);

  const excavator = createExcavator({ id: 'EXCAVATOR-01' });
  placeOnTerrain(excavator, PIT_DESIGN.shovelPoint.x, PIT_DESIGN.shovelPoint.z, PIT_DESIGN.loadingPoint);
  root.add(excavator);

  const updateTruck01 = createTruckCycleController(truck01, route, 0);
  const updateTruck02 = createTruckCycleController(truck02, route, 43);
  updateTruck01(0.001);
  updateTruck02(0.001);

  let loaderElapsed = 0;
  let excavatorElapsed = 0;
  function updateLoader(dt) {
    loaderElapsed = (loaderElapsed + dt) % 30;
    const joints = loader.userData.joints;
    if (!joints) return;
    let loaded = false;
    let distance = 0;
    if (loaderElapsed < 6) {
      const t = loaderElapsed / 6;
      lerpXZOnTerrain(loader, loaderPoints.home, loaderPoints.pile, t);
      joints.lift.rotation.x = THREE.MathUtils.lerp(0, -0.36, t);
      joints.bucketPivot.rotation.x = THREE.MathUtils.lerp(0, 0.28, t);
      distance = 1.3 * dt;
    } else if (loaderElapsed < 10) {
      const t = (loaderElapsed - 6) / 4;
      lerpXZOnTerrain(loader, loaderPoints.pile, loaderPoints.turn, t);
      loaded = true;
      joints.lift.rotation.x = THREE.MathUtils.lerp(-0.36, 0.04, t);
      joints.bucketPivot.rotation.x = THREE.MathUtils.lerp(0.28, -0.08, t);
      distance = 1.2 * dt;
    } else if (loaderElapsed < 17) {
      const t = (loaderElapsed - 10) / 7;
      lerpXZOnTerrain(loader, loaderPoints.turn, loaderPoints.hopper, t);
      loaded = true;
      joints.front.rotation.y = Math.sin(t * Math.PI) * 0.15;
      joints.lift.rotation.x = THREE.MathUtils.lerp(0.04, 0.24, t);
      distance = 1.4 * dt;
    } else if (loaderElapsed < 20) {
      placeOnTerrain(loader, loaderPoints.hopper.x, loaderPoints.hopper.z, loaderPoints.hopperForward);
      const t = (loaderElapsed - 17) / 3;
      loaded = t < 0.62;
      joints.bucketPivot.rotation.x = THREE.MathUtils.lerp(-0.08, -0.78, Math.sin(t * Math.PI));
      joints.dumpOreGroup?.children.forEach((rock, index) => {
        const phase = (t - 0.25) * 1.7 - rock.userData.dumpPhase * 0.28;
        const active = phase >= 0 && phase <= 1;
        rock.visible = active;
        if (!active) return;
        rock.position.set(
          ((index % 3) - 1) * 0.42,
          THREE.MathUtils.lerp(3.7, 0.65, phase),
          THREE.MathUtils.lerp(6.4, 7.8, phase),
        );
        rock.rotation.x += 0.07;
      });
    } else if (loaderElapsed < 25) {
      const t = (loaderElapsed - 20) / 5;
      lerpXZOnTerrain(loader, loaderPoints.hopper, loaderPoints.turn, t);
      joints.lift.rotation.x = THREE.MathUtils.lerp(0.24, 0, t);
      joints.bucketPivot.rotation.x = THREE.MathUtils.lerp(-0.08, 0, t);
      distance = 1.3 * dt;
    } else {
      const t = (loaderElapsed - 25) / 5;
      lerpXZOnTerrain(loader, loaderPoints.turn, loaderPoints.home, t);
      joints.front.rotation.y *= 0.9;
      distance = 1.2 * dt;
    }
    joints.bucketOre.visible = loaded;
    if (!(loaderElapsed >= 17 && loaderElapsed < 20)) {
      joints.dumpOreGroup?.children.forEach((rock) => { rock.visible = false; });
    }
    rotateVehicleWheels(loader, distance);
    loader.userData.operationalState = loaded ? 'loaded-reclaim' : 'reclaim-cycle';
  }

  function updateExcavator(dt) {
    excavatorElapsed = (excavatorElapsed + dt) % 16;
    const joints = excavator.userData.joints;
    if (!joints) return;
    const p = excavatorElapsed / 16;
    // Dig on the face (first half), swing toward loading truck (middle), return (last quarter).
    const swing = p < 0.42
      ? -0.48
      : p < 0.66
        ? THREE.MathUtils.lerp(-0.48, 0.56, (p - 0.42) / 0.24)
        : p < 0.78
          ? 0.56
          : THREE.MathUtils.lerp(0.56, -0.48, (p - 0.78) / 0.22);
    joints.house.rotation.y = swing;
    const dig = p < 0.42 ? Math.sin((p / 0.42) * Math.PI) : 0;
    joints.boomPivot.rotation.x = -0.18 + dig * 0.27;
    joints.stickPivot.rotation.x = 0.08 + dig * 0.45;
    joints.bucketPivot.rotation.x = -0.28 + dig * 0.52;
    joints.bucketOre.visible = p >= 0.34 && p < 0.67;
    joints.dumpOreGroup?.children.forEach((rock, index) => {
      const phase = ((p - 0.60) / 0.12) - rock.userData.dumpPhase * 0.24;
      const active = phase >= 0 && phase <= 1;
      rock.visible = active;
      if (!active) return;
      // Loading point is about 10 m west / 11 m north of the shovel root.
      rock.position.set(
        -10 + ((index % 3) - 1) * 0.45,
        THREE.MathUtils.lerp(6.6, 2.7, phase),
        11 + (index % 2) * 0.5,
      );
      rock.rotation.z += 0.08;
    });
    excavator.userData.operationalState = p < 0.42 ? 'digging' : p < 0.71 ? 'swing-loaded' : 'returning';
  }

  function update(deltaSeconds) {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
    const dt = Math.min(deltaSeconds, 0.1);
    updateTruck01(dt);
    updateTruck02(dt);
    updateLoader(dt);
    updateExcavator(dt);
  }

  root.userData = { haulTruckCount: 3, wheelLoaderCount: 1, excavatorCount: 1, animatedTruckCount: 2 };
  return {
    root,
    haulTrucks: [truck01, truck02, truck03],
    wheelLoader: loader,
    excavator,
    update,
    get truck01RouteLength() { return route.length; },
  };
}
