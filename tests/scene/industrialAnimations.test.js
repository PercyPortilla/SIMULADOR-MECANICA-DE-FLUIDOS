import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createBaseScene } from '../../src/scene/baseEnvironment.js';
import { createIntegratedAnimations } from '../../src/scene/integration/integratedAnimations.js';

describe('industrial animations', () => {
  it('creates moderate visual animation targets without changing calculations', () => {
    const scene = createBaseScene();
    expect(scene.industrialAnimations).toBeTruthy();
    expect(scene.industrialAnimations.conveyorMarkerCount).toBeGreaterThanOrEqual(3);
    expect(scene.industrialAnimations.pipeMarkerCount).toBeGreaterThanOrEqual(1);
    expect(scene.industrialAnimations.beltFlowCount).toBeGreaterThanOrEqual(3);
    expect(scene.industrialAnimations.mineralSystemCount).toBeGreaterThanOrEqual(3);
    const before = scene.industrialAnimations.elapsedSeconds;
    scene.industrialAnimations.update(0.05);
    expect(scene.industrialAnimations.elapsedSeconds).toBeGreaterThan(before);
    const mineral = scene.environmentRoot.getObjectByName('CV-01-FEEDER-TO-CRUSHER')
      ?.getObjectByName('conveyor-ore-0');
    expect(mineral).toBeTruthy();
    const chute = scene.environmentRoot.getObjectByName('ROM-TO-FEEDER-CHUTE');
    const chuteOre = chute?.getObjectByName('rom-feeder-chute-ore-0');
    expect(chute?.userData.animatedOreCount).toBeGreaterThan(0);
    expect(chute?.getObjectByName('rom-feeder-chute-liner-floor')).toBeTruthy();
    expect(chute?.getObjectByName('rom-feeder-chute-left-wall')).toBeTruthy();
    expect(chute?.getObjectByName('rom-feeder-chute-right-wall')).toBeTruthy();
    expect(chuteOre).toBeTruthy();
    const mineralXBeforePause = mineral.position.x;
    const chuteOreXBeforePause = chuteOre.position.x;

    scene.industrialAnimations.setEnabled(false);
    const paused = scene.industrialAnimations.elapsedSeconds;
    scene.industrialAnimations.update(0.05);
    expect(scene.industrialAnimations.elapsedSeconds).toBe(paused);
    expect(mineral.position.x).toBe(mineralXBeforePause);
    expect(chuteOre.position.x).toBe(chuteOreXBeforePause);
    expect(scene.industrialAnimations.enabled).toBe(false);

    scene.industrialAnimations.setEnabled(true);
    expect(scene.industrialAnimations.enabled).toBe(true);
    scene.industrialAnimations.update(0.05);
    expect(scene.industrialAnimations.elapsedSeconds).toBeGreaterThan(paused);
    expect(mineral.position.x).not.toBe(mineralXBeforePause);
    expect(chuteOre.position.x).not.toBe(chuteOreXBeforePause);
  });
});

it('reconstruye marcadores de flujo al refrescar Pipe 1 sin acumular referencias stale', () => {
  const base = createBaseScene();
  const previousPipeMarkers = base.industrialAnimations.pipeMarkerCount;

  base.pipe1System.update({
    innerDiameterM: 0.05,
    lengthM: 3,
    roughnessM: 0,
    material: 'steel',
    velocityMps: 1,
  });
  base.leachingTrainPiping.refresh();
  base.industrialAnimations.refreshRoutes();

  expect(base.industrialAnimations.pipeMarkerCount).toBe(previousPipeMarkers);
  const afterFirstRefresh = base.industrialAnimations.pipeMarkerCount;
  base.industrialAnimations.refreshRoutes();
  expect(base.industrialAnimations.pipeMarkerCount).toBe(afterFirstRefresh);
});

it('scales visual pipe flow from derived process flow without changing calculations', () => {
  const base = createBaseScene();
  base.industrialAnimations.setProcessMetrics({ flowRateM3s: 0.06, pressurePa: 120000 });
  expect(base.industrialAnimations.visualFlowScale).toBe(2);
  expect(base.integratedPiping.root.userData.processFlowRateM3s).toBe(0.06);
  expect(base.equipmentSystem.getEquipment('PUMP-01').group3D.userData.operationalState).toBe('operating');
});

it('animates only the sump liquid surface, never the whole sump equipment root', () => {
  const base = createBaseScene();
  const sump = base.equipmentSystem.getEquipment('SUMP-01').group3D;
  const liquid = sump.getObjectByName('SUMP-01-slurry');
  expect(liquid?.userData.slurrySurface).toBe(true);
  const rootPosition = sump.position.clone();
  const rootRotation = sump.rotation.clone();
  const liquidPosition = liquid.position.clone();

  base.industrialAnimations.update(0.1);

  expect(sump.position.distanceTo(rootPosition)).toBeLessThan(1e-12);
  expect(Math.abs(sump.rotation.y - rootRotation.y)).toBeLessThan(1e-12);
  expect(liquid.position.distanceTo(liquidPosition)).toBeGreaterThan(0);
});

it('adapts LOD updates to camera motion and keeps a slow safety refresh while static', () => {
  let lodCalls = 0;
  const equipmentSystem = {
    conveyors: [],
    updateAssets() {},
    updateLOD() { lodCalls += 1; },
    setAnimationsEnabled() {},
    registry: new Map(),
    getEquipment() { return null; },
  };
  const mobileEquipment = { update() {}, setEnabled() {} };
  const animations = createIntegratedAnimations({ equipmentSystem, mobileEquipment });
  const camera = new THREE.PerspectiveCamera();

  animations.update(0.016, camera);
  animations.update(0.016, camera);
  expect(lodCalls).toBe(1);

  for (let index = 0; index < 8; index += 1) animations.update(0.016, camera);
  expect(lodCalls).toBe(1);

  camera.position.x += 1;
  for (let index = 0; index < 8; index += 1) animations.update(0.016, camera);
  expect(lodCalls).toBe(2);

  for (let index = 0; index < 21; index += 1) animations.update(0.1, camera);
  expect(lodCalls).toBe(3);

  animations.setEnabled(false);
  camera.position.x += 1;
  animations.updateViewLOD(0.13, camera);
  expect(lodCalls).toBe(4);

  const alternateCamera = new THREE.PerspectiveCamera();
  animations.refreshLOD(alternateCamera);
  expect(lodCalls).toBe(5);
  expect(animations.lodUpdateIntervalSeconds).toBe(0.125);
  expect(animations.lodStationaryRefreshSeconds).toBe(2);
});

it('skips visual pipe particle and texture work when process flow is zero', () => {
  let sampledPoints = 0;
  const flowCurve = {
    getPointAt(_t, target) {
      sampledPoints += 1;
      return target.set(1, 2, 3);
    },
    getTangentAt(_t, target) {
      return target.set(1, 0, 0);
    },
  };
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  const texture = new THREE.Texture();
  const material = new THREE.PointsMaterial({ map: texture });
  material.userData.pipeFluidMaterial = true;
  const points = new THREE.Points(geometry, material);
  points.userData.pipeParticleFlow = true;
  points.userData.flowCurve = flowCurve;
  points.userData.flowProgress = new Float32Array([0.2]);
  const root = new THREE.Group();
  root.add(points);
  const equipmentSystem = {
    conveyors: [],
    updateAssets() {},
    updateLOD() {},
    setAnimationsEnabled() {},
    registry: new Map(),
    getEquipment() { return null; },
  };
  const mobileEquipment = { update() {}, setEnabled() {} };
  const animations = createIntegratedAnimations({
    equipmentSystem,
    mobileEquipment,
    pipingSystem: { root },
  });

  const progressBefore = points.userData.flowProgress[0];
  const textureOffsetBefore = texture.offset.y;
  animations.setProcessMetrics({ flowRateM3s: 0 });
  animations.update(0.05);
  expect(sampledPoints).toBe(0);
  expect(points.userData.flowProgress[0]).toBe(progressBefore);
  expect(texture.offset.y).toBe(textureOffsetBefore);

  animations.setProcessMetrics({ flowRateM3s: 0.03 });
  animations.update(0.05);
  expect(sampledPoints).toBeGreaterThan(0);
  expect(points.userData.flowProgress[0]).not.toBe(progressBefore);
  expect(texture.offset.y).not.toBe(textureOffsetBefore);

  geometry.dispose();
  material.dispose();
  texture.dispose();
});
