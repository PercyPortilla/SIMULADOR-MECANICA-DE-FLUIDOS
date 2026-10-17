import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createConveyorAsset } from '../../src/equipment/conveying/conveyor.js';
import { createEquipmentSystem } from '../../src/scene/equipment/equipmentSystem.js';
import { createPipingEngine } from '../../src/scene/piping/pipingEngine.js';
import {
  BLENDER_MODULE_URLS,
  resetBlenderModuleCacheForTests,
} from '../../src/scene/integration/blenderModuleLibrary.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const moduleRoot = path.resolve(here, '../../public/models/pulpa-blender/v15-modules');

function loadModuleGlb(filename) {
  const buffer = fs.readFileSync(path.join(moduleRoot, filename));
  const bytes = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  return new Promise((resolve, reject) => {
    new GLTFLoader().parse(bytes, '', resolve, reject);
  });
}

afterEach(() => {
  resetBlenderModuleCacheForTests();
  vi.restoreAllMocks();
  delete globalThis.window;
});

describe('V15 Blender hybrid infrastructure', () => {
  it('registers the reusable conveyor and piping module kit', () => {
    expect(Object.keys(BLENDER_MODULE_URLS)).toEqual([
      'conveyorHead',
      'conveyorTail',
      'conveyorIdler',
      'conveyorTransferHood',
      'pipeValve',
      'pipeFlange',
      'pipeSaddle',
    ]);
    Object.values(BLENDER_MODULE_URLS).forEach((url) => {
      expect(url).toMatch(/^models\/pulpa-blender\/v15-modules\/.+\.glb$/);
    });
  });

  it('keeps conveyor geometry parametric while adding Blender visual stations', () => {
    const asset = createConveyorAsset({ length: 24, width: 1.5, incline: THREE.MathUtils.degToRad(12) });
    expect(asset.root.userData.blenderHybridConveyor).toBe(true);
    expect(asset.root.userData.v23MechanicalDetail).toBe(true);
    expect(asset.root.getObjectByName('conveyor-belt')).toBeTruthy();
    expect(asset.root.getObjectByName('conveyor-v23-mechanical-detail')).toBeTruthy();
    expect(asset.root.getObjectByName('conveyor-feed-skirt-left')).toBeTruthy();
    expect(asset.root.getObjectByName('conveyor-feed-skirt-right')).toBeTruthy();
    expect(asset.root.getObjectByName('conveyor-head-belt-scraper')).toBeTruthy();
    expect(asset.root.getObjectByName('conveyor-emergency-pull-cord')).toBeTruthy();
    expect(asset.root.getObjectByName('conveyor-emergency-stop-station')).toBeTruthy();
    expect(asset.root.getObjectByName('blender-conveyor-head-station')?.userData.blenderModuleStatus).toBe('ssr-skip');
    expect(asset.root.getObjectByName('blender-conveyor-tail-station')?.userData.blenderModuleStatus).toBe('ssr-skip');
    expect(asset.root.getObjectByName('blender-conveyor-discharge-hood')).toBeTruthy();
    expect(asset.root.userData.blenderHybridIdlerCount).toBeGreaterThan(0);
    expect(asset.root.userData.inclineCleatCount).toBeGreaterThan(0);
  });

  it('preserves a visible rotating pulley cue after real Blender head/tail modules load', async () => {
    const sourceByUrl = new Map();
    for (const url of [
      BLENDER_MODULE_URLS.conveyorHead,
      BLENDER_MODULE_URLS.conveyorTail,
      BLENDER_MODULE_URLS.conveyorIdler,
      BLENDER_MODULE_URLS.conveyorTransferHood,
    ]) {
      sourceByUrl.set(url, await loadModuleGlb(path.basename(url)));
    }

    globalThis.window = {};
    vi.spyOn(GLTFLoader.prototype, 'load').mockImplementation(function mockLoad(url, onLoad) {
      onLoad(sourceByUrl.get(url));
      return this;
    });
    resetBlenderModuleCacheForTests();

    const asset = createConveyorAsset({ length: 24, width: 1.5, incline: THREE.MathUtils.degToRad(12) });
    await vi.waitFor(() => {
      expect(asset.root.getObjectByName('blender-conveyor-head-station')?.userData.blenderModuleStatus).toBe('loaded');
      expect(asset.root.getObjectByName('blender-conveyor-tail-station')?.userData.blenderModuleStatus).toBe('loaded');
    });

    for (const end of ['head', 'tail']) {
      const pivot = asset.root.getObjectByName(`conveyor-${end}-pulley-pivot`);
      const pulley = pivot.getObjectByName(`conveyor-${end}-pulley`);
      const marker = pivot.getObjectByName(`conveyor-${end}-pulley-marker`);
      expect(pulley.visible).toBe(false);
      expect(marker.visible).toBe(true);
      expect(marker.userData.hybridRotationCue).toBe(true);
      const before = pivot.rotation.z;
      asset.update(0.1);
      expect(Math.abs(pivot.rotation.z - before)).toBeGreaterThan(0.01);
    }
    expect(asset.root.getObjectByName('conveyor-drive-assembly').visible).toBe(false);
  });

  it('adds V23 conveyor detail without changing authoritative feed/discharge ports', () => {
    const angle = THREE.MathUtils.degToRad(8);
    const asset = createConveyorAsset({ length: 18, width: 1.4, incline: angle });
    const [feed, discharge] = asset.metadata.ports;
    const halfRise = Math.tan(angle) * 9;
    expect(feed.position).toEqual([-9, 2.03 - halfRise, 0]);
    expect(discharge.position).toEqual([9, 2.03 + halfRise, 0]);
    expect(asset.root.userData.v23MechanicalDetailParts).toBeGreaterThanOrEqual(6);
  });

  it('keeps route metadata authoritative while adding hybrid fittings', () => {
    const equipment = createEquipmentSystem();
    const source = equipment.getPortWorldPosition('R-01', 'outlet');
    const target = equipment.getPortWorldPosition('R-04', 'inlet');
    const engine = createPipingEngine({ equipmentSystem: equipment });
    const group = engine.renderConnection({
      id: 'HYBRID-PIPING',
      source: { equipmentId: 'R-01', portId: 'outlet' },
      target: { equipmentId: 'R-04', portId: 'inlet' },
      nominalDiameterM: 0.25,
      waypoints: [[source.x + 8, source.y, source.z], [source.x + 8, source.y, target.z]],
    });

    expect(group.userData.blenderHybridPiping).toBe(true);
    expect(group.userData.routePoints[0]).toEqual(source.toArray());
    expect(group.userData.routePoints.at(-1)).toEqual(target.toArray());
    expect(group.getObjectByName('HYBRID-PIPING-source-flange-blender')).toBeTruthy();
    expect(group.getObjectByName('HYBRID-PIPING-target-flange-blender')).toBeTruthy();
    expect(group.getObjectByName('HYBRID-PIPING-isolation-valve-blender')).toBeTruthy();
    const elbows = group.children.filter((child) => child.name.includes('elbow'));
    expect(elbows.length).toBeGreaterThan(0);
    expect(elbows.some((elbow) => elbow.geometry?.type === 'TubeGeometry')).toBe(true);
  });
});
