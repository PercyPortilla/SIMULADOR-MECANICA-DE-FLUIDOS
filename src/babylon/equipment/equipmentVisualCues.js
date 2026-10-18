import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { getBlenderEquipmentContract } from '../../scene/integration/blenderEquipmentContracts.js';

const TAU = Math.PI * 2;

function material(scene, name, hex, {
  alpha = 1,
  emissive = null,
  metal = false,
} = {}) {
  const result = new StandardMaterial(name, scene);
  result.diffuseColor = Color3.FromHexString(hex);
  result.specularColor = metal ? new Color3(0.28, 0.30, 0.31) : new Color3(0.05, 0.05, 0.045);
  result.specularPower = metal ? 42 : 12;
  result.alpha = alpha;
  if (emissive) result.emissiveColor = Color3.FromHexString(emissive);
  result.metadata = { visualOnly: true, equipmentCueMaterial: true };
  return result;
}

function descendants(root) {
  return [root, ...(root?.getDescendants?.(false) ?? [])];
}

function semanticNodeName(name) {
  return String(name ?? '').replace(/[.\s]/g, '').toUpperCase();
}

function findNode(rootNodes, name) {
  for (const root of rootNodes ?? []) {
    const match = descendants(root).find((node) => node.name === name);
    if (match) return match;
  }
  const semantic = semanticNodeName(name);
  if (!semantic) return null;
  for (const root of rootNodes ?? []) {
    const match = descendants(root).find((node) => semanticNodeName(node.name) === semantic);
    if (match) return match;
  }
  return null;
}

function markCue(node, instanceId, role, { interior = false } = {}) {
  node.metadata = {
    ...(node.metadata ?? {}),
    visualOnly: true,
    neutralEducationalCue: true,
    instanceId,
    cueRole: role,
    ...(interior ? { inspectionInterior: true, inspectionRole: 'interior' } : {}),
  };
  if ('isPickable' in node) node.isPickable = false;
  return node;
}

function setTreeVisible(root, visible) {
  descendants(root).forEach((node) => {
    if ('isVisible' in node) node.isVisible = Boolean(visible);
  });
}

function createOreSphere(scene, parent, name, position, oreMaterial, diameter = 0.28) {
  const ore = CreateSphere(name, { diameter, segments: 5 }, scene);
  ore.parent = parent;
  ore.position.copyFrom(position);
  ore.material = oreMaterial;
  markCue(ore, parent.metadata?.instanceId, 'mineral-flow');
  return ore;
}

function addRomCues(scene, root, instanceId, materials, updaters) {
  const grizzly = new TransformNode('rom-grizzly', scene);
  grizzly.parent = root;
  markCue(grizzly, instanceId, 'rom-grizzly');
  for (let index = -4; index <= 4; index += 1) {
    const bar = CreateBox(`rom-grizzly-bar-${index + 5}`, { width: 2.6, height: 0.12, depth: 0.13 }, scene);
    bar.parent = grizzly;
    bar.position.set(-4.45, 4.18, index * 0.72);
    bar.material = materials.steel;
    markCue(bar, instanceId, 'rom-grizzly');
  }
  const throat = new TransformNode('rom-truck-dump-throat', scene);
  throat.parent = root;
  markCue(throat, instanceId, 'rom-truck-dump-throat');
  const throatPlate = CreateBox('rom-truck-dump-throat-liner', { width: 2.3, height: 0.30, depth: 6.7 }, scene);
  throatPlate.parent = throat;
  throatPlate.position.set(-5.05, 3.42, 0);
  throatPlate.rotation.z = -0.18;
  throatPlate.material = materials.dark;
  markCue(throatPlate, instanceId, 'rom-truck-dump-throat');
  const ore = Array.from({ length: 8 }, (_, index) => createOreSphere(
    scene,
    throat,
    `rom-throat-ore-${index + 1}`,
    new Vector3(-5.35 + (index % 2) * 0.50, 4.25 - (index % 4) * 0.42, -1.6 + Math.floor(index / 4) * 3.2),
    materials.ore,
    0.34 + (index % 3) * 0.05,
  ));
  updaters.push((dt) => {
    ore.forEach((item, index) => {
      item.position.y -= dt * (0.55 + index * 0.025);
      if (item.position.y < 2.75) item.position.y = 4.35;
    });
  });
}

function addCrusherOre(scene, root, instanceId, materials, updaters) {
  const flow = new TransformNode('PRIMARY-CRUSHER-v29-ore-flow', scene);
  flow.parent = root;
  markCue(flow, instanceId, 'crusher-ore-flow');
  const pieces = Array.from({ length: 10 }, (_, index) => {
    const ore = createOreSphere(
      scene,
      flow,
      `PRIMARY-CRUSHER-v29-ore-${index + 1}`,
      new Vector3(-0.48 + (index % 3) * 0.38, 4.30 - (index % 5) * 0.67, -0.55 + (index % 2) * 1.1),
      materials.ore,
      0.30 + (index % 3) * 0.06,
    );
    ore.metadata.travelPhase = index / 10;
    return ore;
  });
  updaters.push((dt) => pieces.forEach((ore) => {
    ore.metadata.travelPhase = (ore.metadata.travelPhase + dt * 0.24) % 1;
    const phase = ore.metadata.travelPhase;
    ore.position.y = 4.55 - phase * 4.0;
    ore.position.x = -0.35 + Math.sin(phase * Math.PI) * 0.45;
    ore.rotation.y += dt * 0.8;
  }));

  const safety = new TransformNode('PRIMARY-CRUSHER-v23-safety-overlay', scene);
  safety.parent = root;
  markCue(safety, instanceId, 'crusher-safety-overlay');
  [-1, 1].forEach((side) => {
    const rail = CreateBox(`PRIMARY-CRUSHER-v23-safety-rail-${side}`, { width: 4.7, height: 0.08, depth: 0.08 }, scene);
    rail.parent = safety;
    rail.position.set(0, 4.92, side * 2.15);
    rail.material = materials.safety;
    markCue(rail, instanceId, 'crusher-safety-overlay');
  });
}

function addStockpileCues(scene, root, instanceId, materials, updaters) {
  const motion = new TransformNode('STOCKPILE-RECLAIM-motion', scene);
  motion.parent = root;
  markCue(motion, instanceId, 'stockpile-reclaim-motion');
  const start = new Vector3(21.5, 3.65, 12.0);
  const end = new Vector3(27.0, 1.15, 8.9);
  const pieces = Array.from({ length: 10 }, (_, index) => {
    const ore = createOreSphere(scene, motion, `STOCKPILE-RECLAIM-reclaim-ore-${index + 1}`, start.clone(), materials.ore, 0.28 + (index % 3) * 0.05);
    ore.metadata.travelPhase = index / 10;
    return ore;
  });
  updaters.push((dt) => pieces.forEach((ore) => {
    ore.metadata.travelPhase = (ore.metadata.travelPhase + dt * 0.12) % 1;
    Vector3.LerpToRef(start, end, ore.metadata.travelPhase, ore.position);
    ore.position.y += Math.sin(ore.metadata.travelPhase * Math.PI) * 0.22;
  }));

  const feed = new TransformNode('STOCKPILE-RECLAIM-v24-feed-flow', scene);
  feed.parent = root;
  markCue(feed, instanceId, 'stockpile-feed-flow');
  const feedStart = new Vector3(-13.0, 9.4, 0);
  const feedEnd = new Vector3(-4.7, 7.55, 0);
  const feedPieces = Array.from({ length: 8 }, (_, index) => {
    const ore = createOreSphere(scene, feed, `STOCKPILE-RECLAIM-feed-ore-${index + 1}`, feedStart.clone(), materials.ore, 0.25);
    ore.metadata.travelPhase = index / 8;
    return ore;
  });
  updaters.push((dt) => feedPieces.forEach((ore) => {
    ore.metadata.travelPhase = (ore.metadata.travelPhase + dt * 0.10) % 1;
    Vector3.LerpToRef(feedStart, feedEnd, ore.metadata.travelPhase, ore.position);
  }));
}

function addMillCharge(scene, root, instanceId, materials, updaters) {
  const charge = new TransformNode('mill-charge', scene);
  charge.parent = root;
  charge.position.y = 3.25;
  markCue(charge, instanceId, 'mill-charge', { interior: true });
  const media = [];
  for (let index = 0; index < 24; index += 1) {
    const x = -2.5 + (index % 8) * 0.72;
    const row = Math.floor(index / 8);
    const angle = -2.4 + (index % 8) * 0.20 + row * 0.15;
    const radius = 1.28 + row * 0.20;
    const ball = CreateSphere(`mill-charge-media-${index + 1}`, { diameter: 0.26, segments: 8 }, scene);
    ball.parent = charge;
    ball.position.set(x, Math.cos(angle) * radius, Math.sin(angle) * radius);
    ball.material = materials.dark;
    markCue(ball, instanceId, 'mill-charge', { interior: true });
    media.push(ball);
  }
  setTreeVisible(charge, false);
  updaters.push((dt) => { charge.rotation.x += dt * 0.24; });
}

function addSumpCues(scene, root, instanceId, materials, updaters) {
  const slurry = CreateCylinder('SUMP-01-slurry', { diameter: 4.04, height: 1.65, tessellation: 32 }, scene);
  slurry.parent = root;
  slurry.position.y = 1.15;
  slurry.material = materials.slurry;
  markCue(slurry, instanceId, 'sump-slurry', { interior: true });
  const solids = new TransformNode('SUMP-01-suspended-solids', scene);
  solids.parent = root;
  markCue(solids, instanceId, 'sump-suspended-solids', { interior: true });
  const particles = Array.from({ length: 28 }, (_, index) => {
    const point = CreateSphere(`SUMP-01-solid-${index + 1}`, { diameter: 0.10, segments: 4 }, scene);
    point.parent = solids;
    const angle = (index * 2.399963) % TAU;
    const r = 0.25 + ((index * 37) % 100) / 100 * 1.5;
    point.position.set(Math.cos(angle) * r, 0.55 + (index % 7) * 0.18, Math.sin(angle) * r);
    point.material = materials.ore;
    markCue(point, instanceId, 'sump-suspended-solids', { interior: true });
    point.metadata.baseY = point.position.y;
    point.metadata.phase = index * 0.31;
    return point;
  });
  updaters.push((dt, elapsed) => {
    slurry.rotation.y += dt * 0.22;
    slurry.position.y = 1.15 + Math.sin(elapsed * 1.8) * 0.035;
    particles.forEach((point) => {
      point.position.y = point.metadata.baseY + Math.sin(elapsed * 1.3 + point.metadata.phase) * 0.07;
      point.rotation.y += dt * 0.4;
    });
  });
}

function addPumpCues(scene, root, instanceId, materials, spec, updaters) {
  const impeller = new TransformNode('pump-impeller', scene);
  impeller.parent = root;
  const position = spec.proceduralOverlayPositions?.['pump-impeller'] ?? [-1.15, 1.18, 0];
  impeller.position = Vector3.FromArray(position);
  markCue(impeller, instanceId, 'pump-impeller', { interior: true });
  const hub = CreateCylinder(`${instanceId}-cue-impeller-hub`, { diameter: 0.34, height: 0.28, tessellation: 18 }, scene);
  hub.parent = impeller;
  hub.rotation.z = Math.PI / 2;
  hub.material = materials.dark;
  markCue(hub, instanceId, 'pump-impeller', { interior: true });
  for (let index = 0; index < 7; index += 1) {
    const angle = index / 7 * TAU;
    const blade = CreateBox(`${instanceId}-cue-impeller-blade-${index + 1}`, { width: 0.10, height: 0.58, depth: 0.20 }, scene);
    blade.parent = impeller;
    blade.position.set(0, Math.cos(angle) * 0.30, Math.sin(angle) * 0.30);
    blade.rotation.x = angle;
    blade.rotation.z = 0.32;
    blade.material = materials.safety;
    markCue(blade, instanceId, 'pump-impeller', { interior: true });
  }
  setTreeVisible(impeller, false);

  const path = new TransformNode('pump-slurry-path', scene);
  path.parent = root;
  markCue(path, instanceId, 'pump-slurry-path', { interior: true });
  const suction = CreateCylinder(`${instanceId}-cue-suction-fluid`, { diameter: 0.30, height: 1.25, tessellation: 16 }, scene);
  suction.parent = path;
  suction.rotation.z = Math.PI / 2;
  suction.position.set(-1.78, 1.12, 0);
  suction.material = materials.slurry;
  markCue(suction, instanceId, 'pump-slurry-path', { interior: true });
  const discharge = CreateCylinder(`${instanceId}-cue-discharge-fluid`, { diameter: 0.26, height: 1.35, tessellation: 16 }, scene);
  discharge.parent = path;
  discharge.position.set(-1.15, 1.82, 0);
  discharge.material = materials.slurry;
  markCue(discharge, instanceId, 'pump-slurry-path', { interior: true });
  setTreeVisible(path, false);
  updaters.push((dt) => { impeller.rotation.x += dt * 5.4; });
}

function addCycloneCues(scene, root, instanceId, materials, names, updaters) {
  const positions = [
    [-1.7, 2.8, -0.9], [0, 2.8, -0.9], [1.7, 2.8, -0.9],
    [-1.7, 2.8, 0.9], [0, 2.8, 0.9], [1.7, 2.8, 0.9],
  ];
  names.filter((name) => /^cyclone-\d+-swirl$/.test(name)).forEach((name, index) => {
    const swirl = new TransformNode(name, scene);
    swirl.parent = root;
    swirl.position.set(...positions[index % positions.length]);
    markCue(swirl, instanceId, 'cyclone-swirl', { interior: true });
    for (let ringIndex = 0; ringIndex < 3; ringIndex += 1) {
      const ring = CreateTorus(`${name}-ring-${ringIndex + 1}`, {
        diameter: 0.55 - ringIndex * 0.09,
        thickness: 0.045,
        tessellation: 18,
      }, scene);
      ring.parent = swirl;
      ring.position.y = 0.35 - ringIndex * 0.30;
      ring.scaling.z = 0.78;
      ring.material = materials.slurry;
      markCue(ring, instanceId, 'cyclone-swirl', { interior: true });
    }
    setTreeVisible(swirl, false);
    updaters.push((dt) => { swirl.rotation.y += dt * (2.1 + index * 0.08); });
  });
  if (names.includes('cyclone-manifold-suspended-solids')) {
    const solids = new TransformNode('cyclone-manifold-suspended-solids', scene);
    solids.parent = root;
    solids.position.y = 4.45;
    markCue(solids, instanceId, 'cyclone-manifold-solids', { interior: true });
    for (let index = 0; index < 12; index += 1) {
      const point = createOreSphere(scene, solids, `cyclone-manifold-solid-${index + 1}`, new Vector3(-2.2 + index * 0.40, 0, ((index % 3) - 1) * 0.18), materials.ore, 0.10);
      point.metadata.inspectionInterior = true;
    }
    setTreeVisible(solids, false);
  }
}

function educationalPlacement(instanceId, descriptor, index) {
  if (/^R-0[1-4]$/.test(instanceId)) return { kind: 'cylinder', position: [0, 4.15, 0], size: [5.8, 0.16] };
  if (instanceId === 'CIP-ADSORPTION') {
    const xs = [-5.0, -1.67, 1.67, 5.0];
    return { kind: 'cylinder', position: [xs[index] ?? 0, 2.85, -0.35], size: [2.35, 0.14] };
  }
  if (instanceId === 'ELUTION-SKID') {
    if (descriptor.name === 'elution-column-solution') return { kind: 'cylinder', position: [-1.45, 2.27, 0], size: [1.72, 3.5] };
    return { kind: 'cylinder', position: [1.65, 1.35, -1.45], size: [1.45, 1.75] };
  }
  if (instanceId === 'EW-CELLS') {
    const xs = [-3.0, -1.0, 1.0, 3.0];
    return { kind: 'box', position: [xs[index] ?? 0, 0.80, 0], size: [1.0, 0.14, 3.2] };
  }
  if (instanceId === 'SMELTING-FURNACE') {
    return descriptor.name.includes('CRUCIBLE')
      ? { kind: 'cylinder', position: [0, 1.45, 0], size: [1.25, 0.16] }
      : { kind: 'cylinder', position: [0, 0.62, 0], size: [1.95, 0.14] };
  }
  return { kind: 'box', position: [0, 1, 0], size: [1.5, 0.12, 1.5] };
}

function createEducationalHostCue(scene, root, instanceId, descriptor, index, materials) {
  const placement = educationalPlacement(instanceId, descriptor, index);
  let cue;
  if (placement.kind === 'cylinder') {
    cue = CreateCylinder(descriptor.name, {
      diameter: placement.size[0],
      height: placement.size[1],
      tessellation: 28,
    }, scene);
  } else {
    cue = CreateBox(descriptor.name, {
      width: placement.size[0],
      height: placement.size[1],
      depth: placement.size[2],
    }, scene);
  }
  cue.parent = root;
  cue.position.set(...placement.position);
  cue.material = descriptor.mode === 'glow' ? materials.glow : materials.liquid;
  markCue(cue, instanceId, `educational-${descriptor.mode}`, { interior: true });
  cue.metadata.educationalDescriptor = { ...descriptor };
  cue.metadata.restScale = cue.scaling.asArray();
  cue.metadata.restRotationY = cue.rotation.y;
  if (descriptor.mode === 'glow') cue.isVisible = true;
  else cue.isVisible = false;
  return cue;
}

function animateEducationalNode(node, descriptor, elapsed) {
  const phase = Number(descriptor.phase || 0);
  if (descriptor.mode === 'liquid') {
    node.metadata ??= {};
    node.metadata.restScale ??= node.scaling?.asArray?.() ?? [1, 1, 1];
    node.metadata.restRotationY ??= Number(node.rotation?.y || 0);
    const [sx, sy, sz] = node.metadata.restScale;
    node.scaling?.set?.(sx, sy * (1 + Math.sin(elapsed * 1.35 + phase) * 0.0045), sz);
    if (node.rotation) node.rotation.y = Number(node.metadata.restRotationY) + Math.sin(elapsed * 0.42 + phase) * 0.012;
    return;
  }
  if (descriptor.mode === 'glow') {
    const meshes = [node, ...(node.getChildMeshes?.(false) ?? [])];
    meshes.forEach((mesh) => {
      const useMaterial = mesh.material;
      if (!useMaterial?.emissiveColor) return;
      useMaterial.metadata ??= {};
      useMaterial.metadata.educationalBaseEmissive ??= useMaterial.emissiveColor.asArray();
      const [r, g, b] = useMaterial.metadata.educationalBaseEmissive;
      const factor = 1 + Math.sin(elapsed * 2.5 + phase) * 0.10;
      useMaterial.emissiveColor.set(r * factor, g * factor, b * factor);
    });
  }
}

function createCatalogFallback(scene, parent, instanceId, dimensions, materials) {
  const root = new TransformNode(`${instanceId}-PROCEDURAL-FALLBACK`, scene);
  root.parent = parent;
  root.metadata = {
    visualOnly: true,
    catalogFallback: true,
    instanceId,
    preservesPortsAndLayout: true,
  };
  const length = Number(dimensions?.length ?? dimensions?.lengthM ?? 5) || 5;
  const width = Number(dimensions?.width ?? dimensions?.widthM ?? 4) || 4;
  const height = Number(dimensions?.height ?? dimensions?.heightM ?? 4) || 4;
  const addBox = (name, size, position, useMaterial = materials.steel) => {
    const mesh = CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, scene);
    mesh.parent = root;
    mesh.position.set(...position);
    mesh.material = useMaterial;
    markCue(mesh, instanceId, 'catalog-fallback');
    return mesh;
  };
  const addCylinder = (name, diameter, cylinderHeight, position, useMaterial = materials.steel, rotate = false) => {
    const mesh = CreateCylinder(name, { diameter, height: cylinderHeight, tessellation: 24 }, scene);
    mesh.parent = root;
    mesh.position.set(...position);
    if (rotate) mesh.rotation.z = Math.PI / 2;
    mesh.material = useMaterial;
    markCue(mesh, instanceId, 'catalog-fallback');
    return mesh;
  };

  if (instanceId === 'MILL-01') {
    addCylinder(`${instanceId}-fallback-shell`, Math.min(width, height) * 0.72, length * 0.66, [0, height * 0.48, 0], materials.steel, true);
  } else if (/^R-0[1-4]$/.test(instanceId) || instanceId === 'SUMP-01') {
    addCylinder(`${instanceId}-fallback-tank`, Math.min(length, width) * 0.78, height * 0.82, [0, height * 0.42, 0]);
  } else if (instanceId === 'SLURRY-PUMP-01' || instanceId === 'PUMP-01') {
    const casing = CreateTorus(`${instanceId}-fallback-volute`, { diameter: 1.55, thickness: 0.34, tessellation: 30 }, scene);
    casing.parent = root;
    casing.position.set(-1.1, Math.min(1.25, height * 0.48), 0);
    casing.rotation.y = Math.PI / 2;
    casing.material = materials.steel;
    markCue(casing, instanceId, 'catalog-fallback');
    addBox(`${instanceId}-fallback-motor`, [1.8, 0.9, 1.0], [1.25, 0.8, 0], materials.dark);
  } else if (instanceId === 'CLASS-01') {
    [-1.8, -0.6, 0.6, 1.8].forEach((x, index) => {
      const cyclone = CreateCylinder(`${instanceId}-fallback-cyclone-${index + 1}`, {
        diameterTop: 0.78,
        diameterBottom: 0.18,
        height: 2.7,
        tessellation: 22,
      }, scene);
      cyclone.parent = root;
      cyclone.position.set(x, 2.45, 0);
      cyclone.material = materials.steel;
      markCue(cyclone, instanceId, 'catalog-fallback');
    });
  } else if (instanceId === 'STOCKPILE-RECLAIM') {
    const pile = CreateCylinder(`${instanceId}-fallback-pile`, { diameterTop: 0.4, diameterBottom: 25, height: 8.5, tessellation: 32 }, scene);
    pile.parent = root;
    pile.position.set(-2, 4.25, 0);
    pile.material = materials.ore;
    markCue(pile, instanceId, 'catalog-fallback');
    addBox(`${instanceId}-fallback-reclaim`, [6.2, 0.45, 2.2], [24, 0.72, 10.2], materials.steel);
  } else if (instanceId === 'EW-CELLS') {
    [-3, -1, 1, 3].forEach((x, index) => addBox(`${instanceId}-fallback-cell-${index + 1}`, [1.1, 1.05, 3.4], [x, 0.75, 0]));
  } else if (instanceId === 'ELUTION-SKID') {
    addCylinder(`${instanceId}-fallback-column`, 2.0, 4.2, [-1.45, 2.25, 0]);
    addBox(`${instanceId}-fallback-heater`, [2.2, 1.8, 1.8], [1.55, 1.1, 0.7], materials.dark);
  } else if (instanceId === 'SMELTING-FURNACE') {
    addCylinder(`${instanceId}-fallback-body`, 2.45, 2.7, [0, 1.55, 0], materials.dark);
    addCylinder(`${instanceId}-fallback-stack`, 0.62, 2.4, [0, 4.1, 0], materials.dark);
  } else if (instanceId === 'CIP-ADSORPTION') {
    [-4.8, -1.6, 1.6, 4.8].forEach((x, index) => addCylinder(`${instanceId}-fallback-tank-${index + 1}`, 2.45, 4.8, [x, 2.4, 0]));
  } else {
    addBox(`${instanceId}-fallback-body`, [Math.max(0.8, length * 0.70), Math.max(0.8, height * 0.65), Math.max(0.8, width * 0.70)], [0, height * 0.33, 0]);
  }
  return root;
}

export function createBabylonEquipmentVisualCues({
  scene,
  instanceId,
  hostRoot,
  dimensions = {},
  spec = getBlenderEquipmentContract(instanceId),
} = {}) {
  if (!scene || !hostRoot || !instanceId) throw new TypeError('Babylon equipment cues require scene, instanceId and hostRoot.');
  const root = new TransformNode(`${instanceId}-V30-VISUAL-CUES`, scene);
  root.parent = hostRoot;
  root.metadata = {
    visualOnly: true,
    instanceId,
    blenderContractConsumed: Boolean(spec),
    keepProceduralUpdate: Boolean(spec?.keepProceduralUpdate),
    preserveProceduralOverlays: [...(spec?.preserveProceduralOverlays ?? [])],
    educationalProcessNodeCount: spec?.educationalProcessNodes?.length ?? 0,
    educationalHostProcessNodeCount: spec?.educationalHostProcessNodes?.length ?? 0,
    animationPacing: spec?.animationPacing ? { ...spec.animationPacing } : null,
  };
  const materials = {
    steel: material(scene, `${instanceId}-cue-steel`, '#66777c', { metal: true }),
    dark: material(scene, `${instanceId}-cue-dark`, '#414d51', { metal: true }),
    safety: material(scene, `${instanceId}-cue-safety`, '#d5a51e', { metal: true }),
    ore: material(scene, `${instanceId}-cue-ore`, '#765b43'),
    slurry: material(scene, `${instanceId}-cue-slurry`, '#85694d', { alpha: 0.82 }),
    liquid: material(scene, `${instanceId}-cue-liquid`, '#728f84', { alpha: 0.72 }),
    glow: material(scene, `${instanceId}-cue-glow`, '#ff8a24', { emissive: '#ff3d00' }),
  };
  const updaters = [];
  const educationalNodes = [];
  let fallbackRoot = null;
  let animationsEnabled = false;
  let elapsedSeconds = 0;

  const preserved = spec?.preserveProceduralOverlays ?? [];
  if (instanceId === 'ROM-HOPPER' && preserved.some((name) => name === 'rom-grizzly' || name === 'rom-truck-dump-throat')) {
    addRomCues(scene, root, instanceId, materials, updaters);
  }
  if (instanceId === 'PRIMARY-CRUSHER' && preserved.includes('PRIMARY-CRUSHER-v29-ore-flow')) {
    addCrusherOre(scene, root, instanceId, materials, updaters);
  }
  if (instanceId === 'STOCKPILE-RECLAIM' && preserved.includes('STOCKPILE-RECLAIM-motion')) {
    addStockpileCues(scene, root, instanceId, materials, updaters);
  }
  if (instanceId === 'MILL-01' && preserved.includes('mill-charge')) addMillCharge(scene, root, instanceId, materials, updaters);
  if (instanceId === 'SUMP-01' && preserved.includes('SUMP-01-slurry')) addSumpCues(scene, root, instanceId, materials, updaters);
  if ((instanceId === 'SLURRY-PUMP-01' || instanceId === 'PUMP-01') && preserved.includes('pump-impeller')) {
    addPumpCues(scene, root, instanceId, materials, spec, updaters);
  }
  if (instanceId === 'CLASS-01' && preserved.some((name) => /^cyclone-\d+-swirl$/.test(name))) {
    addCycloneCues(scene, root, instanceId, materials, preserved, updaters);
  }
  (spec?.educationalHostProcessNodes ?? []).forEach((descriptor, index) => {
    educationalNodes.push({ node: createEducationalHostCue(scene, root, instanceId, descriptor, index, materials), descriptor });
  });

  function bindImportedNodes(rootNodes) {
    (spec?.educationalProcessNodes ?? []).forEach((descriptor, index) => {
      const node = findNode(rootNodes, descriptor.name);
      if (node) {
        markCue(node, instanceId, `educational-${descriptor.mode}`, { interior: true });
        node.metadata.educationalDescriptor = { ...descriptor };
        node.metadata.educationalContractNodeName = descriptor.name;
        node.metadata.educationalResolvedNodeName = node.name;
        educationalNodes.push({ node, descriptor, imported: true });
      } else {
        educationalNodes.push({ node: createEducationalHostCue(scene, root, instanceId, descriptor, index, materials), descriptor, missingImportedNode: true });
      }
    });
    root.metadata.boundEducationalProcessNodeCount = educationalNodes.filter((entry) => entry.imported).length;
    root.metadata.educationalFallbackNodeCount = educationalNodes.filter((entry) => entry.missingImportedNode).length;
    return educationalNodes;
  }

  function ensureFallback() {
    if (fallbackRoot) return fallbackRoot;
    fallbackRoot = createCatalogFallback(scene, root, instanceId, dimensions, materials);
    root.metadata.catalogFallbackActive = true;
    if ((spec?.educationalProcessNodes?.length ?? 0) > 0 && educationalNodes.length === 0) bindImportedNodes([]);
    return fallbackRoot;
  }

  const observer = scene.onBeforeRenderObservable.add(() => {
    if (!animationsEnabled) return;
    const dt = Math.min(0.1, Math.max(0, Number(scene.getEngine?.().getDeltaTime?.() ?? 0) / 1000));
    if (!(dt > 0)) return;
    elapsedSeconds += dt;
    if (spec?.keepProceduralUpdate || updaters.length) updaters.forEach((update) => update(dt, elapsedSeconds));
    educationalNodes.forEach(({ node, descriptor }) => animateEducationalNode(node, descriptor, elapsedSeconds));
  });

  return {
    root,
    materials,
    bindImportedNodes,
    ensureFallback,
    setAnimationsEnabled(enabled) {
      animationsEnabled = Boolean(enabled);
      return animationsEnabled;
    },
    get animationsEnabled() { return animationsEnabled; },
    get educationalNodes() { return educationalNodes.map((entry) => entry.node); },
    get fallbackRoot() { return fallbackRoot; },
    get fallbackActive() { return Boolean(fallbackRoot); },
    dispose() {
      scene.onBeforeRenderObservable.remove(observer);
      root.dispose(false, true);
      Object.values(materials).forEach((item) => item.dispose());
      educationalNodes.splice(0, educationalNodes.length);
      fallbackRoot = null;
    },
  };
}
