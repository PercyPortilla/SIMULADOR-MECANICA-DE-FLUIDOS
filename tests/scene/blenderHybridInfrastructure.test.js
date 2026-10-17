import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createConveyorAsset } from '../../src/equipment/conveying/conveyor.js';
import { createEquipmentSystem } from '../../src/scene/equipment/equipmentSystem.js';
import { createPipingEngine } from '../../src/scene/piping/pipingEngine.js';
import { BLENDER_MODULE_URLS } from '../../src/scene/integration/blenderModuleLibrary.js';

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
    expect(asset.root.getObjectByName('conveyor-belt')).toBeTruthy();
    expect(asset.root.getObjectByName('blender-conveyor-head-station')?.userData.blenderModuleStatus).toBe('ssr-skip');
    expect(asset.root.getObjectByName('blender-conveyor-tail-station')?.userData.blenderModuleStatus).toBe('ssr-skip');
    expect(asset.root.getObjectByName('blender-conveyor-discharge-hood')).toBeTruthy();
    expect(asset.root.userData.blenderHybridIdlerCount).toBeGreaterThan(0);
    expect(asset.root.userData.inclineCleatCount).toBeGreaterThan(0);
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
