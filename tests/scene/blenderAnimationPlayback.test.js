import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  attachBlenderVisualReplacement,
  resetBlenderReplacementCacheForTests,
  stabilizeImportedRotationPivot,
} from '../../src/scene/integration/blenderVisualReplacement.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const assetRoot = path.resolve(here, '../../public/models/pulpa-blender');

function loadGlb(filename) {
  const buffer = fs.readFileSync(path.join(assetRoot, filename));
  const bytes = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(bytes, '', resolve, reject);
  });
}

async function sampleRotation(filename, nodeName, timeSelector = (clip) => clip.duration * 0.25) {
  const gltf = await loadGlb(filename);
  expect(gltf.animations).toHaveLength(1);
  const target = gltf.scene.getObjectByName(nodeName);
  expect(target, `${filename}: missing ${nodeName}`).toBeTruthy();
  const mixer = new THREE.AnimationMixer(gltf.scene);
  mixer.clipAction(gltf.animations[0]).play();
  mixer.setTime(0.0001);
  const initial = target.quaternion.clone();
  mixer.setTime(timeSelector(gltf.animations[0]));
  const sampled = target.quaternion.clone();
  mixer.stopAllAction();
  return initial.angleTo(sampled);
}

async function sampleLateMotion(filename, nodeName, property, startFraction = 0.84, endFraction = 0.92) {
  const gltf = await loadGlb(filename);
  expect(gltf.animations).toHaveLength(1);
  const clip = gltf.animations[0];
  const track = clip.tracks.find((candidate) => candidate.name === `${nodeName}.${property}`);
  expect(track, `${filename}: missing ${nodeName}.${property}`).toBeTruthy();
  expect(track.times.at(-1)).toBeCloseTo(clip.duration, 5);

  const target = gltf.scene.getObjectByName(nodeName);
  expect(target, `${filename}: missing ${nodeName}`).toBeTruthy();
  const mixer = new THREE.AnimationMixer(gltf.scene);
  mixer.clipAction(clip).play();
  mixer.setTime(clip.duration * startFraction);
  const before = property === 'position' ? target.position.clone() : target.quaternion.clone();
  mixer.setTime(clip.duration * endFraction);
  const after = property === 'position' ? target.position.clone() : target.quaternion.clone();
  mixer.stopAllAction();
  return property === 'position' ? before.distanceTo(after) : before.angleTo(after);
}

afterEach(() => {
  resetBlenderReplacementCacheForTests();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Blender animation playback through Three.js', () => {
  const oneRevolutionTargets = [
    ['MILL-01.glb', 'MILL-01_ROTATING_GROUP'],
    ['SLURRY-PUMP-01.glb', 'SLURRY-PUMP-01_ROTATING_GROUP'],
    ['LEACH-REACTOR.glb', 'LEACH-REACTOR_ROTATING_GROUP'],
    ['APRON-FEEDER.glb', 'APRON-FEEDER_ROTOR_01'],
    ['APRON-FEEDER.glb', 'APRON-FEEDER_ROTOR_02'],
    ['PRIMARY-CRUSHER.glb', 'PRIMARY-CRUSHER_FLYWHEEL_01'],
    ['PRIMARY-CRUSHER.glb', 'PRIMARY-CRUSHER_FLYWHEEL_02'],
    ['PRIMARY-CRUSHER.glb', 'PRIMARY-CRUSHER_ECCENTRIC'],
    // GLTFLoader sanitizes punctuation used in Blender object names.
    ['CIP-ADSORPTION.glb', 'CIP-ADSORPTION_ROTATING_-500'],
    ['CIP-ADSORPTION.glb', 'CIP-ADSORPTION_ROTATING_-167'],
    ['CIP-ADSORPTION.glb', 'CIP-ADSORPTION_ROTATING_+167'],
    ['CIP-ADSORPTION.glb', 'CIP-ADSORPTION_ROTATING_+500'],
  ];

  for (const [filename, nodeName] of oneRevolutionTargets) {
    it(`${filename} moves ${nodeName} away from its initial quaternion`, async () => {
      const angularDelta = await sampleRotation(filename, nodeName);
      expect(angularDelta).toBeGreaterThan(0.35);
    });
  }

  it('keeps the loader wheel visibly rotating between full-revolution crossings', async () => {
    const angularDelta = await sampleRotation(
      'WHEEL-LOADER.glb',
      'WHEEL-LOADER_WHEEL_FL',
      () => 1.0,
    );
    expect(angularDelta).toBeGreaterThan(0.35);
  });

  it('keeps APRON-FEEDER pans and rotors moving through the late half of the clip', async () => {
    const panDelta = await sampleLateMotion('APRON-FEEDER.glb', 'APRON-FEEDER_PANS_GROUP', 'position');
    const rotorDelta = await sampleLateMotion('APRON-FEEDER.glb', 'APRON-FEEDER_ROTOR_01', 'quaternion');
    expect(panDelta).toBeGreaterThan(0.005);
    expect(rotorDelta).toBeGreaterThan(0.1);
  });

  it('keeps PRIMARY-CRUSHER jaw and drive moving through the late half of the clip', async () => {
    const jawDelta = await sampleLateMotion('PRIMARY-CRUSHER.glb', 'PRIMARY-CRUSHER_MOVING_JAW', 'quaternion');
    const driveDelta = await sampleLateMotion('PRIMARY-CRUSHER.glb', 'PRIMARY-CRUSHER_FLYWHEEL_01', 'quaternion');
    expect(jawDelta).toBeGreaterThan(0.005);
    expect(driveDelta).toBeGreaterThan(0.1);
  });

  for (const [instanceId, filename, nodeName] of [
    ['APRON-FEEDER', 'APRON-FEEDER.glb', 'APRON-FEEDER_ROTOR_01'],
    ['PRIMARY-CRUSHER', 'PRIMARY-CRUSHER.glb', 'PRIMARY-CRUSHER_FLYWHEEL_01'],
  ]) {
    it(`${instanceId} freezes and resumes its Blender mixer with Animaciones ON/OFF`, async () => {
      const sourceGltf = await loadGlb(filename);
      vi.stubGlobal('window', {});
      vi.spyOn(GLTFLoader.prototype, 'load').mockImplementation(function mockLoad(_url, onLoad) {
        onLoad(sourceGltf);
        return this;
      });
      resetBlenderReplacementCacheForTests();

      const hostRoot = new THREE.Group();
      const controller = attachBlenderVisualReplacement({ hostRoot, instanceId });
      await Promise.resolve();
      await Promise.resolve();
      expect(controller.loaded).toBe(true);

      const target = controller.scene.getObjectByName(nodeName);
      expect(target).toBeTruthy();
      controller.setAnimationTime(sourceGltf.animations[0].duration * 0.62);
      const beforeFreeze = target.quaternion.clone();
      controller.setAnimationEnabled(false);
      controller.update(0.1);
      expect(beforeFreeze.angleTo(target.quaternion)).toBeLessThan(1e-6);

      controller.setAnimationEnabled(true);
      controller.update(0.1);
      expect(beforeFreeze.angleTo(target.quaternion)).toBeGreaterThan(0.05);
      controller.dispose();
    });
  }

  it('paces SMELTING-FURNACE with a long dwell instead of looping the 5-second tilt continuously', async () => {
    const sourceGltf = await loadGlb('SMELTING-FURNACE.glb');
    vi.stubGlobal('window', {});
    vi.spyOn(GLTFLoader.prototype, 'load').mockImplementation(function mockLoad(_url, onLoad) {
      onLoad(sourceGltf);
      return this;
    });
    resetBlenderReplacementCacheForTests();

    const hostRoot = new THREE.Group();
    const controller = attachBlenderVisualReplacement({ hostRoot, instanceId: 'SMELTING-FURNACE' });
    await Promise.resolve();
    await Promise.resolve();
    expect(controller.loaded).toBe(true);
    expect(hostRoot.userData.blenderAnimationPacing).toEqual({
      cycleSeconds: 16,
      activeStartSeconds: 8.8,
      activeEndSeconds: 13.12,
    });

    const pivot = controller.scene.getObjectByName('SMELTING-FURNACE_TILT_PIVOT');
    expect(pivot).toBeTruthy();
    controller.setAnimationTime(4);
    const rest = pivot.quaternion.clone();
    controller.setAnimationTime(11.392);
    expect(rest.angleTo(pivot.quaternion)).toBeGreaterThan(0.4);
    controller.setAnimationTime(14);
    expect(rest.angleTo(pivot.quaternion)).toBeLessThan(1e-4);

    controller.setAnimationTime(9.5);
    const beforeFreeze = pivot.quaternion.clone();
    controller.setAnimationEnabled(false);
    controller.update(0.1);
    expect(beforeFreeze.angleTo(pivot.quaternion)).toBeLessThan(1e-6);
    controller.setAnimationEnabled(true);
    controller.update(0.1);
    expect(beforeFreeze.angleTo(pivot.quaternion)).toBeGreaterThan(0.005);
    controller.dispose();
  });

  it('applies distinct host phase offsets to the real leach-reactor Blender animation', async () => {
    const sourceGltf = await loadGlb('LEACH-REACTOR.glb');
    vi.stubGlobal('window', {});
    vi.spyOn(GLTFLoader.prototype, 'load').mockImplementation(function mockLoad(_url, onLoad) {
      onLoad(sourceGltf);
      return this;
    });
    resetBlenderReplacementCacheForTests();

    const samples = [];
    for (const [instanceId, phaseOffset] of [
      ['R-01', 0.63],
      ['R-02', 1.26],
      ['R-03', 1.89],
      ['R-04', 2.52],
    ]) {
      const hostRoot = new THREE.Group();
      hostRoot.userData.animationPhaseOffset = phaseOffset;
      const controller = attachBlenderVisualReplacement({ hostRoot, instanceId });
      await Promise.resolve();
      await Promise.resolve();
      expect(controller.loaded).toBe(true);
      const agitator = controller.scene.getObjectByName('LEACH-REACTOR_ROTATING_GROUP');
      expect(agitator).toBeTruthy();
      samples.push(agitator.quaternion.clone());
      controller.dispose();
    }

    for (let index = 1; index < samples.length; index += 1) {
      expect(samples[index - 1].angleTo(samples[index])).toBeGreaterThan(0.25);
    }
  });

  for (const [instanceId, filename, nodeName] of [
    ['EXCAVATOR-01', 'MINING-SHOVEL.glb', 'MINING-SHOVEL_BUCKET_ORE'],
    ['LOADER-01', 'WHEEL-LOADER.glb', 'WHEEL-LOADER_BUCKET_ORE'],
  ]) {
    it(`${instanceId} starts with imported bucket ore hidden until its managed cycle loads material`, async () => {
      const sourceGltf = await loadGlb(filename);
      vi.stubGlobal('window', {});
      vi.spyOn(GLTFLoader.prototype, 'load').mockImplementation(function mockLoad(_url, onLoad) {
        onLoad(sourceGltf);
        return this;
      });
      resetBlenderReplacementCacheForTests();

      const hostRoot = new THREE.Group();
      const controller = attachBlenderVisualReplacement({ hostRoot, instanceId });
      await Promise.resolve();
      await Promise.resolve();
      const ore = controller.scene.getObjectByName(nodeName);
      expect(ore).toBeTruthy();
      expect(ore.visible).toBe(false);
      controller.setMaterialLoadVisible(true);
      expect(ore.visible).toBe(true);
      controller.dispose();
    });
  }

  for (const [filename, nodeName] of [
    ['MILL-01.glb', 'MILL-01_ROTATING_GROUP'],
    ['SLURRY-PUMP-01.glb', 'SLURRY-PUMP-01_ROTATING_GROUP'],
  ]) {
    it(`${filename} keeps ${nodeName} above its rest bottom after Three.js pivot repair`, async () => {
      const gltf = await loadGlb(filename);
      const target = gltf.scene.getObjectByName(nodeName);
      stabilizeImportedRotationPivot(gltf.scene, { nodeName, axis: 'x' });
      gltf.scene.updateMatrixWorld(true);
      const restBottom = new THREE.Box3().setFromObject(target, true).min.y;
      const mixer = new THREE.AnimationMixer(gltf.scene);
      mixer.clipAction(gltf.animations[0]).play();
      for (const fraction of [0.125, 0.25, 0.5, 0.75]) {
        mixer.setTime(gltf.animations[0].duration * fraction);
        gltf.scene.updateMatrixWorld(true);
        const bottom = new THREE.Box3().setFromObject(target, true).min.y;
        expect(bottom).toBeGreaterThan(restBottom - 0.2);
      }
      mixer.stopAllAction();
    });
  }
});
