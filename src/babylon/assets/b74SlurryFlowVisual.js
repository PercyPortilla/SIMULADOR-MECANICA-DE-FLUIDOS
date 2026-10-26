import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';

export const B74_FLOW_SPECS = Object.freeze([
  Object.freeze({
    id: 'mill-to-sump',
    connectionId: 'P-MILL-TO-SUMP',
    sourceEquipmentId: 'MILL-01',
    targetEquipmentId: 'SUMP-01',
    diameterM: 0.40,
    sourceAnchor: Object.freeze([151.94, 25.40, -87.81]),
    targetAnchor: Object.freeze([178.50, 22.99, -90.11]),
  }),
  Object.freeze({
    id: 'sump-to-pump',
    connectionId: 'P-SUMP-TO-PUMP',
    sourceEquipmentId: 'SUMP-01',
    targetEquipmentId: 'SLURRY-PUMP-01',
    diameterM: 0.30,
    sourceAnchor: Object.freeze([178.50, 22.99, -90.11]),
    targetAnchor: Object.freeze([206.97, 23.62, -90.00]),
  }),
  Object.freeze({
    id: 'pump-to-class',
    connectionId: 'P-PUMP-TO-CYCLONES',
    sourceEquipmentId: 'SLURRY-PUMP-01',
    targetEquipmentId: 'CLASS-01',
    diameterM: 0.25,
    sourceAnchor: Object.freeze([206.97, 23.62, -90.00]),
    targetAnchor: Object.freeze([228.41, 26.84, -103.06]),
  }),
  Object.freeze({
    id: 'class-to-r01',
    connectionId: 'P-CLASSIFICATION-TO-LEACH',
    sourceEquipmentId: 'CLASS-01',
    targetEquipmentId: 'R-01',
    diameterM: 0.22,
    sourceAnchor: Object.freeze([228.41, 26.84, -103.06]),
    targetAnchor: Object.freeze([268.0, 29.78, -88.0]),
    maxGapM: 28,
    velocityBasis: 'main-throughput-proxy-no-branch-balance',
  }),
  Object.freeze({
    id: 'r01-to-r02',
    connectionId: 'P-LEACH-R01-R02',
    sourceEquipmentId: 'R-01',
    targetEquipmentId: 'R-02',
    diameterM: 0.25,
    sourceAnchor: Object.freeze([268.0, 29.78, -88.0]),
    targetAnchor: Object.freeze([300.0, 29.75, -88.0]),
    maxGapM: 24,
    velocityBasis: 'main-throughput-proxy-no-branch-balance',
  }),
  Object.freeze({
    id: 'r02-to-r03',
    connectionId: 'P-LEACH-R02-R03',
    sourceEquipmentId: 'R-02',
    targetEquipmentId: 'R-03',
    diameterM: 0.25,
    sourceAnchor: Object.freeze([300.0, 29.75, -88.0]),
    targetAnchor: Object.freeze([300.0, 29.72, -122.0]),
    maxGapM: 24,
    velocityBasis: 'main-throughput-proxy-no-branch-balance',
  }),
  Object.freeze({
    id: 'r03-to-r04',
    connectionId: 'P-LEACH-R03-R04',
    sourceEquipmentId: 'R-03',
    targetEquipmentId: 'R-04',
    diameterM: 0.25,
    sourceAnchor: Object.freeze([300.0, 29.72, -122.0]),
    targetAnchor: Object.freeze([332.0, 29.69, -122.0]),
    maxGapM: 24,
    velocityBasis: 'main-throughput-proxy-no-branch-balance',
  }),
  Object.freeze({
    id: 'r04-to-cip',
    connectionId: 'P-PUMP-01-TO-CIP',
    inspectionIds: Object.freeze(['P-LEACHING-TO-PUMP-01', 'PUMP-01', 'P-PUMP-01-TO-CIP']),
    sourceEquipmentId: 'R-04',
    targetEquipmentId: 'CIP-ADSORPTION',
    diameterM: 0.22,
    sourceAnchor: Object.freeze([332.0, 29.69, -122.0]),
    targetAnchor: Object.freeze([392.0, 29.15, -104.0]),
    maxGapM: 32,
    velocityBasis: 'main-throughput-proxy-no-branch-balance',
  }),
]);

export const B76_SLURRY_DIAMETER_RATIO = 0.82;
const INSPECTION_REVEAL_MODES = new Set(['transparent', 'cutaway', 'interior']);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function finite(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

export function calculateB74PathVelocityMps(flowRateM3s, diameterM, fallbackVelocityMps = 0) {
  const q = finite(flowRateM3s);
  const diameter = finite(diameterM);
  if (Math.abs(q) > 1e-12 && diameter > 0) {
    const area = Math.PI * diameter * diameter / 4;
    return q / area;
  }
  return finite(fallbackVelocityMps);
}

function visitHierarchy(root, callback) {
  callback(root);
  root.getDescendants?.(false)?.forEach(callback);
}

function allMeshes(rootNodes) {
  const meshes = [];
  const seen = new Set();
  rootNodes.forEach((root) => visitHierarchy(root, (node) => {
    if (!node?.getBoundingInfo || !('material' in node) || seen.has(node)) return;
    seen.add(node);
    meshes.push(node);
  }));
  return meshes;
}

function matchesSpec(name, specId) {
  if (specId === 'mill-to-sump') {
    return name === 'MILL-01_TROMMEL_DISCHARGE'
      || name === 'SUMP-01_INLET_PIPE'
      || name.startsWith('V57_MILL_TO_SUMP_');
  }
  if (specId === 'sump-to-pump') {
    return name === 'SUMP-01_SUCTION_NOZZLE'
      || name === 'SLURRY-PUMP-01_VOLUTE'
      || /^SLURRY-PUMP-01_SUCTION_(?:SEG\d+|ELBOW_\d+|FLUID)/.test(name);
  }
  if (specId === 'pump-to-class') {
    return name === 'SLURRY-PUMP-01_DISCHARGE_PIPE'
      || /^CLASS-01_FEED_LINE_(?:SEG\d+|ELBOW_\d+|FLUID)/.test(name);
  }
  if (specId === 'class-to-r01') {
    return name.startsWith('CLASS-01_OVERFLOW_TO_LEACH_')
      || name === 'V52_PIPE_CLASS_OVERFLOW_TO_R01';
  }
  if (specId === 'r01-to-r02') return name.startsWith('LEACH_TRANSFER_1') || name === 'V39_PIPE_R01_TO_R02';
  if (specId === 'r02-to-r03') return name.startsWith('LEACH_TRANSFER_2') || name === 'V39_PIPE_R02_TO_R03';
  if (specId === 'r03-to-r04') return name.startsWith('LEACH_TRANSFER_3') || name === 'V39_PIPE_R03_TO_R04';
  if (specId === 'r04-to-cip') {
    return name.startsWith('LEACH_TO_CIP')
      || name.startsWith('B52_R04_TO_PUMP_')
      || name.startsWith('B52_PUMP_TO_CIP_')
      || name === 'V37_PIPE_R04_TO_PUMP'
      || name === 'V52_PIPE_PUMP_TO_CIP';
  }
  return false;
}

function worldCenterAndAxisPoints(mesh) {
  mesh.computeWorldMatrix?.(true);
  const info = mesh.getBoundingInfo?.();
  const box = info?.boundingBox;
  if (!box) return [];
  const minimum = box.minimum;
  const maximum = box.maximum;
  const center = Vector3.Center(minimum, maximum);
  const size = maximum.subtract(minimum);
  const values = [size.x, size.y, size.z];
  const longestIndex = values.indexOf(Math.max(...values));
  const longest = values[longestIndex];
  const sorted = [...values].sort((a, b) => b - a);
  const ratio = longest / Math.max(0.001, sorted[1] || 0.001);
  const world = mesh.getWorldMatrix?.();
  if (!world) return [box.centerWorld.clone()];

  if (longest < 0.45 || ratio < 1.55) return [box.centerWorld.clone()];
  const half = longest * 0.46;
  const a = center.clone();
  const b = center.clone();
  if (longestIndex === 0) {
    a.x -= half;
    b.x += half;
  } else if (longestIndex === 1) {
    a.y -= half;
    b.y += half;
  } else {
    a.z -= half;
    b.z += half;
  }
  return [
    Vector3.TransformCoordinates(a, world),
    Vector3.TransformCoordinates(b, world),
  ];
}

function dedupePoints(points, toleranceM = 0.08) {
  const result = [];
  points.forEach((point) => {
    if (!point || ![point.x, point.y, point.z].every(Number.isFinite)) return;
    if (result.some((existing) => Vector3.Distance(existing, point) <= toleranceM)) return;
    result.push(point.clone());
  });
  return result;
}

export function orderB74RoutePoints(points, sourceAnchor, targetAnchor) {
  const remaining = dedupePoints(points);
  if (remaining.length < 2) return remaining;
  const source = sourceAnchor instanceof Vector3 ? sourceAnchor : Vector3.FromArray(sourceAnchor);
  const target = targetAnchor instanceof Vector3 ? targetAnchor : Vector3.FromArray(targetAnchor);
  let currentIndex = 0;
  let bestStart = Infinity;
  remaining.forEach((point, index) => {
    const score = Vector3.Distance(point, source);
    if (score < bestStart) {
      bestStart = score;
      currentIndex = index;
    }
  });
  const ordered = [remaining.splice(currentIndex, 1)[0]];
  while (remaining.length) {
    const current = ordered.at(-1);
    let bestIndex = 0;
    let bestScore = Infinity;
    remaining.forEach((point, index) => {
      const localDistance = Vector3.Distance(current, point);
      const targetBias = Vector3.Distance(point, target) * 0.035;
      const score = localDistance + targetBias;
      if (score < bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });
    ordered.push(remaining.splice(bestIndex, 1)[0]);
  }
  const firstTargetDistance = Vector3.Distance(ordered[0], target);
  const lastTargetDistance = Vector3.Distance(ordered.at(-1), target);
  if (firstTargetDistance < lastTargetDistance) ordered.reverse();
  return dedupePoints(ordered, 0.10);
}

function contiguousRoute(points, maxGapM = 18) {
  if (points.length < 2) return points;
  const groups = [];
  let current = [points[0]];
  for (let index = 1; index < points.length; index += 1) {
    if (Vector3.Distance(points[index - 1], points[index]) > maxGapM) {
      groups.push(current);
      current = [points[index]];
    } else {
      current.push(points[index]);
    }
  }
  groups.push(current);
  const length = (route) => route.slice(0, -1)
    .reduce((sum, point, index) => sum + Vector3.Distance(point, route[index + 1]), 0);
  return groups.sort((a, b) => length(b) - length(a))[0] ?? [];
}

function routeLength(points) {
  return points.slice(0, -1)
    .reduce((sum, point, index) => sum + Vector3.Distance(point, points[index + 1]), 0);
}

function pointAtDistance(points, distanceM) {
  if (points.length < 2) return points[0]?.clone?.() ?? Vector3.Zero();
  const total = routeLength(points);
  if (total <= 1e-8) return points[0].clone();
  let remaining = ((distanceM % total) + total) % total;
  for (let index = 0; index < points.length - 1; index += 1) {
    const length = Vector3.Distance(points[index], points[index + 1]);
    if (remaining <= length || index === points.length - 2) {
      return Vector3.Lerp(points[index], points[index + 1], length > 1e-8 ? remaining / length : 0);
    }
    remaining -= length;
  }
  return points.at(-1).clone();
}

function alignCylinder(mesh, start, end) {
  const direction = end.subtract(start);
  const length = direction.length();
  if (length <= 1e-8) return false;
  mesh.position.copyFrom(Vector3.Lerp(start, end, 0.5));
  const rotation = Quaternion.Identity();
  Quaternion.FromUnitVectorsToRef(Vector3.Up(), direction.normalize(), rotation);
  mesh.rotationQuaternion = rotation;
  return true;
}

function createMaterials(scene) {
  const slurry = new StandardMaterial('b74-slurry-body', scene);
  slurry.diffuseColor = new Color3(0.34, 0.235, 0.14);
  slurry.emissiveColor = new Color3(0.055, 0.032, 0.016);
  slurry.specularColor = new Color3(0.055, 0.045, 0.035);
  slurry.alpha = 0.88;
  slurry.backFaceCulling = false;

  const quartz = new StandardMaterial('b74-quartz-tracer', scene);
  quartz.diffuseColor = new Color3(0.72, 0.70, 0.64);
  quartz.specularColor = new Color3(0.13, 0.13, 0.12);

  const pyrite = new StandardMaterial('b74-pyrite-tracer', scene);
  pyrite.diffuseColor = new Color3(0.43, 0.33, 0.09);
  pyrite.specularColor = new Color3(0.55, 0.44, 0.14);
  pyrite.specularPower = 30;

  const gold = new StandardMaterial('b74-gold-tracer', scene);
  gold.diffuseColor = new Color3(0.88, 0.61, 0.08);
  gold.emissiveColor = new Color3(0.045, 0.025, 0.002);
  gold.specularColor = new Color3(0.85, 0.67, 0.20);
  gold.specularPower = 42;

  return { slurry, quartz, pyrite, gold };
}

function createFluidBody(scene, root, spec, points, material) {
  const segments = [];
  points.slice(0, -1).forEach((start, index) => {
    const end = points[index + 1];
    const length = Vector3.Distance(start, end);
    if (length <= 0.08 || length > (spec.maxGapM ?? 18)) return;
    const segment = CreateCylinder('B74_' + spec.id + '_SLURRY_' + String(index + 1).padStart(2, '0'), {
      height: length,
      diameter: spec.diameterM * B76_SLURRY_DIAMETER_RATIO,
      tessellation: 14,
      cap: 3,
    }, scene);
    segment.parent = root;
    if (!alignCylinder(segment, start, end)) {
      segment.dispose();
      return;
    }
    segment.material = material;
    segment.isPickable = false;
    segment.renderingGroupId = 2;
    segment.metadata = {
      visualOnly: true,
      visualBuild: 'B74',
      v57AuthoritativeVisual: true,
      inspectionInterior: true,
      inspectionRole: 'interior',
      slurryFlowBody: true,
      connectionId: spec.connectionId,
      processKind: 'slurry',
      velocityBasis: spec.velocityBasis ?? 'Q-over-A',
    };
    segments.push(segment);
  });
  return segments;
}

function tracerKind(index) {
  const cycle = index % 18;
  if (cycle === 5 || cycle === 14) return 'gold';
  if ([2, 7, 10, 16].includes(cycle)) return 'pyrite';
  return 'quartz';
}

function createTracers(scene, root, spec, points, materials) {
  const totalLengthM = Math.max(0.1, routeLength(points));
  // B76 prefers fewer, larger tracers over hundreds of tiny meshes.
  const count = clamp(Math.round(totalLengthM * 1.15), 10, 20);
  const tracers = [];
  for (let index = 0; index < count; index += 1) {
    const kind = tracerKind(index);
    const diameter = kind === 'gold'
      ? Math.min(0.055, spec.diameterM * 0.16)
      : kind === 'pyrite'
        ? Math.min(0.070, spec.diameterM * 0.20)
        : Math.min(0.085, spec.diameterM * 0.24);
    const tracer = CreateSphere('B74_' + spec.id + '_' + kind.toUpperCase() + '_' + String(index + 1).padStart(2, '0'), {
      diameter: Math.max(0.028, diameter),
      segments: kind === 'gold' ? 6 : 4,
    }, scene);
    tracer.parent = root;
    tracer.position.copyFrom(pointAtDistance(points, totalLengthM * index / count));
    tracer.material = materials[kind];
    tracer.isPickable = false;
    tracer.renderingGroupId = 3;
    tracer.metadata = {
      visualOnly: true,
      visualBuild: 'B74',
      v57AuthoritativeVisual: true,
      inspectionInterior: true,
      inspectionRole: 'interior',
      slurryTracer: true,
      mineral: kind,
      connectionId: spec.connectionId,
      phaseM: totalLengthM * index / count,
      concentrationNotToScale: true,
      disseminated: kind === 'gold',
    };
    tracers.push(tracer);
  }
  return { tracers, totalLengthM };
}

function buildPath(scene, root, meshes, spec, materials) {
  const matching = meshes.filter((mesh) => matchesSpec(String(mesh.name ?? ''), spec.id));
  const candidatePoints = matching.flatMap(worldCenterAndAxisPoints);
  const ordered = orderB74RoutePoints(candidatePoints, spec.sourceAnchor, spec.targetAnchor);
  const points = contiguousRoute(ordered, spec.maxGapM ?? 18);
  if (points.length < 2 || routeLength(points) < 0.25) {
    return {
      spec,
      points,
      matching,
      fluidSegments: [],
      tracers: [],
      totalLengthM: 0,
      velocityMps: 0,
      skipped: true,
    };
  }
  const fluidSegments = createFluidBody(scene, root, spec, points, materials.slurry);
  const tracerResult = createTracers(scene, root, spec, points, materials);
  return {
    spec,
    points,
    matching,
    fluidSegments,
    tracers: tracerResult.tracers,
    totalLengthM: tracerResult.totalLengthM,
    velocityMps: 0,
    skipped: false,
  };
}

export function applyB74SlurryFlowVisual({ scene, rootNodes = [], host } = {}) {
  if (!scene || !host) throw new TypeError('B74 slurry flow visual requires scene and host.');
  const root = new TransformNode('B74-SLURRY-FLOW-VISUALS', scene);
  root.parent = host;
  root.metadata = {
    visualOnly: true,
    visualBuild: 'B74',
    v57AuthoritativeVisual: true,
    solverPolicy: 'read-only visual consumer',
    concentrationNotToScale: true,
  };
  const materials = createMaterials(scene);
  const meshes = allMeshes(rootNodes);
  const paths = B74_FLOW_SPECS.map((spec) => buildPath(scene, root, meshes, spec, materials));
  let animationsEnabled = true;
  let inspectionState = Object.freeze({ targetId: null, mode: 'normal' });
  let metrics = Object.freeze({
    flowRateM3s: 0,
    imposedFlowRateM3s: 0,
    fallbackVelocityMps: 0,
    solidsMassFraction: 0,
    solidVolumeFraction: 0,
    densityKgM3: 0,
    feedGoldKgH: 0,
    basis: 'transport-imposed-flow',
  });

  function setMetrics(next = {}) {
    const flowRateM3s = finite(next.flowRateM3s);
    const imposedFlowRateM3s = finite(next.imposedFlowRateM3s, flowRateM3s);
    const fallbackVelocityMps = finite(next.velocityMps);
    const solidsMassFraction = clamp(finite(next.solidsMassFraction), 0, 1);
    const solidVolumeFraction = clamp(finite(next.solidVolumeFraction), 0, 1);
    const densityKgM3 = Math.max(0, finite(next.densityKgM3));
    const feedGoldKgH = Math.max(0, finite(next.feedGoldKgH));
    metrics = Object.freeze({
      flowRateM3s,
      imposedFlowRateM3s,
      fallbackVelocityMps,
      solidsMassFraction,
      solidVolumeFraction,
      densityKgM3,
      feedGoldKgH,
      basis: String(next.basis || 'transport-imposed-flow'),
    });

    const darkness = 0.10 * solidsMassFraction;
    materials.slurry.diffuseColor = new Color3(
      0.34 - darkness,
      0.245 - darkness * 0.72,
      0.155 - darkness * 0.48,
    );
    materials.slurry.alpha = clamp(0.82 + solidVolumeFraction * 0.18, 0.82, 0.96);

    paths.forEach((path) => {
      path.velocityMps = calculateB74PathVelocityMps(flowRateM3s, path.spec.diameterM, fallbackVelocityMps);
      path.tracers.forEach((tracer) => {
        if (tracer.metadata?.mineral === 'gold') {
          tracer.metadata = {
            ...(tracer.metadata ?? {}),
            feedGoldKgH,
            illustrativeWhenGradeUnavailable: feedGoldKgH <= 0,
          };
        }
        tracer.metadata = {
          ...(tracer.metadata ?? {}),
          metricVisibility: solidsMassFraction > 0 || feedGoldKgH > 0 ? 1 : 0.28,
        };
      });
    });

    root.metadata = {
      ...(root.metadata ?? {}),
      flowRateM3s,
      imposedFlowRateM3s,
      flowBasis: metrics.basis,
      solidsMassFraction,
      solidVolumeFraction,
      densityKgM3,
      feedGoldKgH,
      pathVelocitiesMps: Object.fromEntries(paths.map((path) => [path.spec.connectionId, path.velocityMps])),
      pathVelocityBasis: Object.fromEntries(paths.map((path) => [
        path.spec.connectionId,
        path.spec.velocityBasis ?? 'Q-over-A',
      ])),
      direction: flowRateM3s < 0 ? 'target-to-source' : 'source-to-target',
    };
    applyInspectionVisibility();
    return metrics;
  }

  function pathMatchesInspection(path, targetId) {
    if (!targetId) return false;
    return targetId === path.spec.connectionId
      || targetId === path.spec.sourceEquipmentId
      || targetId === path.spec.targetEquipmentId
      || path.spec.inspectionIds?.includes?.(targetId) === true;
  }

  function applyInspectionVisibility() {
    const reveal = INSPECTION_REVEAL_MODES.has(inspectionState.mode);
    paths.forEach((path) => {
      const relevant = pathMatchesInspection(path, inspectionState.targetId);
      const fluidVisibility = reveal
        ? (relevant ? 1 : 0.025)
        : (relevant ? 0.10 : 0.015);
      path.fluidSegments.forEach((segment) => {
        segment.visibility = fluidVisibility;
      });
      path.tracers.forEach((tracer) => {
        const metricVisibility = finite(tracer.metadata?.metricVisibility, 0);
        tracer.visibility = reveal && relevant
          ? metricVisibility
          : (!reveal && relevant ? metricVisibility * 0.08 : 0);
      });
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
    let moved = false;
    paths.forEach((path) => {
      if (path.skipped || !(path.totalLengthM > 0) || Math.abs(path.velocityMps) <= 1e-9) return;
      path.tracers.forEach((tracer) => {
        const nextPhase = finite(tracer.metadata?.phaseM) + path.velocityMps * dt;
        const wrapped = ((nextPhase % path.totalLengthM) + path.totalLengthM) % path.totalLengthM;
        tracer.metadata.phaseM = wrapped;
        tracer.position.copyFrom(pointAtDistance(path.points, wrapped));
      });
      moved = true;
    });
    return moved;
  }

  function setAnimationsEnabled(enabled) {
    animationsEnabled = Boolean(enabled);
    root.metadata = { ...(root.metadata ?? {}), animationsEnabled };
    return animationsEnabled;
  }

  applyInspectionVisibility();

  const availablePaths = paths.filter((path) => !path.skipped);
  host.metadata = {
    ...(host.metadata ?? {}),
    b74SlurryFlow: {
      pathCount: availablePaths.length,
      skippedConnectionIds: paths.filter((path) => path.skipped).map((path) => path.spec.connectionId),
      tracerCount: paths.reduce((sum, path) => sum + path.tracers.length, 0),
      fluidSegmentCount: paths.reduce((sum, path) => sum + path.fluidSegments.length, 0),
      mineralKinds: ['quartz', 'pyrite', 'gold'],
      concentrationNotToScale: true,
    },
  };

  return {
    root,
    paths,
    materials,
    setMetrics,
    setInspectionState,
    update,
    setAnimationsEnabled,
    get metrics() { return metrics; },
    get inspectionState() { return inspectionState; },
    dispose() {
      root.dispose(false, true);
      Object.values(materials).forEach((material) => material.dispose(false, true));
    },
  };
}
