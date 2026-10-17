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
