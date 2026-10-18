import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Scene } from '@babylonjs/core/scene.js';
import { describe, expect, it, vi } from 'vitest';
import { getTerrainHeight } from '../../src/scene/environment/terrainHeight.js';
import { SUPPORT_LAYOUT } from '../../src/scene/integration/finalLayout.js';
import {
  BABYLON_MOBILE_EQUIPMENT_IDS,
  BABYLON_TRUCK_PHASE_OFFSETS_SECONDS,
  BABYLON_TRUCK_TIMINGS,
  createBabylonMobileEquipmentSystem,
} from '../../src/babylon/mobile/mobileEquipmentSystem.js';

function addNode(root, scene, name) {
  const node = new TransformNode(name, scene);
  node.parent = root;
  return node;
}

function fakeContainer(scene, url) {
  const root = new TransformNode(`fake-${url}`, scene);
  if (url.includes('HAUL-TRUCK')) {
    [
      'HAUL-TRUCK_DUMP_PIVOT',
      'HAUL-TRUCK_ORE_LOAD',
      'HAUL-TRUCK_WHEEL_STEER_FL',
      'HAUL-TRUCK_WHEEL_STEER_FR',
      'HAUL-TRUCK_WHEEL_SPIN_FL',
      'HAUL-TRUCK_WHEEL_SPIN_FR',
      'HAUL-TRUCK_WHEEL_SPIN_RL1',
      'HAUL-TRUCK_WHEEL_SPIN_RL2',
      'HAUL-TRUCK_WHEEL_SPIN_RR1',
      'HAUL-TRUCK_WHEEL_SPIN_RR2',
    ].forEach((name) => addNode(root, scene, name));
  }
  if (url.includes('WHEEL-LOADER')) {
    ['WHEEL-LOADER_BUCKET_ORE', 'WHEEL-LOADER_WHEEL_FL', 'WHEEL-LOADER_WHEEL_FR', 'WHEEL-LOADER_WHEEL_RL', 'WHEEL-LOADER_WHEEL_RR']
      .forEach((name) => addNode(root, scene, name));
  }
  if (url.includes('MINING-SHOVEL')) addNode(root, scene, 'MINING-SHOVEL_BUCKET_ORE');
  const animationGroup = {
    name: `anim-${url}`,
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
  };
  return {
    rootNodes: [root],
    animationGroups: [animationGroup],
    addAllToScene: vi.fn(),
    dispose: vi.fn(),
  };
}

async function createMobile() {
  const engine = new NullEngine({ renderWidth: 32, renderHeight: 32 });
  const scene = new Scene(engine);
  scene.useRightHandedSystem = true;
  const mobile = createBabylonMobileEquipmentSystem({
    scene,
    loadContainer: async (url) => fakeContainer(scene, url),
  });
  await mobile.ready;
  return { engine, scene, mobile };
}

function dispose({ engine, scene, mobile }) {
  mobile.dispose();
  scene.dispose();
  engine.dispose();
}

function snapshot(mobile) {
  return {
    elapsed: mobile.elapsedSeconds,
    trucks: mobile.trucks.map((truck) => ({
      position: truck.root.position.asArray(),
      rotation: truck.root.rotation.asArray(),
      wheel: truck.wheelAssemblies[0].spinPivot.rotation.z,
      dump: truck.dumpPivot.rotation.z,
    })),
    loader: {
      position: mobile.loader.root.position.asArray(),
      articulation: mobile.loader.articulation.rotation.y,
      arm: mobile.loader.armPivot.rotation.z,
      bucket: mobile.loader.bucketPivot.rotation.z,
      wheel: mobile.loader.wheels[0].rotation.z,
    },
    excavator: {
      upper: mobile.excavator.upper.rotation.y,
      boom: mobile.excavator.boomPivot.rotation.z,
      stick: mobile.excavator.stickPivot.rotation.z,
      bucket: mobile.excavator.bucketPivot.rotation.z,
    },
  };
}

describe('Babylon V31 mobile equipment parity', () => {
  it('creates the authoritative V30 fleet with three staggered ROAD-01 trucks, shovel and LOADER-01', async () => {
    const context = await createMobile();
    const { mobile } = context;
    expect(BABYLON_MOBILE_EQUIPMENT_IDS).toEqual([
      'TRUCK-01', 'TRUCK-02', 'TRUCK-03', 'EXCAVATOR-01', 'LOADER-01',
    ]);
    expect(BABYLON_TRUCK_PHASE_OFFSETS_SECONDS).toEqual([0, 34, 68]);
    expect(BABYLON_TRUCK_TIMINGS).toEqual({
      loading: 10, haul: 40, dump: 8, romTurnaround: 5, return: 35, pitTurnaround: 5,
    });
    expect(mobile.trucks.map((truck) => truck.id)).toEqual(['TRUCK-01', 'TRUCK-02', 'TRUCK-03']);
    expect(mobile.root.metadata.animatedTruckCount).toBe(3);
    expect(mobile.trucks.every((truck) => truck.root.metadata.routeId === 'ROAD-01')).toBe(true);

    const initial = mobile.trucks.map((truck) => truck.root.position.clone());
    expect(VectorDistance(initial[0], initial[1])).toBeGreaterThan(20);
    expect(VectorDistance(initial[1], initial[2])).toBeGreaterThan(20);
    expect(VectorDistance(initial[0], initial[2])).toBeGreaterThan(20);

    expect(mobile.excavator.root.position.x).toBe(SUPPORT_LAYOUT.truckLoad.x + 10);
    expect(mobile.excavator.root.position.z).toBe(SUPPORT_LAYOUT.truckLoad.z - 2);
    expect(mobile.excavator.root.position.y).toBeCloseTo(
      getTerrainHeight(SUPPORT_LAYOUT.truckLoad.x + 10, SUPPORT_LAYOUT.truckLoad.z - 2),
      12,
    );
    expect(mobile.loader.root.position.y - getTerrainHeight(mobile.loader.root.position.x, mobile.loader.root.position.z))
      .toBeCloseTo(0.04, 10);
    dispose(context);
  });

  it('preserves V30 semantic pivot axes for truck, shovel and loader', async () => {
    const context = await createMobile();
    const { mobile } = context;
    const truck = mobile.truck;
    expect(truck.dumpPivot.metadata).toMatchObject({ dumpHinge: 'rear', dumpAxis: 'local-z', dumpDirection: 'rearward' });
    expect(truck.wheelAssemblies[0].steerPivot.metadata.rotationAxis).toBe('y');
    expect(truck.wheelAssemblies[0].spinPivot.metadata.rotationAxis).toBe('z');
    expect(mobile.excavator.upper.metadata.rotationAxis).toBe('y');
    expect(mobile.excavator.boomPivot.metadata.rotationAxis).toBe('z');
    expect(mobile.excavator.stickPivot.metadata.rotationAxis).toBe('z');
    expect(mobile.excavator.bucketPivot.metadata.rotationAxis).toBe('z');
    expect(mobile.loader.articulation.metadata.rotationAxis).toBe('y');
    expect(mobile.loader.armPivot.metadata.rotationAxis).toBe('z');
    expect(mobile.loader.bucketPivot.metadata.rotationAxis).toBe('z');
    expect(mobile.loader.wheels.every((wheel) => wheel.metadata.rotationAxis === 'z')).toBe(true);
    dispose(context);
  });

  it('keeps all three trucks on the engineered ROAD-01 surface and lets each reach the ROM dump phase', async () => {
    const context = await createMobile();
    const { mobile } = context;
    const dumped = new Set();
    for (let step = 0; step < 1100; step += 1) {
      mobile.update(0.1);
      mobile.trucks.forEach((truck) => {
        if (truck.root.metadata.operationalState === 'dumping-at-rom') dumped.add(truck.id);
        const terrainY = getTerrainHeight(truck.root.position.x, truck.root.position.z);
        expect(truck.root.position.y).toBeGreaterThanOrEqual(terrainY - 0.02);
        expect(truck.root.position.y - terrainY).toBeLessThan(0.35);
      });
    }
    expect([...dumped].sort()).toEqual(['TRUCK-01', 'TRUCK-02', 'TRUCK-03']);
    dispose(context);
  });

  it('drives wheels from actual travel and mirrors the truck dump/steer/spin semantic nodes', async () => {
    const context = await createMobile();
    const { mobile } = context;
    const truck = mobile.truck;
    const beforeWheel = truck.wheelAssemblies[0].spinPivot.rotation.z;
    for (let step = 0; step < 110; step += 1) mobile.update(0.1);
    expect(Math.abs(truck.wheelAssemblies[0].spinPivot.rotation.z - beforeWheel)).toBeGreaterThan(0.05);

    while (mobile.elapsedSeconds < 54) mobile.update(0.1);
    expect(truck.root.metadata.operationalState).toBe('dumping-at-rom');
    expect(truck.dumpPivot.rotation.z).toBeGreaterThan(40 * Math.PI / 180);
    const importedDump = truck.visual.rootNodes[0].getDescendants(false).find((node) => node.name === 'HAUL-TRUCK_DUMP_PIVOT');
    const importedSpin = truck.visual.rootNodes[0].getDescendants(false).find((node) => node.name === 'HAUL-TRUCK_WHEEL_SPIN_FL');
    expect(importedDump.rotation.z).toBeCloseTo(truck.dumpPivot.rotation.z, 10);
    expect(importedSpin.rotation.z).toBeCloseTo(truck.wheelAssemblies[0].spinPivot.rotation.z, 10);
    dispose(context);
  });

  it('freezes the whole fleet with Animaciones OFF and resumes from the same elapsed state', async () => {
    const context = await createMobile();
    const { mobile } = context;
    for (let step = 0; step < 115; step += 1) mobile.update(0.1);
    mobile.setEnabled(false);
    const frozen = snapshot(mobile);
    for (let step = 0; step < 40; step += 1) mobile.update(0.1);
    expect(snapshot(mobile)).toEqual(frozen);
    expect(mobile.visuals.every((visual) => visual.animationsEnabled === false)).toBe(true);

    mobile.setEnabled(true);
    mobile.update(0.1);
    expect(mobile.elapsedSeconds).toBeCloseTo(frozen.elapsed + 0.1, 12);
    expect(snapshot(mobile)).not.toEqual(frozen);
    expect(mobile.trucks.every((truck) => truck.visual.animationsEnabled === false)).toBe(true);
    expect(mobile.excavator.visual.animationsEnabled).toBe(true);
    expect(mobile.loader.visual.animationsEnabled).toBe(true);
    dispose(context);
  });

  it('keeps the Babylon mobile module renderer-specific without Three, fog or solver coupling', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const source = fs.readFileSync(path.resolve(here, '../../src/babylon/mobile/mobileEquipmentSystem.js'), 'utf8');
    expect(source).not.toMatch(/from\s+['"]three(?:\/|['"])/i);
    expect(source).not.toMatch(/\bTHREE\b/);
    expect(source).not.toMatch(/\bfog\b/i);
    expect(source).not.toMatch(/from\s+['"][^'"]*(?:solver|rheolog|hydraulic)/i);
  });
});

function VectorDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}
