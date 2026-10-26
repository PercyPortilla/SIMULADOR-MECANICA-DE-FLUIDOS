import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { V57_INSPECTION_NODE_ALIASES } from '../../scene/integration/v57Layout.js';

export const B75_EQUIPMENT_SPECS = Object.freeze([
  Object.freeze({ id: 'MILL-01', mode: 'mill', particles: 18 }),
  Object.freeze({ id: 'SUMP-01', mode: 'sump', particles: 16 }),
  Object.freeze({ id: 'SLURRY-PUMP-01', mode: 'pump', particles: 14 }),
  Object.freeze({ id: 'CLASS-01', mode: 'cyclones', particlesPerCyclone: 4 }),
  Object.freeze({ id: 'R-01', mode: 'reactor', particles: 8 }),
  Object.freeze({ id: 'R-02', mode: 'reactor', particles: 8 }),
  Object.freeze({ id: 'R-03', mode: 'reactor', particles: 8 }),
  Object.freeze({ id: 'R-04', mode: 'reactor', particles: 8 }),
  Object.freeze({ id: 'CIP-ADSORPTION', mode: 'cip', particlesPerTank: 5 }),
]);

const INSPECTION_REVEAL_MODES = new Set(['transparent', 'cutaway', 'interior']);

function finite(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function visitHierarchy(root, callback) {
  callback(root);
  root.getDescendants?.(false)?.forEach(callback);
}

function allNodes(rootNodes) {
  const nodes = [];
  const seen = new Set();
  rootNodes.forEach((root) => visitHierarchy(root, (node) => {
    if (!node || seen.has(node)) return;
    seen.add(node);
    nodes.push(node);
  }));
  return nodes;
}

function resolveEquipmentRoot(nodes, id) {
  const alias = V57_INSPECTION_NODE_ALIASES[id];
  const names = new Set(alias?.names ?? [id]);
  return nodes.find((node) => names.has(node.name)) ?? null;
}

function directBounds(node) {
  if (!node) return null;
  node.computeWorldMatrix?.(true);
  const bounds = node.getHierarchyBoundingVectors?.(true);
  if (!bounds?.min || !bounds?.max) return null;
  const values = [bounds.min.x, bounds.min.y, bounds.min.z, bounds.max.x, bounds.max.y, bounds.max.z];
  if (!values.every(Number.isFinite)) return null;
  const size = bounds.max.subtract(bounds.min);
  if (size.lengthSquared() <= 1e-10) return null;
  return {
    min: bounds.min.clone(),
    max: bounds.max.clone(),
    center: Vector3.Center(bounds.min, bounds.max),
    size,
  };
}

function meshBounds(mesh) {
  if (!mesh?.getBoundingInfo) return null;
  mesh.computeWorldMatrix?.(true);
  const box = mesh.getBoundingInfo().boundingBox;
  return {
    min: box.minimumWorld.clone(),
    max: box.maximumWorld.clone(),
    center: box.centerWorld.clone(),
    size: box.extendSizeWorld.scale(2),
  };
}

function aggregateBounds(items) {
  const bounds = items.map((item) => item?.getBoundingInfo ? meshBounds(item) : directBounds(item)).filter(Boolean);
  if (!bounds.length) return null;
  const min = bounds[0].min.clone();
  const max = bounds[0].max.clone();
  bounds.slice(1).forEach((entry) => {
    min.minimizeInPlace(entry.min);
    max.maximizeInPlace(entry.max);
  });
  return {
    min,
    max,
    center: Vector3.Center(min, max),
    size: max.subtract(min),
  };
}

function descendantMeshes(root) {
  if (!root) return [];
  return [
    ...(root.getBoundingInfo && 'material' in root ? [root] : []),
    ...(root.getChildMeshes?.(false) ?? []),
  ];
}

function interiorMeshes(root) {
  return descendantMeshes(root).filter((mesh) => /(?:SLURRY|FLUID|CHARGE)(?:_|$)/i.test(String(mesh.name ?? '')));
}

function findNamedMesh(root, matcher) {
  return descendantMeshes(root).find((mesh) => matcher(String(mesh.name ?? ''))) ?? null;
}

function createMaterials(scene) {
  const slurry = new StandardMaterial('b75-equipment-slurry', scene);
  slurry.diffuseColor = new Color3(0.34, 0.235, 0.14);
  slurry.ambientColor = new Color3(0.06, 0.042, 0.026);
  slurry.specularColor = new Color3(0.05, 0.04, 0.03);
  slurry.emissiveColor = new Color3(0.045, 0.026, 0.012);
  slurry.alpha = 0.88;
  slurry.backFaceCulling = false;

  const quartz = new StandardMaterial('b75-quartz', scene);
  quartz.diffuseColor = new Color3(0.73, 0.71, 0.66);
  quartz.specularColor = new Color3(0.14, 0.14, 0.13);

  const pyrite = new StandardMaterial('b75-pyrite', scene);
  pyrite.diffuseColor = new Color3(0.44, 0.34, 0.10);
  pyrite.specularColor = new Color3(0.58, 0.46, 0.16);
  pyrite.specularPower = 28;

  const gold = new StandardMaterial('b75-gold', scene);
  gold.diffuseColor = new Color3(0.88, 0.61, 0.08);
  gold.emissiveColor = new Color3(0.045, 0.025, 0.002);
  gold.specularColor = new Color3(0.86, 0.68, 0.20);
  gold.specularPower = 42;

  return { slurry, quartz, pyrite, gold };
}

function particleKind(index, total) {
  if (index === Math.max(0, total - 1)) return 'gold';
  if (index % 4 === 2) return 'pyrite';
  return 'quartz';
}

function particleDiameter(kind, span) {
  const base = kind === 'gold' ? 0.052 : kind === 'pyrite' ? 0.070 : 0.086;
  return clamp(Math.min(base, span * 0.050), 0.026, base);
}

function addParticle(scene, root, materials, descriptor) {
  const kind = descriptor.kind;
  const particle = CreateSphere(
    'B75_' + descriptor.equipmentId + '_' + kind.toUpperCase() + '_' + String(descriptor.index + 1).padStart(2, '0'),
    { diameter: descriptor.diameterM, segments: kind === 'gold' ? 6 : 4 },
    scene,
  );
  particle.parent = root;
  particle.material = materials[kind];
  particle.isPickable = false;
  particle.renderingGroupId = 3;
  particle.metadata = {
    visualOnly: true,
    visualBuild: 'B75',
    v57AuthoritativeVisual: true,
    inspectionInterior: true,
    inspectionRole: 'interior',
    equipmentSlurryTracer: true,
    equipmentId: descriptor.equipmentId,
    mineral: kind,
    concentrationNotToScale: true,
    disseminated: kind === 'gold',
  };
  descriptor.mesh = particle;
  return descriptor;
}

function seedOrbitParticles(scene, root, materials, equipmentId, mode, bounds, count, motions) {
  if (!bounds || count <= 0) return;
  const horizontalSpan = Math.max(0.4, Math.min(bounds.size.x, bounds.size.z));
  const radiusX = clamp(bounds.size.x * 0.23, 0.16, Math.max(0.22, bounds.size.x * 0.38));
  const radiusZ = clamp(bounds.size.z * 0.23, 0.16, Math.max(0.22, bounds.size.z * 0.38));
  const verticalSpan = Math.max(0.2, bounds.size.y * 0.34);
  for (let index = 0; index < count; index += 1) {
    const kind = particleKind(index, count);
    motions.push(addParticle(scene, root, materials, {
      equipmentId,
      mode,
      index,
      count,
      kind,
      diameterM: particleDiameter(kind, horizontalSpan),
      center: bounds.center.clone(),
      minY: bounds.center.y - verticalSpan * 0.5,
      maxY: bounds.center.y + verticalSpan * 0.5,
      radiusX,
      radiusZ,
      phase: Math.PI * 2 * index / count,
      phaseOffset: index / count,
      mesh: null,
    }));
  }
}

function millBounds(root) {
  const internal = interiorMeshes(root).filter((mesh) => /CHARGE|SLURRY/i.test(mesh.name));
  return aggregateBounds(internal) ?? directBounds(root);
}

function sumpBounds(root) {
  const internal = interiorMeshes(root).filter((mesh) => /SUMP-01.*SLURRY/i.test(mesh.name));
  return aggregateBounds(internal) ?? directBounds(root);
}

function pumpBounds(root) {
  const volute = findNamedMesh(root, (name) => name === 'SLURRY-PUMP-01_VOLUTE' || /VOLUTE/.test(name));
  return meshBounds(volute) ?? directBounds(root);
}

function reactorBounds(root) {
  return aggregateBounds(interiorMeshes(root)) ?? directBounds(root);
}

function cycloneCenters(root) {
  const groups = new Map();
  descendantMeshes(root).forEach((mesh) => {
    const match = String(mesh.name ?? '').match(/CLASS-01_CYCLONE_(\d+)_(?:BARREL|CONE|SWIRL)/i);
    if (!match) return;
    const key = match[1];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(mesh);
  });
  const centers = [...groups.values()]
    .map((meshes) => aggregateBounds(meshes))
    .filter(Boolean)
    .map((bounds) => ({
      center: bounds.center,
      radius: clamp(Math.min(bounds.size.x, bounds.size.z) * 0.23, 0.08, 0.28),
      topY: bounds.max.y - bounds.size.y * 0.12,
      bottomY: bounds.min.y + bounds.size.y * 0.12,
    }));
  if (centers.length) return centers;

  const bounds = directBounds(root);
  if (!bounds) return [];
  const ring = Math.max(0.35, Math.min(bounds.size.x, bounds.size.z) * 0.28);
  return Array.from({ length: 6 }, (_, index) => {
    const angle = Math.PI * 2 * index / 6;
    return {
      center: new Vector3(
        bounds.center.x + Math.cos(angle) * ring,
        bounds.center.y,
        bounds.center.z + Math.sin(angle) * ring,
      ),
      radius: clamp(ring * 0.16, 0.08, 0.24),
      topY: bounds.center.y + bounds.size.y * 0.24,
      bottomY: bounds.center.y - bounds.size.y * 0.24,
    };
  });
}

function seedCyclones(scene, root, materials, equipmentRoot, spec, motions) {
  const centers = cycloneCenters(equipmentRoot);
  centers.forEach((cyclone, cycloneIndex) => {
    const count = spec.particlesPerCyclone;
    for (let index = 0; index < count; index += 1) {
      const globalIndex = cycloneIndex * count + index;
      const kind = particleKind(globalIndex, centers.length * count);
      motions.push(addParticle(scene, root, materials, {
        equipmentId: spec.id,
        mode: 'cyclone',
        index: globalIndex,
        count: centers.length * count,
        kind,
        diameterM: particleDiameter(kind, cyclone.radius * 2),
        center: cyclone.center.clone(),
        radiusX: cyclone.radius,
        radiusZ: cyclone.radius,
        topY: cyclone.topY,
        bottomY: cyclone.bottomY,
        phase: Math.PI * 2 * index / count,
        phaseOffset: index / count,
        cycloneIndex,
        mesh: null,
      }));
    }
  });
}

function cipTankBounds(root) {
  const slurryMeshes = interiorMeshes(root).filter((mesh) => /CIP-ADSORPTION.*SLURRY/i.test(mesh.name));
  const explicit = slurryMeshes.map(meshBounds).filter(Boolean);
  if (explicit.length) return explicit;

  const bounds = directBounds(root);
  if (!bounds) return [];
  const tankWidth = bounds.size.x / 5.1;
  return Array.from({ length: 4 }, (_, index) => {
    const x = bounds.center.x + (index - 1.5) * tankWidth * 1.08;
    const size = new Vector3(tankWidth * 0.72, bounds.size.y * 0.58, Math.min(bounds.size.z * 0.58, tankWidth * 0.82));
    return {
      center: new Vector3(x, bounds.center.y - bounds.size.y * 0.05, bounds.center.z),
      size,
      min: new Vector3(x - size.x / 2, bounds.center.y - size.y / 2, bounds.center.z - size.z / 2),
      max: new Vector3(x + size.x / 2, bounds.center.y + size.y / 2, bounds.center.z + size.z / 2),
    };
  });
}

function seedCip(scene, root, materials, equipmentRoot, spec, motions) {
  const tanks = cipTankBounds(equipmentRoot);
  tanks.forEach((bounds, tankIndex) => {
    const count = spec.particlesPerTank;
    const horizontalSpan = Math.max(0.3, Math.min(bounds.size.x, bounds.size.z));
    for (let index = 0; index < count; index += 1) {
      const globalIndex = tankIndex * count + index;
      const kind = particleKind(globalIndex, tanks.length * count);
      motions.push(addParticle(scene, root, materials, {
        equipmentId: spec.id,
        mode: 'cip',
        index: globalIndex,
        count: tanks.length * count,
        kind,
        diameterM: particleDiameter(kind, horizontalSpan),
        center: bounds.center.clone(),
        radiusX: Math.max(0.12, bounds.size.x * 0.28),
        radiusZ: Math.max(0.12, bounds.size.z * 0.28),
        minY: bounds.center.y - bounds.size.y * 0.22,
        maxY: bounds.center.y + bounds.size.y * 0.22,
        phase: Math.PI * 2 * index / count,
        phaseOffset: index / count,
        tankIndex,
        mesh: null,
      }));
    }
  });
}

function positionMotion(motion, timeSeconds, speed) {
  const mesh = motion.mesh;
  if (!mesh) return;
  const phase = motion.phase + timeSeconds * speed;

  if (motion.mode === 'mill') {
    const axial = ((motion.index % 5) - 2) / 2;
    mesh.position.set(
      motion.center.x + axial * motion.radiusX * 0.72,
      motion.center.y + Math.cos(phase) * Math.max(0.12, (motion.maxY - motion.minY) * 0.42),
      motion.center.z + Math.sin(phase) * motion.radiusZ,
    );
    return;
  }

  if (motion.mode === 'pump') {
    mesh.position.set(
      motion.center.x + Math.sin(phase * 0.55) * motion.radiusX * 0.28,
      motion.center.y + Math.cos(phase) * Math.max(0.12, (motion.maxY - motion.minY) * 0.42),
      motion.center.z + Math.sin(phase) * motion.radiusZ,
    );
    return;
  }

  if (motion.mode === 'cyclone') {
    const normalized = ((motion.phaseOffset + timeSeconds * speed * 0.12) % 1 + 1) % 1;
    const spiral = phase * 2.35;
    const y = motion.topY + (motion.bottomY - motion.topY) * normalized;
    const radius = motion.radiusX * (0.92 - normalized * 0.42);
    mesh.position.set(
      motion.center.x + Math.cos(spiral) * radius,
      y,
      motion.center.z + Math.sin(spiral) * radius,
    );
    return;
  }

  const vertical = motion.minY + (motion.maxY - motion.minY) * (0.5 + 0.25 * Math.sin(phase * 0.7 + motion.index));
  mesh.position.set(
    motion.center.x + Math.cos(phase) * motion.radiusX,
    vertical,
    motion.center.z + Math.sin(phase) * motion.radiusZ,
  );
}

export function applyB75EquipmentSlurryVisual({ scene, rootNodes = [], host } = {}) {
  if (!scene || !host) throw new TypeError('B75 equipment slurry visual requires scene and host.');

  const root = new TransformNode('B75-EQUIPMENT-SLURRY-VISUALS', scene);
  root.parent = host;
  root.metadata = {
    visualOnly: true,
    visualBuild: 'B75',
    v57AuthoritativeVisual: true,
    solverPolicy: 'read-only visual consumer',
    concentrationNotToScale: true,
  };

  const materials = createMaterials(scene);
  const nodes = allNodes(rootNodes);
  const motions = [];
  const equipment = new Map();
  const materialSnapshots = new Map();

  B75_EQUIPMENT_SPECS.forEach((spec) => {
    const equipmentRoot = resolveEquipmentRoot(nodes, spec.id);
    if (!equipmentRoot) return;
    equipment.set(spec.id, equipmentRoot);

    interiorMeshes(equipmentRoot).forEach((mesh) => {
      if (!materialSnapshots.has(mesh)) materialSnapshots.set(mesh, mesh.material);
      mesh.material = materials.slurry;
      mesh.metadata = {
        ...(mesh.metadata ?? {}),
        b75EquipmentSlurry: true,
        inspectionInterior: true,
        inspectionRole: 'interior',
      };
    });

    if (spec.mode === 'cyclones') {
      seedCyclones(scene, root, materials, equipmentRoot, spec, motions);
      return;
    }
    if (spec.mode === 'cip') {
      seedCip(scene, root, materials, equipmentRoot, spec, motions);
      return;
    }

    const bounds = spec.mode === 'mill'
      ? millBounds(equipmentRoot)
      : spec.mode === 'sump'
        ? sumpBounds(equipmentRoot)
        : spec.mode === 'pump'
          ? pumpBounds(equipmentRoot)
          : reactorBounds(equipmentRoot);
    seedOrbitParticles(scene, root, materials, spec.id, spec.mode, bounds, spec.particles, motions);
  });

  let animationsEnabled = true;
  let elapsedSeconds = 0;
  let inspectionState = Object.freeze({ targetId: null, mode: 'normal' });
  let metrics = Object.freeze({
    flowRateM3s: 0,
    solidsMassFraction: 0,
    solidVolumeFraction: 0,
    densityKgM3: 0,
    feedGoldKgH: 0,
  });

  function setMetrics(next = {}) {
    metrics = Object.freeze({
      flowRateM3s: finite(next.flowRateM3s),
      solidsMassFraction: clamp(finite(next.solidsMassFraction), 0, 1),
      solidVolumeFraction: clamp(finite(next.solidVolumeFraction), 0, 1),
      densityKgM3: Math.max(0, finite(next.densityKgM3)),
      feedGoldKgH: Math.max(0, finite(next.feedGoldKgH)),
    });

    const darkness = metrics.solidsMassFraction * 0.11;
    materials.slurry.diffuseColor = new Color3(
      0.34 - darkness,
      0.245 - darkness * 0.70,
      0.155 - darkness * 0.46,
    );
    materials.slurry.alpha = clamp(0.82 + metrics.solidVolumeFraction * 0.18, 0.82, 0.96);

    root.metadata = {
      ...(root.metadata ?? {}),
      flowRateM3s: metrics.flowRateM3s,
      solidsMassFraction: metrics.solidsMassFraction,
      solidVolumeFraction: metrics.solidVolumeFraction,
      densityKgM3: metrics.densityKgM3,
      feedGoldKgH: metrics.feedGoldKgH,
    };
    applyInspectionVisibility();
    return metrics;
  }

  function metricParticleVisibility(motion) {
    if (metrics.solidsMassFraction > 0) {
      return clamp(0.52 + metrics.solidsMassFraction * 1.2, 0.52, 1);
    }
    if (motion.mesh?.metadata?.mineral === 'gold' && metrics.feedGoldKgH > 0) return 1;
    return 0;
  }

  function applyInspectionVisibility() {
    const reveal = INSPECTION_REVEAL_MODES.has(inspectionState.mode);
    motions.forEach((motion) => {
      const metricVisibility = metricParticleVisibility(motion);
      const selected = motion.equipmentId === inspectionState.targetId;
      const openSumpHint = !reveal && motion.equipmentId === 'SUMP-01';
      motion.mesh.visibility = reveal && selected
        ? metricVisibility
        : (openSumpHint ? metricVisibility * 0.12 : 0);
    });
    root.metadata = {
      ...(root.metadata ?? {}),
      inspectionTargetId: inspectionState.targetId,
      inspectionMode: inspectionState.mode,
    };
  }

  function setInspectionState({ targetId = null, mode = 'normal' } = {}) {
    inspectionState = Object.freeze({
      targetId: targetId ? String(targetId) : null,
      mode: INSPECTION_REVEAL_MODES.has(mode) ? mode : 'normal',
    });
    applyInspectionVisibility();
    return inspectionState;
  }

  function update(deltaSeconds) {
    if (!animationsEnabled) return false;
    const dt = clamp(finite(deltaSeconds), 0, 0.1);
    if (!(dt > 0)) return false;
    elapsedSeconds += dt;

    const flowStrength = clamp(Math.abs(metrics.flowRateM3s) / 0.03, 0, 3.5);
    const solidsVisible = metrics.solidsMassFraction > 0
      ? clamp(0.45 + metrics.solidsMassFraction * 1.25, 0.45, 1)
      : 0;
    let moved = false;

    motions.forEach((motion) => {
      let speed = 0;
      if (motion.mode === 'mill') speed = solidsVisible > 0 ? 0.72 + flowStrength * 0.10 : 0;
      else if (motion.mode === 'reactor') speed = solidsVisible > 0 ? 0.58 + flowStrength * 0.22 : 0;
      else if (motion.mode === 'cip') speed = solidsVisible > 0 ? 0.78 + flowStrength * 0.24 : 0;
      else if (motion.mode === 'sump') speed = flowStrength * 1.10;
      else if (motion.mode === 'pump') speed = flowStrength * 2.35;
      else if (motion.mode === 'cyclone') speed = flowStrength * 3.10;
      positionMotion(motion, elapsedSeconds, speed);
      if (speed > 0 && solidsVisible > 0) moved = true;
      if (motion.mesh?.metadata?.mineral === 'gold') {
        motion.mesh.metadata = {
          ...(motion.mesh.metadata ?? {}),
          feedGoldKgH: metrics.feedGoldKgH,
          illustrativeWhenGradeUnavailable: metrics.feedGoldKgH <= 0,
        };
      }
    });

    applyInspectionVisibility();
    return moved;
  }

  function setAnimationsEnabled(enabled) {
    animationsEnabled = Boolean(enabled);
    root.metadata = { ...(root.metadata ?? {}), animationsEnabled };
    return animationsEnabled;
  }

  applyInspectionVisibility();

  host.metadata = {
    ...(host.metadata ?? {}),
    b75EquipmentSlurry: {
      equipmentIds: [...equipment.keys()],
      equipmentCount: equipment.size,
      tracerCount: motions.length,
      interiorMeshCount: materialSnapshots.size,
      concentrationNotToScale: true,
      modes: Object.fromEntries(B75_EQUIPMENT_SPECS.map((spec) => [spec.id, spec.mode])),
    },
  };

  return {
    root,
    equipment,
    motions,
    materials,
    setMetrics,
    setInspectionState,
    update,
    setAnimationsEnabled,
    get metrics() { return metrics; },
    get inspectionState() { return inspectionState; },
    dispose() {
      materialSnapshots.forEach((material, mesh) => {
        if (!mesh?.isDisposed?.()) mesh.material = material;
      });
      root.dispose(false, true);
      Object.values(materials).forEach((material) => material.dispose(false, true));
      equipment.clear();
      motions.length = 0;
    },
  };
}
