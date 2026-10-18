import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreateLines } from '@babylonjs/core/Meshes/Builders/linesBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { getTerrainHeight, getZoneElevation } from '../../scene/environment/terrainHeight.js';
import { getPlantZone } from '../../scene/layout/plantLayout.js';

export const BABYLON_INDUSTRIAL_PAD_THICKNESS = 0.18;

export const BABYLON_INDUSTRIAL_PAD_DEFINITIONS = Object.freeze([
  Object.freeze({
    zoneId: 'reception',
    name: 'rom-hopper-local-pad',
    center: Object.freeze([-110, -30]),
    width: 12.5,
    depth: 14,
    curbs: false,
    followTerrain: false,
  }),
  Object.freeze({
    zoneId: 'crushing',
    name: 'crusher-local-pad',
    center: Object.freeze([-88, -30]),
    width: 8.5,
    depth: 9.5,
    curbs: false,
    followTerrain: true,
  }),
]);

export const BABYLON_EMBEDDED_FOUNDATION_ZONE_IDS = Object.freeze(['Z4', 'Z5']);
export const BABYLON_EMBEDDED_FOUNDATION_THICKNESS_M = 0.35;
export const BABYLON_EMBEDDED_FOUNDATION_COVER_M = 0.08;

function requireRightHandedScene(scene, label) {
  if (!scene) throw new TypeError(`${label} requires a Babylon Scene.`);
  if (scene.useRightHandedSystem !== true) {
    throw new Error(`${label} requires scene.useRightHandedSystem = true.`);
  }
}

function colorFromHex(hex) {
  return new Color3(
    ((hex >> 16) & 0xff) / 255,
    ((hex >> 8) & 0xff) / 255,
    (hex & 0xff) / 255,
  );
}

function createConcreteMaterial(scene, name, hex = 0x929691) {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = colorFromHex(hex);
  material.specularColor = new Color3(0.06, 0.06, 0.055);
  material.specularPower = 8;
  return material;
}

export function getBabylonIndustrialPad(zoneId) {
  const definition = BABYLON_INDUSTRIAL_PAD_DEFINITIONS.find((pad) => pad.zoneId === zoneId);
  if (!definition) return null;
  return Object.freeze({
    ...definition,
    center: Object.freeze([...definition.center]),
    elevation: definition.followTerrain
      ? getTerrainHeight(definition.center[0], definition.center[1])
      : getZoneElevation(zoneId),
  });
}

function addExpansionJoints(root, pad, scene) {
  const joints = [];
  const topY = pad.elevation + BABYLON_INDUSTRIAL_PAD_THICKNESS + 0.012;
  const spacing = 8;
  let index = 0;
  for (let x = -pad.width / 2 + spacing; x < pad.width / 2; x += spacing) {
    index += 1;
    const line = CreateLines(`${pad.name}-expansion-joint-x-${index}`, {
      points: [
        new Vector3(pad.center[0] + x, topY, pad.center[1] - pad.depth / 2),
        new Vector3(pad.center[0] + x, topY, pad.center[1] + pad.depth / 2),
      ],
      updatable: false,
    }, scene);
    line.color = colorFromHex(0x6f7470);
    line.alpha = 0.32;
    line.isPickable = false;
    line.parent = root;
    line.metadata = { visualOnly: true, expansionJoint: true, padName: pad.name };
    joints.push(line);
  }
  index = 0;
  for (let z = -pad.depth / 2 + spacing; z < pad.depth / 2; z += spacing) {
    index += 1;
    const line = CreateLines(`${pad.name}-expansion-joint-z-${index}`, {
      points: [
        new Vector3(pad.center[0] - pad.width / 2, topY, pad.center[1] + z),
        new Vector3(pad.center[0] + pad.width / 2, topY, pad.center[1] + z),
      ],
      updatable: false,
    }, scene);
    line.color = colorFromHex(0x6f7470);
    line.alpha = 0.32;
    line.isPickable = false;
    line.parent = root;
    line.metadata = { visualOnly: true, expansionJoint: true, padName: pad.name };
    joints.push(line);
  }
  return joints;
}

export function createBabylonIndustrialPads({ scene, material = null } = {}) {
  requireRightHandedScene(scene, 'Babylon industrial pads');
  const root = new TransformNode('industrial-pads', scene);
  const padMaterial = material ?? createConcreteMaterial(scene, 'industrial-pad-material', 0x929691);
  const pads = {};
  const expansionJoints = [];

  BABYLON_INDUSTRIAL_PAD_DEFINITIONS.forEach(({ zoneId }) => {
    const pad = getBabylonIndustrialPad(zoneId);
    const mesh = CreateBox(pad.name, {
      width: pad.width,
      height: BABYLON_INDUSTRIAL_PAD_THICKNESS,
      depth: pad.depth,
    }, scene);
    mesh.position.set(
      pad.center[0],
      pad.elevation + BABYLON_INDUSTRIAL_PAD_THICKNESS / 2,
      pad.center[1],
    );
    mesh.material = padMaterial;
    mesh.receiveShadows = true;
    mesh.metadata = {
      zoneId,
      widthM: pad.width,
      depthM: pad.depth,
      thicknessM: BABYLON_INDUSTRIAL_PAD_THICKNESS,
      datumY: pad.elevation,
      terrainHeightSource: pad.followTerrain ? 'getTerrainHeight' : 'getZoneElevation',
      coordinateSystem: 'right-handed',
    };
    mesh.parent = root;
    pads[zoneId] = mesh;
    expansionJoints.push(...addExpansionJoints(root, pad, scene));
  });

  root.metadata = {
    coordinateSystem: 'right-handed',
    worldUnitsPerMeter: 1,
    terrainHeightSource: 'getTerrainHeight/getZoneElevation',
  };
  return { root, pads, expansionJoints, material: padMaterial };
}

export function getBabylonEmbeddedFoundationDefinition(zoneId) {
  if (!BABYLON_EMBEDDED_FOUNDATION_ZONE_IDS.includes(zoneId)) return null;
  const zone = getPlantZone(zoneId);
  const thickness = BABYLON_EMBEDDED_FOUNDATION_THICKNESS_M;
  const cover = BABYLON_EMBEDDED_FOUNDATION_COVER_M;
  return Object.freeze({
    zoneId,
    name: `${zone.key}-equipment-foundation`,
    center: Object.freeze([zone.position.x, zone.position.z]),
    width: zone.width - 3.0,
    depth: zone.depth - 3.0,
    thickness,
    engineeringDatumY: zone.elevation,
    foundationTopY: zone.elevation - cover,
    centerY: zone.elevation - cover - thickness / 2,
    coverM: cover,
  });
}

export function createBabylonPlantFoundations({ scene, material = null } = {}) {
  requireRightHandedScene(scene, 'Babylon plant foundations');
  const root = new TransformNode('central-concrete-platform', scene);
  const foundationMaterial = material ?? createConcreteMaterial(scene, 'central-concrete-platform-material', 0x929691);
  const foundations = {};

  BABYLON_EMBEDDED_FOUNDATION_ZONE_IDS.forEach((zoneId) => {
    const foundation = getBabylonEmbeddedFoundationDefinition(zoneId);
    const mesh = CreateBox(foundation.name, {
      width: foundation.width,
      height: foundation.thickness,
      depth: foundation.depth,
    }, scene);
    mesh.position.set(foundation.center[0], foundation.centerY, foundation.center[1]);
    mesh.material = foundationMaterial;
    mesh.receiveShadows = true;
    mesh.metadata = {
      zoneId,
      embeddedFoundation: true,
      widthM: foundation.width,
      depthM: foundation.depth,
      thicknessM: foundation.thickness,
      foundationTopY: foundation.foundationTopY,
      engineeringDatumY: foundation.engineeringDatumY,
      coverM: foundation.coverM,
      coordinateSystem: 'right-handed',
    };
    mesh.parent = root;
    foundations[zoneId] = mesh;
  });

  root.metadata = {
    coordinateSystem: 'right-handed',
    worldUnitsPerMeter: 1,
    v30Source: 'baseEnvironment Z4/Z5 embedded foundations',
  };
  return { root, foundations, material: foundationMaterial };
}
