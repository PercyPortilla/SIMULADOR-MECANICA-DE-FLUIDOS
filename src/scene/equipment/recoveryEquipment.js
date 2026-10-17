import * as THREE from 'three';
import { createEquipment } from './equipmentRegistry.js';
import { createIndustrialMaterial } from '../materials/industrialMaterials.js';

function meshWithMaterial(geometry, material, name, position) {
  const object = new THREE.Mesh(geometry, material);
  object.name = name;
  object.position.set(position[0], position[1], position[2]);
  object.castShadow = true;
  object.receiveShadow = true;
  return object;
}

function mesh(geometry, materialRole, name, position, overrides = {}) {
  return meshWithMaterial(geometry, createIndustrialMaterial(materialRole, overrides), name, position);
}


function enableMeshShadows(root) {
  root.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });
}

function addNozzle(group, { name, position, direction = 'x', radius = 0.16, length = 0.65 }) {
  const nozzle = mesh(
    new THREE.CylinderGeometry(radius, radius, length, 20),
    'processSteel',
    name,
    position,
  );
  if (direction === 'x') nozzle.rotation.z = Math.PI / 2;
  else if (direction === 'z') nozzle.rotation.x = Math.PI / 2;
  group.add(nozzle);
  return nozzle;
}

function addRail(group, { name, width, depth, y, z = 0 }) {
  const rail = new THREE.Group();
  rail.name = name;
  const material = createIndustrialMaterial('safetyYellow');
  const postHeight = 0.58;
  const postGeometry = new THREE.CylinderGeometry(0.025, 0.025, postHeight, 10);
  [-width / 2, 0, width / 2].forEach((x, index) => {
    const post = meshWithMaterial(postGeometry, material, `${name}-post-${index + 1}`, [x, y + postHeight / 2, z]);
    rail.add(post);
  });
  const top = meshWithMaterial(
    new THREE.CylinderGeometry(0.022, 0.022, width, 10),
    material,
    `${name}-top`,
    [0, y + postHeight, z],
  );
  top.rotation.z = Math.PI / 2;
  rail.add(top);
  group.add(rail);
  return rail;
}

export function createCipAdsorptionTrain({ position, rotationY = 0 } = {}) {
  const id = 'CIP-ADSORPTION';
  const group = new THREE.Group();
  group.name = id;
  group.userData.inspectableEquipment = true;
  const skidHeight = 0.22;
  group.add(mesh(new THREE.BoxGeometry(15.0, skidHeight, 7.0), 'concrete', `${id}-pad`, [0, skidHeight / 2, 0]));

  // V24F: repeated CIP vessels reuse immutable geometry/material resources.
  const tankGeometry = new THREE.CylinderGeometry(1.65, 1.65, 5.2, 32);
  const tankMaterial = createIndustrialMaterial('processSteel');
  const lidGeometry = new THREE.CylinderGeometry(1.72, 1.72, 0.14, 32);
  const lidMaterial = createIndustrialMaterial('structuralSteel');
  const guardGeometry = new THREE.TorusGeometry(1.90, 0.045, 8, 40);
  const guardMaterial = createIndustrialMaterial('safetyYellow');
  const slurrySurfaceGeometry = new THREE.CylinderGeometry(1.48, 1.48, 0.10, 28);
  const slurrySurfaceMaterial = new THREE.MeshStandardMaterial({ color: 0x80654b, roughness: 0.84, transparent: true, opacity: 0.82 });
  [-4.6, 0, 4.6].forEach((x, index) => {
    const vessel = meshWithMaterial(tankGeometry, tankMaterial, `${id}-tank-${index + 1}`, [x, skidHeight + 2.6, 0.15]);
    vessel.userData.inspectionShell = true;
    group.add(vessel);

    const slurrySurface = new THREE.Mesh(slurrySurfaceGeometry, slurrySurfaceMaterial);
    slurrySurface.name = `${id}-slurry-${index + 1}`;
    slurrySurface.position.set(x, skidHeight + 4.35, 0.15);
    slurrySurface.userData.inspectionInterior = true;
    slurrySurface.userData.slurrySurface = true;
    slurrySurface.visible = false;
    group.add(slurrySurface);

    const lid = meshWithMaterial(lidGeometry, lidMaterial, `${id}-tank-lid-${index + 1}`, [x, skidHeight + 5.27, 0.15]);
    group.add(lid);

    const guard = meshWithMaterial(guardGeometry, guardMaterial, `${id}-guard-${index + 1}`, [x, skidHeight + 5.02, 0.15]);
    guard.rotation.x = Math.PI / 2;
    group.add(guard);

    const drive = mesh(new THREE.BoxGeometry(0.78, 0.56, 0.78), 'darkSteel', `${id}-drive-${index + 1}`, [x, skidHeight + 5.72, 0.15]);
    group.add(drive);
    const shaft = mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.72, 12), 'structuralSteel', `${id}-agitator-shaft-${index + 1}`, [x, skidHeight + 5.28, 0.15]);
    shaft.userData.cipAgitator = true;
    group.add(shaft);
  });

  const accessDeck = mesh(new THREE.BoxGeometry(13.4, 0.14, 1.05), 'structuralSteel', `${id}-access-deck`, [0, skidHeight + 4.75, -2.40]);
  group.add(accessDeck);
  addRail(group, { name: `${id}-rear-rail`, width: 13.0, depth: 1.05, y: skidHeight + 4.83, z: -2.88 });

  const manifold = mesh(new THREE.CylinderGeometry(0.10, 0.10, 12.5, 16), 'structuralSteel', `${id}-upper-manifold`, [0, skidHeight + 5.45, 0.15]);
  manifold.rotation.z = Math.PI / 2;
  group.add(manifold);
  const dropGeometry = new THREE.CylinderGeometry(0.065, 0.065, 0.85, 12);
  const dropMaterial = createIndustrialMaterial('structuralSteel');
  [-4.6, 0, 4.6].forEach((x, index) => {
    const drop = meshWithMaterial(dropGeometry, dropMaterial, `${id}-manifold-drop-${index + 1}`, [x, skidHeight + 5.03, 0.15]);
    group.add(drop);
  });

  const lowerHeader = mesh(new THREE.CylinderGeometry(0.095, 0.095, 12.8, 16), 'structuralSteel', `${id}-lower-header`, [0, skidHeight + 1.05, 1.85]);
  lowerHeader.rotation.z = Math.PI / 2;
  group.add(lowerHeader);

  const inlet = [-7.8, 2.55, 0.15];
  const outlet = [7.8, 2.55, 0.15];
  addNozzle(group, { name: `${id}-inlet-nozzle`, position: inlet, direction: 'x', radius: 0.18 });
  addNozzle(group, { name: `${id}-outlet-nozzle`, position: outlet, direction: 'x', radius: 0.16 });

  // V24E: rails/guards/details must read under the final lighting, not collapse into unshadowed overlays.
  enableMeshShadows(group);

  return createEquipment({
    id,
    type: 'adsorption-train',
    dimensions: { width: 15.6, depth: 7.0, height: 6.2 },
    transform: { position, rotationY },
    ports: [
      { id: 'inlet', type: 'inlet', localPosition: inlet, direction: [-1, 0, 0], nominalDiameterM: 0.05 },
      { id: 'outlet', type: 'outlet', localPosition: outlet, direction: [1, 0, 0], nominalDiameterM: 0.04 },
    ],
    metadata: { zoneId: 'Z8', stageId: 'REC-ADSORPTION', routeEquipmentId: id },
    group3D: group,
  });
}

export function createElutionSkid({ position, rotationY = 0 } = {}) {
  const id = 'ELUTION-SKID';
  const group = new THREE.Group();
  group.name = id;
  group.userData.inspectableEquipment = true;
  const baseHeight = 0.22;
  group.add(mesh(new THREE.BoxGeometry(8.0, baseHeight, 5.5), 'concrete', `${id}-pad`, [0, baseHeight / 2, 0]));

  const column = mesh(new THREE.CylinderGeometry(1.0, 1.0, 4.2, 30), 'processSteel', `${id}-elution-column`, [-1.45, baseHeight + 2.1, 0]);
  column.userData.inspectionShell = true;
  group.add(column);
  const columnSolution = new THREE.Mesh(
    new THREE.CylinderGeometry(0.86, 0.86, 3.5, 28),
    new THREE.MeshStandardMaterial({ color: 0x8a7655, roughness: 0.75, transparent: true, opacity: 0.74 }),
  );
  columnSolution.name = `${id}-internal-solution`;
  columnSolution.position.set(-1.45, baseHeight + 2.05, 0);
  columnSolution.userData.inspectionInterior = true;
  columnSolution.userData.processFluid = true;
  columnSolution.visible = false;
  group.add(columnSolution);
  const columnCap = mesh(new THREE.CylinderGeometry(1.08, 1.08, 0.14, 30), 'structuralSteel', `${id}-column-cap`, [-1.45, baseHeight + 4.28, 0]);
  group.add(columnCap);

  const heater = mesh(new THREE.BoxGeometry(2.2, 1.8, 1.8), 'darkSteel', `${id}-heater`, [1.55, baseHeight + 1.05, 0.7]);
  group.add(heater);
  const heaterFace = mesh(new THREE.BoxGeometry(2.23, 0.9, 0.09), 'structuralSteel', `${id}-heater-face`, [1.55, baseHeight + 1.12, 1.65]);
  group.add(heaterFace);

  const solutionTank = mesh(new THREE.CylinderGeometry(0.85, 0.85, 2.5, 26), 'processSteel', `${id}-solution-tank`, [1.65, baseHeight + 1.25, -1.45]);
  group.add(solutionTank);

  const exchanger = mesh(new THREE.CylinderGeometry(0.34, 0.34, 2.2, 20), 'structuralSteel', `${id}-heat-exchanger`, [0.25, baseHeight + 1.45, 1.85]);
  exchanger.rotation.z = Math.PI / 2;
  group.add(exchanger);
  const servicePipe = mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.6, 12), 'structuralSteel', `${id}-service-pipe`, [0.0, baseHeight + 3.65, -0.45]);
  servicePipe.rotation.z = Math.PI / 2;
  group.add(servicePipe);

  // Bomba de recirculación y loop térmico visual.
  const recircPump = mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.62, 20), 'darkSteel', `${id}-recirculation-pump`, [2.35, baseHeight + 0.50, -1.55]);
  recircPump.rotation.z = Math.PI / 2;
  group.add(recircPump);
  const recircMotor = mesh(new THREE.BoxGeometry(0.78, 0.55, 0.58), 'structuralSteel', `${id}-recirculation-motor`, [2.75, baseHeight + 0.55, -1.55]);
  group.add(recircMotor);
  const thermalLoop = new THREE.Mesh(
    new THREE.TorusGeometry(0.74, 0.055, 8, 28, Math.PI * 1.45),
    createIndustrialMaterial('structuralSteel'),
  );
  thermalLoop.name = `${id}-thermal-loop`;
  thermalLoop.rotation.y = Math.PI / 2;
  thermalLoop.position.set(-0.85, baseHeight + 1.45, 0.0);
  group.add(thermalLoop);

  const serviceDeck = mesh(new THREE.BoxGeometry(6.6, 0.12, 0.8), 'structuralSteel', `${id}-service-deck`, [-0.15, baseHeight + 3.65, -2.10]);
  group.add(serviceDeck);
  addRail(group, { name: `${id}-service-rail`, width: 6.3, depth: 0.8, y: baseHeight + 3.72, z: -2.48 });

  const inlet = [-4.2, 2.05, 0];
  const outlet = [4.2, 2.05, 0];
  addNozzle(group, { name: `${id}-inlet-nozzle`, position: inlet, direction: 'x', radius: 0.16 });
  addNozzle(group, { name: `${id}-outlet-nozzle`, position: outlet, direction: 'x', radius: 0.16 });

  enableMeshShadows(group);

  return createEquipment({
    id,
    type: 'elution-system',
    dimensions: { width: 8.4, depth: 5.5, height: 4.8 },
    transform: { position, rotationY },
    ports: [
      { id: 'inlet', type: 'inlet', localPosition: inlet, direction: [-1, 0, 0], nominalDiameterM: 0.04 },
      { id: 'outlet', type: 'outlet', localPosition: outlet, direction: [1, 0, 0], nominalDiameterM: 0.04 },
    ],
    metadata: { zoneId: 'Z8', stageId: 'REC-ELUTION', routeEquipmentId: id },
    group3D: group,
  });
}

export function createElectrowinningCells({ position, rotationY = 0 } = {}) {
  const id = 'EW-CELLS';
  const group = new THREE.Group();
  group.name = id;
  group.userData.inspectableEquipment = true;
  const baseHeight = 0.18;
  group.add(mesh(new THREE.BoxGeometry(9.0, baseHeight, 5.5), 'concrete', `${id}-pad`, [0, baseHeight / 2, 0]));

  // V24F: EW repeats identical cells; share resources while keeping separate named meshes.
  const cellGeometry = new THREE.BoxGeometry(1.15, 1.05, 3.6);
  const cellMaterial = createIndustrialMaterial('processSteel');
  const rimGeometry = new THREE.BoxGeometry(1.22, 0.09, 3.68);
  const rimMaterial = createIndustrialMaterial('structuralSteel');
  const electrodeGeometry = new THREE.BoxGeometry(0.065, 0.82, 3.05);
  const electrodeMaterial = createIndustrialMaterial('darkSteel');
  const electrolyteGeometry = new THREE.BoxGeometry(0.94, 0.14, 3.2);
  const electrolyteMaterial = new THREE.MeshStandardMaterial({ color: 0x728f84, roughness: 0.62, transparent: true, opacity: 0.76 });
  const cellXs = [-3.0, -1.5, 0, 1.5, 3.0];
  cellXs.forEach((x, index) => {
    const cell = meshWithMaterial(cellGeometry, cellMaterial, `${id}-cell-${index + 1}`, [x, baseHeight + 0.68, 0]);
    cell.userData.inspectionShell = true;
    group.add(cell);
    group.add(meshWithMaterial(rimGeometry, rimMaterial, `${id}-cell-rim-${index + 1}`, [x, baseHeight + 1.25, 0]));
    const electrolyte = new THREE.Mesh(electrolyteGeometry, electrolyteMaterial);
    electrolyte.name = `${id}-electrolyte-${index + 1}`;
    electrolyte.position.set(x, baseHeight + 0.80, 0);
    electrolyte.userData.inspectionInterior = true;
    electrolyte.userData.processFluid = true;
    electrolyte.visible = false;
    group.add(electrolyte);
    [-0.16, 0, 0.16].forEach((offset, plateIndex) => {
      group.add(meshWithMaterial(
        electrodeGeometry,
        electrodeMaterial,
        `${id}-electrode-${index + 1}-${plateIndex + 1}`,
        [x + offset * 1.8, baseHeight + 1.55, 0],
      ));
    });
  });

  const busBarGeometry = new THREE.BoxGeometry(7.4, 0.16, 0.20);
  const busBarMaterial = createIndustrialMaterial('safetyYellow');
  const busBarA = meshWithMaterial(busBarGeometry, busBarMaterial, `${id}-busbar-a`, [0, 1.78, -1.72]);
  const busBarB = meshWithMaterial(busBarGeometry, busBarMaterial, `${id}-busbar-b`, [0, 1.78, 1.72]);
  group.add(busBarA, busBarB);
  const serviceWalkway = mesh(new THREE.BoxGeometry(7.8, 0.12, 0.7), 'structuralSteel', `${id}-service-walkway`, [0, baseHeight + 0.16, -2.35]);
  group.add(serviceWalkway);
  addRail(group, { name: `${id}-walkway-rail`, width: 7.6, depth: 0.7, y: baseHeight + 0.24, z: -2.70 });

  const inlet = [-4.7, 1.2, 0];
  const solutionOutlet = [4.7, 1.2, 0];
  const productOutlet = [3.8, 1.75, -2.2];
  addNozzle(group, { name: `${id}-inlet-nozzle`, position: inlet, direction: 'x', radius: 0.15 });
  addNozzle(group, { name: `${id}-solution-outlet-nozzle`, position: solutionOutlet, direction: 'x', radius: 0.13 });

  enableMeshShadows(group);

  return createEquipment({
    id,
    type: 'electrowinning-cells',
    dimensions: { width: 9.4, depth: 5.5, height: 2.2 },
    transform: { position, rotationY },
    ports: [
      { id: 'inlet', type: 'inlet', localPosition: inlet, direction: [-1, 0, 0], nominalDiameterM: 0.04 },
      { id: 'solutionOutlet', type: 'outlet', localPosition: solutionOutlet, direction: [1, 0, 0], nominalDiameterM: 0.035 },
      { id: 'productOutlet', type: 'product', localPosition: productOutlet, direction: [1, 0, 0], nominalDiameterM: 0.02 },
    ],
    metadata: { zoneId: 'Z8', stageId: 'REC-ELECTROWINNING', routeEquipmentId: id },
    group3D: group,
  });
}

export function createSmeltingFurnace({ position, rotationY = 0 } = {}) {
  const id = 'SMELTING-FURNACE';
  const group = new THREE.Group();
  group.name = id;
  group.userData.inspectableEquipment = true;
  const baseHeight = 0.22;
  group.add(mesh(new THREE.BoxGeometry(6.5, baseHeight, 5.0), 'concrete', `${id}-pad`, [0, baseHeight / 2, 0]));

  const hearth = mesh(new THREE.CylinderGeometry(1.45, 1.38, 0.42, 30), 'structuralSteel', `${id}-hearth`, [0, baseHeight + 0.27, 0]);
  group.add(hearth);
  const furnace = mesh(new THREE.CylinderGeometry(1.28, 1.12, 2.6, 30), 'darkSteel', `${id}-body`, [0, baseHeight + 1.45, 0]);
  furnace.userData.inspectionShell = true;
  group.add(furnace);
  const moltenPool = new THREE.Mesh(
    new THREE.CylinderGeometry(0.98, 0.98, 0.12, 26),
    new THREE.MeshStandardMaterial({ color: 0xff8a24, emissive: 0xff3d00, emissiveIntensity: 1.7, roughness: 0.4 }),
  );
  moltenPool.name = `${id}-molten-pool`;
  moltenPool.position.set(0, baseHeight + 0.58, 0);
  moltenPool.userData.inspectionInterior = true;
  moltenPool.userData.moltenProcess = true;
  moltenPool.visible = false;
  group.add(moltenPool);
  const openingMaterial = new THREE.MeshStandardMaterial({
    color: 0xff7a18,
    emissive: 0xff3d00,
    emissiveIntensity: 2.2,
    roughness: 0.5,
    metalness: 0,
  });
  const opening = meshWithMaterial(new THREE.CircleGeometry(0.68, 26), openingMaterial, `${id}-hot-opening`, [1.20, baseHeight + 1.45, 0]);
  opening.rotation.y = Math.PI / 2;
  group.add(opening);
  const refractoryBand = new THREE.Mesh(new THREE.TorusGeometry(1.22, 0.08, 8, 32), createIndustrialMaterial('safetyYellow'));
  refractoryBand.name = `${id}-refractory-band`;
  refractoryBand.rotation.x = Math.PI / 2;
  refractoryBand.position.set(0, baseHeight + 1.18, 0);
  group.add(refractoryBand);

  const hood = mesh(new THREE.ConeGeometry(1.55, 1.0, 30), 'structuralSteel', `${id}-hood`, [0, baseHeight + 3.15, 0]);
  group.add(hood);
  const stack = mesh(new THREE.CylinderGeometry(0.28, 0.34, 2.1, 22), 'darkSteel', `${id}-stack`, [0, baseHeight + 4.65, 0]);
  group.add(stack);
  const stackBand = mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.34, 20), 'safetyYellow', `${id}-stack-band`, [0, baseHeight + 4.95, 0], { color: 0xb84a2a, metalness: 0.2, roughness: 0.62 });
  group.add(stackBand);

  const servicePlatform = mesh(new THREE.BoxGeometry(4.4, 0.14, 0.9), 'structuralSteel', `${id}-service-platform`, [0, baseHeight + 2.2, -1.65]);
  group.add(servicePlatform);
  addRail(group, { name: `${id}-service-rail`, width: 4.2, depth: 0.9, y: baseHeight + 2.28, z: -2.08 });

  const tapChute = mesh(new THREE.BoxGeometry(0.38, 0.24, 0.78), 'structuralSteel', `${id}-tap-chute`, [1.42, baseHeight + 0.72, 0.75]);
  tapChute.rotation.y = -0.35;
  group.add(tapChute);

  const doreMold = mesh(new THREE.BoxGeometry(1.2, 0.18, 0.55), 'safetyYellow', `${id}-dore-product`, [1.85, baseHeight + 0.18, 1.15], { metalness: 0.55, roughness: 0.35 });
  doreMold.userData.finalProductId = 'DORE';
  group.add(doreMold);
  group.add(mesh(new THREE.BoxGeometry(1.55, 0.22, 0.88), 'concrete', `${id}-dore-mold-stand`, [1.85, baseHeight + 0.04, 1.15]));

  const productInlet = [-3.45, 1.85, 0];
  enableMeshShadows(group);

  return createEquipment({
    id,
    type: 'smelting-furnace',
    dimensions: { width: 6.5, depth: 5.0, height: 5.8 },
    transform: { position, rotationY },
    ports: [
      { id: 'productInlet', type: 'product-inlet', localPosition: productInlet, direction: [-1, 0, 0], nominalDiameterM: 0.02 },
    ],
    metadata: { zoneId: 'Z8', stageId: 'REC-SMELTING', routeEquipmentId: id, finalProductId: 'DORE' },
    group3D: group,
  });
}
