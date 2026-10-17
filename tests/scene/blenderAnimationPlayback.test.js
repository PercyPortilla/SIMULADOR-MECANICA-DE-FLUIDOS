import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { describe, expect, it } from 'vitest';

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
});
