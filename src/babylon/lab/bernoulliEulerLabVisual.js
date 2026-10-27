import { PointLight } from '@babylonjs/core/Lights/pointLight.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { V57_INSPECTION_NODE_ALIASES } from '../../scene/integration/v57Layout.js';
import { applyB87HydraulicRigVisual } from './b87HydraulicRigVisual.js';

export const B78_LAB_EQUIPMENT_IDS = Object.freeze([
  'SUMP-01',
  'SLURRY-PUMP-01',
  'CLASS-01',
]);

export const B78_LAB_CONNECTION_IDS = Object.freeze([
  'P-SUMP-TO-PUMP',
  'P-PUMP-TO-CYCLONES',
]);

export const B78_LAB_FRAMINGS = Object.freeze({
  overview: Object.freeze({
    center: Object.freeze([205.0, 26.5, -96.0]),
    size: Object.freeze([58.0, 17.0, 28.0]),
    position: Object.freeze([166.0, 43.0, -61.0]),
  }),
  sump: Object.freeze({
    center: Object.freeze([178.5, 23.4, -90.1]),
    size: Object.freeze([15.0, 10.0, 15.0]),
    position: Object.freeze([164.0, 35.0, -72.0]),
  }),
  pump: Object.freeze({
    center: Object.freeze([207.0, 24.2, -90.0]),
    size: Object.freeze([18.0, 12.0, 16.0]),
    position: Object.freeze([190.0, 36.0, -70.0]),
  }),
  cyclones: Object.freeze({
    center: Object.freeze([228.4, 27.5, -103.1]),
    size: Object.freeze([20.0, 19.0, 20.0]),
    position: Object.freeze([210.0, 43.0, -76.0]),
  }),
});

const LAB_MODES = new Set(['realistic', 'didactic', 'presentation']);
const LAB_TARGET_SPECS = Object.freeze(
  [...B78_LAB_EQUIPMENT_IDS, ...B78_LAB_CONNECTION_IDS].map((id) => ({
    id,
    ...aliasesFor(id),
  })),
);

function visitHierarchy(root, callback) {
  callback(root);
  root.getDescendants?.(false)?.forEach(callback);
}

function allV57Nodes(scene) {
  return [
    ...(scene?.transformNodes ?? []),
    ...(scene?.meshes ?? []),
  ].filter((node) => node?.metadata?.v57AuthoritativeVisual === true);
}

function aliasesFor(id) {
  const alias = V57_INSPECTION_NODE_ALIASES[id];
  if (!alias || alias.semanticOnly) return { names: [], prefixes: [] };
  return {
    names: alias.names ?? [],
    prefixes: alias.prefixes ?? [],
  };
}

function collectRelevantMeshes(scene) {
  const relevant = new Set();
  const nodes = allV57Nodes(scene);

  nodes.forEach((node) => {
    const name = String(node?.name ?? '');
    const metadataId = node?.metadata?.equipmentId;
    const connectionId = node?.metadata?.connectionId;
    const direct = B78_LAB_EQUIPMENT_IDS.includes(metadataId)
      || B78_LAB_CONNECTION_IDS.includes(connectionId)
      || name.startsWith('B73_FOUNDATION_SUMP-01')
      || name.startsWith('B73_FOUNDATION_SLURRY-PUMP-01')
      || name.startsWith('B73_FOUNDATION_CLASS-01')
      || name.startsWith('B74_sump-to-pump_')
      || name.startsWith('B74_pump-to-class_')
      || name.startsWith('B75_SUMP-01_')
      || name.startsWith('B75_SLURRY-PUMP-01_')
      || name.startsWith('B75_CLASS-01_');
    const matchedAlias = LAB_TARGET_SPECS.some((spec) => (
      spec.names.includes(name)
      || spec.prefixes.some((prefix) => name.startsWith(prefix))
    ));
    if (!direct && !matchedAlias) return;
    if ('material' in node) relevant.add(node);
    visitHierarchy(node, (child) => {
      if ('material' in child) relevant.add(child);
    });
  });

  return relevant;
}

function material(scene, name, diffuse, emissive = null) {
  const result = new StandardMaterial(name, scene);
  result.diffuseColor = diffuse;
  result.ambientColor = diffuse.scale(0.22);
  result.specularColor = new Color3(0.10, 0.11, 0.11);
  result.specularPower = 18;
  if (emissive) result.emissiveColor = emissive;
  result.metadata = { visualOnly: true, visualBuild: 'B86', bernoulliEulerLab: true };
  return result;
}

function isLabOwnedMesh(mesh) {
  const metadata = mesh?.metadata ?? {};
  return metadata.bernoulliEulerLab === true
    || metadata.labFloor === true
    || metadata.labEdge === true
    || metadata.labPoint != null
    || metadata.labPointLabel === true;
}

function isFlowManagedMesh(mesh) {
  const metadata = mesh?.metadata ?? {};
  return metadata.slurryFlowBody === true
    || metadata.slurryTracer === true
    || metadata.equipmentSlurryTracer === true;
}

function isRelevantGeneratedMesh(mesh) {
  const metadata = mesh?.metadata ?? {};
  const name = String(mesh?.name ?? '');
  if (B78_LAB_EQUIPMENT_IDS.includes(metadata.equipmentId)) return true;
  if (B78_LAB_CONNECTION_IDS.includes(metadata.connectionId)) return true;
  if (metadata.b71HydraulicStudy && ['sump-to-pump', 'pump-to-class'].includes(metadata.seamBridge)) return true;
  return name.startsWith('B73_FOUNDATION_SUMP-01')
    || name.startsWith('B73_FOUNDATION_SLURRY-PUMP-01')
    || name.startsWith('B73_FOUNDATION_CLASS-01');
}

function addMarker(scene, root, id, position, color) {
  const marker = CreateCylinder(`B78_LAB_POINT_${id}`, {
    diameter: 2.0,
    height: 0.10,
    tessellation: 48,
    cap: 3,
  }, scene);
  marker.parent = root;
  marker.position.copyFrom(Vector3.FromArray(position));
  marker.isPickable = false;
  marker.material = material(
    scene,
    `b78-lab-point-${id.toLowerCase()}`,
    color.scale(0.26),
    color.scale(0.62),
  );
  marker.metadata = {
    visualOnly: true,
    visualBuild: 'B86',
    bernoulliEulerLab: true,
    labPoint: id,
    inspectionInterior: true,
  };
  return marker;
}

function addMarkerLabel(scene, root, id, position, color) {
  const label = CreatePlane(`B84_LAB_LABEL_${id}`, {
    width: 3.1,
    height: 1.55,
    sideOrientation: Mesh.DOUBLESIDE,
  }, scene);
  label.parent = root;
  label.position.copyFrom(Vector3.FromArray(position));
  label.position.y += 2.35;
  label.billboardMode = Mesh.BILLBOARDMODE_ALL;
  label.isPickable = false;

  const labelMaterial = new StandardMaterial(`b84-lab-label-${id.toLowerCase()}`, scene);
  labelMaterial.diffuseColor = color.scale(0.18);
  labelMaterial.emissiveColor = color.scale(0.58);
  labelMaterial.specularColor = Color3.Black();
  labelMaterial.backFaceCulling = false;

  let texture = null;
  if (typeof document !== 'undefined') {
    texture = new DynamicTexture(`b84-lab-label-texture-${id.toLowerCase()}`, {
      width: 256,
      height: 128,
    }, scene, false);
    texture.hasAlpha = true;
    texture.drawText(
      id,
      null,
      96,
      'bold 92px Arial',
      '#ffffff',
      'rgba(6,18,24,0.86)',
      true,
      true,
    );
    labelMaterial.diffuseTexture = texture;
    labelMaterial.emissiveTexture = texture;
    labelMaterial.opacityTexture = texture;
  }
  label.material = labelMaterial;
  label.metadata = {
    visualOnly: true,
    visualBuild: 'B86',
    bernoulliEulerLab: true,
    labPoint: id,
    labPointLabel: true,
  };
  return { label, material: labelMaterial, texture };
}

export function applyB78BernoulliEulerLabVisual({ scene, host, rootNodes = [] } = {}) {
  if (!scene || !host) throw new TypeError('B78 lab visual requires scene and host.');

  const root = new TransformNode('B78-BERNOULLI-EULER-LAB', scene);
  root.parent = host;
  root.metadata = {
    visualOnly: true,
    visualBuild: 'B86',
    labView: true,
    bernoulliEulerLab: true,
    isolationStrategy: 'mesh-level-dedicated-stage',
  };

  const concrete = material(scene, 'b78-lab-concrete', new Color3(0.235, 0.255, 0.25));
  concrete.specularColor = new Color3(0.025, 0.028, 0.027);
  concrete.specularPower = 4;
  const edge = material(
    scene,
    'b78-lab-edge',
    new Color3(0.045, 0.075, 0.085),
    new Color3(0.015, 0.075, 0.085),
  );

  const floor = CreateBox('B86_LAB_FLOOR', { width: 66, height: 0.34, depth: 32 }, scene);
  floor.parent = root;
  floor.position.set(205, 20.15, -96);
  floor.material = concrete;
  floor.receiveShadows = true;
  floor.isPickable = false;
  floor.metadata = {
    visualOnly: true,
    visualBuild: 'B86',
    bernoulliEulerLab: true,
    labFloor: true,
  };

  const edgeSpecs = [
    [66, 0.12, 0.16, 205, 20.37, -112],
    [66, 0.12, 0.16, 205, 20.37, -80],
    [0.16, 0.12, 32, 172, 20.37, -96],
    [0.16, 0.12, 32, 238, 20.37, -96],
  ];
  const edges = edgeSpecs.map(([width, height, depth, x, y, z], index) => {
    const strip = CreateBox(`B86_LAB_EDGE_${index + 1}`, { width, height, depth }, scene);
    strip.parent = root;
    strip.position.set(x, y, z);
    strip.material = edge;
    strip.isPickable = false;
    strip.metadata = {
      visualOnly: true,
      visualBuild: 'B86',
      bernoulliEulerLab: true,
      labEdge: true,
    };
    return strip;
  });

  const hydraulicRig = applyB87HydraulicRigVisual({ scene, parent: root });

  const markers = {
    A: addMarker(scene, root, 'A', [184.0, 22.15, -90.0], new Color3(0.15, 0.78, 0.95)),
    B: addMarker(scene, root, 'B', [205.0, 25.15, -90.0], new Color3(0.95, 0.62, 0.15)),
    C: addMarker(scene, root, 'C', [228.2, 26.95, -103.1], new Color3(0.35, 0.92, 0.48)),
  };
  const markerLabels = {
    A: addMarkerLabel(scene, root, 'A', [184.0, 22.15, -90.0], new Color3(0.15, 0.78, 0.95)),
    B: addMarkerLabel(scene, root, 'B', [205.0, 25.15, -90.0], new Color3(0.95, 0.62, 0.15)),
    C: addMarkerLabel(scene, root, 'C', [228.2, 26.95, -103.1], new Color3(0.35, 0.92, 0.48)),
  };

  const lights = [
    new PointLight('B78_LAB_KEY', new Vector3(190, 45, -72), scene),
    new PointLight('B78_LAB_FILL', new Vector3(228, 39, -86), scene),
    new PointLight('B78_LAB_RIM', new Vector3(218, 34, -122), scene),
  ];
  lights[0].diffuse = new Color3(0.96, 0.93, 0.86);
  lights[1].diffuse = new Color3(0.72, 0.86, 0.96);
  lights[2].diffuse = new Color3(0.52, 0.68, 0.82);
  lights[0].intensity = 1.25;
  lights[1].intensity = 0.75;
  lights[2].intensity = 0.55;
  lights.forEach((light) => {
    light.range = 82;
    light.setEnabled(false);
    light.metadata = { visualOnly: true, visualBuild: 'B86', labLight: true, bernoulliEulerLab: true };
  });

  root.setEnabled(false);
  let active = false;
  let mode = 'realistic';
  let relevantMeshes = new Set();
  let meshStateSnapshots = new Map();
  let baseLightSnapshots = new Map();
  let sceneSnapshot = null;
  let elapsed = 0;

  function snapshotAndIsolate() {
    relevantMeshes = collectRelevantMeshes(scene);
    meshStateSnapshots = new Map();
    scene.meshes.forEach((mesh) => {
      if (isLabOwnedMesh(mesh) || isFlowManagedMesh(mesh)) return;
      const keep = relevantMeshes.has(mesh) || isRelevantGeneratedMesh(mesh);
      meshStateSnapshots.set(mesh, {
        isVisible: mesh.isVisible,
        visibility: Number(mesh.visibility),
      });
      if (keep) return;
      mesh.isVisible = false;
      mesh.visibility = 0;
    });

    sceneSnapshot = {
      clearColor: scene.clearColor?.clone?.() ?? null,
      environmentIntensity: Number(scene.environmentIntensity),
      fogEnabled: Boolean(scene.fogEnabled),
    };
    scene.clearColor = new Color4(0.018, 0.027, 0.034, 1);
    if (Number.isFinite(scene.environmentIntensity)) scene.environmentIntensity = 0.42;
    scene.fogEnabled = false;

    baseLightSnapshots = new Map();
    const labLightIds = new Set(lights.map((light) => light.name));
    scene.lights.forEach((light) => {
      if (labLightIds.has(light.name)) return;
      baseLightSnapshots.set(light, {
        enabled: light.isEnabled?.() !== false,
        intensity: Number(light.intensity),
      });
      light.setEnabled?.(false);
    });
    host.metadata = {
      ...(host.metadata ?? {}),
      b86LabIsolationStrategy: 'mesh-level-dedicated-stage',
      b78LabRelevantMeshCount: relevantMeshes.size,
      b86LabHiddenMeshCount: [...meshStateSnapshots.keys()].filter((mesh) => !mesh.isVisible).length,
    };
  }

  function restoreScene() {
    meshStateSnapshots.forEach((snapshot, mesh) => {
      if (mesh?.isDisposed?.()) return;
      mesh.isVisible = snapshot.isVisible;
      if (Number.isFinite(snapshot.visibility)) mesh.visibility = snapshot.visibility;
    });
    baseLightSnapshots.forEach((snapshot, light) => {
      if (light?.isDisposed?.()) return;
      if (Number.isFinite(snapshot.intensity)) light.intensity = snapshot.intensity;
      light.setEnabled?.(snapshot.enabled);
    });
    if (sceneSnapshot) {
      if (sceneSnapshot.clearColor) scene.clearColor = sceneSnapshot.clearColor;
      if (Number.isFinite(sceneSnapshot.environmentIntensity)) {
        scene.environmentIntensity = sceneSnapshot.environmentIntensity;
      }
      scene.fogEnabled = sceneSnapshot.fogEnabled;
    }
    meshStateSnapshots.clear();
    baseLightSnapshots.clear();
    relevantMeshes.clear();
    sceneSnapshot = null;
  }

  function applyLabVisibility() {
    if (!active) return;
    relevantMeshes.forEach((mesh) => {
      if (mesh.metadata?.inspectionInterior) return;
      if (mesh.metadata?.slurryFlowBody || mesh.metadata?.slurryTracer || mesh.metadata?.equipmentSlurryTracer) return;
      const name = String(mesh.name ?? '');
      const shell = /(?:SHELL|BODY|CASING|VOLUTE|BARREL|CONE|PIPE|NOZZLE|SEG\d+|ELBOW)/i.test(name);
      mesh.visibility = shell
        ? (mode === 'realistic' ? 0.88 : mode === 'didactic' ? 0.36 : 0.28)
        : (mode === 'realistic' ? 0.95 : 0.72);
    });
  }

  function applyModeVisibility() {
    const showDidactic = active && (mode === 'didactic' || mode === 'presentation');
    Object.values(markers).forEach((marker) => marker.setEnabled(showDidactic));
    Object.values(markerLabels).forEach(({ label }) => label.setEnabled(showDidactic));
    edges.forEach((strip) => strip.visibility = mode === 'realistic' ? 0.48 : 0.92);
    floor.visibility = mode === 'presentation' ? 0.96 : 0.88;
    hydraulicRig.setMode(mode);
    host.metadata = {
      ...(host.metadata ?? {}),
      b78LabMode: mode,
    };
    applyLabVisibility();
  }

  function setMode(nextMode = 'realistic') {
    mode = LAB_MODES.has(nextMode) ? nextMode : 'realistic';
    applyModeVisibility();
    return mode;
  }

  function setActive(nextActive, nextMode = mode) {
    const next = Boolean(nextActive);
    if (next === active) {
      setMode(nextMode);
      return active;
    }
    active = next;
    if (active) {
      snapshotAndIsolate();
      root.setEnabled(true);
      lights.forEach((light) => light.setEnabled(true));
      setMode(nextMode);
    } else {
      restoreScene();
      root.setEnabled(false);
      lights.forEach((light) => light.setEnabled(false));
    }
    host.metadata = {
      ...(host.metadata ?? {}),
      b78LabActive: active,
      b78LabMode: mode,
    };
    return active;
  }

  function update(deltaSeconds) {
    if (!active || (mode !== 'didactic' && mode !== 'presentation')) return false;
    const dt = Math.max(0, Math.min(0.1, Number(deltaSeconds) || 0));
    if (!(dt > 0)) return false;
    elapsed += dt;
    const pulse = 1 + Math.sin(elapsed * 3.2) * (mode === 'presentation' ? 0.08 : 0.045);
    Object.values(markers).forEach((marker, index) => {
      const phase = 1 + Math.sin(elapsed * 3.2 + index * 0.8) * 0.035;
      marker.scaling.setAll(pulse * phase);
    });
    return true;
  }

  return {
    root,
    floor,
    edges,
    markers,
    markerLabels,
    hydraulicRig,
    lights,
    setActive,
    setMode,
    update,
    get active() { return active; },
    get mode() { return mode; },
    get framing() { return B78_LAB_FRAMINGS; },
    dispose() {
      if (active) restoreScene();
      lights.forEach((light) => light.dispose());
      root.dispose(false, true);
      concrete.dispose(false, true);
      edge.dispose(false, true);
      Object.values(markers).forEach((marker) => marker.material?.dispose?.(false, true));
      Object.values(markerLabels).forEach(({ label, material: labelMaterial, texture }) => {
        label.dispose(false, false);
        labelMaterial.dispose(false, false);
        texture?.dispose?.();
      });
      hydraulicRig.dispose();
    },
  };
}

