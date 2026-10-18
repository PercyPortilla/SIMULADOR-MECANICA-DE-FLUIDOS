import { describe, expect, it, vi } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Scene } from '@babylonjs/core/scene.js';
import { attachBabylonEquipmentVisual } from '../../src/babylon/assets/equipmentVisual.js';

function sceneFixture() {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  scene.useRightHandedSystem = true;
  return { engine, scene };
}

function containerFixture(scene, names = []) {
  const root = new TransformNode('__root__', scene);
  const nodes = names.map((name) => {
    const mesh = new Mesh(name, scene);
    mesh.parent = root;
    return mesh;
  });
  const animation = {
    name: 'Animation',
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
  };
  return {
    root,
    nodes,
    animation,
    container: {
      rootNodes: [root],
      animationGroups: [animation],
      addAllToScene: vi.fn(),
      dispose: vi.fn(),
    },
  };
}

function namedAnimation(name) {
  return {
    name,
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
  };
}

function multiAnimationContainer(scene, animationNames, configureRoot = null) {
  const root = new TransformNode('__root__', scene);
  configureRoot?.(root);
  const animations = animationNames.map(namedAnimation);
  return {
    root,
    animations,
    container: {
      rootNodes: [root],
      animationGroups: animations,
      addAllToScene: vi.fn(),
      dispose: vi.fn(),
    },
  };
}

describe('Babylon generic Blender equipment visual', () => {
  it('loads, mirrors and hides nodes according to the shared Blender contract', async () => {
    const { engine, scene } = sceneFixture();
    const fixture = containerFixture(scene, [
      'STOCKPILE-RECLAIM_BODY',
      'STOCKPILE-RECLAIM_FEEDER',
      'STOCKPILE-RECLAIM_GRIZZLY_01',
    ]);
    const material = new StandardMaterial('stockpile-mirrored-material', scene);
    material.backFaceCulling = true;
    material.cullBackFaces = true;
    fixture.nodes[0].material = material;
    const handle = attachBabylonEquipmentVisual({
      scene,
      instanceId: 'STOCKPILE-RECLAIM',
      loadContainer: vi.fn(async () => fixture.container),
    });
    await handle.ready;

    expect(handle.loaded).toBe(true);
    expect(handle.visualRoot.scaling.asArray()).toEqual([1, 1, -1]);
    expect(fixture.nodes[0].isEnabled()).toBe(true);
    expect(fixture.nodes[1].isEnabled()).toBe(false);
    expect(fixture.nodes[2].isEnabled()).toBe(false);
    expect(handle.host.metadata.hiddenNodeCount).toBe(2);
    expect(handle.host.metadata.mirroredCullingSafeMeshCount).toBe(1);
    expect(material.backFaceCulling).toBe(false);
    expect(material.cullBackFaces).toBe(false);
    expect(fixture.nodes[0].metadata.mirroredVisualCullingSafe).toBe(true);
    expect(handle.host.metadata.animationGroupNames).toEqual(['Animation']);
    expect(fixture.animation.stop).toHaveBeenCalled();

    handle.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('uses the real GLB Animation fallback when expectedAnimation is absent and controls only that group', async () => {
    const { engine, scene } = sceneFixture();
    const fixture = multiAnimationContainer(scene, ['Idle', 'Animation', 'Diagnostics']);
    const handle = attachBabylonEquipmentVisual({
      scene,
      instanceId: 'MILL-01',
      loadContainer: vi.fn(async () => fixture.container),
    });
    await handle.ready;

    expect(handle.host.metadata.expectedAnimation).toBe('MILL-01_Rotation');
    expect(handle.host.metadata.selectedAnimationGroupName).toBe('Animation');
    expect(handle.host.metadata.animationFallbackUsed).toBe(true);
    expect(handle.host.metadata.controlledAnimationGroupNames).toEqual(['Animation']);
    handle.setAnimationsEnabled(true);
    expect(fixture.animations[0].play).not.toHaveBeenCalled();
    expect(fixture.animations[1].play).toHaveBeenCalledWith(true);
    expect(fixture.animations[2].play).not.toHaveBeenCalled();
    handle.setAnimationsEnabled(false);
    expect(fixture.animations[1].pause).toHaveBeenCalled();

    handle.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('keeps R-01..04 and both pumps on independent AnimationGroups', async () => {
    const { engine, scene } = sceneFixture();
    const ids = ['R-01', 'R-02', 'R-03', 'R-04', 'SLURRY-PUMP-01', 'PUMP-01'];
    const fixtures = new Map();
    const handles = ids.map((instanceId) => {
      const fixture = multiAnimationContainer(scene, ['Animation']);
      fixtures.set(instanceId, fixture);
      return attachBabylonEquipmentVisual({
        scene,
        instanceId,
        loadContainer: vi.fn(async () => fixture.container),
      });
    });
    await Promise.all(handles.map((handle) => handle.ready));

    expect(new Set(handles.map((handle) => handle.controlledAnimationGroups[0])).size).toBe(ids.length);
    handles.forEach((handle) => {
      expect(handle.host.metadata.selectedAnimationGroupName).toBe('Animation');
      expect(handle.host.metadata.animationFallbackUsed).toBe(true);
    });

    handles[0].setAnimationsEnabled(true);
    expect(fixtures.get('R-01').animations[0].play).toHaveBeenCalledTimes(1);
    ids.slice(1).forEach((id) => expect(fixtures.get(id).animations[0].play).not.toHaveBeenCalled());

    handles[5].setAnimationsEnabled(true);
    expect(fixtures.get('PUMP-01').animations[0].play).toHaveBeenCalledTimes(1);
    expect(fixtures.get('SLURRY-PUMP-01').animations[0].play).not.toHaveBeenCalled();

    handles[0].setAnimationsEnabled(false);
    expect(fixtures.get('R-01').animations[0].pause).toHaveBeenCalled();
    expect(fixtures.get('R-02').animations[0].pause).toHaveBeenCalledTimes(1);
    expect(fixtures.get('PUMP-01').animations[0].pause).toHaveBeenCalledTimes(1);

    handles.forEach((handle) => handle.dispose());
    scene.dispose();
    engine.dispose();
  });

  it('repairs the MILL rotation pivot without discarding its quaternion or moving child world pose', async () => {
    const { engine, scene } = sceneFixture();
    const initialQuaternion = Quaternion.FromEulerAngles(0.18, -0.11, 0.07);
    let pivot;
    let child;
    const fixture = multiAnimationContainer(scene, ['Animation'], (root) => {
      const parent = new TransformNode('MILL-01_PARENT', scene);
      parent.parent = root;
      parent.position.set(3.5, 1.2, -2.0);
      pivot = new TransformNode('MILL-01_ROTATING_GROUP', scene);
      pivot.parent = parent;
      pivot.position.set(0, 4.5, -3.25);
      pivot.rotationQuaternion = initialQuaternion.clone();
      child = MeshBuilder.CreateBox('MILL-01_DRUM', { width: 6, height: 2, depth: 2 }, scene);
      child.parent = pivot;
      child.position.set(1.0, 2.75, 4.5);
    });
    fixture.root.computeWorldMatrix(true);
    child.computeWorldMatrix(true);
    const beforeChildWorld = child.getAbsolutePosition().clone();
    const beforeQuaternion = pivot.rotationQuaternion.clone();

    const handle = attachBabylonEquipmentVisual({
      scene,
      instanceId: 'MILL-01',
      loadContainer: vi.fn(async () => fixture.container),
    });
    await handle.ready;
    child.computeWorldMatrix(true);
    const afterChildWorld = child.getAbsolutePosition().clone();

    expect(handle.host.metadata.rotationPivotRepaired).toBe(true);
    expect(pivot.metadata.rotationPivotStabilized).toBe(true);
    expect(pivot.metadata.rotationPivotAxis).toBe('x');
    expect(Vector3.Distance(afterChildWorld, beforeChildWorld)).toBeLessThan(1e-6);
    expect(pivot.rotationQuaternion.asArray()).toEqual(beforeQuaternion.asArray());
    expect(Math.hypot(...pivot.metadata.rotationPivotShift)).toBeGreaterThan(0.1);

    handle.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('repairs the pump rotation pivot with the same quaternion-safe world-pose rule', async () => {
    const { engine, scene } = sceneFixture();
    const initialQuaternion = Quaternion.FromEulerAngles(-0.12, 0.09, 0.04);
    let pivot;
    let impeller;
    const fixture = multiAnimationContainer(scene, ['Animation'], (root) => {
      const parent = new TransformNode('SLURRY-PUMP-01_PARENT', scene);
      parent.parent = root;
      parent.position.set(-2.5, 0.6, 1.3);
      pivot = new TransformNode('SLURRY-PUMP-01_ROTATING_GROUP', scene);
      pivot.parent = parent;
      pivot.position.set(-21, 0, 0);
      pivot.rotationQuaternion = initialQuaternion.clone();
      impeller = MeshBuilder.CreateCylinder('SLURRY-PUMP-01_IMPELLER', { diameter: 2.4, height: 1.0 }, scene);
      impeller.parent = pivot;
      impeller.position.set(21, 1.7, -2.2);
    });
    fixture.root.computeWorldMatrix(true);
    impeller.computeWorldMatrix(true);
    const beforeWorld = impeller.getAbsolutePosition().clone();
    const beforeQuaternion = pivot.rotationQuaternion.clone();

    const handle = attachBabylonEquipmentVisual({
      scene,
      instanceId: 'SLURRY-PUMP-01',
      loadContainer: vi.fn(async () => fixture.container),
    });
    await handle.ready;
    impeller.computeWorldMatrix(true);

    expect(handle.host.metadata.rotationPivotRepaired).toBe(true);
    expect(pivot.metadata.rotationPivotAxis).toBe('x');
    expect(Vector3.Distance(impeller.getAbsolutePosition(), beforeWorld)).toBeLessThan(1e-6);
    expect(pivot.rotationQuaternion.asArray()).toEqual(beforeQuaternion.asArray());
    expect(Math.hypot(...pivot.metadata.rotationPivotShift)).toBeGreaterThan(0.1);

    handle.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('honors playAllAnimations and an ON toggle issued before asynchronous GLB load completes', async () => {
    const { engine, scene } = sceneFixture();
    const fixture = multiAnimationContainer(scene, ['Boom', 'Stick', 'Bucket']);
    let resolveLoad;
    const pending = new Promise((resolve) => { resolveLoad = resolve; });
    const handle = attachBabylonEquipmentVisual({
      scene,
      instanceId: 'EXCAVATOR-01',
      loadContainer: vi.fn(() => pending),
    });
    handle.setAnimationsEnabled(true);
    resolveLoad(fixture.container);
    await handle.ready;

    expect(handle.host.metadata.controlledAnimationGroupNames).toEqual(['Boom', 'Stick', 'Bucket']);
    fixture.animations.forEach((animation) => expect(animation.play).toHaveBeenCalledWith(true));
    handle.setAnimationsEnabled(false);
    fixture.animations.forEach((animation) => expect(animation.pause).toHaveBeenCalled());

    handle.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('honors SMELTING animationPacing instead of continuously advancing the tilt clip', async () => {
    const { engine, scene } = sceneFixture();
    vi.spyOn(engine, 'getDeltaTime').mockReturnValue(100);
    const paced = {
      name: 'Animation',
      from: 0,
      to: 100,
      play: vi.fn(),
      pause: vi.fn(),
      stop: vi.fn(),
      goToFrame: vi.fn(),
    };
    const fixture = multiAnimationContainer(scene, []);
    fixture.container.animationGroups = [paced];
    const handle = attachBabylonEquipmentVisual({
      scene,
      instanceId: 'SMELTING-FURNACE',
      loadContainer: vi.fn(async () => fixture.container),
    });
    await handle.ready;

    expect(handle.host.metadata.blenderAnimationPacing).toEqual({
      cycleSeconds: 16,
      activeStartSeconds: 8.8,
      activeEndSeconds: 13.12,
    });
    handle.setAnimationsEnabled(true);
    expect(paced.play).toHaveBeenCalledWith(true);
    expect(paced.pause).toHaveBeenCalled();
    expect(paced.goToFrame).toHaveBeenLastCalledWith(0);

    for (let index = 0; index < 90; index += 1) scene.onBeforeRenderObservable.notifyObservers(scene);
    expect(paced.goToFrame.mock.calls.at(-1)[0]).toBeGreaterThan(0);
    expect(paced.goToFrame.mock.calls.at(-1)[0]).toBeLessThan(10);
    for (let index = 0; index < 45; index += 1) scene.onBeforeRenderObservable.notifyObservers(scene);
    expect(paced.goToFrame.mock.calls.at(-1)[0]).toBe(100);

    handle.setAnimationsEnabled(false);
    const callCount = paced.goToFrame.mock.calls.length;
    scene.onBeforeRenderObservable.notifyObservers(scene);
    expect(paced.goToFrame).toHaveBeenCalledTimes(callCount);

    handle.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('owns AnimationGroup playback and bucket material visibility', async () => {
    const { engine, scene } = sceneFixture();
    const fixture = containerFixture(scene, ['MINING-SHOVEL_BUCKET_ORE', 'MINING-SHOVEL_BODY']);
    const handle = attachBabylonEquipmentVisual({
      scene,
      instanceId: 'EXCAVATOR-01',
      loadContainer: vi.fn(async () => fixture.container),
    });
    await handle.ready;

    expect(handle.materialLoadNode).toBe(fixture.nodes[0]);
    expect(fixture.nodes[0].isEnabled()).toBe(false);
    handle.setMaterialLoadVisible(true);
    expect(fixture.nodes[0].isEnabled()).toBe(true);
    handle.setAnimationsEnabled(true);
    expect(fixture.animation.play).toHaveBeenCalledWith(true);
    handle.setAnimationsEnabled(false);
    expect(fixture.animation.pause).toHaveBeenCalled();

    handle.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('requires a right-handed scene and a valid contract', () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    expect(() => attachBabylonEquipmentVisual({ scene, instanceId: 'MILL-01' })).toThrow(/right-handed/);
    scene.useRightHandedSystem = true;
    expect(() => attachBabylonEquipmentVisual({ scene, instanceId: 'UNKNOWN' })).toThrow(/contract/);
    scene.dispose();
    engine.dispose();
  });
});
