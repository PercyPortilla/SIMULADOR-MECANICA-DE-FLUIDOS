import * as THREE from 'three';
import { IntegratedEquipmentRegistry, createCatalogInstance, createConveyorInstance } from './assetIntegrationLayer.js';
import { createSumpEquipment, createStockpileReclaimEquipment } from './supportEquipment.js';
import { FINAL_EQUIPMENT_LAYOUT, SUPPORT_LAYOUT } from './finalLayout.js';
import { getTerrainHeight } from '../environment/terrainHeight.js';
import { createIndustrialMaterial } from '../materials/industrialMaterials.js';
import { attachBlenderModule, BLENDER_MODULE_URLS } from './blenderModuleLibrary.js';

const PORT_ALIASES = Object.freeze({
  'MILL-01': Object.freeze({ feed: 'feedIn', discharge: 'slurryOut' }),
  'CLASS-01': Object.freeze({ inlet: 'feed', outlet: 'overflow' }),
  'R-01': Object.freeze({ inlet: 'feedIn', outlet: 'overflowOut' }),
  'R-02': Object.freeze({ inlet: 'feedIn', outlet: 'overflowOut' }),
  'R-03': Object.freeze({ inlet: 'feedIn', outlet: 'overflowOut' }),
  'R-04': Object.freeze({ inlet: 'feedIn', outlet: 'overflowOut' }),
  'CIP-ADSORPTION': Object.freeze({ inlet: 'feed', outlet: 'slurryOut' }),
  'ELUTION-SKID': Object.freeze({ inlet: 'loadedCarbonIn', outlet: 'pregnantSolutionOut' }),
  'EW-CELLS': Object.freeze({ inlet: 'electrolyteIn', outlet: 'electrolyteOut' }),
  'SMELTING-FURNACE': Object.freeze({ inlet: 'feed', outlet: 'productOut' }),
});

function groundedPosition(x, z, lift = 0) {
  return new THREE.Vector3(x, getTerrainHeight(x, z) + lift, z);
}

function structuralMemberBetween(name, start, end, thickness, material) {
  const a = start.clone();
  const b = end.clone();
  const direction = b.clone().sub(a);
  const length = Math.max(1e-5, direction.length());
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(thickness, length, thickness), material);
  mesh.name = name;
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.inspectionRole = 'structure';
  return mesh;
}

function createStockpileFeedTransferTower(source, target) {
  const root = new THREE.Group();
  root.name = 'CV-02-STOCKPILE-TRANSFER-TOWER';
  root.userData.structuralAuxiliary = true;
  root.userData.transferTower = true;
  root.userData.conveyorId = 'CV-02-CRUSHER-TO-STOCKPILE';
  root.userData.supportedEndpoint = target.toArray();

  const horizontal = target.clone().sub(source).setY(0);
  if (horizontal.lengthSq() < 1e-8) horizontal.set(1, 0, 0);
  horizontal.normalize();
  const side = new THREE.Vector3(-horizontal.z, 0, horizontal.x);
  const center = target.clone().addScaledVector(horizontal, -0.72);
  const halfRun = 1.8;
  const halfWidth = 2.25;
  const deckY = target.y - 0.72;
  const steel = createIndustrialMaterial('structuralSteel', { color: 0x526268, metalness: 0.70, roughness: 0.38 });
  const darkSteel = createIndustrialMaterial('darkSteel', { color: 0x414d51, metalness: 0.68, roughness: 0.44 });
  const safety = createIndustrialMaterial('safetyYellow', { color: 0xd49a25, metalness: 0.38, roughness: 0.44 });

  const corners = [
    [-halfRun, -halfWidth],
    [-halfRun, halfWidth],
    [halfRun, -halfWidth],
    [halfRun, halfWidth],
  ].map(([along, lateral], index) => {
    const point = center.clone().addScaledVector(horizontal, along).addScaledVector(side, lateral);
    const terrainY = getTerrainHeight(point.x, point.z);
    const footing = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.16, 0.72), darkSteel.clone());
    footing.name = `${root.name}-footing-${index + 1}`;
    footing.position.set(point.x, terrainY + 0.08, point.z);
    footing.castShadow = true;
    footing.receiveShadow = true;
    footing.userData.terrainY = terrainY;
    root.add(footing);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.055, 0.42), steel.clone());
    plate.name = `${root.name}-baseplate-${index + 1}`;
    plate.position.set(point.x, terrainY + 0.1875, point.z);
    plate.castShadow = true;
    plate.receiveShadow = true;
    root.add(plate);
    const top = point.clone().setY(deckY - 0.12);
    root.add(structuralMemberBetween(`${root.name}-leg-${index + 1}`, point.clone().setY(terrainY + 0.16), top, 0.22, steel.clone()));
    return { base: point.clone().setY(terrainY), top, terrainY };
  });

  // Upper frame and cross-bracing are world-space/terrain-aware. The Blender
  // head/hood mounted by CV-02 remains the detailed visual machinery on top.
  for (const [a, b, suffix] of [[0, 1, 'upstream'], [2, 3, 'downstream'], [0, 2, 'left'], [1, 3, 'right']]) {
    root.add(structuralMemberBetween(`${root.name}-top-${suffix}`, corners[a].top, corners[b].top, 0.20, steel.clone()));
  }
  const bracePairs = [[0, 3], [1, 2]];
  bracePairs.forEach(([a, b], index) => {
    const start = corners[a].base.clone().setY(corners[a].terrainY + 0.18);
    const end = corners[b].top.clone().setY(deckY - 0.28);
    root.add(structuralMemberBetween(`${root.name}-xbrace-${index + 1}`, start, end, 0.095, steel.clone()));
  });

  const deck = new THREE.Mesh(new THREE.BoxGeometry(halfRun * 2 + 0.55, 0.12, halfWidth * 2 + 0.55), darkSteel.clone());
  deck.name = `${root.name}-maintenance-deck`;
  deck.position.copy(center).setY(deckY);
  deck.castShadow = true;
  deck.receiveShadow = true;
  deck.userData.inspectionRole = 'structure';
  root.add(deck);

  // Toe rails make the deck read as a real transfer station without replacing
  // the parametric conveyor endpoint or its Blender head/transfer hood.
  const railY = deckY + 1.0;
  const railInset = 0.14;
  const localCorners = [
    center.clone().addScaledVector(horizontal, -halfRun + railInset).addScaledVector(side, -halfWidth + railInset).setY(railY),
    center.clone().addScaledVector(horizontal, -halfRun + railInset).addScaledVector(side, halfWidth - railInset).setY(railY),
    center.clone().addScaledVector(horizontal, halfRun - railInset).addScaledVector(side, -halfWidth + railInset).setY(railY),
    center.clone().addScaledVector(horizontal, halfRun - railInset).addScaledVector(side, halfWidth - railInset).setY(railY),
  ];
  [[0, 1], [0, 2], [1, 3]].forEach(([a, b], index) => {
    root.add(structuralMemberBetween(`${root.name}-guardrail-${index + 1}`, localCorners[a], localCorners[b], 0.055, safety.clone()));
  });
  localCorners.forEach((point, index) => {
    root.add(structuralMemberBetween(`${root.name}-rail-post-${index + 1}`, point.clone().setY(deckY + 0.10), point, 0.055, safety.clone()));
  });
  return root;
}

function addCatalogFixed(root, registry, instanceId, definition) {
  const { handle, equipment } = createCatalogInstance({
    instanceId,
    assetKey: definition.asset,
    position: groundedPosition(definition.x, definition.z),
    rotationY: definition.rotationY,
    aliases: PORT_ALIASES[instanceId] ?? {},
    registry,
  });
  root.add(handle.root);
  return equipment;
}

function attachSupport(root, registry, equipment) {
  registry.addExternal(equipment);
  root.add(equipment.group3D);
  return equipment;
}

function taperedPanelGeometry(length, startWidth, endWidth, kind) {
  const x0 = -length / 2;
  const x1 = length / 2;
  const sw = startWidth / 2;
  const ew = endWidth / 2;
  const wallHeightStart = 1.15;
  const wallHeightEnd = 0.82;
  let vertices;
  if (kind === 'floor') {
    vertices = [x0, 0, -sw, x1, 0, -ew, x1, 0, ew, x0, 0, sw];
  } else if (kind === 'left') {
    vertices = [x0, 0, -sw, x1, 0, -ew, x1, wallHeightEnd, -ew, x0, wallHeightStart, -sw];
  } else {
    vertices = [x0, 0, sw, x0, wallHeightStart, sw, x1, wallHeightEnd, ew, x1, 0, ew];
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  return geometry;
}

function createRomToFeederTransfer(romOut, feederIn) {
  const group = new THREE.Group();
  group.name = 'ROM-TO-FEEDER-CHUTE';
  group.userData.inspectableEquipment = true;
  group.userData.inspectionKind = 'material-chute';
  group.userData.sourcePoint = romOut.toArray();
  group.userData.targetPoint = feederIn.toArray();

  const direction = feederIn.clone().sub(romOut);
  const length = Math.max(0.8, direction.length());
  group.position.copy(romOut).add(feederIn).multiplyScalar(0.5);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction.clone().normalize());

  const shell = createIndustrialMaterial('structuralSteel', { color: 0x59676a, metalness: 0.64, roughness: 0.4, side: THREE.DoubleSide });
  const liner = createIndustrialMaterial('darkSteel', { color: 0x4e5555, metalness: 0.36, roughness: 0.62, side: THREE.DoubleSide });
  const oreMaterial = createIndustrialMaterial('mineral', { color: 0x806046, roughness: 1, metalness: 0 });
  const startWidth = 2.45;
  const endWidth = 1.72;

  const floor = new THREE.Mesh(taperedPanelGeometry(length, startWidth, endWidth, 'floor'), liner);
  floor.name = 'rom-feeder-chute-liner-floor';
  floor.position.y = -0.10;
  floor.castShadow = true;
  floor.receiveShadow = true;
  group.add(floor);
  for (const side of ['left', 'right']) {
    const wall = new THREE.Mesh(taperedPanelGeometry(length, startWidth, endWidth, side), shell.clone());
    wall.name = `rom-feeder-chute-${side}-wall`;
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);
  }

  const outletSkirtLength = Math.min(1.35, length * 0.22);
  const skirt = new THREE.Mesh(
    new THREE.BoxGeometry(outletSkirtLength, 0.66, endWidth + 0.10),
    createIndustrialMaterial('darkSteel', { color: 0x4b5456, metalness: 0.45, roughness: 0.62 }),
  );
  skirt.name = 'rom-feeder-chute-outlet-skirt';
  skirt.position.set(length / 2 - outletSkirtLength / 2, 0.19, 0);
  skirt.castShadow = true;
  group.add(skirt);

  // External stiffeners make the converging chute read as fabricated mining
  // equipment instead of a bare triangular shell. Geometry remains driven by
  // the real source/target vector and therefore cannot break the transfer.
  const stiffenerMaterial = createIndustrialMaterial('structuralSteel', { color: 0x47565a, metalness: 0.70, roughness: 0.38 });
  const stiffenerCount = Math.max(3, Math.min(8, Math.floor(length / 1.15)));
  for (let index = 1; index <= stiffenerCount; index += 1) {
    const progress = index / (stiffenerCount + 1);
    const x = THREE.MathUtils.lerp(-length / 2, length / 2, progress);
    const width = THREE.MathUtils.lerp(startWidth, endWidth, progress);
    const wallHeight = THREE.MathUtils.lerp(1.15, 0.82, progress);
    for (const side of [-1, 1]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.075, wallHeight + 0.16, 0.075), stiffenerMaterial.clone());
      rib.name = `rom-feeder-chute-stiffener-${index}-${side < 0 ? 'l' : 'r'}`;
      rib.position.set(x, wallHeight * 0.48, side * (width / 2 + 0.045));
      rib.castShadow = true;
      rib.receiveShadow = true;
      rib.userData.inspectionRole = 'structure';
      group.add(rib);
    }
  }

  attachBlenderModule({
    parent: group,
    url: BLENDER_MODULE_URLS.conveyorTransferHood,
    name: 'rom-feeder-blender-transfer-hood',
    position: [Math.max(-length / 2 + 0.75, length / 2 - 0.88), 0.34, 0],
    scale: [0.92, 0.86, THREE.MathUtils.clamp(endWidth / 1.4, 0.85, 1.45)],
    userData: { chuteHybridRole: 'outlet-hood' },
  });
  group.userData.blenderHybridChute = true;

  const orePieces = [];
  const updatePiece = (ore, progress, index) => {
    const usableLength = Math.max(0.4, length - 0.55);
    const width = THREE.MathUtils.lerp(startWidth, endWidth, progress);
    ore.position.set(
      -usableLength / 2 + usableLength * progress,
      0.12 + 0.035 * Math.sin(progress * Math.PI * 4 + index),
      ((index % 7) - 3) * width * 0.055,
    );
  };
  for (let index = 0; index < 24; index += 1) {
    const radius = 0.105 + (index % 4) * 0.018;
    const ore = new THREE.Mesh(new THREE.DodecahedronGeometry(radius, 0), oreMaterial);
    ore.name = `rom-feeder-chute-ore-${index}`;
    ore.userData.chuteProgress = (index / 24 + (index % 5) * 0.006) % 1;
    ore.userData.inspectionRole = 'interior';
    ore.castShadow = true;
    updatePiece(ore, ore.userData.chuteProgress, index);
    group.add(ore);
    orePieces.push(ore);
  }

  group.userData.animatedOreCount = orePieces.length;
  return {
    root: group,
    update(dt) {
      if (!Number.isFinite(dt) || dt <= 0) return;
      const step = Math.min(dt, 0.1) * 0.42;
      orePieces.forEach((ore, index) => {
        ore.userData.chuteProgress = (ore.userData.chuteProgress + step) % 1;
        updatePiece(ore, ore.userData.chuteProgress, index);
        ore.rotation.x += dt * 0.42;
        ore.rotation.z += dt * 0.31;
      });
    },
  };
}

export function createIntegratedPlant() {
  const root = new THREE.Group();
  root.name = 'integrated-equipment-v1';
  root.userData.integrationVersion = 'PULPA-LAB-INTEGRATED-V1';
  root.userData.assetCatalogFrozen = true;
  const registry = new IntegratedEquipmentRegistry();
  let animationsEnabled = true;

  Object.entries(FINAL_EQUIPMENT_LAYOUT).forEach(([instanceId, definition]) => {
    const equipment = addCatalogFixed(root, registry, instanceId, definition);
    const reactorMatch = /^R-(0[1-4])$/.exec(instanceId);
    if (reactorMatch) equipment.group3D.userData.animationPhaseOffset = Number(reactorMatch[1]) * 0.63;
  });

  // Individual embedded foundations replace the oversized white leach/recovery
  // slabs visible in the post-video review. They preserve equipment elevations.
  const civilFoundations = new THREE.Group();
  civilFoundations.name = 'integrated-equipment-foundations';
  const foundationMaterial = createIndustrialMaterial('concrete', { color: 0x8d918d, roughness: 0.95 });
  const foundationEdgeMaterial = createIndustrialMaterial('concrete', { color: 0x737a76, roughness: 0.96 });
  const anchorMaterial = createIndustrialMaterial('structuralSteel', { color: 0x556367, metalness: 0.72, roughness: 0.36 });
  const anchorGeometry = new THREE.BoxGeometry(0.36, 0.045, 0.36);
  const foundationIds = ['MILL-01', 'SLURRY-PUMP-01', 'CLASS-01', 'R-01', 'R-02', 'R-03', 'R-04', 'PUMP-01', 'CIP-ADSORPTION', 'ELUTION-SKID', 'EW-CELLS', 'SMELTING-FURNACE'];
  foundationIds.forEach((instanceId) => {
    const equipment = registry.getEquipment(instanceId);
    const definition = FINAL_EQUIPMENT_LAYOUT[instanceId];
    if (!equipment || !definition) return;
    const length = Number(equipment.dimensions.length || 4);
    const width = Number(equipment.dimensions.width || 4);
    const thickness = 0.18;
    const foundation = new THREE.Mesh(
      new THREE.BoxGeometry(length + 1.8, thickness, width + 1.8),
      foundationMaterial,
    );
    foundation.name = `${instanceId}-local-foundation`;
    foundation.position.set(
      definition.x,
      getTerrainHeight(definition.x, definition.z) - thickness / 2 + 0.025,
      definition.z,
    );
    foundation.castShadow = true;
    foundation.receiveShadow = true;
    foundation.userData.refinementCivil = true;
    civilFoundations.add(foundation);

    // Stepped embedded plinth + steel anchor plates. These remain parametric
    // because each equipment footprint is different and must follow layout/terrain.
    const lowerPlinth = new THREE.Mesh(
      new THREE.BoxGeometry(length + 2.2, 0.10, width + 2.2),
      foundationEdgeMaterial,
    );
    lowerPlinth.name = `${instanceId}-foundation-lower-plinth`;
    lowerPlinth.position.set(
      definition.x,
      getTerrainHeight(definition.x, definition.z) - thickness - 0.025,
      definition.z,
    );
    lowerPlinth.castShadow = true;
    lowerPlinth.receiveShadow = true;
    lowerPlinth.userData.refinementCivil = true;
    civilFoundations.add(lowerPlinth);

    const plateInsetX = Math.max(0.6, length / 2 - 0.45);
    const plateInsetZ = Math.max(0.6, width / 2 - 0.45);
    for (const [sx, sz] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      const plate = new THREE.Mesh(anchorGeometry, anchorMaterial);
      plate.name = `${instanceId}-foundation-anchor-${sx > 0 ? 'e' : 'w'}${sz > 0 ? 'n' : 's'}`;
      plate.position.set(
        definition.x + sx * plateInsetX,
        getTerrainHeight(definition.x, definition.z) + 0.048,
        definition.z + sz * plateInsetZ,
      );
      plate.castShadow = true;
      plate.receiveShadow = true;
      plate.userData.refinementCivil = true;
      civilFoundations.add(plate);
    }
  });
  root.add(civilFoundations);

  const stockpilePosition = groundedPosition(SUPPORT_LAYOUT.stockpile.x, SUPPORT_LAYOUT.stockpile.z);
  const stockpile = createStockpileReclaimEquipment({ id: 'STOCKPILE-RECLAIM', position: stockpilePosition });
  attachSupport(root, registry, stockpile);

  const sumpPosition = groundedPosition(SUPPORT_LAYOUT.sump.x, SUPPORT_LAYOUT.sump.z);
  const sump = createSumpEquipment({ id: 'SUMP-01', position: sumpPosition });
  attachSupport(root, registry, sump);

  root.updateMatrixWorld(true);

  // Conveyors are generated after all source/target ports have authoritative world transforms.
  const conveyorSpecs = [
    ['CV-01-FEEDER-TO-CRUSHER', 'APRON-FEEDER', 'dischargeOut', 'PRIMARY-CRUSHER', 'feedIn', 1.5],
    ['CV-02-CRUSHER-TO-STOCKPILE', 'PRIMARY-CRUSHER', 'dischargeOut', 'STOCKPILE-RECLAIM', 'feedIn', 1.45],
    ['CV-03-STOCKPILE-TO-GRINDING', 'STOCKPILE-RECLAIM', 'reclaimOut', 'MILL-01', 'feedIn', 1.4],
  ];
  const conveyors = [];
  conveyorSpecs.forEach(([id, sourceEquipment, sourcePort, targetEquipment, targetPort, width]) => {
    const source = registry.getPortWorldPosition(sourceEquipment, sourcePort);
    const target = registry.getPortWorldPosition(targetEquipment, targetPort);
    const created = createConveyorInstance({ instanceId: id, source, target, width, walkway: true, registry });
    created.equipment.group3D.userData.integrationSource = `${sourceEquipment}.${sourcePort}`;
    created.equipment.group3D.userData.integrationTarget = `${targetEquipment}.${targetPort}`;
    root.add(created.handle.root);
    conveyors.push(created.equipment);
  });

  const cv02Source = registry.getPortWorldPosition('PRIMARY-CRUSHER', 'dischargeOut');
  const cv02Target = registry.getPortWorldPosition('STOCKPILE-RECLAIM', 'feedIn');
  const stockpileFeedTower = createStockpileFeedTransferTower(cv02Source, cv02Target);
  root.add(stockpileFeedTower);

  // Material chute from ROM hopper to apron feeder remains external to the frozen
  // catalog assets, but now has explicit converging geometry and its own material flow.
  const romOut = registry.getPortWorldPosition('ROM-HOPPER', 'dischargeOut');
  const feederIn = registry.getPortWorldPosition('APRON-FEEDER', 'feedIn');
  const romFeederTransfer = createRomToFeederTransfer(romOut, feederIn);
  root.add(romFeederTransfer.root);

  root.updateMatrixWorld(true);

  return {
    root,
    registry,
    conveyors,
    stockpileFeedTower,
    stockpile,
    sump,
    getEquipment: (id) => registry.getEquipment(id),
    getPort: (equipmentId, portId) => registry.getPort(equipmentId, portId),
    getPortWorldPosition: (equipmentId, portId) => registry.getPortWorldPosition(equipmentId, portId),
    getPortWorldDirection: (equipmentId, portId) => registry.getPortWorldDirection(equipmentId, portId),
    updateAssets: (dt) => {
      registry.updateAssets(dt);
      if (animationsEnabled) romFeederTransfer.update(dt);
    },
    updateLOD: (camera) => registry.updateLOD(camera),
    setAnimationsEnabled: (enabled) => {
      animationsEnabled = Boolean(enabled);
      registry.setAnimationsEnabled(enabled);
    },
  };
}
