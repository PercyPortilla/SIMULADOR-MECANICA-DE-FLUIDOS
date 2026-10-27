import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';

const ACCESSORY_MODE = new Set(['realistic', 'didactic', 'presentation']);

function pbrMaterial(scene, name, color, {
  metallic = 0.72,
  roughness = 0.30,
  alpha = 1,
  emissive = null,
} = {}) {
  const result = new PBRMaterial(name, scene);
  result.albedoColor = color;
  result.metallic = metallic;
  result.roughness = roughness;
  result.alpha = alpha;
  result.transparencyMode = alpha < 1 ? PBRMaterial.PBRMATERIAL_ALPHABLEND : null;
  if (emissive) result.emissiveColor = emissive;
  result.metadata = { visualOnly: true, visualBuild: 'B87', bernoulliEulerLab: true };
  return result;
}

function labMetadata(accessoryType, extra = {}) {
  return {
    visualOnly: true,
    visualBuild: 'B87',
    bernoulliEulerLab: true,
    labHydraulicRig: true,
    labAccessoryType: accessoryType,
    ...extra,
  };
}

function orientationFromUp(direction) {
  const dir = direction.normalizeToNew();
  const up = Vector3.Up();
  const dot = Math.max(-1, Math.min(1, Vector3.Dot(up, dir)));
  if (dot > 0.999999) return Quaternion.Identity();
  if (dot < -0.999999) return Quaternion.RotationAxis(Vector3.Right(), Math.PI);
  const axis = Vector3.Cross(up, dir).normalize();
  return Quaternion.RotationAxis(axis, Math.acos(dot));
}

function placeBetween(mesh, from, to) {
  const start = Vector3.FromArray(from);
  const end = Vector3.FromArray(to);
  const direction = end.subtract(start);
  mesh.position.copyFrom(Vector3.Center(start, end));
  mesh.rotationQuaternion = orientationFromUp(direction);
  return direction.length();
}

function createPipeBand(scene, parent, name, position, direction, material, accessoryType = 'flange') {
  const band = CreateTorus(name, {
    diameter: 0.72,
    thickness: 0.12,
    tessellation: 40,
  }, scene);
  band.parent = parent;
  band.position.copyFrom(Vector3.FromArray(position));
  band.rotationQuaternion = orientationFromUp(Vector3.FromArray(direction));
  band.material = material;
  band.isPickable = false;
  band.metadata = labMetadata(accessoryType);
  return band;
}

function createInspectionWindow(scene, parent, name, from, to, materials, connectionId) {
  const start = Vector3.FromArray(from);
  const end = Vector3.FromArray(to);
  const length = Vector3.Distance(start, end);

  const glass = CreateCylinder(`${name}_GLASS`, {
    height: length,
    diameter: 0.64,
    tessellation: 48,
    cap: 3,
  }, scene);
  glass.parent = parent;
  placeBetween(glass, from, to);
  glass.material = materials.glass;
  glass.isPickable = false;
  glass.metadata = labMetadata('inspection-window', { connectionId });

  const inlet = createPipeBand(scene, parent, `${name}_FLANGE_IN`, from, end.subtract(start).asArray(), materials.steel);
  inlet.metadata.connectionId = connectionId;
  const outlet = createPipeBand(scene, parent, `${name}_FLANGE_OUT`, to, end.subtract(start).asArray(), materials.steel);
  outlet.metadata.connectionId = connectionId;
  return { glass, inlet, outlet };
}

function createSupport(scene, parent, name, position, topY, materials) {
  const [x, , z] = position;
  const baseY = 20.45;
  const height = Math.max(0.8, topY - baseY);
  const base = CreateBox(`${name}_BASE`, { width: 1.5, height: 0.18, depth: 1.25 }, scene);
  base.parent = parent;
  base.position.set(x, baseY, z);
  base.material = materials.darkSteel;
  base.receiveShadows = true;
  base.isPickable = false;
  base.metadata = labMetadata('support');

  const post = CreateBox(`${name}_POST`, { width: 0.22, height, depth: 0.22 }, scene);
  post.parent = parent;
  post.position.set(x, baseY + height * 0.5, z);
  post.material = materials.steel;
  post.receiveShadows = true;
  post.isPickable = false;
  post.metadata = labMetadata('support');

  const saddle = CreateBox(`${name}_SADDLE`, { width: 1.05, height: 0.16, depth: 0.42 }, scene);
  saddle.parent = parent;
  saddle.position.set(x, topY, z);
  saddle.material = materials.darkSteel;
  saddle.isPickable = false;
  saddle.metadata = labMetadata('support');
  return { base, post, saddle };
}

function createValve(scene, parent, materials) {
  const bodyFrom = [212.8, 24.40, -91.25];
  const bodyTo = [214.4, 24.75, -92.15];
  const body = CreateCylinder('B87_LAB_DISCHARGE_VALVE_BODY', {
    height: Vector3.Distance(Vector3.FromArray(bodyFrom), Vector3.FromArray(bodyTo)),
    diameter: 0.72,
    tessellation: 40,
  }, scene);
  body.parent = parent;
  placeBetween(body, bodyFrom, bodyTo);
  body.material = materials.darkSteel;
  body.isPickable = false;
  body.metadata = labMetadata('valve', { connectionId: 'P-PUMP-TO-CYCLONES' });

  const stem = CreateCylinder('B87_LAB_DISCHARGE_VALVE_STEM', {
    height: 1.25,
    diameter: 0.12,
    tessellation: 24,
  }, scene);
  stem.parent = parent;
  stem.position.set(213.62, 25.40, -91.72);
  stem.material = materials.steel;
  stem.isPickable = false;
  stem.metadata = labMetadata('valve', { connectionId: 'P-PUMP-TO-CYCLONES' });

  const wheel = CreateTorus('B87_LAB_DISCHARGE_VALVE_WHEEL', {
    diameter: 1.10,
    thickness: 0.10,
    tessellation: 40,
  }, scene);
  wheel.parent = parent;
  wheel.position.set(213.62, 26.03, -91.72);
  wheel.material = materials.safety;
  wheel.isPickable = false;
  wheel.metadata = labMetadata('valve', { connectionId: 'P-PUMP-TO-CYCLONES' });
  return { body, stem, wheel };
}

function createReducer(scene, parent, materials) {
  const from = [202.7, 23.55, -90.02];
  const to = [204.9, 23.60, -90.01];
  const reducer = CreateCylinder('B87_LAB_SUCTION_REDUCER', {
    height: Vector3.Distance(Vector3.FromArray(from), Vector3.FromArray(to)),
    diameterTop: 0.42,
    diameterBottom: 0.62,
    tessellation: 48,
    cap: 3,
  }, scene);
  reducer.parent = parent;
  placeBetween(reducer, from, to);
  reducer.material = materials.steel;
  reducer.isPickable = false;
  reducer.metadata = labMetadata('reducer', { connectionId: 'P-SUMP-TO-PUMP' });
  return reducer;
}

function createFloorGrid(scene, parent, materials) {
  const lines = [];
  for (let x = 176; x <= 234; x += 4) {
    const line = CreateBox(`B87_LAB_GRID_X_${x}`, { width: 0.025, height: 0.015, depth: 27 }, scene);
    line.parent = parent;
    line.position.set(x, 20.335, -96);
    line.material = materials.grid;
    line.isPickable = false;
    line.metadata = labMetadata('floor-grid');
    lines.push(line);
  }
  for (let z = -108; z <= -84; z += 4) {
    const line = CreateBox(`B87_LAB_GRID_Z_${Math.abs(z)}`, { width: 61, height: 0.015, depth: 0.025 }, scene);
    line.parent = parent;
    line.position.set(205, 20.335, z);
    line.material = materials.grid;
    line.isPickable = false;
    line.metadata = labMetadata('floor-grid');
    lines.push(line);
  }
  return lines;
}

export function applyB87HydraulicRigVisual({ scene, parent } = {}) {
  if (!scene || !parent) throw new TypeError('B87 hydraulic lab rig requires scene and parent.');

  const root = new TransformNode('B87-BERNOULLI-EULER-HYDRAULIC-RIG', scene);
  root.parent = parent;
  root.metadata = labMetadata('rig-root');

  const materials = {
    steel: pbrMaterial(scene, 'b87-lab-stainless-steel', new Color3(0.54, 0.58, 0.61), { metallic: 0.92, roughness: 0.20 }),
    darkSteel: pbrMaterial(scene, 'b87-lab-dark-steel', new Color3(0.075, 0.095, 0.11), { metallic: 0.82, roughness: 0.28 }),
    safety: pbrMaterial(scene, 'b87-lab-safety-yellow', new Color3(0.91, 0.61, 0.08), { metallic: 0.55, roughness: 0.30 }),
    glass: pbrMaterial(scene, 'b87-lab-inspection-glass', new Color3(0.42, 0.78, 0.88), { metallic: 0.08, roughness: 0.08, alpha: 0.22 }),
    grid: pbrMaterial(scene, 'b87-lab-grid', new Color3(0.18, 0.34, 0.42), { metallic: 0.25, roughness: 0.55, alpha: 0.72, emissive: new Color3(0.025, 0.07, 0.09) }),
  };

  const grid = createFloorGrid(scene, root, materials);
  const suctionWindow = createInspectionWindow(
    scene,
    root,
    'B87_LAB_SUCTION_WINDOW',
    [188.6, 23.02, -90.07],
    [194.6, 23.15, -90.04],
    materials,
    'P-SUMP-TO-PUMP',
  );
  const dischargeWindow = createInspectionWindow(
    scene,
    root,
    'B87_LAB_DISCHARGE_WINDOW',
    [216.0, 25.15, -94.0],
    [220.0, 25.85, -96.5],
    materials,
    'P-PUMP-TO-CYCLONES',
  );
  const reducer = createReducer(scene, root, materials);
  const valve = createValve(scene, root, materials);
  const supports = [
    createSupport(scene, root, 'B87_LAB_SUPPORT_01', [187.4, 0, -90.05], 22.65, materials),
    createSupport(scene, root, 'B87_LAB_SUPPORT_02', [196.2, 0, -90.02], 22.78, materials),
    createSupport(scene, root, 'B87_LAB_SUPPORT_03', [215.8, 0, -93.8], 24.60, materials),
    createSupport(scene, root, 'B87_LAB_SUPPORT_04', [221.1, 0, -97.2], 25.30, materials),
  ];

  const accentFlanges = [
    createPipeBand(scene, root, 'B87_LAB_FLANGE_SUCTION_A', [184.1, 23.0, -90.08], [1, 0, 0], materials.steel),
    createPipeBand(scene, root, 'B87_LAB_FLANGE_PUMP_IN', [205.4, 23.58, -90.01], [1, 0, 0], materials.steel),
    createPipeBand(scene, root, 'B87_LAB_FLANGE_PUMP_OUT', [208.5, 23.9, -90.4], [1, 0.15, -0.2], materials.steel),
  ];

  let mode = 'realistic';
  function setMode(nextMode = 'realistic') {
    mode = ACCESSORY_MODE.has(nextMode) ? nextMode : 'realistic';
    materials.glass.alpha = mode === 'realistic' ? 0.22 : mode === 'didactic' ? 0.42 : 0.52;
    materials.grid.alpha = mode === 'realistic' ? 0.42 : 0.76;
    return mode;
  }

  setMode(mode);
  return {
    root,
    materials,
    grid,
    suctionWindow,
    dischargeWindow,
    reducer,
    valve,
    supports,
    accentFlanges,
    setMode,
    get mode() { return mode; },
    dispose() {
      root.dispose(false, true);
      Object.values(materials).forEach((entry) => entry.dispose(false, true));
    },
  };
}
