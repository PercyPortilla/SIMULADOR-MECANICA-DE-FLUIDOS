import * as THREE from 'three';
import { getZoneTransform } from '../layout/plantLayout.js';
import { getTerrainHeight } from '../environment/terrainHeight.js';
import { INDUSTRIAL_PAD_THICKNESS } from '../environment/industrialPads.js';
import { createIndustrialMaterial } from '../materials/industrialMaterials.js';

function standardMaterial(color, { metalness = 0.42, roughness = 0.52 } = {}) {
  return createIndustrialMaterial('processSteel', { color, metalness, roughness });
}

function addBox(group, {
  name,
  size,
  position,
  material,
  rotation = [0, 0, 0],
}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function addCylinder(group, {
  name,
  radiusTop,
  radiusBottom = radiusTop,
  height,
  position,
  material,
  radialSegments = 24,
  rotation = [0, 0, 0],
}) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments),
    material,
  );
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

function createSafetyRail(group, { width, depth, y, material }) {
  const rail = new THREE.Group();
  rail.name = 'safety-rail';
  const postHeight = 1.05;
  const postSize = 0.08;
  const xValues = [-width / 2, 0, width / 2];
  const zValues = [-depth / 2, depth / 2];
  xValues.forEach((x) => {
    zValues.forEach((z) => {
      addBox(rail, {
        name: 'rail-post',
        size: [postSize, postHeight, postSize],
        position: [x, y + postHeight / 2, z],
        material,
      });
    });
  });
  [-depth / 2, depth / 2].forEach((z) => {
    addBox(rail, {
      name: 'rail-horizontal',
      size: [width, postSize, postSize],
      position: [0, y + postHeight, z],
      material,
    });
  });
  group.add(rail);
  return rail;
}

function createReceptionModule() {
  const zone = getZoneTransform('Z1');
  const root = new THREE.Group();
  root.name = 'MINERAL-RECEPTION';
  root.position.set(
    zone.position.x,
    zone.position.y + INDUSTRIAL_PAD_THICKNESS,
    zone.position.z,
  );
  root.rotation.y = zone.rotationY;
  root.userData = { zoneId: 'Z1', process: 'reception', inspectableEquipment: true };

  const steel = standardMaterial(0x788589, { metalness: 0.62, roughness: 0.42 });
  const darkSteel = standardMaterial(0x48555a, { metalness: 0.7, roughness: 0.38 });
  const safety = standardMaterial(0xd3a61f, { metalness: 0.25, roughness: 0.52 });
  const mineral = standardMaterial(0x75634f, { metalness: 0, roughness: 1 });

  // Tolva principal: paredes trapezoidales simplificadas mediante tronco de pirámide.
  const hopper = new THREE.Mesh(
    new THREE.CylinderGeometry(2.3, 4.25, 4.2, 4, 1, false),
    steel,
  );
  hopper.name = 'ROM-hopper';
  hopper.userData.inspectionShell = true;
  hopper.position.set(2.5, 2.35, 0);
  hopper.rotation.y = Math.PI / 4;
  hopper.castShadow = true;
  hopper.receiveShadow = true;
  root.add(hopper);

  // Marco superior robusto alrededor de la boca ROM.
  [
    [[2.5, 4.58, -3.72], [7.8, 0.22, 0.22]],
    [[2.5, 4.58, 3.72], [7.8, 0.22, 0.22]],
    [[-1.22, 4.58, 0], [0.22, 0.22, 7.5]],
    [[6.22, 4.58, 0], [0.22, 0.22, 7.5]],
  ].forEach(([position, size], index) => {
    addBox(root, {
      name: `ROM-hopper-lip-${index + 1}`,
      size,
      position,
      material: darkSteel,
    });
  });

  // Reja/grizzly visible sobre la boca de tolva.
  const grizzly = new THREE.Group();
  grizzly.name = 'ROM-grizzly';
  for (let index = -5; index <= 5; index += 1) {
    addBox(grizzly, {
      name: `grizzly-bar-${index + 6}`,
      size: [0.12, 0.16, 7.1],
      position: [index * 0.65, 4.55, 0],
      material: darkSteel,
    });
  }
  grizzly.position.x = 2.5;
  root.add(grizzly);

  // Mineral visible sobre la parrilla para dar escala y función al punto de descarga.
  const romMineral = new THREE.Mesh(
    new THREE.ConeGeometry(3.35, 1.25, 18, 2, false),
    mineral,
  );
  romMineral.name = 'ROM-visible-ore-charge';
  romMineral.position.set(2.3, 5.12, 0.1);
  romMineral.scale.set(1.08, 0.8, 0.9);
  romMineral.castShadow = true;
  root.add(romMineral);

  // Chute de descarga inferior hacia la primera faja.
  const chute = addBox(root, {
    name: 'ROM-discharge-chute',
    size: [2.2, 1.5, 2.2],
    position: [2.5, 0.1, 0],
    material: darkSteel,
    rotation: [0, 0, -0.16],
  });
  chute.userData.transferPoint = 'reception-discharge';

  // Estructura y plataforma de mantenimiento.
  [-1, 1].forEach((xSign) => {
    [-1, 1].forEach((zSign) => {
      addBox(root, {
        name: 'reception-support',
        size: [0.28, 4.5, 0.28],
        position: [2.5 + xSign * 3.35, 2.25, zSign * 2.8],
        material: darkSteel,
      });
    });
  });
  // Arriostres en X para que el soporte de la tolva se lea como una estructura minera real.
  [-1, 1].forEach((zSign) => {
    [-1, 1].forEach((xSign) => {
      addBox(root, {
        name: 'reception-cross-brace',
        size: [0.16, 4.7, 0.16],
        position: [2.5 + xSign * 2.0, 2.15, zSign * 2.82],
        material: darkSteel,
        rotation: [0, 0, xSign * 0.62],
      });
    });
  });
  addBox(root, {
    name: 'reception-service-platform',
    size: [8.2, 0.22, 6.4],
    position: [2.5, 3.9, 0],
    material: steel,
  });
  createSafetyRail(root, { width: 8.0, depth: 6.2, y: 4.02, material: safety });

  // Escalera lateral de mantenimiento.
  const receptionLadder = new THREE.Group();
  receptionLadder.name = 'reception-access-ladder';
  [-0.34, 0.34].forEach((x) => {
    addBox(receptionLadder, {
      name: 'reception-ladder-rail',
      size: [0.07, 3.9, 0.07],
      position: [x, 2.05, 0],
      material: safety,
    });
  });
  for (let y = 0.4; y < 3.85; y += 0.4) {
    addBox(receptionLadder, {
      name: 'reception-ladder-rung',
      size: [0.72, 0.055, 0.07],
      position: [0, y, 0],
      material: safety,
    });
  }
  receptionLadder.position.set(6.25, 0.05, 3.2);
  root.add(receptionLadder);

  // Apron/vibratory feeder: separate tray, side skirts, exciter and a reusable
  // set of ore lumps.  Animation is driven centrally by industrialAnimations.
  const feeder = addBox(root, {
    name: 'ROM-apron-feeder',
    size: [3.8, 0.30, 1.9],
    position: [4.25, 0.55, 0],
    material: darkSteel,
    rotation: [0, 0, -0.08],
  });
  feeder.userData.vibratoryFeeder = true;
  feeder.userData.basePosition = feeder.position.toArray();
  [-0.93, 0.93].forEach((z, index) => {
    addBox(root, {
      name: `ROM-feeder-skirt-${index + 1}`,
      size: [3.65, 0.62, 0.12],
      position: [4.25, 0.90, z],
      material: steel,
      rotation: [0, 0, -0.08],
    });
  });
  const exciter = addCylinder(root, {
    name: 'ROM-feeder-exciter',
    radiusTop: 0.28,
    height: 0.72,
    position: [4.0, 0.26, -1.15],
    material: safety,
    radialSegments: 18,
    rotation: [Math.PI / 2, 0, 0],
  });
  exciter.userData.feederExciter = true;

  for (let index = 0; index < 12; index += 1) {
    const ore = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18 + (index % 3) * 0.035, 0), mineral);
    ore.name = `ROM-feeder-ore-${index + 1}`;
    ore.position.set(2.85 + (index % 6) * 0.52, 0.89 + (index % 2) * 0.05, -0.56 + Math.floor(index / 6) * 1.1);
    ore.rotation.set(index * 0.17, index * 0.31, index * 0.11);
    ore.castShadow = true;
    ore.userData.feederOre = true;
    ore.userData.travelStartX = 2.7;
    ore.userData.travelEndX = 5.85;
    ore.userData.travelOffset = (index / 12) * 3.15;
    root.add(ore);
  }

  // Área de descarga y zona de trabajo, marcadas de forma funcional pero sin vehículos.
  const dumpZone = addBox(root, {
    name: 'haul-truck-dump-zone',
    size: [16.0, 0.08, 12.0],
    position: [-4.0, 0.08, 0],
    material: new THREE.MeshStandardMaterial({
      color: 0x84745d,
      roughness: 1,
      transparent: true,
      opacity: 0.72,
    }),
  });
  dumpZone.userData.vehicleZone = 'haul-truck';

  const loaderZone = addBox(root, {
    name: 'wheel-loader-work-zone',
    size: [8.5, 0.07, 8.5],
    position: [-13.0, 0.09, 11.0],
    material: new THREE.MeshStandardMaterial({
      color: 0x8e7c54,
      roughness: 1,
      transparent: true,
      opacity: 0.46,
    }),
  });
  loaderZone.userData.vehicleZone = 'wheel-loader';

  // Pequeño volumen mineral en la zona de descarga para comunicar función.
  addBox(root, {
    name: 'reception-mineral-bed',
    size: [7.5, 0.32, 6.0],
    position: [-4.0, 0.25, 0],
    material: mineral,
  });

  return {
    root,
    transferPoints: {
      discharge: root.localToWorld(new THREE.Vector3(3.6, 0.25, 0)),
    },
  };
}

function createCrusherModule() {
  const zone = getZoneTransform('Z2');
  const root = new THREE.Group();
  root.name = 'PRIMARY-CRUSHING';
  root.position.set(zone.position.x, zone.position.y + 0.1, zone.position.z);
  root.rotation.y = zone.rotationY;
  root.userData = { zoneId: 'Z2', process: 'crushing', inspectableEquipment: true };

  const steel = standardMaterial(0x738185, { metalness: 0.62, roughness: 0.42 });
  const darkSteel = standardMaterial(0x465257, { metalness: 0.72, roughness: 0.34 });
  const crusherMat = standardMaterial(0x879295, { metalness: 0.48, roughness: 0.52 });
  const safety = standardMaterial(0xd5a921, { metalness: 0.2, roughness: 0.55 });

  // Pórtico estructural.
  [-1, 1].forEach((xSign) => {
    [-1, 1].forEach((zSign) => {
      addBox(root, {
        name: 'crusher-column',
        size: [0.32, 7.0, 0.32],
        position: [xSign * 3.1, 3.5, zSign * 2.6],
        material: darkSteel,
      });
    });
  });
  addBox(root, {
    name: 'crusher-upper-platform',
    size: [7.1, 0.28, 6.0],
    position: [0, 5.5, 0],
    material: steel,
  });
  createSafetyRail(root, { width: 6.9, depth: 5.8, y: 5.66, material: safety });

  // Vigas de coronación y ménsulas visibles de la torre.
  [-2.8, 0, 2.8].forEach((z) => {
    addBox(root, {
      name: 'crusher-top-crossbeam',
      size: [7.0, 0.24, 0.24],
      position: [0, 6.85, z],
      material: darkSteel,
    });
  });
  [-2.95, 2.95].forEach((x) => {
    addBox(root, {
      name: 'crusher-side-beam',
      size: [0.24, 0.24, 5.4],
      position: [x, 6.65, 0],
      material: darkSteel,
    });
  });

  // Cuerpo reconocible de chancadora primaria: carcasa superior e inferior.
  const crusherBody = addCylinder(root, {
    name: 'primary-crusher-body',
    radiusTop: 2.15,
    radiusBottom: 1.55,
    height: 3.4,
    position: [0, 3.85, 0],
    material: crusherMat,
    radialSegments: 20,
  });
  crusherBody.userData.inspectionShell = true;

  // Gyratory internals: eccentric mantle and spider make the primary crusher
  // mechanically legible instead of reading as a generic cone.
  const mantlePivot = new THREE.Group();
  mantlePivot.name = 'primary-crusher-mantle-pivot';
  mantlePivot.userData.crusherMantle = true;
  mantlePivot.userData.baseX = 0;
  mantlePivot.userData.baseZ = 0;
  const mantle = new THREE.Mesh(
    new THREE.ConeGeometry(1.15, 2.85, 28, 1, false),
    darkSteel,
  );
  mantle.name = 'primary-crusher-mantle';
  mantle.position.y = 3.65;
  mantle.castShadow = true;
  mantlePivot.add(mantle);
  root.add(mantlePivot);

  const spider = new THREE.Group();
  spider.name = 'primary-crusher-spider';
  [0, Math.PI / 2].forEach((angle, index) => {
    addBox(spider, {
      name: `primary-crusher-spider-arm-${index + 1}`,
      size: [4.65, 0.24, 0.28],
      position: [0, 5.35, 0],
      material: darkSteel,
      rotation: [0, angle, 0],
    });
  });
  addCylinder(spider, {
    name: 'primary-crusher-spider-hub',
    radiusTop: 0.42,
    height: 0.65,
    position: [0, 5.45, 0],
    material: darkSteel,
    radialSegments: 20,
  });
  root.add(spider);

  // Aros de refuerzo sobre la carcasa principal.
  [3.05, 4.0, 4.95].forEach((y, index) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.78 - index * 0.08, 0.08, 8, 28),
      darkSteel,
    );
    ring.name = `primary-crusher-reinforcement-ring-${index + 1}`;
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, y, 0);
    ring.castShadow = true;
    root.add(ring);
  });
  const crusherLowerBody = addCylinder(root, {
    name: 'primary-crusher-lower-body',
    radiusTop: 1.6,
    radiusBottom: 1.15,
    height: 1.8,
    position: [0, 1.3, 0],
    material: darkSteel,
    radialSegments: 20,
  });
  crusherLowerBody.userData.inspectionShell = true;

  const inletChute = addBox(root, {
    name: 'crusher-inlet-chute',
    size: [3.2, 1.2, 2.8],
    position: [-2.9, 6.45, 0],
    material: darkSteel,
    rotation: [0, 0, -0.22],
  });
  inletChute.userData.transferPoint = 'crusher-inlet';

  addBox(root, {
    name: 'crusher-feed-hood',
    size: [3.8, 0.55, 3.4],
    position: [-2.6, 6.9, 0],
    material: steel,
    rotation: [0, 0, -0.08],
  });

  for (let index = 0; index < 9; index += 1) {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.22 + (index % 3) * 0.055, 0),
      standardMaterial(0x6b5945, { metalness: 0, roughness: 1 }),
    );
    rock.name = `crusher-ore-${index + 1}`;
    rock.position.set(-2.45 + (index % 3) * 0.42, 6.35 - Math.floor(index / 3) * 0.6, -0.45 + (index % 2) * 0.9);
    rock.userData.crusherOre = true;
    rock.userData.phase = index / 9;
    rock.castShadow = true;
    root.add(rock);
  }

  const outletChute = addBox(root, {
    name: 'crusher-discharge-chute',
    size: [2.0, 1.0, 2.0],
    position: [2.0, 0.75, 0],
    material: darkSteel,
    rotation: [0, 0, -0.18],
  });
  outletChute.userData.transferPoint = 'crusher-discharge';

  // Escalera técnica simplificada, funcional y reconocible.
  const ladder = new THREE.Group();
  ladder.name = 'crusher-access-ladder';
  [-0.38, 0.38].forEach((x) => {
    addBox(ladder, {
      name: 'ladder-rail',
      size: [0.08, 5.0, 0.08],
      position: [x, 2.5, 0],
      material: safety,
    });
  });
  for (let y = 0.3; y < 4.8; y += 0.42) {
    addBox(ladder, {
      name: 'ladder-rung',
      size: [0.8, 0.06, 0.08],
      position: [0, y, 0],
      material: safety,
    });
  }
  ladder.position.set(3.45, 0.15, -2.65);
  root.add(ladder);

  // V23F: detalle industrial moderado dentro de la huella existente.
  // Accionamiento lateral y guarda para reforzar la lectura de chancadora como máquina.
  addBox(root, {
    name: 'crusher-drive-motor',
    size: [1.65, 1.15, 1.25],
    position: [2.55, 2.7, -2.1],
    material: darkSteel,
  });

  // Dos ménsulas de soporte bajo el accionamiento.
  [-0.62, 0.62].forEach((zOffset) => {
    addBox(root, {
      name: 'crusher-drive-support',
      size: [2.4, 0.18, 0.18],
      position: [2.35, 1.82, -2.1 + zOffset],
      material: darkSteel,
    });
  });
  addCylinder(root, {
    name: 'crusher-drive-coupling',
    radiusTop: 0.22,
    radiusBottom: 0.22,
    height: 0.9,
    position: [1.55, 2.7, -2.1],
    material: steel,
    radialSegments: 18,
    rotation: [0, 0, Math.PI / 2],
  });
  addBox(root, {
    name: 'crusher-coupling-guard',
    size: [1.15, 0.72, 0.9],
    position: [1.55, 2.7, -2.1],
    material: safety,
  });

  // Plataforma baja y arriostres secundarios para evitar aspecto de pórtico vacío.
  addBox(root, {
    name: 'crusher-lower-maintenance-platform',
    size: [6.2, 0.18, 1.15],
    position: [0, 2.0, -2.45],
    material: steel,
  });
  [-2.75, 2.75].forEach((x) => {
    addBox(root, {
      name: 'crusher-lower-rail-post',
      size: [0.07, 0.85, 0.07],
      position: [x, 2.48, -2.95],
      material: safety,
    });
  });
  addBox(root, {
    name: 'crusher-lower-rail',
    size: [5.6, 0.07, 0.07],
    position: [0, 2.88, -2.95],
    material: safety,
  });
  [-1, 1].forEach((sign) => {
    const brace = addBox(root, {
      name: 'crusher-cross-brace',
      size: [0.14, 4.3, 0.14],
      position: [sign * 2.95, 3.0, 0],
      material: darkSteel,
      rotation: [0, 0, sign * 0.62],
    });
    brace.userData.detailOnly = true;
  });

  return {
    root,
    transferPoints: {
      inlet: root.localToWorld(new THREE.Vector3(-4.1, 6.45, 0)),
      discharge: root.localToWorld(new THREE.Vector3(3.0, 0.6, 0)),
    },
  };
}

function createStockpileModule() {
  const zone = getZoneTransform('Z3');
  const root = new THREE.Group();
  root.name = 'STOCKPILE-AREA';
  const terrainY = getTerrainHeight(zone.position.x, zone.position.z);
  root.position.set(zone.position.x, terrainY, zone.position.z);
  root.rotation.y = zone.rotationY;
  root.userData = { zoneId: 'Z3', process: 'stockpile', inspectableEquipment: true };

  const mineral = standardMaterial(0x745e47, { metalness: 0, roughness: 1 });
  const baseMaterial = standardMaterial(0x66645d, { metalness: 0, roughness: 0.96 });
  const steel = standardMaterial(0x6f7d81, { metalness: 0.58, roughness: 0.48 });

  addCylinder(root, {
    name: 'stockpile-operating-base',
    radiusTop: 17.5,
    radiusBottom: 17.5,
    height: 0.12,
    position: [0, 0.08, 0],
    material: baseMaterial,
    radialSegments: 48,
  });

  const pileGroup = new THREE.Group();
  pileGroup.name = 'mineral-stockpile';
  [
    { radius: 12.5, height: 9.4, x: -1.0, z: 0.0, sx: 1.0, sz: 0.88 },
    { radius: 8.4, height: 7.1, x: 5.5, z: 1.8, sx: 1.08, sz: 0.82 },
    { radius: 7.6, height: 6.4, x: -6.4, z: -2.4, sx: 0.92, sz: 1.08 },
  ].forEach((definition, index) => {
    const pile = new THREE.Mesh(
      new THREE.ConeGeometry(definition.radius, definition.height, 48, 6, false),
      mineral,
    );
    pile.name = `mineral-stockpile-lobe-${index + 1}`;
    pile.position.set(definition.x, definition.height / 2 + 0.18, definition.z);
    pile.scale.set(definition.sx, 1, definition.sz);
    pile.rotation.y = index * 0.47;
    pile.castShadow = true;
    pile.receiveShadow = true;
    pileGroup.add(pile);
  });
  root.add(pileGroup);

  // Derrames bajos alrededor del pie evitan la lectura de un cono perfecto.
  [
    [-12.0, 0.58, 4.5, 3.6, 0.92],
    [11.0, 0.52, -5.4, 3.1, 0.82],
    [-7.5, 0.46, -10.0, 2.6, 0.72],
  ].forEach(([x, y, z, radius, height], index) => {
    const spill = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 20, 3, false), mineral);
    spill.name = `stockpile-spillage-${index + 1}`;
    spill.position.set(x, y, z);
    spill.scale.z = 0.72 + index * 0.08;
    spill.castShadow = true;
    root.add(spill);
  });

  // Punto elevado de descarga de la faja sobre el acopio.
  addBox(root, {
    name: 'stockpile-feed-transfer',
    size: [1.3, 1.2, 1.3],
    position: [-13.0, 10.2, 0],
    material: steel,
  });

  // Pequeña torre de descarga y pasarela sobre el acopio.
  [-13.75, -12.25].forEach((x) => {
    addBox(root, {
      name: 'stockpile-feed-tower-leg',
      size: [0.22, 9.7, 0.22],
      position: [x, 4.85, -0.85],
      material: steel,
    });
    addBox(root, {
      name: 'stockpile-feed-tower-leg',
      size: [0.22, 9.7, 0.22],
      position: [x, 4.85, 0.85],
      material: steel,
    });
  });
  addBox(root, {
    name: 'stockpile-feed-walkway',
    size: [8.0, 0.16, 0.95],
    position: [-9.8, 10.05, -1.35],
    material: steel,
  });

  // Reclaim station: loader dumps into a dedicated hopper and apron feeder.
  // This makes the stockpile -> CV-03 transfer explicit instead of appearing magical.
  const reclaimHopper = new THREE.Mesh(
    new THREE.CylinderGeometry(1.8, 3.4, 3.2, 4, 1, false),
    steel,
  );
  reclaimHopper.name = 'stockpile-reclaim-hopper';
  reclaimHopper.position.set(13.0, 2.0, 7.0);
  reclaimHopper.rotation.y = Math.PI / 4;
  reclaimHopper.castShadow = true;
  reclaimHopper.receiveShadow = true;
  root.add(reclaimHopper);

  for (let index = -3; index <= 3; index += 1) {
    addBox(root, {
      name: `stockpile-reclaim-grizzly-${index + 4}`,
      size: [0.10, 0.10, 3.25],
      position: [13.0 + index * 0.70, 3.68, 7.0],
      material: steel,
    });
  }

  const reclaimFeeder = addBox(root, {
    name: 'stockpile-reclaim-preparation',
    size: [6.6, 0.42, 2.1],
    position: [14.0, 0.58, 5.0],
    material: steel,
    rotation: [0, -0.30, -0.035],
  });
  reclaimFeeder.userData.futureConnection = 'Z4';
  reclaimFeeder.userData.reclaimFeeder = true;
  reclaimFeeder.userData.basePosition = reclaimFeeder.position.toArray();

  addBox(root, {
    name: 'stockpile-reclaim-tunnel',
    size: [7.0, 1.75, 3.2],
    position: [14.0, 0.88, 5.0],
    material: baseMaterial,
  });

  for (let index = 0; index < 10; index += 1) {
    const ore = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16 + (index % 2) * 0.04, 0), mineral);
    ore.name = `stockpile-reclaim-ore-${index + 1}`;
    ore.position.set(11.3 + (index % 5) * 1.0, 0.98, 4.5 + Math.floor(index / 5) * 0.62);
    ore.userData.reclaimOre = true;
    ore.userData.travelStartX = 11.0;
    ore.userData.travelEndX = 17.0;
    ore.userData.travelOffset = (index / 10) * 6.0;
    ore.castShadow = true;
    root.add(ore);
  }

  // Loader manoeuvring pad is intentionally kept clear of the stockpile toe.
  addCylinder(root, {
    name: 'stockpile-loader-apron',
    radiusTop: 9.0,
    radiusBottom: 9.0,
    height: 0.10,
    position: [8.0, 0.10, 13.0],
    material: baseMaterial,
    radialSegments: 40,
  });

  return {
    root,
    transferPoints: {
      feed: root.localToWorld(new THREE.Vector3(-13.2, 10.2, 0)),
      reclaim: root.localToWorld(new THREE.Vector3(17.4, 0.72, 4.5)),
    },
  };
}

export function createMineralFrontEnd() {
  const root = new THREE.Group();
  root.name = 'mineral-front-end';

  const reception = createReceptionModule();
  const crushing = createCrusherModule();
  const stockpile = createStockpileModule();
  root.add(reception.root, crushing.root, stockpile.root);
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    if (!object.isMesh) return;
    object.castShadow = true;
    object.receiveShadow = true;
  });

  // Recalcular puntos mundiales con la jerarquía ya insertada.
  const points = {
    receptionDischarge: reception.root.localToWorld(new THREE.Vector3(3.6, 0.25, 0)),
    crusherInlet: crushing.root.localToWorld(new THREE.Vector3(-4.1, 6.45, 0)),
    crusherDischarge: crushing.root.localToWorld(new THREE.Vector3(3.0, 0.6, 0)),
    stockpileFeed: stockpile.root.localToWorld(new THREE.Vector3(-13.2, 10.2, 0)),
    stockpileReclaim: stockpile.root.localToWorld(new THREE.Vector3(17.4, 0.72, 4.5)),
  };

  return { root, reception, crushing, stockpile, transferPoints: points };
}
