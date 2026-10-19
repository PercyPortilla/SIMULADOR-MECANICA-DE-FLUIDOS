import { Animation } from '@babylonjs/core/Animations/animation.js';
import { AnimationGroup } from '@babylonjs/core/Animations/animationGroup.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { V56_EQUIPMENT_ANCHORS } from '../../scene/integration/v56Layout.js';

function material(scene, name, hex, { emissive = null, alpha = 1 } = {}) {
  const result = new StandardMaterial(name, scene);
  result.diffuseColor = Color3.FromHexString(`#${hex.toString(16).padStart(6, '0')}`);
  result.specularColor = new Color3(0.20, 0.22, 0.22);
  result.specularPower = 24;
  result.alpha = alpha;
  if (emissive != null) result.emissiveColor = Color3.FromHexString(`#${emissive.toString(16).padStart(6, '0')}`);
  if (alpha < 1) result.disableDepthWrite = true;
  return result;
}

function addBox(root, scene, name, size, position, meshMaterial, metadata = {}) {
  const mesh = CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, scene);
  mesh.position.set(...position);
  mesh.material = meshMaterial;
  mesh.receiveShadows = true;
  mesh.isPickable = false;
  mesh.metadata = { visualOnly: true, v57PresentationFinish: true, dimensionsM: [...size], ...metadata };
  mesh.parent = root;
  return mesh;
}

function addCylinder(root, scene, name, { radius, height, position, meshMaterial, tessellation = 16, metadata = {} }) {
  const mesh = CreateCylinder(name, { diameter: radius * 2, height, tessellation }, scene);
  mesh.position.set(...position);
  mesh.material = meshMaterial;
  mesh.receiveShadows = true;
  mesh.isPickable = false;
  mesh.metadata = { visualOnly: true, v57PresentationFinish: true, radiusM: radius, heightM: height, ...metadata };
  mesh.parent = root;
  return mesh;
}

function addBeam(root, scene, name, start, end, thickness, meshMaterial) {
  const direction = end.subtract(start);
  const length = direction.length();
  if (length < 0.001) return null;
  const beam = CreateBox(name, { width: thickness, height: length, depth: thickness }, scene);
  beam.position = Vector3.Lerp(start, end, 0.5);
  beam.rotationQuaternion = Quaternion.FromUnitVectorsToRef(Vector3.Up(), direction.normalize(), Quaternion.Identity());
  beam.material = meshMaterial;
  beam.receiveShadows = true;
  beam.isPickable = false;
  beam.metadata = { visualOnly: true, v57PresentationFinish: true, beamLengthM: length };
  beam.parent = root;
  return beam;
}

function createPipeRun(root, scene, name, points, radius, pipeMaterial) {
  const pipeRoot = new TransformNode(name, scene);
  pipeRoot.parent = root;
  pipeRoot.metadata = { visualOnly: true, v57PresentationFinish: true, pipeRun: true, renderedRadiusM: radius };
  for (let index = 0; index < points.length - 1; index += 1) {
    const a = Vector3.FromArray(points[index]);
    const b = Vector3.FromArray(points[index + 1]);
    const direction = b.subtract(a);
    const length = direction.length();
    if (length < 0.001) continue;
    const segment = CreateCylinder(`${name}-segment-${index + 1}`, {
      diameter: radius * 2,
      height: length,
      tessellation: 16,
    }, scene);
    segment.position = Vector3.Lerp(a, b, 0.5);
    segment.rotationQuaternion = Quaternion.FromUnitVectorsToRef(Vector3.Up(), direction.normalize(), Quaternion.Identity());
    segment.material = pipeMaterial;
    segment.receiveShadows = true;
    segment.isPickable = false;
    segment.metadata = { visualOnly: true, v57PresentationFinish: true, pipeRun: name, segmentIndex: index };
    segment.parent = pipeRoot;
  }
  return pipeRoot;
}

function createServiceRacks(root, scene, steel, yellow) {
  const racks = new TransformNode('V57-SERVICE-RACKS', scene);
  racks.parent = root;
  const stations = [188, 220, 252, 284, 316, 348];
  stations.forEach((x, index) => {
    const baseY = 1.0;
    const topY = 10.0;
    const z = -47;
    addBox(racks, scene, `V57-rack-foot-${index + 1}`, [4.4, 0.16, 2.2], [x, baseY + 0.08, z], steel);
    addBeam(racks, scene, `V57-rack-column-a-${index + 1}`, new Vector3(x - 1.7, baseY, z - 0.7), new Vector3(x - 1.7, topY, z - 0.7), 0.16, steel);
    addBeam(racks, scene, `V57-rack-column-b-${index + 1}`, new Vector3(x + 1.7, baseY, z + 0.7), new Vector3(x + 1.7, topY, z + 0.7), 0.16, steel);
    addBeam(racks, scene, `V57-rack-crossbar-${index + 1}`, new Vector3(x - 1.9, topY, z), new Vector3(x + 1.9, topY, z), 0.18, steel);
    addBox(racks, scene, `V57-rack-safety-${index + 1}`, [3.2, 0.12, 0.09], [x, topY - 0.22, z - 1.2], yellow);
  });
  return racks;
}

function createTankFarm(root, scene, steel, concrete, pipeMaterial) {
  const farm = new TransformNode('V57-TANK-FARM', scene);
  farm.parent = root;
  const tanks = [
    [246, -16, 2.2, 7.2],
    [258, -16, 2.0, 6.5],
    [270, -16, 1.8, 5.8],
  ];
  tanks.forEach(([x, z, radius, height], index) => {
    addCylinder(farm, scene, `V57-tank-${index + 1}`, { radius, height, position: [x, 1.2 + height / 2, z], meshMaterial: steel, tessellation: 24, metadata: { role: 'service-tank' } });
    addCylinder(farm, scene, `V57-tank-pad-${index + 1}`, { radius: radius + 0.35, height: 0.18, position: [x, 1.11, z], meshMaterial: concrete, tessellation: 24 });
    addBox(farm, scene, `V57-tank-ladder-${index + 1}`, [0.12, height - 0.4, 0.12], [x + radius + 0.22, 1.35 + (height - 0.4) / 2, z], pipeMaterial);
  });
  createPipeRun(farm, scene, 'V57-tank-header', [[244, 8.7, -16], [272, 8.7, -16]], 0.16, pipeMaterial);
  createPipeRun(farm, scene, 'V57-tank-drop', [[252, 8.7, -16], [252, 8.7, -20], [252, 5.0, -20]], 0.12, pipeMaterial);
  return farm;
}

function createLightPoles(root, scene, steel, lampMaterial) {
  const lights = new TransformNode('V57-LIGHTING-POLES', scene);
  lights.parent = root;
  [[186, -55], [226, -55], [266, -55], [306, -55], [346, -55], [364, -18]].forEach(([x, z], index) => {
    addCylinder(lights, scene, `V57-light-pole-${index + 1}`, { radius: 0.075, height: 7.0, position: [x, 4.5, z], meshMaterial: steel, tessellation: 10 });
    addBeam(lights, scene, `V57-light-arm-${index + 1}`, new Vector3(x, 7.85, z), new Vector3(x + 0.85, 7.85, z), 0.08, steel);
    addBox(lights, scene, `V57-light-head-${index + 1}`, [0.42, 0.16, 0.20], [x + 1.02, 7.78, z], lampMaterial);
  });
  return lights;
}

export function createBabylonV57PresentationFinish({ scene, parent } = {}) {
  if (!scene) throw new TypeError('V57 presentation finish requires a Scene.');
  const root = new TransformNode('PULPA-LAB-V57-PRESENTATION-FINISH', scene);
  root.parent = parent ?? null;
  root.metadata = {
    visualOnly: true,
    v57PresentationFinish: true,
    preservesV56Textures: true,
    preservesV56Connections: true,
    preservesV56Animations: true,
    coordinateSystem: 'right-handed',
  };

  const steel = material(scene, 'v57-finish-steel', 0x536269);
  const concrete = material(scene, 'v57-finish-concrete', 0x858887);
  const yellow = material(scene, 'v57-finish-safety-yellow', 0xd7a52f);
  const pipeMaterial = material(scene, 'v57-finish-process-pipe', 0x2f6671);
  const lampMaterial = material(scene, 'v57-finish-lamp', 0xffd487, { emissive: 0x9e6a26 });

  createServiceRacks(root, scene, steel, yellow);
  createTankFarm(root, scene, steel, concrete, pipeMaterial);
  createLightPoles(root, scene, steel, lampMaterial);
  createPipeRun(root, scene, 'V57-process-header', [[184, 10.2, -43], [230, 10.2, -43], [278, 10.2, -43], [330, 10.2, -43], [356, 10.2, -30]], 0.20, pipeMaterial);
  createPipeRun(root, scene, 'V57-return-header', [[204, 9.1, -40], [250, 9.1, -40], [300, 9.1, -40], [342, 9.1, -28]], 0.13, steel);

  const beacon = new TransformNode('V57-operation-beacon', scene);
  beacon.position.set(V56_EQUIPMENT_ANCHORS['PUMP-01'].x, 9.9, V56_EQUIPMENT_ANCHORS['PUMP-01'].z - 5.0);
  beacon.parent = root;
  addCylinder(beacon, scene, 'V57-operation-beacon-stem', { radius: 0.06, height: 0.7, position: [0, 0.35, 0], meshMaterial: steel, tessellation: 10 });
  addCylinder(beacon, scene, 'V57-operation-beacon-lamp', { radius: 0.20, height: 0.18, position: [0, 0.78, 0], meshMaterial: lampMaterial, tessellation: 16 });
  const animation = new Animation('v57-beacon-rotation', 'rotation.y', 30, Animation.ANIMATIONTYPE_FLOAT, Animation.ANIMATIONLOOPMODE_CYCLE);
  animation.setKeys([{ frame: 0, value: 0 }, { frame: 120, value: Math.PI * 2 }]);
  const animationGroup = new AnimationGroup('V57-presentation-animation', scene);
  animationGroup.addTargetedAnimation(animation, beacon);
  animationGroup.start(true);

  let animationsEnabled = true;
  const syncAnimationState = () => {
    if (animationsEnabled) animationGroup.play(true);
    else animationGroup.pause();
  };
  return {
    root,
    animationGroup,
    setAnimationsEnabled(enabled) {
      animationsEnabled = Boolean(enabled);
      syncAnimationState();
      return animationsEnabled;
    },
    dispose() {
      animationGroup.stop();
      animationGroup.dispose();
      root.dispose(false, true);
    },
  };
}

