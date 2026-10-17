import * as THREE from 'three';
import { createEquipment } from './equipmentRegistry.js';
import { createIndustrialMaterial } from '../materials/industrialMaterials.js';

function mat(color, metalness = 0.5, roughness = 0.48) {
  return createIndustrialMaterial('processSteel', { color, metalness, roughness });
}

function box(group, name, size, position, material, rotation = [0, 0, 0]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function cylinder(group, name, radiusTop, radiusBottom, height, position, material, rotation = [0, 0, Math.PI / 2], radialSegments = 32) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function railPosts(group, prefix, xs, y, z, material, height = 0.9) {
  xs.forEach((x) => box(group, `${prefix}-post`, [0.07, height, 0.07], [x, y + height / 2, z], material));
}

function createMillCharge(id, shellRadius, shellLength) {
  const group = new THREE.Group();
  group.name = `${id}-internal-charge`;
  group.userData.inspectionInterior = true;
  group.userData.millInternal = true;
  group.visible = false;

  const ore = createIndustrialMaterial('mineral', { color: 0x6d5844, roughness: 1, metalness: 0 });
  const ballMaterial = mat(0x555b5d, 0.68, 0.38);
  const ballGeometry = new THREE.SphereGeometry(0.16, 10, 8);
  const balls = new THREE.InstancedMesh(ballGeometry, ballMaterial, 36);
  balls.name = `${id}-grinding-media`;
  const matrix = new THREE.Matrix4();
  for (let i = 0; i < 36; i += 1) {
    const x = -shellLength * 0.38 + (i % 9) * (shellLength * 0.76 / 8);
    const row = Math.floor(i / 9);
    const angle = -Math.PI * 0.86 + (i % 9) * 0.16 + row * 0.09;
    const r = shellRadius * (0.54 + row * 0.08);
    matrix.makeTranslation(x, Math.cos(angle) * r, Math.sin(angle) * r);
    balls.setMatrixAt(i, matrix);
  }
  balls.instanceMatrix.needsUpdate = true;
  group.add(balls);

  const chargeBed = new THREE.Mesh(
    new THREE.CylinderGeometry(shellRadius * 0.72, shellRadius * 0.72, shellLength * 0.86, 32, 1, false, 0, Math.PI),
    ore,
  );
  chargeBed.name = `${id}-ore-charge`;
  chargeBed.rotation.z = Math.PI / 2;
  chargeBed.rotation.x = Math.PI / 2;
  chargeBed.position.y = -0.55;
  chargeBed.userData.inspectionInterior = true;
  group.add(chargeBed);
  return group;
}

export function createGrindingMill({ id = 'MILL-01', position, rotationY = 0 } = {}) {
  const root = new THREE.Group();
  root.name = id;
  root.userData.inspectableEquipment = true;
  const steel = mat(0x7c888c, 0.62, 0.42);
  const dark = mat(0x465257, 0.72, 0.36);
  const safety = mat(0xd0a51e, 0.25, 0.54);
  const concrete = mat(0x8b8e8c, 0, 0.92);

  box(root, `${id}-foundation`, [10.8, 0.5, 7.6], [0, 0.25, 0], concrete);

  const shellAssembly = new THREE.Group();
  shellAssembly.name = `${id}-rotating-assembly`;
  shellAssembly.userData.millRotatingAssembly = true;
  const shell = cylinder(shellAssembly, `${id}-shell`, 2.45, 2.45, 7.0, [0, 3.25, 0], steel);
  shell.userData.inspectionShell = true;
  [-3.52, 3.52].forEach((x, index) => {
    const end = cylinder(shellAssembly, `${id}-end-head-${index + 1}`, 2.38, 1.2, 0.45, [x, 3.25, 0], steel);
    end.userData.inspectionShell = true;
  });
  [-2.55, -1.3, 0, 1.3, 2.55].forEach((x, index) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(2.51, index === 3 ? 0.14 : 0.075, 10, 40),
      index === 3 ? safety : dark,
    );
    ring.name = `${id}-shell-ring-${index + 1}`;
    ring.rotation.y = Math.PI / 2;
    ring.position.set(x, 3.25, 0);
    ring.castShadow = true;
    ring.userData.inspectionShell = true;
    shellAssembly.add(ring);
  });
  cylinder(shellAssembly, `${id}-feed-trunnion`, 0.72, 0.72, 1.1, [-4.05, 3.25, 0], dark);
  cylinder(shellAssembly, `${id}-discharge-trunnion`, 0.72, 0.72, 1.1, [4.05, 3.25, 0], dark);
  root.add(shellAssembly);

  const internalCharge = createMillCharge(id, 2.2, 6.4);
  internalCharge.position.y = 3.25;
  root.add(internalCharge);

  [-2.45, 2.45].forEach((x, index) => {
    box(root, `${id}-bearing-pedestal-${index + 1}`, [1.35, 2.25, 3.55], [x, 1.15, 0], dark);
    cylinder(root, `${id}-bearing-housing-${index + 1}`, 0.95, 0.95, 0.52, [x, 3.25, 0], dark);
  });

  // Girth gear and pinion visibly explain how the shell is driven.
  const girthGear = new THREE.Mesh(new THREE.TorusGeometry(2.62, 0.20, 10, 56), dark);
  girthGear.name = `${id}-girth-gear`;
  girthGear.rotation.y = Math.PI / 2;
  girthGear.position.set(1.55, 3.25, 0);
  girthGear.castShadow = true;
  girthGear.userData.millRotatingWithShell = true;
  shellAssembly.add(girthGear);

  box(root, `${id}-drive-motor`, [2.7, 1.7, 2.0], [1.8, 1.25, -3.15], dark);
  for (let index = -3; index <= 3; index += 1) {
    box(root, `${id}-motor-fin-${index + 4}`, [2.45, 0.08, 0.08], [1.8, 1.28 + index * 0.18, -2.08], steel);
  }
  box(root, `${id}-drive-gearbox`, [1.35, 1.45, 1.6], [0.1, 1.28, -3.15], steel);
  cylinder(root, `${id}-drive-coupling`, 0.24, 0.24, 1.15, [-0.95, 1.28, -3.15], dark);
  box(root, `${id}-coupling-guard`, [1.5, 0.8, 1.1], [-0.95, 1.28, -3.15], safety);
  cylinder(root, `${id}-pinion`, 0.34, 0.34, 0.8, [1.35, 2.35, -2.35], dark, [Math.PI / 2, 0, 0], 20);

  box(root, `${id}-service-platform`, [9.4, 0.18, 1.4], [0, 4.5, -3.15], steel);
  box(root, `${id}-safety-rail`, [9.4, 0.08, 0.08], [0, 5.35, -3.75], safety);
  railPosts(root, `${id}-service-rail`, [-4.55, -2.25, 0, 2.25, 4.55], 4.5, -3.75, safety);
  box(root, `${id}-service-rail-mid`, [9.2, 0.06, 0.06], [0, 4.92, -3.75], safety);

  [-0.34, 0.34].forEach((x) => {
    box(root, `${id}-access-ladder-rail`, [0.07, 4.0, 0.07], [-4.2 + x, 2.3, -3.45], safety);
  });
  for (let y = 0.55; y < 4.2; y += 0.42) {
    box(root, `${id}-access-ladder-rung`, [0.7, 0.055, 0.07], [-4.2, y, -3.45], safety);
  }

  // Feed chute and discharge trommel with a visible screen cage.
  box(root, `${id}-feed-chute`, [2.0, 1.05, 1.65], [-5.0, 3.75, 0], dark, [0, 0, -0.08]);
  const trommel = cylinder(root, `${id}-discharge-trommel`, 0.94, 0.94, 1.55, [5.15, 3.25, 0], steel);
  trommel.userData.millRotatingWithShell = true;
  for (let i = 0; i < 7; i += 1) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.96, 0.035, 6, 28), dark);
    ring.name = `${id}-trommel-ring-${i + 1}`;
    ring.rotation.y = Math.PI / 2;
    ring.position.set(4.55 + i * 0.20, 3.25, 0);
    root.add(ring);
  }

  const feedNozzle = cylinder(root, `${id}-feed-nozzle`, 0.32, 0.32, 0.8, [-4.65, 3.25, 0], dark);
  feedNozzle.userData.portId = 'feed';
  const dischargeNozzle = cylinder(root, `${id}-discharge-nozzle`, 0.28, 0.28, 0.8, [4.65, 3.25, 0], dark);
  dischargeNozzle.userData.portId = 'discharge';

  return createEquipment({
    id,
    type: 'grinding-mill',
    dimensions: { lengthM: 10.8, widthM: 7.6, heightM: 5.5 },
    transform: { position, rotationY },
    ports: [
      { id: 'feed', type: 'inlet', localPosition: [-5.05, 3.25, 0], direction: [-1, 0, 0], nominalDiameterM: 0.35 },
      { id: 'discharge', type: 'outlet', localPosition: [5.05, 3.25, 0], direction: [1, 0, 0], nominalDiameterM: 0.20 },
    ],
    metadata: { zoneId: 'Z4', process: 'grinding', validatedProcessModel: false },
    group3D: root,
  });
}

function createCyclone(group, id, x, steel, dark) {
  const cyclone = new THREE.Group();
  cyclone.name = `${id}-cyclone-${x}`;
  const barrel = cylinder(cyclone, `${id}-separator-${x}`, 0.42, 0.42, 1.05, [0, 3.55, 0], steel, [0, 0, 0], 28);
  barrel.userData.inspectionShell = true;
  const cone = cylinder(cyclone, `${id}-separator-cone-${x}`, 0.42, 0.09, 1.9, [0, 2.08, 0], steel, [0, 0, 0], 28);
  cone.userData.inspectionShell = true;
  cylinder(cyclone, `${id}-overflow-riser-${x}`, 0.10, 0.10, 0.85, [0, 4.45, 0], dark, [0, 0, 0], 18);
  cylinder(cyclone, `${id}-underflow-spigot-${x}`, 0.08, 0.08, 0.45, [0, 0.90, 0], dark, [0, 0, 0], 18);

  const vortex = new THREE.Mesh(
    new THREE.TorusKnotGeometry(0.24, 0.035, 48, 6, 2, 3),
    new THREE.MeshStandardMaterial({ color: 0x9a7654, transparent: true, opacity: 0.78, roughness: 0.8 }),
  );
  vortex.name = `${id}-cyclone-vortex-${x}`;
  vortex.scale.set(0.48, 1.05, 0.48);
  vortex.position.y = 2.7;
  vortex.userData.inspectionInterior = true;
  vortex.userData.cycloneVortex = true;
  vortex.visible = false;
  cyclone.add(vortex);
  return cyclone;
}

export function createGenericClassifier({ id = 'CLASS-01', position, rotationY = 0 } = {}) {
  const root = new THREE.Group();
  root.name = id;
  root.userData.inspectableEquipment = true;
  const steel = mat(0x748286, 0.62, 0.42);
  const dark = mat(0x48555a, 0.72, 0.35);
  const safety = mat(0xd0a51e, 0.22, 0.54);
  const concrete = mat(0x858987, 0, 0.94);
  const slurry = new THREE.MeshStandardMaterial({ color: 0x866c51, roughness: 0.86, transparent: true, opacity: 0.88 });

  box(root, `${id}-skid`, [10.5, 0.45, 7.5], [0, 0.225, 0], concrete);

  // Mill discharge sump: the route now enters at a low, mechanically plausible level.
  const sump = cylinder(root, `${id}-sump`, 1.55, 1.45, 2.05, [-3.1, 1.45, 0.9], steel, [0, 0, 0], 32);
  sump.userData.inspectionShell = true;
  const sumpFluid = cylinder(root, `${id}-sump-slurry`, 1.40, 1.40, 0.14, [-3.1, 2.30, 0.9], slurry, [0, 0, 0], 32);
  sumpFluid.userData.inspectionInterior = true;
  sumpFluid.userData.slurrySurface = true;
  sumpFluid.visible = false;

  // Dedicated classification feed pump.
  const pumpGroup = new THREE.Group();
  pumpGroup.name = `${id}-feed-pump`;
  pumpGroup.position.set(-0.5, 0.4, 1.2);
  const volute = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.21, 14, 36), steel);
  volute.name = `${id}-pump-volute`;
  volute.rotation.y = Math.PI / 2;
  volute.position.y = 0.85;
  volute.userData.inspectionShell = true;
  pumpGroup.add(volute);
  const impeller = new THREE.Group();
  impeller.name = `${id}-pump-impeller`;
  impeller.position.y = 0.85;
  impeller.userData.pumpImpeller = true;
  impeller.userData.inspectionInterior = true;
  impeller.visible = false;
  for (let i = 0; i < 6; i += 1) {
    const blade = box(impeller, `${id}-pump-blade-${i + 1}`, [0.10, 0.48, 0.20], [Math.cos(i * Math.PI / 3) * 0.24, Math.sin(i * Math.PI / 3) * 0.24, 0], dark);
    blade.rotation.z = i * Math.PI / 3;
  }
  pumpGroup.add(impeller);
  box(pumpGroup, `${id}-pump-motor`, [1.45, 0.95, 0.9], [1.25, 0.82, 0], dark);
  root.add(pumpGroup);

  // Pump discharge riser and cyclone feed manifold.
  cylinder(root, `${id}-feed-riser`, 0.18, 0.18, 4.0, [0.0, 3.2, 0.5], dark, [0, 0, 0], 18);
  box(root, `${id}-manifold`, [7.2, 0.50, 0.78], [1.2, 4.62, 0], dark);
  cylinder(root, `${id}-feed-header`, 0.18, 0.18, 7.2, [1.2, 4.62, -0.66], dark, [0, 0, Math.PI / 2]);

  const cycloneXs = [-2.1, -0.7, 0.7, 2.1];
  cycloneXs.forEach((x, index) => {
    const cyclone = createCyclone(root, id, index + 1, steel, dark);
    cyclone.position.x = x + 1.2;
    root.add(cyclone);
    cylinder(root, `${id}-manifold-drop-${index + 1}`, 0.09, 0.09, 0.75, [x + 1.2, 4.25, 0], dark, [0, 0, 0], 18);
    box(root, `${id}-support-${index + 1}`, [0.16, 4.05, 0.16], [x + 0.5, 2.05, -1.0], dark);
    box(root, `${id}-support-${index + 1}-b`, [0.16, 4.05, 0.16], [x + 1.9, 2.05, 1.0], dark);
  });

  box(root, `${id}-platform`, [9.0, 0.18, 2.8], [0.8, 4.15, 0], steel);
  box(root, `${id}-rail`, [9.0, 0.08, 0.08], [0.8, 5.02, -1.35], safety);
  railPosts(root, `${id}-platform-rail`, [-3.5, -1.5, 0.5, 2.5, 4.5], 4.15, -1.35, safety, 0.82);
  box(root, `${id}-platform-rail-mid`, [8.8, 0.06, 0.06], [0.8, 4.58, -1.35], safety);

  box(root, `${id}-overflow-launder`, [7.4, 0.34, 0.58], [1.2, 5.00, 0.2], steel);
  box(root, `${id}-underflow-launder`, [7.4, 0.28, 0.92], [1.2, 0.32, 0.65], dark);
  box(root, `${id}-return-chute`, [1.1, 0.75, 0.82], [-2.2, 0.55, 0.65], dark, [0, 0, -0.12]);

  [-0.32, 0.32].forEach((x) => {
    box(root, `${id}-access-ladder-rail`, [0.07, 4.0, 0.07], [-4.15 + x, 2.2, -2.5], safety);
  });
  for (let y = 0.55; y < 4.1; y += 0.42) {
    box(root, `${id}-access-ladder-rung`, [0.66, 0.055, 0.07], [-4.15, y, -2.5], safety);
  }

  return createEquipment({
    id,
    type: 'generic-classification-skid',
    dimensions: { lengthM: 10.5, widthM: 7.5, heightM: 5.1 },
    transform: { position, rotationY },
    ports: [
      { id: 'inlet', type: 'inlet', localPosition: [-4.85, 1.45, 0.9], direction: [-1, 0, 0], nominalDiameterM: 0.20 },
      { id: 'product', type: 'outlet', localPosition: [5.15, 4.85, 0.2], direction: [1, 0, 0], nominalDiameterM: 0.20 },
    ],
    metadata: {
      zoneId: 'Z5',
      process: 'classification',
      genericPlaceholder: true,
      validatedProcessModel: false,
      note: 'Representación 3D de sump + bomba + cluster de ciclones; sin modelo de clasificación validado.',
    },
    group3D: root,
  });
}
